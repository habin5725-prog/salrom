import { describe, expect, it } from "vitest";
import { imagesToPdf, pageSize } from "./images-to-pdf";

// 그림 내용은 확인하지 않으므로 JPEG 시작과 끝 표시만 있는 가짜 데이터로 충분하다.
const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

function text(bytes: Uint8Array) {
  return new TextDecoder("latin1").decode(bytes);
}

describe("사진을 PDF로 합치기", () => {
  it("사진 수만큼 쪽을 만들고 목차(xref)가 각 객체 위치를 가리킨다", () => {
    const pdf = imagesToPdf([
      { data: fakeJpeg, width: 1200, height: 1600 },
      { data: fakeJpeg, width: 1600, height: 1200 },
    ]);
    const s = text(pdf);
    expect(s.startsWith("%PDF-1.4\n")).toBe(true);
    expect(s).toContain("/Count 2");
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);

    const xrefAt = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const entries = s.slice(xrefAt).split("\n").slice(3, 3 + 8);
    entries.forEach((line, i) => {
      const offset = Number(line.slice(0, 10));
      expect(s.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });

  it("pdf.js 가 쪽 수와 쪽 비율을 읽는다", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = imagesToPdf([
      { data: fakeJpeg, width: 1000, height: 1500 },
      { data: fakeJpeg, width: 1500, height: 1000 },
      { data: fakeJpeg, width: 800, height: 800 },
    ]);
    const task = pdfjs.getDocument({ data, useSystemFonts: false });
    const doc = await task.promise;
    expect(doc.numPages).toBe(3);
    const first = (await doc.getPage(1)).getViewport({ scale: 1 });
    expect(first.height / first.width).toBeCloseTo(1.5, 2);
    const second = (await doc.getPage(2)).getViewport({ scale: 1 });
    expect(second.height / second.width).toBeCloseTo(2 / 3, 2);
    await task.destroy();
  });

  it("아주 긴 사진은 PDF 쪽 크기 한도 안으로 줄인다", () => {
    const size = pageSize(100, 10_000);
    expect(size.height).toBe(14_400);
    expect(size.width).toBeCloseTo(144, 0);
  });
});
