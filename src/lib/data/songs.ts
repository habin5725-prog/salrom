import "server-only";

import { kindOfPath, type FileKind } from "../files";
import { getServerSupabase } from "../supabase/server";

export type LibrarySong = {
  id: string;
  title: string;
  sheetCount: number;
  lastUsed: { date: string; songKey: string | null } | null;
};

/** 악보함 전체 곡. 검색은 화면에서 한다(팀 규모상 곡 수가 많지 않다). */
export async function listLibrarySongs(): Promise<LibrarySong[]> {
  const supabase = await getServerSupabase();
  const [songsResult, usageResult] = await Promise.all([
    supabase.from("songs").select("id, title, sheets(id)").order("title"),
    supabase
      .from("service_songs")
      .select("song_id, song_key, services(service_date, status)")
      .limit(5000),
  ]);
  if (songsResult.error) throw new Error(`악보함을 불러오지 못했습니다: ${songsResult.error.message}`);

  const lastUsed = new Map<string, { date: string; songKey: string | null }>();
  for (const row of usageResult.data ?? []) {
    const service = row.services;
    if (!service || service.status !== "published") continue;
    const prev = lastUsed.get(row.song_id);
    if (!prev || prev.date < service.service_date) {
      lastUsed.set(row.song_id, { date: service.service_date, songKey: row.song_key });
    }
  }

  return (songsResult.data ?? []).map((song) => ({
    id: song.id,
    title: song.title,
    sheetCount: song.sheets.length,
    lastUsed: lastUsed.get(song.id) ?? null,
  }));
}

export type SongSheet = {
  id: string;
  name: string;
  currentVersion: number;
  /** 가장 최근 파일의 종류(악보 PDF, 음원, 문서 등) */
  kind: FileKind;
  versions: { version: number; createdAt: string; kind: FileKind }[];
};

export type SongDetail = {
  id: string;
  title: string;
  sheets: SongSheet[];
  usage: { serviceId: string; date: string; title: string; songKey: string | null }[];
};

export async function getSongDetail(songId: string): Promise<SongDetail | null> {
  const supabase = await getServerSupabase();
  const { data: song, error } = await supabase
    .from("songs")
    .select("id, title, sheets(id, name, current_version, created_at, sheet_versions(version, created_at, file_path))")
    .eq("id", songId)
    .maybeSingle();
  if (error) throw new Error(`곡을 불러오지 못했습니다: ${error.message}`);
  if (!song) return null;

  const { data: usageRows } = await supabase
    .from("service_songs")
    .select("song_key, services(id, service_date, title, status)")
    .eq("song_id", songId);

  const usage = (usageRows ?? [])
    .flatMap((row) =>
      row.services && row.services.status === "published"
        ? [{ serviceId: row.services.id, date: row.services.service_date, title: row.services.title, songKey: row.song_key }]
        : [],
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    id: song.id,
    title: song.title,
    sheets: [...song.sheets]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((sheet) => {
        const versions = sheet.sheet_versions
          .map((v) => ({ version: v.version, createdAt: v.created_at, kind: kindOfPath(v.file_path) }))
          .sort((a, b) => b.version - a.version);
        return {
          id: sheet.id,
          name: sheet.name,
          currentVersion: sheet.current_version,
          kind: versions.find((v) => v.version === sheet.current_version)?.kind ?? "pdf",
          versions,
        };
      }),
    usage,
  };
}
