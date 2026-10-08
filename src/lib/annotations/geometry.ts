// 필기 좌표 계산. 모든 좌표는 "페이지 너비 = 1" 단위이다.

export type Point = { x: number; y: number };

const round = (n: number) => Math.round(n * 10000) / 10000;

/** 점 p와 선분 ab 사이의 최소 거리 */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ramer–Douglas–Peucker 방식으로 점 수를 줄인다. 손글씨 모양은 거의 그대로 유지된다. */
export function simplifyPoints(points: readonly Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points.slice();

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = distanceToSegment(points[i], points[start], points[end]);
      if (d > maxDistance) {
        maxDistance = d;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > epsilon) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

/** 저장용 평면 배열 [x0, y0, x1, y1, ...] 로 바꾼다. 점이 하나뿐이면 같은 점을 두 번 넣어 점으로 그린다. */
export function toFlatPoints(points: readonly Point[]): number[] {
  const flat: number[] = [];
  for (const p of points) flat.push(round(p.x), round(p.y));
  if (flat.length === 2) flat.push(flat[0], flat[1]);
  return flat;
}

export function fromFlatPoints(flat: readonly number[]): Point[] {
  const points: Point[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) points.push({ x: flat[i], y: flat[i + 1] });
  return points;
}

/** 부드러운 SVG 경로(중간점을 잇는 2차 곡선) */
export function toSvgPath(flat: readonly number[]): string {
  const pts = fromFlatPoints(flat);
  if (pts.length === 0) return "";
  if (pts.length <= 2) {
    const last = pts[pts.length - 1];
    return `M${pts[0].x} ${pts[0].y}L${last.x} ${last.y}`;
  }
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = round((pts[i].x + pts[i + 1].x) / 2);
    const my = round((pts[i].y + pts[i + 1].y) / 2);
    d += `Q${pts[i].x} ${pts[i].y} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  return `${d}L${last.x} ${last.y}`;
}

/** 지우개가 선에 닿았는지 */
export function hitStroke(flat: readonly number[], strokeWidth: number, p: Point, tolerance: number): boolean {
  const pts = fromFlatPoints(flat);
  const limit = strokeWidth / 2 + tolerance;
  if (pts.length === 1) return Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= limit;
  for (let i = 0; i + 1 < pts.length; i++) {
    if (distanceToSegment(p, pts[i], pts[i + 1]) <= limit) return true;
  }
  return false;
}

/** 글자 상자의 대략적인 크기. 한글은 글자 크기와 거의 같은 폭, 영문과 숫자는 절반 정도로 계산한다. */
export function estimateTextBox(text: string, size: number): { width: number; height: number } {
  let units = 0;
  for (const ch of text) units += /[\u0000-ÿ]/.test(ch) ? 0.6 : 1;
  return { width: units * size, height: size * 1.2 };
}

/** 지우개나 손가락이 글자 필기에 닿았는지(y는 기준선) */
export function hitText(
  data: { x: number; y: number; text: string; size: number },
  p: Point,
  tolerance: number,
): boolean {
  const box = estimateTextBox(data.text, data.size);
  return (
    p.x >= data.x - tolerance &&
    p.x <= data.x + box.width + tolerance &&
    p.y >= data.y - box.height - tolerance &&
    p.y <= data.y + box.height * 0.25 + tolerance
  );
}
