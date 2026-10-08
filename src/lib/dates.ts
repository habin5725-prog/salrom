// 날짜는 데이터베이스에 'YYYY-MM-DD' 문자열(date)로 저장하고 한국 시간 기준으로 다룬다.

export const APP_TIME_ZONE = "Asia/Seoul";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 한국 시간 기준 오늘 날짜 'YYYY-MM-DD' */
export function todayISO(now: Date = new Date()): string {
  // en-CA 형식은 YYYY-MM-DD 이다.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parseISO(iso: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`날짜 형식이 올바르지 않습니다: ${iso}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 요일 번호(0=일요일) */
export function weekdayOf(iso: string): number {
  const { y, m, d } = parseISO(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseISO(iso);
  return toISO(new Date(Date.UTC(y, m - 1, d + days)));
}

/** 오늘이 주일이면 오늘, 아니면 다가오는 주일 */
export function upcomingSundayISO(fromISO: string): string {
  const weekday = weekdayOf(fromISO);
  return addDays(fromISO, weekday === 0 ? 0 : 7 - weekday);
}

/** '10월 11일 (일)' 형식. withYear면 '2026년 10월 11일 (일)' */
export function formatServiceDate(iso: string, options: { withYear?: boolean } = {}): string {
  const { y, m, d } = parseISO(iso);
  const weekday = WEEKDAYS[weekdayOf(iso)];
  const base = `${m}월 ${d}일 (${weekday})`;
  return options.withYear ? `${y}년 ${base}` : base;
}

/** 오늘 기준 짧은 안내 문구: '오늘', '내일', '3일 후', '지난 예배' */
export function relativeDayLabel(iso: string, today: string): string {
  const a = parseISO(iso);
  const b = parseISO(today);
  const diff = Math.round(
    (Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86_400_000,
  );
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff > 1) return `${diff}일 후`;
  return "지난 예배";
}

/** 시각 표시: '10월 8일 (목) 오후 2:30' (한국 시간) */
export function formatDateTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const day = todayISO(date);
  const time = new Intl.DateTimeFormat("ko-KR", { timeZone: APP_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(date);
  return `${formatServiceDate(day)} ${time}`;
}

/** 시각만: '오후 2:30' (한국 시간) */
export function formatTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: APP_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(
    new Date(isoTimestamp),
  );
}
