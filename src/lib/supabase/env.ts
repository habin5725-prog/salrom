// Supabase 연결 정보. 값이 없으면 앱은 설정 안내 화면을 보여준다.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

/** 악보 PDF를 저장하는 비공개 Storage 버킷 */
export const SHEETS_BUCKET = "sheets";
