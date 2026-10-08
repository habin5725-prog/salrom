import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "./icons";

type Props = {
  title: string;
  /** 제목 위 작은 글씨 */
  eyebrow?: string;
  back?: { href: string; label: string };
  action?: ReactNode;
};

export function PageHeader({ title, eyebrow, back, action }: Props) {
  return (
    <header className="safe-top mb-5">
      {back && (
        <Link
          href={back.href}
          className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 px-2 text-base font-semibold text-muted"
        >
          <ChevronLeftIcon size={22} />
          {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-[0.95rem] font-semibold text-accent">{eyebrow}</p>}
          <h1 className="text-[1.6rem] font-bold leading-tight break-keep">{title}</h1>
        </div>
        {action}
      </div>
    </header>
  );
}
