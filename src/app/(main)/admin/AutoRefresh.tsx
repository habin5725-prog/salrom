"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 화면을 열어 둔 동안 일정 간격으로 최신 기록을 다시 불러온다. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, seconds]);
  return null;
}
