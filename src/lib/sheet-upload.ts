"use client";

import type { BrowserSupabase } from "./supabase/client";
import { SHEETS_BUCKET } from "./supabase/env";

// 악보 PDF 등록. 파일을 먼저 올린 뒤 성공했을 때만 곡, 악보, 파일 행을 만든다.
// 그래서 올리기에 실패해도 빈 곡이나 빈 악보가 남지 않는다.

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function checkPdf(file: File): string | null {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "PDF 파일만 올릴 수 있습니다.";
  if (file.size > MAX_PDF_BYTES) return "파일이 너무 큽니다(최대 20MB).";
  if (file.size === 0) return "빈 파일입니다.";
  return null;
}

async function uploadFile(supabase: BrowserSupabase, songId: string, sheetId: string, file: File): Promise<string> {
  const path = `${songId}/${sheetId}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage.from(SHEETS_BUCKET).upload(path, file, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) throw new Error("악보 파일을 올리지 못했습니다. 인터넷 연결을 확인해 주세요.");
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
  file: File,
): Promise<UploadedSheet> {
  const path = await uploadFile(supabase, songId, sheetId, file);
  const version = await addVersionRow(supabase, sheetId, path, file.size);
  return { songId, sheetId, sheetName, version };
}

/** 기존 곡에 다른 악보(예: 다른 Key 편곡)를 추가한다. */
export async function uploadNewSheet(
  supabase: BrowserSupabase,
  songId: string,
  sheetName: string,
  file: File,
): Promise<UploadedSheet> {
  const sheetId = crypto.randomUUID();
  const name = sheetName.trim() || "악보";
  const path = await uploadFile(supabase, songId, sheetId, file);
  const { error } = await supabase.from("sheets").insert({ id: sheetId, song_id: songId, name });
  if (error) throw new Error("악보를 저장하지 못했습니다.");
  const version = await addVersionRow(supabase, sheetId, path, file.size);
  return { songId, sheetId, sheetName: name, version };
}

/** 새 곡을 등록한다. 파일이 있으면 악보도 함께 등록한다. */
export async function createSong(
  supabase: BrowserSupabase,
  title: string,
  file: File | null,
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
  const path = await uploadFile(supabase, songId, sheetId, file);
  const { error: songError } = await supabase.from("songs").insert({ id: songId, title: cleanTitle });
  if (songError) throw new Error("곡을 저장하지 못했습니다.");
  const { error: sheetError } = await supabase.from("sheets").insert({ id: sheetId, song_id: songId, name: "악보" });
  if (sheetError) throw new Error("악보를 저장하지 못했습니다.");
  const version = await addVersionRow(supabase, sheetId, path, file.size);
  return { songId, title: cleanTitle, sheet: { songId, sheetId, sheetName: "악보", version } };
}
