// 앱과 같은 조회 문장을 로컬 PostgREST에 실행해 결과 모양과 권한을 확인한다.
import crypto from "node:crypto";
import { PostgrestClient } from "@supabase/postgrest-js";

const SECRET = "local-test-secret-that-is-at-least-32-chars";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(payload) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
const client = (payload) =>
  new PostgrestClient(process.env.E2E_PGRST_URL ?? "http://localhost:3901", {
    headers: { Authorization: `Bearer ${jwt(payload)}` },
  });

const LEADER = "00000000-0000-0000-0000-00000000000b";
const visitor = client({ role: "anon" });
const leader = client({ sub: LEADER, role: "authenticated" });
const service = client({ role: "service_role" });
const today = new Date().toISOString().slice(0, 10);

let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}`);
  if (!cond) {
    failures++;
    console.log(JSON.stringify(detail, null, 2));
  }
}

// 1. 로그인 없는 방문자: 다가오는 예배와 곡 목록
const up = await visitor.from("services").select("id, service_date, title, status").gte("service_date", today)
  .order("service_date").order("created_at").limit(1).maybeSingle();
check("방문자: 다가오는 예배(공개된 것만)", !up.error && up.data?.id === "10000000-0000-0000-0000-000000000001", up);
const SETLIST_SELECT = "id, position, song_key, song_id, sheet_id, sheet_version, songs(title)";
const sl = await visitor.from("service_songs").select(SETLIST_SELECT).eq("service_id", up.data.id).order("position").order("created_at");
check("방문자: 곡 목록과 곡명", !sl.error && sl.data.length === 2 && sl.data[0].songs.title === "주님의 은혜", sl);
const drafts = await visitor.from("services").select("id").eq("status", "draft");
check("방문자: 초안 안 보임", !drafts.error && drafts.data.length === 0, drafts);

// 2. 지난 예배, 악보함, 곡 상세
const past = await visitor.from("services").select("id, service_date, title, status, service_songs(position, song_key, songs(title))")
  .lt("service_date", today).order("service_date", { ascending: false }).limit(60);
check("방문자: 지난 예배", !past.error && past.data.length === 1, past);
const lib = await visitor.from("songs").select("id, title, sheets(id)").order("title");
check("방문자: 악보함", !lib.error && lib.data.length === 2, lib);
const detail = await visitor.from("songs")
  .select("id, title, sheets(id, name, current_version, created_at, sheet_versions(version, created_at))")
  .eq("id", "20000000-0000-0000-0000-000000000001").maybeSingle();
check("방문자: 곡 상세와 파일 목록", !detail.error && detail.data.sheets[0].sheet_versions.length === 2, detail);

// 3. 방문자는 아무것도 바꿀 수 없다
const vIns = await visitor.from("services").insert({ service_date: today });
check("방문자: 예배 만들기 거부", vIns.error?.code === "42501", vIns);
const vUpd = await visitor.from("services").update({ status: "draft" }).eq("id", "10000000-0000-0000-0000-000000000001").select("id");
check("방문자: 공개 취소 거부", Boolean(vUpd.error) || vUpd.data.length === 0, vUpd);
const vAnn = await visitor.from("annotations").insert({ sheet_id: "30000000-0000-0000-0000-000000000001", sheet_version: 1, page: 1, type: "text", data: { x: 0, y: 0, text: "x" }, scope: "global" });
check("방문자: 공용 필기 거부", Boolean(vAnn.error), vAnn);
for (const table of ["app_settings", "visit_sessions", "page_views", "visitors", "access_events", "push_subscriptions", "profiles"]) {
  const r = await visitor.from(table).select("*").limit(1);
  check(`방문자: ${table} 읽기 거부`, Boolean(r.error), r);
}

// 4. 리더: 편집 화면 조회, 공개, 순서, 버전
const ed = await leader.from("service_songs")
  .select("id, position, song_key, song_id, sheet_id, sheet_version, songs(title), sheet_versions(sheets(name, current_version))")
  .eq("service_id", "10000000-0000-0000-0000-000000000001").order("position").order("created_at");
check("리더: 편집 화면 악보 정보", !ed.error && ed.data[0].sheet_versions.sheets.current_version === 2, ed);
const pub1 = await leader.from("services").update({ status: "published", published_at: new Date().toISOString() })
  .eq("id", "10000000-0000-0000-0000-000000000003").eq("status", "draft").select("id, status").maybeSingle();
const pub2 = await leader.from("services").update({ status: "published", published_at: new Date().toISOString() })
  .eq("id", "10000000-0000-0000-0000-000000000003").eq("status", "draft").select("id, status").maybeSingle();
check("리더: 첫 공개는 행 반환", !pub1.error && pub1.data?.status === "published", pub1);
check("리더: 두 번째 공개는 행 없음(알림 중복 방지)", !pub2.error && pub2.data === null, pub2);
const re = await leader.rpc("reorder_service_songs", {
  p_service_id: "10000000-0000-0000-0000-000000000001",
  p_ids: ["40000000-0000-0000-0000-000000000002", "40000000-0000-0000-0000-000000000001"],
});
const after = await leader.from("service_songs").select("id").eq("service_id", "10000000-0000-0000-0000-000000000001").order("position");
check("리더: 순서 변경", !re.error && after.data[0].id === "40000000-0000-0000-0000-000000000002", { re, after });
const ver = await leader.from("sheet_versions").insert({ sheet_id: "30000000-0000-0000-0000-000000000002", file_path: "b/2.pdf", file_size: 10 }).select("version").single();
check("리더: 새 파일 버전 번호", !ver.error && ver.data.version === 2, ver);
const g = await leader.from("annotations").insert({ sheet_id: "30000000-0000-0000-0000-000000000001", sheet_version: 1, page: 1, type: "text", data: { x: 0.1, y: 0.1, text: "후렴 2번" }, scope: "global" });
check("리더: 공용 필기 저장", !g.error, g);
const seen = await visitor.from("annotations").select("id, scope").eq("sheet_id", "30000000-0000-0000-0000-000000000001");
check("방문자: 공용 필기 보임", !seen.error && seen.data.length === 1, seen);
const lr = await leader.from("visit_sessions").select("*").limit(1);
check("리더: 접속 기록 표 직접 읽기 거부", Boolean(lr.error), lr);

// 5. 서버 키: 접속 기록과 설정
const s1 = await service.from("app_settings").upsert({ key: "probe", value: { ok: true } }, { onConflict: "key" }).select("key");
check("서버: 앱 설정 쓰기", !s1.error, s1);
const vid = crypto.randomUUID();
const v1 = await service.from("visitors").upsert({ id: vid, device: "test" }, { onConflict: "id" });
const sess = await service.from("visit_sessions").insert({ visitor_id: vid, mode: "visitor", city: "Seoul", country: "KR" }).select("id").single();
const pv = await service.from("page_views").insert({ session_id: sess.data?.id, path: "/", label: "홈" }).select("id").single();
check("서버: 접속 기록 쓰기", !v1.error && !sess.error && !pv.error, { v1, sess, pv });
const own = await service.from("page_views").select("id, session_id, visit_sessions!inner(visitor_id)").eq("id", pv.data.id).eq("visit_sessions.visitor_id", vid).maybeSingle();
const notOwn = await service.from("page_views").select("id, session_id, visit_sessions!inner(visitor_id)").eq("id", pv.data.id).eq("visit_sessions.visitor_id", crypto.randomUUID()).maybeSingle();
check("서버: 다른 기기의 기록은 고칠 수 없게 확인", own.data?.id === pv.data.id && notOwn.data === null, { own, notOwn });
const dash = await service.from("visit_sessions")
  .select("id, visitor_id, started_at, last_seen_at, mode, city, region, country, visitors(name, device), page_views(label, started_at, last_seen_at)")
  .order("started_at", { ascending: false }).limit(60);
check("서버: 관리자 화면 접속 기록 조회", !dash.error && dash.data[0].visitors.device === "test" && dash.data[0].page_views.length === 1, dash);
const del = await service.from("visit_sessions").delete().eq("id", sess.data.id);
const left = await service.from("page_views").select("id").eq("id", pv.data.id);
check("서버: 접속을 지우면 화면 기록도 지워짐", !del.error && left.data.length === 0, { del, left });

console.log(failures === 0 ? "\n모든 API 조회 확인 통과" : `\n실패 ${failures}건`);
process.exit(failures === 0 ? 0 : 1);
