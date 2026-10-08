"use client";

// pdf.js는 악보 화면에서만 필요하므로 그때 불러온다.
// 구형 iPhone과 태블릿을 위해 legacy 빌드를 쓴다. 보조 파일은 scripts/copy-pdfjs.mjs 가 public/pdfjs 에 둔다.

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
export type PdfDocument = Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>;
export type PdfPage = Awaited<ReturnType<PdfDocument["getPage"]>>;

let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/** PDF를 연다. 다 쓰면 destroy로 워커 작업을 정리한다. */
export async function openPdf(data: ArrayBuffer): Promise<{ doc: PdfDocument; destroy: () => void }> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    wasmUrl: "/pdfjs/wasm/",
    iccUrl: "/pdfjs/iccs/",
  });
  const doc = await task.promise;
  return { doc, destroy: () => void task.destroy() };
}

// iPhone Safari의 캔버스 한도(약 1,670만 화소)와 메모리를 고려해 한 쪽당 800만 화소까지만 그린다.
const MAX_CANVAS_PIXELS = 8_000_000;

/** 화면 너비(cssWidth)에 맞춰 선명하게 그린다. 확대 배율이 바뀌면 cancel로 이전 작업을 멈춘다. */
export function renderPage(
  page: PdfPage,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): { promise: Promise<void>; cancel: () => void } {
  const base = page.getViewport({ scale: 1 });
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  let scale = (cssWidth * ratio) / base.width;
  const pixels = base.width * scale * base.height * scale;
  if (pixels > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);

  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const task = page.render({ canvas, viewport });
  return { promise: task.promise, cancel: () => task.cancel() };
}
