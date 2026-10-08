import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { SUPABASE_URL } from "./env";

/** 서버 전용 키(새 이름 SUPABASE_SECRET_KEY 또는 예전 이름 SUPABASE_SERVICE_ROLE_KEY) */
export function serverSecretKey(): string {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

/**
 * RLS를 우회하는 관리용 클라이언트. 서버에서만 쓴다.
 * 접속 기록, 앱 설정, 알림 구독처럼 브라우저가 직접 볼 수 없는 표를 다룰 때와 공용 계정을 만들 때 쓴다.
 * 호출 전에 반드시 요청자의 권한을 확인해야 한다.
 */
export function getAdminSupabase() {
  const key = serverSecretKey();
  if (!SUPABASE_URL || !key) return null;
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
