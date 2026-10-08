import { FolderIcon, HomeIcon, ListIcon, SettingsIcon } from "./icons";

/** 하단 메뉴(휴대폰, 패드)와 위쪽 메뉴(노트북)에서 함께 쓰는 4개 메뉴 */
export const NAV_ITEMS = [
  { href: "/", label: "홈", icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/week", label: "이번 주", icon: ListIcon, match: (p: string) => p.startsWith("/week") },
  { href: "/library", label: "악보함", icon: FolderIcon, match: (p: string) => p.startsWith("/library") },
  {
    href: "/settings",
    label: "설정",
    icon: SettingsIcon,
    match: (p: string) => p.startsWith("/settings"),
  },
] as const;
