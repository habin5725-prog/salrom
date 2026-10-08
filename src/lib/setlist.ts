/** 목록에서 한 항목을 다른 위치로 옮긴 새 배열 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = items.slice();
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) {
    return next;
  }
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** 새 곡을 맨 뒤에 붙일 때 쓸 순서 번호 */
export function nextPosition(items: readonly { position: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.position), 0) + 1;
}

/** Key 입력값 정리: 공백 제거, 첫 글자 대문자(예: 'g' → 'G', 'bb' → 'Bb') */
export function normalizeKey(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, " ").slice(0, 12);
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
