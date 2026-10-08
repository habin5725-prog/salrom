import Link from "next/link";
import { Suspense } from "react";
import { APP_NAME } from "@/lib/app";
import { getViewer } from "@/lib/auth";
import { TopNav } from "./BottomNav";
import { LiveStatus } from "./LiveStatus";

/** 모든 화면 위쪽: 앱 이름, 실시간 표시등, (넓은 화면) 메뉴, 로그인 또는 현재 모드 */
export function TopBar() {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-line bg-page/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        <Link href="/" className="min-w-0 truncate text-[1.05rem] font-bold">
          {APP_NAME}
        </Link>
        <LiveStatus />
        <div className="ml-auto flex items-center gap-2">
          <TopNav />
          <Suspense fallback={<span className="inline-block h-10 w-[4.5rem]" />}>
            <ModeButton />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function ModeButton() {
  const viewer = await getViewer();
  if (viewer.mode === "admin") {
    return (
      <Link href="/admin" className="btn btn-sm bg-ink px-3 text-white">
        총 관리자
      </Link>
    );
  }
  if (viewer.mode === "leader") {
    return (
      <Link href="/edit" className="btn btn-sm btn-primary px-3">
        리더 모드
      </Link>
    );
  }
  return (
    <Link href="/login" className="btn btn-sm btn-secondary px-3">
      로그인
    </Link>
  );
}
