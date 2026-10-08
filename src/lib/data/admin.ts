import "server-only";

import { connection } from "next/server";
import { addDays, todayISO } from "../dates";
import { getAdminSupabase } from "../supabase/admin";

// 총 관리자 화면용 조회. 접속 기록 표는 브라우저에서 읽을 수 없으므로 서버 키로 읽는다.
// 이 함수들을 부르기 전에 반드시 총 관리자인지 확인한다(getAdmin).

const LIVE_WINDOW_MS = 2 * 60_000;

const COUNTRY: Record<string, string> = { KR: "대한민국", US: "미국", JP: "일본", CN: "중국", CA: "캐나다", AU: "호주" };

export function placeText(city: string | null, region: string | null, country: string | null): string {
  const parts = [city, country ? (COUNTRY[country] ?? country) : null].filter(Boolean);
  if (parts.length === 0 && region) return region;
  return parts.length > 0 ? parts.join(", ") : "알 수 없음";
}

/** 머문 시간(분). 1분이 안 되면 0 */
export function minutesBetween(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
}

export function durationText(minutes: number): string {
  if (minutes < 1) return "1분 미만";
  if (minutes < 60) return `${minutes}분`;
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

const MODE_LABEL = { visitor: "방문", leader: "리더 모드", admin: "총 관리자" } as const;
export function modeText(mode: keyof typeof MODE_LABEL): string {
  return MODE_LABEL[mode];
}

export type VisitRow = {
  id: string;
  visitorId: string;
  who: string;
  device: string;
  startedAt: string;
  lastSeenAt: string;
  minutes: number;
  place: string;
  mode: "visitor" | "leader" | "admin";
  views: { label: string; startedAt: string; minutes: number }[];
};

type RawSession = {
  id: string;
  visitor_id: string;
  started_at: string;
  last_seen_at: string;
  mode: "visitor" | "leader" | "admin";
  city: string | null;
  region: string | null;
  country: string | null;
  visitors: { name: string | null; device: string | null } | null;
  page_views: { label: string; started_at: string; last_seen_at: string }[];
};

const SESSION_SELECT =
  "id, visitor_id, started_at, last_seen_at, mode, city, region, country, visitors(name, device), page_views(label, started_at, last_seen_at)";

function toVisit(row: RawSession): VisitRow {
  return {
    id: row.id,
    visitorId: row.visitor_id,
    who: row.visitors?.name || "이름 없음",
    device: row.visitors?.device || "알 수 없는 기기",
    startedAt: row.started_at,
    lastSeenAt: row.last_seen_at,
    minutes: minutesBetween(row.started_at, row.last_seen_at),
    place: placeText(row.city, row.region, row.country),
    mode: row.mode,
    views: [...row.page_views]
      .sort((a, b) => a.started_at.localeCompare(b.started_at))
      .map((v) => ({ label: v.label, startedAt: v.started_at, minutes: minutesBetween(v.started_at, v.last_seen_at) })),
  };
}

export type Dashboard = {
  live: VisitRow[];
  todayVisitors: number;
  weekVisitors: number;
  recent: VisitRow[];
  topSheets: { label: string; minutes: number; views: number }[];
  events: { id: string; createdAt: string; kind: string; detail: string | null; who: string; place: string }[];
};

/** 한국 시간 자정(예: 2026-10-08T00:00:00+09:00) */
function seoulMidnight(iso: string): string {
  return `${iso}T00:00:00+09:00`;
}

export async function getDashboard(): Promise<Dashboard> {
  await connection();
  const admin = getAdminSupabase();
  if (!admin) throw new Error("서버 키가 없습니다.");
  const now = Date.now();
  const today = todayISO();

  const [live, recent, week, sheetViews, events] = await Promise.all([
    admin
      .from("visit_sessions")
      .select(SESSION_SELECT)
      .gte("last_seen_at", new Date(now - LIVE_WINDOW_MS).toISOString())
      .order("last_seen_at", { ascending: false }),
    admin.from("visit_sessions").select(SESSION_SELECT).order("started_at", { ascending: false }).limit(60),
    admin
      .from("visit_sessions")
      .select("visitor_id, started_at")
      .gte("started_at", new Date(seoulMidnight(addDays(today, -6))).toISOString())
      .limit(5000),
    admin
      .from("page_views")
      .select("label, started_at, last_seen_at")
      .like("label", "악보:%")
      .gte("started_at", new Date(now - 30 * 86_400_000).toISOString())
      .limit(10000),
    admin
      .from("access_events")
      .select("id, created_at, kind, detail, visitor_id, city, region, country")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const todayStart = new Date(seoulMidnight(today)).getTime();
  const weekRows = week.data ?? [];
  const todayVisitors = new Set(
    weekRows.filter((r) => new Date(r.started_at).getTime() >= todayStart).map((r) => r.visitor_id),
  ).size;
  const weekVisitors = new Set(weekRows.map((r) => r.visitor_id)).size;

  const sheetTotals = new Map<string, { minutes: number; views: number }>();
  for (const v of sheetViews.data ?? []) {
    // 같은 곡을 다른 예배에서 본 것도 합친다(괄호 앞 곡명 기준).
    const label = v.label.replace(/\s*\(.*\)$/, "");
    const entry = sheetTotals.get(label) ?? { minutes: 0, views: 0 };
    entry.minutes += minutesBetween(v.started_at, v.last_seen_at);
    entry.views += 1;
    sheetTotals.set(label, entry);
  }

  const eventRows = events.data ?? [];
  const visitorIds = [...new Set(eventRows.map((e) => e.visitor_id).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (visitorIds.length > 0) {
    const { data } = await admin.from("visitors").select("id, name, device").in("id", visitorIds);
    for (const v of data ?? []) names.set(v.id, v.name || v.device || "이름 없음");
  }

  return {
    live: ((live.data ?? []) as RawSession[]).map(toVisit),
    todayVisitors,
    weekVisitors,
    recent: ((recent.data ?? []) as RawSession[]).map(toVisit),
    topSheets: [...sheetTotals.entries()]
      .map(([label, v]) => ({ label: label.replace(/^악보:\s*/, ""), ...v }))
      .sort((a, b) => b.minutes - a.minutes || b.views - a.views)
      .slice(0, 10),
    events: eventRows.map((e) => ({
      id: e.id,
      createdAt: e.created_at,
      kind: e.kind,
      detail: e.detail,
      who: (e.visitor_id && names.get(e.visitor_id)) || "알 수 없는 기기",
      place: placeText(e.city, e.region, e.country),
    })),
  };
}

export async function getVisit(id: string): Promise<VisitRow | null> {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const { data } = await admin.from("visit_sessions").select(SESSION_SELECT).eq("id", id).maybeSingle();
  return data ? toVisit(data as RawSession) : null;
}

/** 한 기기의 지난 접속들 */
export async function getVisitorHistory(visitorId: string): Promise<VisitRow[]> {
  const admin = getAdminSupabase();
  if (!admin) return [];
  const { data } = await admin
    .from("visit_sessions")
    .select(SESSION_SELECT)
    .eq("visitor_id", visitorId)
    .order("started_at", { ascending: false })
    .limit(30);
  return ((data ?? []) as RawSession[]).map(toVisit);
}

export const EVENT_LABEL: Record<string, string> = {
  login_success: "관리 모드 들어옴",
  login_fail: "비밀번호 틀림",
  logout: "관리 모드 나감",
  publish: "찬양 공개",
  notify: "변경 알림 보냄",
  setup: "사이트 준비",
};
