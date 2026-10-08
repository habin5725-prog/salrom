// 사진(JPEG) 여러 장을 한 쪽에 한 장씩 담은 PDF로 만든다.
// 사진 악보도 PDF 악보와 똑같이 확대, 필기, 버전 관리를 쓰기 위해서이다.
// JPEG는 PDF 안에 그대로 넣을 수 있으므로(DCTDecode) 따로 다시 압축하지 않는다.

export type JpegPage = { data: Uint8Array; width: number; height: number };

/** 쪽 너비(A4 너비, pt). 높이는 사진 비율에 맞춘다. */
const PAGE_WIDTH = 595.28;
/** PDF 쪽 크기의 최대값(pt). 아주 긴 사진은 이 안에 들어가도록 줄인다. */
const MAX_SIDE = 14_400;

const num = (n: number) => String(Math.round(n * 100) / 100);

export function pageSize(width: number, height: number): { width: number; height: number } {
  let w = PAGE_WIDTH;
  let h = (PAGE_WIDTH * height) / width;
  if (h > MAX_SIDE) {
    w = (w * MAX_SIDE) / h;
    h = MAX_SIDE;
  }
  return { width: w, height: h };
}

export function imagesToPdf(pages: JpegPage[]): Uint8Array {
  if (pages.length === 0) throw new Error("사진이 없습니다.");
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const push = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    chunks.push(bytes);
    length += bytes.length;
  };
  const offsets: number[] = [];
  const begin = (n: number) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
  };

  // 머리말. 두 번째 줄의 128 이상 바이트는 이진 파일임을 알린다.
  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  // 객체 번호: 1 문서, 2 쪽 목록, 쪽마다 3개(쪽, 그리기 명령, 사진)
  const pageNo = (i: number) => 3 + i * 3;
  begin(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  begin(2);
  push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageNo(i)} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((page, i) => {
    const { width, height } = pageSize(page.width, page.height);
    const [p, c, img] = [pageNo(i), pageNo(i) + 1, pageNo(i) + 2];
    begin(p);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(width)} ${num(height)}] ` +
        `/Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${c} 0 R >>\nendobj\n`,
    );
    const draw = `q ${num(width)} 0 0 ${num(height)} 0 0 cm /Im0 Do Q`;
    begin(c);
    push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream\nendobj\n`);
    begin(img);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB ` +
        `/BitsPerComponent 8 /Filter /DCTDecode /Length ${page.data.length} >>\nstream\n`,
    );
    push(page.data);
    push("\nendstream\nendobj\n");
  });

  const size = 3 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${size}\n0000000000 65535 f \n`);
  for (let n = 1; n < size; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
