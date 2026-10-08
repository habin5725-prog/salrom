"use client";

import { MAX_IMAGES, MAX_UPLOAD_BYTES, baseName, extensionOf, formatBytes, kindOfFile } from "./files";
import { imagesToPdf, type JpegPage } from "./images-to-pdf";
import type { BrowserSupabase } from "./supabase/client";
import { SHEETS_BUCKET } from "./supabase/env";

// 악보 파일 등록. 파일을 먼저 올린 뒤 성공했을 때만 곡, 악보, 파일 행을 만든다.
// 그래서 올리기에 실패해도 빈 곡이나 빈 악보가 남지 않는다.
//
// 올릴 수 있는 것
// - 사진 여러 장: 순서대로 한 쪽에 한 장씩 담은 PDF 악보로 합친다(확대와 필기를 그대로 쓸 수 있다).
// - PDF 한 개: 그대로 올린다.
// - 그 밖의 파일 한 개(음원, 영상, 한글과 워드 문서 등): 그대로 올리고 첨부 파일로 연다.

/** 사진 긴 변의 최대 픽셀. 악보 글씨가 충분히 보이면서 파일이 너무 커지지 않는 크기 */
const IMAGE_MAX_SIDE = 2400;
const JPEG_QUALITY = 0.85;

/** 고른 파일 목록에 문제가 있으면 안내 문구를, 없으면 null */
export function checkFiles(files: File[]): string | null {
  if (files.length === 0) return "올릴 파일을 골라 주세요.";
  const images = files.filter((f) => kindOfFile(f) === "image");
  if (images.length !== files.length && files.length > 1) {
    return "사진은 여러 장을 함께 올릴 수 있지만 PDF나 다른 파일은 한 번에 하나만 올릴 수 있습니다.";
  }
  if (images.length > MAX_IMAGES) return `사진은 한 번에 ${MAX_IMAGES}장까지 합칠 수 있습니다.`;
  for (const file of files) {
    if (file.size === 0) return `빈 파일입니다: ${file.name}`;
    if (file.size > MAX_UPLOAD_BYTES) {
      return `파일이 너무 큽니다(${formatBytes(file.size)}). 한 파일은 ${formatBytes(MAX_UPLOAD_BYTES)}까지 올릴 수 있습니다.`;
    }
  }
  return null;
}

/** 고른 파일로 정한 악보 이름 기본값. 사진과 PDF는 "악보", 그 밖의 파일은 파일 이름 */
export function defaultSheetName(files: File[]): string {
  const first = files[0];
  if (!first || files.length > 1) return "악보";
  const kind = kindOfFile(first);
  if (kind === "image" || kind === "pdf") return "악보";
  return baseName(first.name).slice(0, 60) || "첨부 파일";
}

async function imageToJpeg(file: File): Promise<JpegPage> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error(
        `이 기기에서 열 수 없는 사진입니다(${file.name}). 아이폰 사진(HEIC)이면 아이폰에서 직접 올리거나 JPG로 바꿔 주세요.`,
      );
    }
    // 사진의 회전 정보(EXIF)는 브라우저가 그릴 때 반영한다.
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("사진을 바꾸지 못했습니다.");
    // 투명한 부분(PNG 캡처 등)은 흰 종이처럼 보이게 한다.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new Error("사진을 바꾸지 못했습니다.");
    return { data: new Uint8Array(await blob.arrayBuffer()), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type PreparedFile = { body: Blob; ext: string };

/** 올릴 수 있는 모양으로 바꾼다. 사진은 PDF 악보로 합친다. */
export async function prepareFiles(files: File[], onProgress?: (text: string) => void): Promise<PreparedFile> {
  const problem = checkFiles(files);
  if (problem) throw new Error(problem);

  const first = files[0];
  const kind = kindOfFile(first);
  if (kind === "image") {
    const pages: JpegPage[] = [];
    for (let i = 0; i < files.length; i++) {
      onProgress?.(files.length > 1 ? `사진을 악보로 만드는 중... (${i + 1}/${files.length})` : "사진을 악보로 만드는 중...");
      pages.push(await imageToJpeg(files[i]));
    }
    const pdf = imagesToPdf(pages);
    if (pdf.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error("사진을 합친 악보가 너무 큽니다. 사진 수를 줄여 두 번에 나눠 올려 주세요.");
    }
    return { body: new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" }), ext: "pdf" };
  }
  if (kind === "pdf") return { body: new Blob([first], { type: "application/pdf" }), ext: "pdf" };
  return { body: new Blob([first], { type: first.type || "application/octet-stream" }), ext: extensionOf(first.name) || "bin" };
}

function uploadErrorMessage(message: string): string {
  if (/mime|type.*not supported|invalid_mime/i.test(message)) {
    return "이 파일 형식을 아직 올릴 수 없습니다. 사이트 업데이트가 적용되지 않았을 수 있으니 총 관리자에게 알려 주세요.";
  }
  if (/too large|exceed|maximum allowed size|payload/i.test(message)) {
    return `파일이 너무 큽니다. 한 파일은 ${formatBytes(MAX_UPLOAD_BYTES)}까지 올릴 수 있습니다.`;
  }
  return "파일을 올리지 못했습니다. 인터넷 연결을 확인해 주세요.";
}

async function uploadFile(
  supabase: BrowserSupabase,
  songId: string,
  sheetId: string,
  file: PreparedFile,
): Promise<string> {
  const path = `${songId}/${sheetId}/${crypto.randomUUID()}.${file.ext}`;
  const { error } = await supabase.storage.from(SHEETS_BUCKET).upload(path, file.body, {
    contentType: file.body.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(uploadErrorMessage(error.message));
  return path;
}

async function addVersionRow(
  supabase: BrowserSupabase,
  sheetId: string,
  path: string,
  size: number,
): Promise<number> {
  const { data, error } = await supabase
    .from("sheet_versions")
    .insert({ sheet_id: sheetId, file_path: path, file_size: size })
    .select("version")
    .single();
  if (error || !data) throw new Error("악보 정보를 저장하지 못했습니다.");
  return data.version;
}

export type UploadedSheet = { songId: string; sheetId: string; sheetName: string; version: number };

/** 기존 악보에 새 파일을 올린다(이전 파일과 그 위의 필기는 그대로 남는다). */
export async function uploadNewVersion(
  supabase: BrowserSupabase,
  songId: string,
  sheetId: string,
  sheetName: string,
  file: PreparedFile,
): Promise<UploadedSheet> {
  const path = await uploadFile(supabase, songId, sheetId, file);
  const version = await addVersionRow(supabase, sheetId, path, file.body.size);
  return { songId, sheetId, sheetName, version };
}

/** 기존 곡에 다른 악보(예: 다른 Key 편곡, 연습 음원)를 추가한다. */
export async function uploadNewSheet(
  supabase: BrowserSupabase,
  songId: string,
  sheetName: string,
  file: PreparedFile,
): Promise<UploadedSheet> {
  const sheetId = crypto.randomUUID();
  const name = sheetName.trim().slice(0, 60) || "악보";
  const path = await uploadFile(supabase, songId, sheetId, file);
  const { error } = await supabase.from("sheets").insert({ id: sheetId, song_id: songId, name });
  if (error) throw new Error("악보를 저장하지 못했습니다.");
  const version = await addVersionRow(supabase, sheetId, path, file.body.size);
  return { songId, sheetId, sheetName: name, version };
}

/** 새 곡을 등록한다. 파일이 있으면 악보도 함께 등록한다. */
export async function createSong(
  supabase: BrowserSupabase,
  title: string,
  file: PreparedFile | null,
  sheetName = "악보",
): Promise<{ songId: string; title: string; sheet: UploadedSheet | null }> {
  const songId = crypto.randomUUID();
  const cleanTitle = title.trim().slice(0, 100);
  if (!cleanTitle) throw new Error("곡명을 입력해 주세요.");

  if (!file) {
    const { error } = await supabase.from("songs").insert({ id: songId, title: cleanTitle });
    if (error) throw new Error("곡을 저장하지 못했습니다.");
    return { songId, title: cleanTitle, sheet: null };
  }

  const sheetId = crypto.randomUUID();
  const name = sheetName.trim().slice(0, 60) || "악보";
  const path = await uploadFile(supabase, songId, sheetId, file);
  const { error: songError } = await supabase.from("songs").insert({ id: songId, title: cleanTitle });
  if (songError) throw new Error("곡을 저장하지 못했습니다.");
  const { error: sheetError } = await supabase.from("sheets").insert({ id: sheetId, song_id: songId, name });
  if (sheetError) throw new Error("악보를 저장하지 못했습니다.");
  const version = await addVersionRow(supabase, sheetId, path, file.body.size);
  return { songId, title: cleanTitle, sheet: { songId, sheetId, sheetName: name, version } };
}
