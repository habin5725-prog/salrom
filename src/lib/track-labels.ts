import "server-only";

import { formatServiceDate } from "./dates";
import { isUuid } from "./request-context";
import { getAdminSupabase } from "./supabase/admin";

// 접속 기록에 남길 화면 이름. 주소만으로는 알아보기 어려워 곡명, 예배 날짜를 붙인다.

const STATIC: Record<string, string> = {
  "/": "홈",
  "/week": "이번 주",
  "/library": "악보함",
  "/history": "지난 예배",
  "/settings": "설정",
  "/login": "관리자 로그인",
  "/preview": "기기별 미리보기",
  "/edit": "예배 관리",
  "/edit/new": "새 예배 만들기",
  "/admin": "관리자 화면",
  "/admin/settings": "관리자 설정",
  "/admin/songs": "곡 관리",
};

export async function labelForPath(path: string): Promise<string> {
  if (STATIC[path]) return STATIC[path];
  const [, first, id] = path.split("/");
  const admin = getAdminSupabase();
  if (!admin || !isUuid(id)) return path.slice(0, 100);

  if (first === "play") {
    const { data } = await admin
      .from("service_songs")
      .select("songs(title), services(service_date)")
      .eq("id", id)
      .maybeSingle();
    if (data?.songs) {
      const date = data.services ? ` (${formatServiceDate(data.services.service_date)} 예배)` : "";
      return `악보: ${data.songs.title}${date}`;
    }
    return "악보";
  }
  if (first === "sheet") {
    const { data } = await admin.from("sheets").select("songs(title)").eq("id", id).maybeSingle();
    return data?.songs ? `악보: ${data.songs.title} (악보함)` : "악보";
  }
  if (first === "library") {
    const { data } = await admin.from("songs").select("title").eq("id", id).maybeSingle();
    return data ? `곡 정보: ${data.title}` : "곡 정보";
  }
  if (first === "services") {
    const { data } = await admin.from("services").select("service_date, title").eq("id", id).maybeSingle();
    return data ? `예배 순서: ${formatServiceDate(data.service_date)} ${data.title}` : "예배 순서";
  }
  if (first === "edit") return "예배 편집";
  if (first === "admin") return "관리자 화면";
  return path.slice(0, 100);
}
