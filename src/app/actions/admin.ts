"use server";

import { getViewer } from "@/lib/auth";
import { formatServiceDate } from "@/lib/dates";
import { canManageSite } from "@/lib/permissions";
import { isUuid } from "@/lib/request-context";
import { changeCode, type CodeRole } from "@/lib/settings";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { SHEETS_BUCKET } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";

export type AdminResult = { ok: boolean; message: string };

async function isAdmin(): Promise<boolean> {
  return canManageSite((await getViewer()).role);
}

/** 리더 또는 총 관리자 비밀번호 바꾸기 */
export async function changeCodeAction(role: CodeRole, code: string, confirm: string): Promise<AdminResult> {
  if (!(await isAdmin())) return { ok: false, message: "총 관리자만 바꿀 수 있습니다." };
  if (role !== "leader" && role !== "admin") return { ok: false, message: "잘못된 요청입니다." };
  if (code !== confirm) return { ok: false, message: "두 번 입력한 비밀번호가 다릅니다." };
  return changeCode(role, code.trim());
}

/** 오래된 접속 기록 지우기(days일보다 오래된 것). 0이면 전부 */
export async function deleteOldLogs(days: number): Promise<AdminResult> {
  if (!(await isAdmin())) return { ok: false, message: "총 관리자만 지울 수 있습니다." };
  const admin = getAdminSupabase();
  if (!admin) return { ok: false, message: "서버 키가 없습니다." };
  const before = new Date(Date.now() - Math.max(0, days) * 86_400_000).toISOString();
  // 접속(visit_sessions)을 지우면 그 안의 화면 기록(page_views)도 함께 지워진다.
  const [sessions, events] = await Promise.all([
    admin.from("visit_sessions").delete().lt("started_at", before),
    admin.from("access_events").delete().lt("created_at", before),
  ]);
  if (sessions.error || events.error) return { ok: false, message: "지우지 못했습니다." };
  return { ok: true, message: days > 0 ? `${days}일보다 오래된 기록을 지웠습니다.` : "기록을 모두 지웠습니다." };
}

/** 곡 이름 바꾸기 */
export async function renameSong(songId: string, title: string): Promise<AdminResult> {
  if (!(await isAdmin())) return { ok: false, message: "총 관리자만 바꿀 수 있습니다." };
  const clean = title.trim().slice(0, 100);
  if (!isUuid(songId) || !clean) return { ok: false, message: "곡명을 입력해 주세요." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("songs").update({ title: clean }).eq("id", songId);
  return error ? { ok: false, message: "바꾸지 못했습니다." } : { ok: true, message: "곡명을 바꿨습니다." };
}

export type DeleteSongResult = AdminResult & {
  /** 예배 순서에 쓰인 곡이라 한 번 더 확인이 필요하다. */
  needsConfirm?: boolean;
};

/**
 * 곡 삭제(악보, 모든 파일, 공용 필기 포함). 되돌릴 수 없다.
 * 예배 순서에 쓰인 곡은 force 없이 부르면 쓰인 곳을 알려 주고, force 로 다시 부르면 그 예배 순서에서도 뺀다.
 */
export async function deleteSong(songId: string, force = false): Promise<DeleteSongResult> {
  if (!(await isAdmin())) return { ok: false, message: "총 관리자만 지울 수 있습니다." };
  if (!isUuid(songId)) return { ok: false, message: "잘못된 요청입니다." };
  const supabase = await getServerSupabase();

  const { data: uses, error: usesError } = await supabase
    .from("service_songs")
    .select("id, services(service_date, title)")
    .eq("song_id", songId);
  if (usesError) return { ok: false, message: "지우지 못했습니다. 잠시 후 다시 시도해 주세요." };
  if (uses.length > 0 && !force) {
    const dates = [...new Set(uses.flatMap((u) => (u.services ? [formatServiceDate(u.services.service_date)] : [])))];
    const shown = dates.slice(0, 3).join(", ") + (dates.length > 3 ? ` 외 ${dates.length - 3}곳` : "");
    return {
      ok: false,
      needsConfirm: true,
      message: `이 곡은 예배 순서(${shown})에 들어 있습니다. 지우면 그 예배 순서에서도 빠집니다.`,
    };
  }
  if (uses.length > 0) {
    const { error } = await supabase.from("service_songs").delete().eq("song_id", songId);
    if (error) return { ok: false, message: "예배 순서에서 빼지 못했습니다." };
  }

  const { data: versions } = await supabase
    .from("sheet_versions")
    .select("file_path, sheets!inner(song_id)")
    .eq("sheets.song_id", songId);
  const paths = (versions ?? []).map((v) => v.file_path);
  if (paths.length > 0) await supabase.storage.from(SHEETS_BUCKET).remove(paths);

  const { error } = await supabase.from("songs").delete().eq("id", songId);
  return error ? { ok: false, message: "지우지 못했습니다." } : { ok: true, message: "곡을 지웠습니다." };
}
