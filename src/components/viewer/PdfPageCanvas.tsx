"use client";

import { useEffect, useRef } from "react";
import { renderPage, type PdfPage } from "@/lib/pdf";

/**
 * PDF 한 쪽을 그린다. 확대 배율이 바뀌면 잠시 기다렸다가 새 해상도로 다시 그린다.
 * 새 그림이 완성된 뒤에 바꿔 끼우므로 다시 그리는 동안 화면이 깜빡이지 않는다.
 */
export function PdfPageCanvas({ page, cssWidth }: { page: PdfPage; cssWidth: number }) {
  const holderRef = useRef<HTMLDivElement>(null);

  // 화면에서 사라지면(다른 곡으로 이동 등) 그림을 비워 휴대폰 메모리를 아낀다.
  useEffect(() => {
    const holder = holderRef.current;
    return () => holder?.replaceChildren();
  }, []);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || cssWidth <= 0) return;

    let cancel: (() => void) | null = null;
    let disposed = false;
    const timer = window.setTimeout(() => {
      const canvas = document.createElement("canvas");
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      const job = renderPage(page, canvas, cssWidth);
      cancel = job.cancel;
      job.promise
        .then(() => {
          if (!disposed) holder.replaceChildren(canvas);
        })
        .catch(() => {
          // 다시 그리기로 취소된 작업은 무시한다.
        });
    }, holder.childElementCount === 0 ? 0 : 180);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      cancel?.();
    };
  }, [page, cssWidth]);

  return <div ref={holderRef} className="absolute inset-0 bg-white" />;
}
