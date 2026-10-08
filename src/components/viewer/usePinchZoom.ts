"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

type Pending = { cx: number; cy: number; s: number; mx: number; my: number };

/**
 * 두 손가락으로 확대, 축소, 이동한다. 브라우저 자체 확대 대신 직접 처리해서
 * 상단과 하단 버튼은 그대로 두고 악보만 커지게 한다.
 * 손가락을 움직이는 동안에는 CSS transform으로 보여주고, 손을 떼면 실제 크기를 바꿔 선명하게 다시 그린다.
 */
export function usePinchZoom(
  containerRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
) {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const pending = useRef<Pending | null>(null);

  // 확대 배율이 바뀐 뒤 손가락 사이 지점이 그대로 보이도록 스크롤을 맞춘다.
  useLayoutEffect(() => {
    const el = containerRef.current;
    const p = pending.current;
    if (!el || !p) return;
    el.scrollLeft = p.cx * p.s - p.mx;
    el.scrollTop = p.cy * p.s - p.my;
    pending.current = null;
  }, [zoom, containerRef]);

  const commit = useCallback(
    (next: number, p: Omit<Pending, "s">) => {
      const z = clamp(next);
      const s = z / zoomRef.current;
      const el = containerRef.current;
      if (Math.abs(s - 1) < 0.01) {
        // 배율은 그대로이고 이동만 했다.
        if (el) {
          el.scrollLeft = p.cx - p.mx;
          el.scrollTop = p.cy - p.my;
        }
        return;
      }
      pending.current = { ...p, s };
      zoomRef.current = z;
      setZoom(z);
    },
    [containerRef],
  );

  useEffect(() => {
    const el = containerRef.current;
    const content = contentRef.current;
    if (!el || !content) return;

    let start: { d0: number; z0: number; cx: number; cy: number; sl: number; st: number } | null = null;
    let last = { s: 1, mx: 0, my: 0 };

    const measure = (t: TouchList) => {
      const r = el.getBoundingClientRect();
      return {
        mx: (t[0].clientX + t[1].clientX) / 2 - r.left,
        my: (t[0].clientY + t[1].clientY) / 2 - r.top,
        d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1,
      };
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const m = measure(e.touches);
      start = { d0: m.d, z0: zoomRef.current, cx: el.scrollLeft + m.mx, cy: el.scrollTop + m.my, sl: el.scrollLeft, st: el.scrollTop };
      last = { s: 1, mx: m.mx, my: m.my };
      content.style.transformOrigin = "0 0";
      content.style.willChange = "transform";
    };

    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 2) return;
      e.preventDefault();
      const m = measure(e.touches);
      const s = clamp((start.z0 * m.d) / start.d0) / start.z0;
      // 손가락 사이에 있던 악보 지점(cx, cy)이 지금 손가락 사이(mx, my)에 오도록 옮긴다.
      const tx = m.mx + start.sl - start.cx * s;
      const ty = m.my + start.st - start.cy * s;
      content.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
      last = { s, mx: m.mx, my: m.my };
    };

    const onEnd = (e: TouchEvent) => {
      if (!start || e.touches.length >= 2) return;
      content.style.transform = "";
      content.style.willChange = "";
      const { cx, cy, z0 } = start;
      start = null;
      commit(z0 * last.s, { cx, cy, mx: last.mx, my: last.my });
    };

    // iPhone Safari의 화면 전체 확대 제스처를 막는다.
    const preventGesture = (e: Event) => e.preventDefault();

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("gesturestart", preventGesture);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("gesturestart", preventGesture);
    };
  }, [containerRef, contentRef, commit]);

  /** 버튼으로 확대, 축소(화면 가운데 기준) */
  const zoomBy = useCallback(
    (factor: number) => {
      const el = containerRef.current;
      if (!el) return;
      const mx = el.clientWidth / 2;
      const my = el.clientHeight / 2;
      commit(zoomRef.current * factor, { cx: el.scrollLeft + mx, cy: el.scrollTop + my, mx, my });
    },
    [containerRef, commit],
  );

  return { zoom, zoomBy, canZoomIn: zoom < MAX_ZOOM - 0.01, canZoomOut: zoom > MIN_ZOOM + 0.01 };
}
