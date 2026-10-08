import "server-only";

import { todayISO } from "../dates";
import { getServerSupabase } from "../supabase/server";

// 화면용 조회 함수. 모든 조회는 로그인한 사용자 권한(RLS)으로 실행된다.
// 팀원에게는 공개된 예배만, 리더에게는 초안까지 돌아온다.

export type SetlistItem = {
  id: string;
  position: number;
  songKey: string | null;
  songId: string;
  title: string;
  sheetId: string | null;
  sheetVersion: number | null;
};

export type ServiceSummary = {
  id: string;
  date: string;
  title: string;
  status: "draft" | "published";
};

export type ServiceWithSetlist = ServiceSummary & { songs: SetlistItem[] };

const SETLIST_SELECT = "id, position, song_key, song_id, sheet_id, sheet_version, songs(title)" as const;

type SetlistRow = {
  id: string;
  position: number;
  song_key: string | null;
  song_id: string;
  sheet_id: string | null;
  sheet_version: number | null;
  songs: { title: string } | null;
};

function toSetlistItem(row: SetlistRow): SetlistItem {
  return {
    id: row.id,
    position: row.position,
    songKey: row.song_key,
    songId: row.song_id,
    title: row.songs?.title ?? "(삭제된 곡)",
    sheetId: row.sheet_id,
    sheetVersion: row.sheet_version,
  };
}

function toSummary(row: { id: string; service_date: string; title: string; status: "draft" | "published" }): ServiceSummary {
  return { id: row.id, date: row.service_date, title: row.title, status: row.status };
}

export async function getSetlist(serviceId: string): Promise<SetlistItem[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("service_songs")
    .select(SETLIST_SELECT)
    .eq("service_id", serviceId)
    .order("position")
    .order("created_at");
  if (error) throw new Error(`곡 목록을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []).map(toSetlistItem);
}

export async function getService(serviceId: string): Promise<ServiceWithSetlist | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("services")
    .select("id, service_date, title, status")
    .eq("id", serviceId)
    .maybeSingle();
  if (error) throw new Error(`예배를 불러오지 못했습니다: ${error.message}`);
  if (!data) return null;
  return { ...toSummary(data), songs: await getSetlist(serviceId) };
}

/** 오늘 이후 가장 가까운 예배. 없으면 null */
export async function getUpcomingService(): Promise<ServiceWithSetlist | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("services")
    .select("id, service_date, title, status")
    .gte("service_date", todayISO())
    .order("service_date")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`예배를 불러오지 못했습니다: ${error.message}`);
  if (!data) return null;
  return { ...toSummary(data), songs: await getSetlist(data.id) };
}

export type PastService = ServiceSummary & { songs: { title: string; songKey: string | null }[] };

/** 지난 예배 목록(최근 순) */
export async function listPastServices(limit = 60): Promise<PastService[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("services")
    .select("id, service_date, title, status, service_songs(position, song_key, songs(title))")
    .lt("service_date", todayISO())
    .order("service_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`지난 예배를 불러오지 못했습니다: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...toSummary(row),
    songs: [...row.service_songs]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ title: s.songs?.title ?? "", songKey: s.song_key })),
  }));
}

/** 리더용: 앞으로의 예배와 초안 목록 */
export async function listEditableServices(): Promise<ServiceSummary[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("services")
    .select("id, service_date, title, status")
    .gte("service_date", todayISO())
    .order("service_date")
    .order("created_at");
  if (error) throw new Error(`예배 목록을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []).map(toSummary);
}
