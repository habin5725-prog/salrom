"use client";

import { useEffect } from "react";

/** 홈 화면 설치와 푸시 알림에 필요한 서비스 워커를 등록한다. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // 등록에 실패해도 앱 사용에는 지장이 없다(설치와 알림만 안 된다).
      });
  }, []);
  return null;
}
