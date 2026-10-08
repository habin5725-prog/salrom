"use client";

import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "./icons";

/** 휴대폰에서는 아래에서 올라오는 창, 태블릿에서는 가운데 창 */
export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="safe-bottom flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-surface shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-[1.2rem] font-bold">{title}</h2>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
            <CloseIcon size={20} />
            닫기
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
