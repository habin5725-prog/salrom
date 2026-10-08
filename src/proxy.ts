import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // 정적 파일, 서비스 워커, 앱 아이콘과 매니페스트, 접속 기록은 세션 갱신이 필요 없다.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|pdfjs/|api/track|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs)$).*)",
  ],
};
