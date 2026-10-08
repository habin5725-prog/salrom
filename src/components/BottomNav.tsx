"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { FolderIcon, HomeIcon, ListIcon, SettingsIcon } from "./icons";

const ITEMS = [
  { href: "/", label: "홈", icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/week", label: "이번 주", icon: ListIcon, match: (p: string) => p.startsWith("/week") },
  { href: "/library", label: "악보함", icon: FolderIcon, match: (p: string) => p.startsWith("/library") },
  {
    href: "/settings",
    label: "설정",
    icon: SettingsIcon,
    match: (p: string) => p.startsWith("/settings") || p.startsWith("/edit"),
  },
] as const;

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
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
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
