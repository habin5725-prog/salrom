// 곡명 검색: 일반 검색과 한글 초성 검색(예: "ㅈㄴㅇ" → "주님의 은혜")을 함께 지원한다.

const CHOSUNG = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const;

const SYLLABLE_START = 0xac00;
const SYLLABLE_END = 0xd7a3;
const JUNG_COUNT = 21;
const JONG_COUNT = 28;

function isSyllable(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= SYLLABLE_START && code <= SYLLABLE_END;
}

function isChosungChar(ch: string): boolean {
  return (CHOSUNG as readonly string[]).includes(ch);
}

/** 완성형 한글 글자의 초성. 한글이 아니면 그대로 돌려준다. */
export function chosungOf(ch: string): string {
  if (!isSyllable(ch)) return ch;
  const index = Math.floor((ch.charCodeAt(0) - SYLLABLE_START) / (JUNG_COUNT * JONG_COUNT));
  return CHOSUNG[index];
}

/** 문자열 전체의 초성 */
export function toChosung(text: string): string {
  return Array.from(text, chosungOf).join("");
}

/** 검색 비교용: 공백 제거, 소문자 */
export function normalizeForSearch(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

// 받침 없는 글자를 입력 중일 때(예: "니") 받침 있는 글자("님")와도 맞도록 비교한다.
function sameWithoutJong(typed: string, target: string): boolean {
  if (!isSyllable(typed) || !isSyllable(target)) return false;
  const t = typed.charCodeAt(0) - SYLLABLE_START;
  const g = target.charCodeAt(0) - SYLLABLE_START;
  if (t % JONG_COUNT !== 0) return false;
  return Math.floor(t / JONG_COUNT) === Math.floor(g / JONG_COUNT);
}

function charMatches(target: string, typed: string, isLast: boolean): boolean {
  if (target === typed) return true;
  if (isChosungChar(typed)) return chosungOf(target) === typed;
  return isLast && sameWithoutJong(typed, target);
}

/** 검색어가 곡명에서 처음 맞는 위치. 없으면 -1. 공백은 무시한다. */
export function findMatchIndex(title: string, query: string): number {
  const q = Array.from(normalizeForSearch(query));
  if (q.length === 0) return 0;
  const t = Array.from(normalizeForSearch(title));

  for (let start = 0; start + q.length <= t.length; start++) {
    let ok = true;
    for (let i = 0; i < q.length; i++) {
      if (!charMatches(t[start + i], q[i], i === q.length - 1)) {
        ok = false;
        break;
      }
    }
    if (ok) return start;
  }
  return -1;
}

export function matchesSearch(title: string, query: string): boolean {
  return findMatchIndex(title, query) >= 0;
}

/** 검색 결과: 앞부분이 맞는 곡을 먼저, 같으면 가나다순 */
export function searchSongs<T extends { title: string }>(items: readonly T[], query: string): T[] {
  return items
    .map((item) => ({ item, index: findMatchIndex(item.title, query) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index || a.item.title.localeCompare(b.item.title, "ko"))
    .map((entry) => entry.item);
}
