// pdf.js가 브라우저에서 따로 내려받는 파일(워커, 한글 CMap, 표준 글꼴, 이미지 디코더, 색 프로필)을 public/pdfjs 로 복사한다.
// npm install, dev, build 전에 자동으로 실행된다.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "pdfjs-dist");
const dest = join(root, "public", "pdfjs");

if (!existsSync(src)) {
  console.warn("pdfjs-dist가 설치되지 않아 복사를 건너뜁니다.");
  process.exit(0);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(join(src, "legacy", "build", "pdf.worker.min.mjs"), join(dest, "pdf.worker.min.mjs"));
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true });
}
console.log("pdf.js 파일을 public/pdfjs 에 복사했습니다.");
