"use client";

import { useEffect } from "react";

/** 악보를 보는 동안 화면이 꺼지지 않게 한다(지원하는 브라우저에서만). */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;

    const request = async () => {
      try {
        const next = await navigator.wakeLock.request("screen");
        if (disposed) next.release().catch(() => {});
        else lock = next;
      } catch {
        // 배터리 절약 모드 등으로 거절되면 그냥 둔다.
      }
    };
    request();

    // 다른 앱에 갔다 오면 잠금이 풀리므로 다시 요청한다.
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);
}
