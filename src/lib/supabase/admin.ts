import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { SUPABASE_URL } from "./env";

/**
 * RLS를 우회하는 관리용 클라이언트. 푸시 알림 대상 구독 목록을 읽을 때만 쓴다.
 * 호출 전에 반드시 요청자의 권한을 확인해야 한다.
 */
export function getAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
