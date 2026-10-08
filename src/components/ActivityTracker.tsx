"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";
import { getDeviceId, getVisitorName, isEmbeddedPreview } from "@/lib/device";

const PING_MS = 30_000;

function send(body: object, beacon = false): Promise<{ viewId?: string | null } | null> {
  const text = JSON.stringify(body);
  if (beacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/track", new Blob([text], { type: "application/json" }));
    return Promise.resolve(null);
  }
  return fetch("/api/track", { method: "POST", body: text, keepalive: true, headers: { "Content-Type": "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

/** 접속 기록: 어느 화면을 얼마나 보았는지 총 관리자 화면에 남긴다. */
export function ActivityTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}

function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
    // 기기별 미리보기 화면 안에서는 기록하지 않는다.
    if (isEmbeddedPreview()) return;
    const deviceId = getDeviceId();
    let viewId: string | null = null;
    let disposed = false;

    send({ event: "start", deviceId, path: pathname, name: getVisitorName() }).then((result) => {
      if (!disposed) viewId = result?.viewId ?? null;
    });

    const ping = (beacon = false) => {
      if (viewId) send({ event: "ping", deviceId, viewId }, beacon);
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") ping();
    }, PING_MS);
    const onVisibility = () => ping(document.visibilityState === "hidden");
    const onHide = () => ping(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);

    return () => {
      disposed = true;
      ping(true);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
    };
  }, [pathname]);

  return null;
}
