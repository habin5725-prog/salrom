import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// 가입 확인 메일의 링크를 누르면 이곳으로 돌아온다. 확인 코드를 로그인 세션으로 바꾼 뒤 홈으로 보낸다.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const home = new URL("/", request.nextUrl.origin);

  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(home);
  }

  return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
}
