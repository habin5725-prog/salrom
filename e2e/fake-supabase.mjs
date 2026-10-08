// 테스트 전용: Supabase의 인증, REST, Storage 주소를 흉내 내는 작은 서버(실시간 기능은 없다).
// REST는 로컬 PostgREST로 넘기고, 계정은 auth.users 표(로컬 Postgres)와 메모리의 비밀번호로 다룬다.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const SECRET = "local-test-secret-that-is-at-least-32-chars";
const PGRST = process.env.E2E_PGRST_URL ?? "http://localhost:3901";
const DB_URL = process.env.E2E_DB_URL ?? "postgres://postgres:postgres@localhost:5432/salrom_e2e";
const STORAGE_DIR = process.argv[2];
const PORT = Number(process.env.E2E_SUPABASE_PORT ?? 54321);

const passwords = new Map(); // email -> password

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

const sqlText = (v) => `'${String(v).replace(/'/g, "''")}'`;
function psql(query) {
  return execFileSync("psql", [DB_URL, "-tAc", query]).toString().trim();
}

function findUser(where) {
  const row = psql(`select json_build_object('id', id, 'email', email, 'app', raw_app_meta_data, 'meta', raw_user_meta_data) from auth.users where ${where} limit 1`);
  return row ? JSON.parse(row) : null;
}

function userJson(u) {
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: "2026-01-01T00:00:00Z",
    user_metadata: u.meta ?? {},
    app_metadata: { provider: "email", ...(u.app ?? {}) },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function session(u) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: sign({ sub: u.id, role: "authenticated", aud: "authenticated", email: u.email, session_id: crypto.randomUUID(), iat: now, exp: now + 3600 }),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: Buffer.from(u.email).toString("base64url"),
    user: userJson(u),
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
const isServiceRole = (req) => verify(bearer(req))?.role === "service_role";

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Type, Preference-Applied");
  if (req.method === "OPTIONS") return send(res, 204, "");

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  try {
    // 관리용: 계정 만들기, 목록, 고치기
    if (p === "/auth/v1/admin/users" && req.method === "POST") {
      if (!isServiceRole(req)) return send(res, 401, { msg: "service role required" });
      const body = JSON.parse((await readBody(req)).toString());
      const email = String(body.email).toLowerCase();
      if (findUser(`email = ${sqlText(email)}`)) {
        return send(res, 422, { code: "email_exists", error_code: "email_exists", msg: "A user with this email address has already been registered" });
      }
      const id = crypto.randomUUID();
      psql(
        `insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values (${sqlText(id)}, ${sqlText(email)}, ${sqlText(JSON.stringify(body.user_metadata ?? {}))}, ${sqlText(JSON.stringify(body.app_metadata ?? {}))})`,
      );
      passwords.set(email, body.password);
      return send(res, 200, userJson(findUser(`id = ${sqlText(id)}`)));
    }
    if (p === "/auth/v1/admin/users" && req.method === "GET") {
      if (!isServiceRole(req)) return send(res, 401, { msg: "service role required" });
      const rows = psql(`select coalesce(json_agg(json_build_object('id', id, 'email', email, 'app', raw_app_meta_data, 'meta', raw_user_meta_data)), '[]') from auth.users`);
      return send(res, 200, { users: JSON.parse(rows).map(userJson), aud: "authenticated" });
    }
    if (p.startsWith("/auth/v1/admin/users/") && req.method === "PUT") {
      if (!isServiceRole(req)) return send(res, 401, { msg: "service role required" });
      const id = p.split("/").pop();
      const body = JSON.parse((await readBody(req)).toString());
      const user = findUser(`id = ${sqlText(id)}`);
      if (!user) return send(res, 404, { msg: "not found" });
      if (body.password) passwords.set(user.email, body.password);
      if (body.app_metadata) psql(`update auth.users set raw_app_meta_data = ${sqlText(JSON.stringify(body.app_metadata))} where id = ${sqlText(id)}`);
      return send(res, 200, userJson(findUser(`id = ${sqlText(id)}`)));
    }

    if (p === "/auth/v1/token") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      const grant = url.searchParams.get("grant_type");
      const email =
        grant === "password"
          ? String(body.email ?? "").toLowerCase()
          : Buffer.from(body.refresh_token || "", "base64url").toString();
      const user = email ? findUser(`email = ${sqlText(email)}`) : null;
      const ok = user && (grant !== "password" || passwords.get(email) === body.password);
      if (!ok) {
        return send(res, 400, { code: "invalid_credentials", error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" });
      }
      return send(res, 200, session(user));
    }
    if (p === "/auth/v1/user") {
      const claims = verify(bearer(req));
      const user = claims?.sub ? findUser(`id = ${sqlText(claims.sub)}`) : null;
      if (!user) return send(res, 401, { code: 401, msg: "invalid JWT" });
      return send(res, 200, userJson(user));
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
      const claims = verify(bearer(req) || req.headers.apikey);
      if (!claims) return send(res, 403, { statusCode: "403", error: "Unauthorized", message: "no" });
      const rel = decodeURIComponent(p.slice("/storage/v1/object/".length));
      // 여러 파일 지우기: DELETE /object/{bucket} { prefixes: [...] }
      if (req.method === "DELETE") {
        const body = JSON.parse((await readBody(req)).toString() || "{}");
        for (const prefix of body.prefixes ?? []) fs.rmSync(path.join(STORAGE_DIR, rel, prefix), { force: true });
        return send(res, 200, []);
      }
      const file = path.join(STORAGE_DIR, rel);
      if (!file.startsWith(STORAGE_DIR)) return send(res, 400, { message: "bad path" });
      if (req.method === "POST" || req.method === "PUT") {
        // 실제 Storage처럼 올리기는 로그인한(리더) 사용자만 허용한다.
        if (claims.role !== "authenticated") return send(res, 403, { statusCode: "403", error: "Unauthorized", message: "no" });
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
