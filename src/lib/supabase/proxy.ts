import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/**
 * 매 요청마다 리더/총 관리자 모드의 로그인 세션을 갱신한다.
 * 사이트는 누구나 로그인 없이 보므로 로그인 화면으로 보내지 않는다(편집 화면은 각 페이지가 확인한다).
 */
export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // 세션 쿠키가 있을 때만 확인(갱신)한다. 대부분의 방문자는 쿠키가 없어 그냥 지나간다.
  if (request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    await supabase.auth.getClaims();
  }

  return response;
}
