import "server-only";

import { getServerSupabase } from "../supabase/server";

export type EditorItem = {
  id: string;
  position: number;
  songKey: string | null;
  songId: string;
  title: string;
  sheetId: string | null;
  sheetVersion: number | null;
  sheetName: string | null;
  /** 이 악보의 가장 최근 파일 번호. sheetVersion보다 크면 새 파일이 있다는 뜻 */
  sheetLatestVersion: number | null;
};

export type EditorService = {
  id: string;
  date: string;
  title: string;
  status: "draft" | "published";
  notifiedAt: string | null;
  items: EditorItem[];
};

export async function getEditorData(serviceId: string): Promise<EditorService | null> {
  const supabase = await getServerSupabase();
  const { data: service, error } = await supabase
    .from("services")
    .select("id, service_date, title, status, notified_at")
    .eq("id", serviceId)
    .maybeSingle();
  if (error) throw new Error(`예배를 불러오지 못했습니다: ${error.message}`);
  if (!service) return null;

  const { data: rows, error: rowsError } = await supabase
    .from("service_songs")
    .select(
      "id, position, song_key, song_id, sheet_id, sheet_version, songs(title), sheet_versions(sheets(name, current_version))",
    )
    .eq("service_id", serviceId)
    .order("position")
    .order("created_at");
  if (rowsError) throw new Error(`곡 목록을 불러오지 못했습니다: ${rowsError.message}`);

  return {
    id: service.id,
    date: service.service_date,
    title: service.title,
    status: service.status,
    notifiedAt: service.notified_at,
    items: (rows ?? []).map((row) => ({
      id: row.id,
      position: row.position,
      songKey: row.song_key,
      songId: row.song_id,
      title: row.songs?.title ?? "(삭제된 곡)",
      sheetId: row.sheet_id,
      sheetVersion: row.sheet_version,
      sheetName: row.sheet_versions?.sheets?.name ?? null,
      sheetLatestVersion: row.sheet_versions?.sheets?.current_version ?? null,
    })),
  };
}
