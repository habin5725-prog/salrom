import "server-only";

import { formatServiceDate } from "../dates";
import { kindOfPath } from "../files";
import { getServerSupabase } from "../supabase/server";

export type ViewerSheet = { sheetId: string; version: number; filePath: string };

export type ViewerNav = { href: string; title: string } | null;

export type ViewerData = {
  title: string;
  subtitle: string;
  songKey: string | null;
  sheet: ViewerSheet | null;
  /** 지금 보고 있는 파일보다 새 파일이 있는지(악보함에서 이전 파일을 볼 때) */
  olderVersion: boolean;
  back: { href: string; label: string };
  prev: ViewerNav;
  next: ViewerNav;
  /** 다음 곡 악보를 미리 받아 둘 파일 경로 */
  prefetchPaths: string[];
};

type Row = {
  id: string;
  song_key: string | null;
  sheet_id: string | null;
  sheet_version: number | null;
  songs: { title: string } | null;
  sheet_versions: { file_path: string } | null;
};

/** 예배 순서 안에서 악보 보기: 이전 곡과 다음 곡으로 이동할 수 있다. */
export async function getPlayData(serviceSongId: string): Promise<ViewerData | null> {
  const supabase = await getServerSupabase();
  const { data: current } = await supabase
    .from("service_songs")
    .select("service_id")
    .eq("id", serviceSongId)
    .maybeSingle();
  if (!current) return null;

  const [{ data: service }, { data: rows }] = await Promise.all([
    supabase.from("services").select("id, service_date, title").eq("id", current.service_id).maybeSingle(),
    supabase
      .from("service_songs")
      .select("id, song_key, sheet_id, sheet_version, songs(title), sheet_versions(file_path)")
      .eq("service_id", current.service_id)
      .order("position")
      .order("created_at"),
  ]);
  if (!service || !rows) return null;

  const list = rows as Row[];
  const index = list.findIndex((r) => r.id === serviceSongId);
  if (index < 0) return null;
  const row = list[index];
  const before = list[index - 1];
  const after = list[index + 1];
  const titleOf = (r: Row) => r.songs?.title ?? "(삭제된 곡)";

  return {
    title: titleOf(row),
    subtitle: `${index + 1}/${list.length} · ${formatServiceDate(service.service_date)}`,
    songKey: row.song_key,
    sheet:
      row.sheet_id && row.sheet_version && row.sheet_versions
        ? { sheetId: row.sheet_id, version: row.sheet_version, filePath: row.sheet_versions.file_path }
        : null,
    olderVersion: false,
    back: { href: `/services/${service.id}`, label: "곡 목록" },
    prev: before ? { href: `/play/${before.id}`, title: titleOf(before) } : null,
    next: after ? { href: `/play/${after.id}`, title: titleOf(after) } : null,
    // 다음 곡이 PDF 악보일 때만 미리 받아 둔다(음원이나 문서는 열 때 받는다).
    prefetchPaths:
      after?.sheet_versions && kindOfPath(after.sheet_versions.file_path) === "pdf" ? [after.sheet_versions.file_path] : [],
  };
}

/** 악보함에서 악보 보기. version이 없으면 가장 최근 파일 */
export async function getSheetViewData(sheetId: string, version: number | null): Promise<ViewerData | null> {
  const supabase = await getServerSupabase();
  const { data: sheet } = await supabase
    .from("sheets")
    .select("id, name, current_version, song_id, songs(title)")
    .eq("id", sheetId)
    .maybeSingle();
  if (!sheet || sheet.current_version < 1) return null;

  const wanted = version && version >= 1 && version <= sheet.current_version ? version : sheet.current_version;
  const { data: file } = await supabase
    .from("sheet_versions")
    .select("version, file_path")
    .eq("sheet_id", sheetId)
    .eq("version", wanted)
    .maybeSingle();
  if (!file) return null;

  const older = file.version < sheet.current_version;
  return {
    title: sheet.songs?.title ?? sheet.name,
    subtitle: older ? `${sheet.name} · 이전 파일(${file.version}번째)` : sheet.name,
    songKey: null,
    sheet: { sheetId: sheet.id, version: file.version, filePath: file.file_path },
    olderVersion: older,
    back: { href: `/library/${sheet.song_id}`, label: "곡 정보" },
    prev: null,
    next: null,
    prefetchPaths: [],
  };
}
