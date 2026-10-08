// 악보함에 올리는 파일의 종류. 서버와 브라우저 양쪽에서 쓴다.
// 파일 경로의 확장자로 종류를 정하므로 데이터베이스에 따로 저장하지 않는다.

export type FileKind = "pdf" | "image" | "audio" | "video" | "other";

/** 파일 하나의 최대 크기. Supabase 무료 플랜의 파일 한도(50MB)와 같다. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
/** 한 악보로 합칠 수 있는 사진 수 */
export const MAX_IMAGES = 30;

const IMAGE = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "avif", "tif", "tiff"];
const AUDIO = ["mp3", "m4a", "aac", "wav", "ogg", "oga", "flac", "opus", "weba"];
const VIDEO = ["mp4", "m4v", "mov", "webm", "ogv"];

/** 파일 이름의 확장자(소문자, 영문과 숫자 1~8자). 없으면 빈 문자열 */
export function extensionOf(name: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
}

function kindOfExtension(ext: string): FileKind {
  if (ext === "pdf") return "pdf";
  if (IMAGE.includes(ext)) return "image";
  if (AUDIO.includes(ext)) return "audio";
  if (VIDEO.includes(ext)) return "video";
  return "other";
}

/** 저장된 파일 경로로 종류를 정한다. */
export function kindOfPath(path: string): FileKind {
  return kindOfExtension(extensionOf(path));
}

/** 사용자가 고른 파일의 종류. 브라우저가 알려 주는 형식을 먼저 보고 없으면 확장자를 본다. */
export function kindOfFile(file: { name: string; type: string }): FileKind {
  const type = file.type.toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  return kindOfExtension(extensionOf(file.name));
}

/** 확장자를 뺀 파일 이름(악보 이름 기본값으로 쓴다) */
export function baseName(name: string): string {
  return name.trim().replace(/\.[A-Za-z0-9]{1,8}$/, "").trim();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** 화면에 보이는 종류 이름과 여는 버튼 이름 */
export const KIND_LABEL: Record<FileKind, { name: string; open: string }> = {
  pdf: { name: "악보", open: "악보 보기" },
  image: { name: "사진", open: "사진 보기" },
  audio: { name: "음원", open: "듣기" },
  video: { name: "영상", open: "영상 보기" },
  other: { name: "첨부 파일", open: "파일 열기" },
};
