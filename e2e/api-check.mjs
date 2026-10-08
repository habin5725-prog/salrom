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
  new PostgrestClient(process.env.E2E_PGRST_URL ?? "http://localhost:3901", { headers: { Authorization: `Bearer ${jwt(payload)}` } });

const LEADER = "00000000-0000-0000-0000-00000000000b";
const MEMBER = "00000000-0000-0000-0000-00000000000c";
const member = client({ sub: MEMBER, role: "authenticated" });
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

// 1. 다가오는 예배
const up = await member.from("services").select("id, service_date, title, status").gte("service_date", today)
  .order("service_date").order("created_at").limit(1).maybeSingle();
check("팀원: 다가오는 예배", !up.error && up.data?.id === "10000000-0000-0000-0000-000000000001", up);

// 2. 곡 목록
const SETLIST_SELECT = "id, position, song_key, song_id, sheet_id, sheet_version, songs(title)";
const sl = await member.from("service_songs").select(SETLIST_SELECT).eq("service_id", up.data.id).order("position").order("created_at");
check("팀원: 곡 목록과 곡명", !sl.error && sl.data.length === 2 && sl.data[0].songs.title === "주님의 은혜" && sl.data[1].song_key === "A", sl);

// 3. 지난 예배
const past = await member.from("services").select("id, service_date, title, status, service_songs(position, song_key, songs(title))")
  .lt("service_date", today).order("service_date", { ascending: false }).limit(60);
check("팀원: 지난 예배", !past.error && past.data.length === 1 && past.data[0].service_songs[0].songs.title === "주님의 은혜", past);

// 4. 악보함
const lib = await member.from("songs").select("id, title, sheets(id)").order("title");
const usage = await member.from("service_songs").select("song_id, song_key, services(service_date, status)").limit(5000);
check("팀원: 악보함 곡", !lib.error && lib.data.length === 2 && Array.isArray(lib.data[0].sheets), lib);
check("팀원: 사용 기록에 초안 예배 없음", !usage.error && usage.data.every((r) => r.services.status === "published") && usage.data.length === 3, usage);

// 5. 곡 상세
const detail = await member.from("songs")
  .select("id, title, sheets(id, name, current_version, created_at, sheet_versions(version, created_at))")
  .eq("id", "20000000-0000-0000-0000-000000000001").maybeSingle();
check("팀원: 곡 상세와 파일 목록", !detail.error && detail.data.sheets[0].current_version === 2 && detail.data.sheets[0].sheet_versions.length === 2, detail);
const su = await member.from("service_songs").select("song_key, services(id, service_date, title, status)").eq("song_id", "20000000-0000-0000-0000-000000000001");
check("팀원: 곡 사용 기록", !su.error && su.data.length === 2, su);

// 6. 초안은 팀원에게 안 보임
const drafts = await member.from("services").select("id").eq("status", "draft");
check("팀원: 초안 안 보임", !drafts.error && drafts.data.length === 0, drafts);

// 7. 편집 화면 조회(악보 파일을 거쳐 악보 이름까지)
const ed = await leader.from("service_songs")
  .select("id, position, song_key, song_id, sheet_id, sheet_version, songs(title), sheet_versions(sheets(name, current_version))")
  .eq("service_id", "10000000-0000-0000-0000-000000000001").order("position").order("created_at");
check("리더: 편집 화면 악보 정보", !ed.error && ed.data[0].sheet_versions.sheets.name === "악보" && ed.data[0].sheet_versions.sheets.current_version === 2, ed);
const edDraft = await leader.from("service_songs")
  .select("id, songs(title), sheet_versions(sheets(name, current_version))")
  .eq("service_id", "10000000-0000-0000-0000-000000000003");
check("리더: 악보 없는 곡", !edDraft.error && edDraft.data[0].sheet_versions === null, edDraft);

// 8. 공개(초안 → 공개일 때만 행이 돌아온다)
const pub1 = await leader.from("services").update({ status: "published", published_at: new Date().toISOString() })
  .eq("id", "10000000-0000-0000-0000-000000000003").eq("status", "draft").select("id, service_date, title, status, notified_at").maybeSingle();
const pub2 = await leader.from("services").update({ status: "published", published_at: new Date().toISOString() })
  .eq("id", "10000000-0000-0000-0000-000000000003").eq("status", "draft").select("id, service_date, title, status, notified_at").maybeSingle();
check("리더: 첫 공개는 행 반환", !pub1.error && pub1.data?.status === "published", pub1);
check("리더: 두 번째 공개는 행 없음(알림 중복 방지)", !pub2.error && pub2.data === null, pub2);
const memberPub = await member.from("services").update({ status: "draft" }).eq("id", "10000000-0000-0000-0000-000000000001").select("id").maybeSingle();
check("팀원: 공개 취소 불가", !memberPub.error && memberPub.data === null, memberPub);

// 9. 순서 변경
const re = await leader.rpc("reorder_service_songs", {
  p_service_id: "10000000-0000-0000-0000-000000000001",
  p_ids: ["40000000-0000-0000-0000-000000000002", "40000000-0000-0000-0000-000000000001"],
});
const after = await leader.from("service_songs").select("id, position").eq("service_id", "10000000-0000-0000-0000-000000000001").order("position");
check("리더: 순서 변경", !re.error && after.data[0].id === "40000000-0000-0000-0000-000000000002", { re, after });

// 10. 새 파일 버전 등록(번호는 서버가 매김)
const ver = await leader.from("sheet_versions").insert({ sheet_id: "30000000-0000-0000-0000-000000000002", file_path: "b/2.pdf", file_size: 10 }).select("version").single();
check("리더: 새 파일 버전 번호", !ver.error && ver.data.version === 2, ver);

// 11. 알림 대상(관리용 키): 보내는 사람 제외, 승인된 사용자만
const targets = await service.from("push_subscriptions").select("endpoint, subscription, user_id, profiles!inner(role)")
  .neq("user_id", LEADER).in("profiles.role", ["member", "leader", "admin"]);
check("관리용: 알림 대상", !targets.error && targets.data.length === 1 && targets.data[0].profiles.role === "member", targets);

// 12. 필기
const annId = crypto.randomUUID();
const ins = await member.from("annotations").insert({ id: annId, sheet_id: "30000000-0000-0000-0000-000000000001", sheet_version: 1, page: 1, type: "pen", data: { points: [0.1, 0.1, 0.2, 0.2], color: "#000", width: 0.004 }, scope: "personal" });
const g = await leader.from("annotations").insert({ sheet_id: "30000000-0000-0000-0000-000000000001", sheet_version: 1, page: 1, type: "text", data: { x: 0.1, y: 0.1, text: "후렴 2번", size: 0.035, color: "#dc2626" }, scope: "global" });
const mine = await member.from("annotations").select("*").eq("sheet_id", "30000000-0000-0000-0000-000000000001").eq("sheet_version", 1);
const leaderSees = await leader.from("annotations").select("id, scope").eq("sheet_id", "30000000-0000-0000-0000-000000000001");
check("팀원: 개인 필기 저장", !ins.error, ins);
check("리더: 공용 필기 저장", !g.error, g);
check("팀원: 내 필기 + 공용 필기", !mine.error && mine.data.length === 2, mine);
check("리더: 다른 사람 개인 필기 안 보임", !leaderSees.error && leaderSees.data.length === 1 && leaderSees.data[0].scope === "global", leaderSees);
const badGlobal = await member.from("annotations").insert({ sheet_id: "30000000-0000-0000-0000-000000000001", sheet_version: 1, page: 1, type: "text", data: { x: 0, y: 0, text: "x" }, scope: "global" });
check("팀원: 공용 필기 거부", badGlobal.error?.code === "42501", badGlobal);

// 13. 알림 구독 저장 함수
const sub = await member.rpc("save_push_subscription", { p_endpoint: "https://push.test/m1-b", p_subscription: { endpoint: "https://push.test/m1-b" }, p_device: "iPhone" });
check("팀원: 알림 구독 저장", !sub.error, sub);

// 14. 프로필 이름 변경과 권한 상승 거부
const nm = await member.from("profiles").update({ name: "건반2", instrument: "건반" }).eq("id", MEMBER);
const esc = await member.from("profiles").update({ role: "admin" }).eq("id", MEMBER);
check("팀원: 이름 변경", !nm.error, nm);
check("팀원: 권한 상승 거부", esc.error?.code === "42501", esc);

console.log(failures === 0 ? "\n모든 API 조회 확인 통과" : `\n실패 ${failures}건`);
process.exit(failures === 0 ? 0 : 1);
