// 테스트 전용: Supabase의 인증, REST, Storage 주소를 흉내 내는 작은 서버(실시간 기능은 없다).
// REST는 로컬 PostgREST로 넘기고, 인증은 정해진 테스트 계정만 받는다.
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const SECRET = "local-test-secret-that-is-at-least-32-chars";
const PGRST = process.env.E2E_PGRST_URL ?? "http://localhost:3901";
const STORAGE_DIR = process.argv[2];
const PORT = Number(process.env.E2E_SUPABASE_PORT ?? 54321);

const USERS = {
  "admin@test.kr": { id: "00000000-0000-0000-0000-00000000000a", name: "관리자" },
  "leader@test.kr": { id: "00000000-0000-0000-0000-00000000000b", name: "리더" },
  "m1@test.kr": { id: "00000000-0000-0000-0000-00000000000c", name: "건반" },
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function sign(payload) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verify(token) {
  if (!token) return null;
  const [head, body, sig] = token.split(".");
  if (!sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  if (expected !== sig) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
}

function userJson(email) {
  const u = USERS[email];
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: "2026-01-01T00:00:00Z",
    user_metadata: { name: u.name },
    app_metadata: { provider: "email", providers: ["email"] },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function session(email) {
  const now = Math.floor(Date.now() / 1000);
  const u = USERS[email];
  return {
    access_token: sign({ sub: u.id, role: "authenticated", aud: "authenticated", email, session_id: crypto.randomUUID(), iat: now, exp: now + 3600 }),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: Buffer.from(email).toString("base64url"),
    user: userJson(email),
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

const bearer = (req) => (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Type, Preference-Applied");
  if (req.method === "OPTIONS") return send(res, 204, "");

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  try {
    if (p === "/auth/v1/token") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      const grant = url.searchParams.get("grant_type");
      let email = grant === "password" ? body.email : Buffer.from(body.refresh_token || "", "base64url").toString();
      if (grant === "password" && body.password !== "password") email = null;
      if (!email || !USERS[email]) {
        return send(res, 400, { code: "invalid_credentials", error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" });
      }
      return send(res, 200, session(email));
    }
    if (p === "/auth/v1/user") {
      const claims = verify(bearer(req));
      if (!claims || !claims.email) return send(res, 401, { code: 401, msg: "invalid JWT" });
      return send(res, 200, userJson(claims.email));
    }
    if (p === "/auth/v1/logout") return send(res, 204, "");

    if (p.startsWith("/rest/v1/")) {
      const target = PGRST + p.slice("/rest/v1".length) + url.search;
      const headers = {};
      for (const h of ["authorization", "prefer", "content-type", "accept", "range", "range-unit", "accept-profile", "content-profile"]) {
        if (req.headers[h]) headers[h] = req.headers[h];
      }
      if (!headers.authorization && req.headers.apikey) headers.authorization = `Bearer ${req.headers.apikey}`;
      const body = ["GET", "HEAD"].includes(req.method) ? undefined : await readBody(req);
      const r = await fetch(target, { method: req.method, headers, body });
      const out = Buffer.from(await r.arrayBuffer());
      const pass = {};
      for (const h of ["content-type", "content-range", "preference-applied"]) {
        const v = r.headers.get(h);
        if (v) pass[h] = v;
      }
      return send(res, r.status, out, pass);
    }

    if (p.startsWith("/storage/v1/object/")) {
      const claims = verify(bearer(req));
      if (!claims || claims.role !== "authenticated") return send(res, 403, { statusCode: "403", error: "Unauthorized", message: "no" });
      const rel = decodeURIComponent(p.slice("/storage/v1/object/".length));
      const file = path.join(STORAGE_DIR, rel);
      if (!file.startsWith(STORAGE_DIR)) return send(res, 400, { message: "bad path" });
      if (req.method === "POST" || req.method === "PUT") {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, await readBody(req));
        return send(res, 200, { Key: rel, Id: crypto.randomUUID() });
      }
      if (req.method === "GET") {
        if (!fs.existsSync(file)) return send(res, 404, { statusCode: "404", error: "not_found", message: "Object not found" });
        return send(res, 200, fs.readFileSync(file), { "Content-Type": "application/pdf" });
      }
    }

    send(res, 404, { message: "not found" });
  } catch (e) {
    send(res, 500, { message: String(e) });
  }
});

server.listen(PORT, () => console.log(`fake supabase on ${PORT}`));
