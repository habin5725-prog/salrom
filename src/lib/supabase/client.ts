"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

export type BrowserSupabase = SupabaseClient<Database>;

let client: BrowserSupabase | null = null;

/** 브라우저에서 쓰는 Supabase 클라이언트. 권한은 RLS 정책이 그대로 적용된다. */
export function getBrowserSupabase(): BrowserSupabase {
  if (!client) {
    client = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}
