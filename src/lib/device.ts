"use client";

// 로그인이 없으므로 기기마다 무작위 ID를 하나 만들어 쓴다(접속 기록, 알림 구독, 기기에 저장한 필기 구분).
// 브라우저 저장 공간을 지우면 새 기기로 보인다.

const ID_KEY = "salrom-device-id";
const NAME_KEY = "salrom-visitor-name";
const COOKIE = "salrom_device";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let fallbackId: string | null = null;

export function getDeviceId(): string {
  let id: string | null = null;
  try {
    id = localStorage.getItem(ID_KEY);
    if (!id || !UUID.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
  } catch {
    // 저장 공간을 쓸 수 없는 브라우저(사생활 보호 모드 등)
    fallbackId ??= crypto.randomUUID();
    id = fallbackId;
  }
  // 서버(알림 보내기, 관리 기록)도 기기를 알 수 있도록 쿠키에 같이 둔다.
  if (!document.cookie.includes(`${COOKIE}=${id}`)) {
    document.cookie = `${COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
  }
  return id;
}

export function getVisitorName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setVisitorName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name.trim().slice(0, 40));
  } catch {
    // 무시
  }
}

/** 이 화면이 기기별 미리보기 안에서 열렸는지(이때는 접속 기록을 남기지 않는다) */
export function isEmbeddedPreview(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
