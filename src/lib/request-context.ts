import "server-only";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { serverSecretKey } from "./supabase/admin";

export const DEVICE_COOKIE = "salrom_device";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export type Geo = { city: string | null; region: string | null; country: string | null };

function decode(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value).slice(0, 80);
  } catch {
    return value.slice(0, 80);
  }
}

/**
 * 대략적인 접속 지역. Vercel에 배포하면 요청 머리글(x-vercel-ip-*)로 도시 단위까지 알려 준다.
 * 다른 곳에 배포했거나 로컬에서는 알 수 없음(null)이다.
 */
export function geoFrom(h: Headers): Geo {
  return {
    city: decode(h.get("x-vercel-ip-city")),
    region: decode(h.get("x-vercel-ip-country-region")),
    country: decode(h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry")),
  };
}

/** IP 주소는 저장하지 않고, 비밀번호 시도 횟수 제한에 쓸 해시만 만든다. */
export function ipHashFrom(h: Headers): string {
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return crypto.createHmac("sha256", serverSecretKey() || "salrom").update(ip).digest("hex").slice(0, 32);
}

/** 접속 기기 이름(예: iPhone · Safari) */
export function deviceLabel(userAgent: string): string {
  const ua = userAgent;
  const os = /iPad/.test(ua)
    ? "iPad"
    : /iPhone/.test(ua)
      ? "iPhone"
      : /Android/.test(ua)
        ? /Mobile/.test(ua)
          ? "Android 휴대폰"
          : "Android 태블릿"
        : /Windows/.test(ua)
          ? "Windows PC"
          : /Macintosh/.test(ua)
            ? "Mac"
            : "기타 기기";
  const browser = /SamsungBrowser/.test(ua)
    ? "삼성 인터넷"
    : /KAKAOTALK/i.test(ua)
      ? "카카오톡"
      : /NAVER/.test(ua)
        ? "네이버"
        : /Edg\//.test(ua)
          ? "Edge"
          : /CriOS|Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : /Firefox\//.test(ua)
                ? "Firefox"
                : "브라우저";
  return `${os} · ${browser}`;
}

/** 서버 액션에서 쓰는 요청 정보 */
export async function requestContext() {
  const h = await headers();
  const c = await cookies();
  const device = c.get(DEVICE_COOKIE)?.value;
  return {
    deviceId: isUuid(device) ? device : null,
    ipHash: ipHashFrom(h),
    geo: geoFrom(h),
  };
}
