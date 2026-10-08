import "server-only";

import { requestContext } from "./request-context";
import { getAdminSupabase } from "./supabase/admin";

export type EventKind = "login_success" | "login_fail" | "logout" | "publish" | "notify" | "setup";

/** 관리 기록(누가 언제 어디서 무엇을 했는지)을 남긴다. 실패해도 본래 작업은 계속한다. */
export async function logEvent(kind: EventKind, detail?: string): Promise<void> {
  const admin = getAdminSupabase();
  if (!admin) return;
  try {
    const ctx = await requestContext();
    await admin.from("access_events").insert({
      kind,
      detail: detail?.slice(0, 200) ?? null,
      visitor_id: ctx.deviceId,
      ip_hash: ctx.ipHash,
      city: ctx.geo.city,
      region: ctx.geo.region,
      country: ctx.geo.country,
    });
  } catch {
    // 기록 실패는 무시한다.
  }
}

const FAIL_WINDOW_MS = 15 * 60_000;
const FAIL_LIMIT_PER_DEVICE = 5;
const GLOBAL_WINDOW_MS = 60 * 60_000;
const FAIL_LIMIT_GLOBAL = 30;

/**
 * 비밀번호를 여러 번 틀리면 잠시 막는다(숫자 4자리 비밀번호를 하나씩 맞춰 보는 것을 막기 위해).
 * 같은 접속 위치에서 15분에 5번, 사이트 전체에서 1시간에 30번이 넘으면 막는다.
 */
export async function isLockedOut(ipHash: string): Promise<boolean> {
  const admin = getAdminSupabase();
  if (!admin) return false;
  const now = Date.now();
  const [mine, all] = await Promise.all([
    admin
      .from("access_events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "login_fail")
      .eq("ip_hash", ipHash)
      .gte("created_at", new Date(now - FAIL_WINDOW_MS).toISOString()),
    admin
      .from("access_events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "login_fail")
      .gte("created_at", new Date(now - GLOBAL_WINDOW_MS).toISOString()),
  ]);
  return (mine.count ?? 0) >= FAIL_LIMIT_PER_DEVICE || (all.count ?? 0) >= FAIL_LIMIT_GLOBAL;
}
