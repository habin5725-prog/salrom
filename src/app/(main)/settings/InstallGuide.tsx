"use client";

import { useEffect, useState } from "react";

type Platform = "installed" | "ios" | "android" | "other";

// Chrome 계열 브라우저가 주는 설치 요청 이벤트(표준 타입에는 없다).
type InstallPromptEvent = Event & { prompt: () => Promise<void> };

function detectPlatform(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  const ua = navigator.userAgent;
  // iPadOS는 데스크톱 Safari처럼 보이므로 터치 지원으로 함께 판단한다.
  if (/iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

export function InstallGuide() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    // 브라우저 정보는 화면이 뜬 뒤에만 알 수 있다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detectPlatform());
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (platform === null) return null;

  if (platform === "installed") {
    return <p className="text-muted">이미 홈 화면 앱으로 사용 중입니다.</p>;
  }

  if (promptEvent) {
    return (
      <button type="button" className="btn btn-primary w-full" onClick={() => promptEvent.prompt()}>
        홈 화면에 추가
      </button>
    );
  }

  if (platform === "ios") {
    return (
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-[1rem] break-keep">
        <li>Safari 아래쪽(또는 위쪽)의 공유 버튼을 누릅니다.</li>
        <li>&quot;홈 화면에 추가&quot;를 누릅니다.</li>
        <li>홈 화면에 생긴 아이콘으로 열면 알림도 받을 수 있습니다.</li>
      </ol>
    );
  }

  return (
    <ol className="flex list-decimal flex-col gap-2 pl-5 text-[1rem] break-keep">
      <li>Chrome 오른쪽 위의 점 세 개 메뉴를 누릅니다.</li>
      <li>&quot;홈 화면에 추가&quot; 또는 &quot;앱 설치&quot;를 누릅니다.</li>
    </ol>
  );
}
