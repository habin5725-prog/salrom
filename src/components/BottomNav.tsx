"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { NAV_ITEMS } from "./nav-items";

// 휴대폰과 패드에서는 아래쪽 메뉴, 노트북처럼 넓은 화면에서는 위쪽 메뉴(TopNav)를 쓴다.
// 현재 주소는 요청 시점에만 알 수 있으므로 Suspense로 감싼다. 그전에는 강조 없는 같은 메뉴를 보여준다.
export function BottomNav() {
  return (
    <Suspense fallback={<NavBar pathname={null} />}>
      <ActiveNavBar />
    </Suspense>
  );
}

function ActiveNavBar() {
  return <NavBar pathname={usePathname()} />;
}

function NavBar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="주요 메뉴"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = pathname !== null && match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-[4.25rem] flex-col items-center justify-center gap-1 text-[0.9rem] font-semibold ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <Icon size={26} strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** 노트북처럼 넓은 화면의 위쪽 메뉴 */
export function TopNav() {
  return (
    <Suspense fallback={<TopNavLinks pathname={null} />}>
      <ActiveTopNav />
    </Suspense>
  );
}

function ActiveTopNav() {
  return <TopNavLinks pathname={usePathname()} />;
}

function TopNavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="주요 메뉴" className="hidden items-center gap-1 lg:flex">
      {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
        const active = pathname !== null && match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 font-semibold ${
              active ? "bg-accent-soft text-accent-strong" : "text-muted hover:bg-surface"
            }`}
          >
            <Icon size={20} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
