"use client";

import type { BrowserSupabase } from "./supabase/client";
import { SHEETS_BUCKET } from "./supabase/env";

// 악보 PDF를 기기에 저장해 두어 다시 열 때 빠르고, 예배 중 인터넷이 불안정해도 볼 수 있게 한다.
// 버전마다 파일 경로가 다르고 한 번 올린 파일은 바뀌지 않으므로 경로를 그대로 키로 쓴다.
// 로그아웃할 때 모두 지운다.

const CACHE_NAME = "sheet-pdfs-v1";
const keyFor = (path: string) => `/__sheet-cache/${encodeURIComponent(path)}`;

function cacheAvailable(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

export async function loadSheetPdf(supabase: BrowserSupabase, path: string): Promise<ArrayBuffer> {
  if (cacheAvailable()) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(keyFor(path));
      if (hit) return await hit.arrayBuffer();
    } catch {
      // 캐시를 못 쓰면 바로 내려받는다.
    }
  }

  const { data, error } = await supabase.storage.from(SHEETS_BUCKET).download(path);
  if (error || !data) throw new Error("악보 파일을 불러오지 못했습니다.");
  const buffer = await data.arrayBuffer();

  if (cacheAvailable()) {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(
        keyFor(path),
        new Response(buffer.slice(0), { headers: { "Content-Type": "application/pdf" } }),
      );
    } catch {
      // 저장 공간이 부족하면 캐시하지 않는다.
    }
  }
  return buffer;
}

/** 다음 곡 악보를 미리 받아 둔다. 실패해도 무시한다. */
export function prefetchSheetPdf(supabase: BrowserSupabase, path: string): void {
  loadSheetPdf(supabase, path).catch(() => {});
}

export async function clearSheetCache(): Promise<void> {
  if (cacheAvailable()) await caches.delete(CACHE_NAME);
}
