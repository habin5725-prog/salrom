// Supabase 연결 정보. 값이 없으면 앱은 설정 안내 화면을 보여준다.
// Vercel에서 Supabase를 연결하면 새 이름(PUBLISHABLE_KEY)이, 직접 넣으면 예전 이름(ANON_KEY)이 쓰일 수 있어 둘 다 읽는다.
// NEXT_PUBLIC_ 값은 빌드할 때 그대로 들어가야 하므로 process.env.이름 형태로 적는다.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

/** 악보 PDF를 저장하는 비공개 Storage 버킷 */
export const SHEETS_BUCKET = "sheets";
