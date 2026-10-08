import type { Enums, Json, Tables } from "../database.types";

// 필기 좌표는 "페이지 너비 = 1" 단위로 저장한다.
// x는 0~1, y는 0~(페이지 높이/너비) 범위이다. 확대 배율이나 화면 크기와 무관하게 같은 위치에 그려진다.

export type AnnotationScope = Enums<"annotation_scope">;
export type AnnotationType = Enums<"annotation_type">;

export type StrokeData = {
  /** [x0, y0, x1, y1, ...] */
  points: number[];
  color: string;
  /** 선 굵기(페이지 너비 단위) */
  width: number;
};

export type TextData = {
  x: number;
  /** 글자 기준선 위치 */
  y: number;
  text: string;
  /** 글자 크기(페이지 너비 단위) */
  size: number;
  color: string;
};

export type Annotation =
  | (BaseAnnotation & { type: "pen" | "highlighter"; data: StrokeData })
  | (BaseAnnotation & { type: "text"; data: TextData });

type BaseAnnotation = {
  id: string;
  sheetId: string;
  sheetVersion: number;
  userId: string;
  page: number;
  scope: AnnotationScope;
  updatedAt: string;
};

/** 개인 필기와 공용 필기의 색. 공용 필기는 색 외에 "공용" 표시도 함께 그린다. */
export const NOTE_COLORS = {
  personal: { pen: "#1d4ed8", highlighter: "#facc15", text: "#1d4ed8" },
  global: { pen: "#dc2626", highlighter: "#fb923c", text: "#dc2626" },
} as const;

export const STROKE_WIDTH = { pen: 0.004, highlighter: 0.02 } as const;
export const TEXT_SIZE = 0.035;
export const MAX_TEXT_LENGTH = 80;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 데이터베이스 행을 화면용 필기 객체로 바꾼다. 형식이 깨진 행은 무시한다. */
export function parseAnnotation(row: Tables<"annotations">): Annotation | null {
  const base: BaseAnnotation = {
    id: row.id,
    sheetId: row.sheet_id,
    sheetVersion: row.sheet_version,
    userId: row.user_id,
    page: row.page,
    scope: row.scope,
    updatedAt: row.updated_at,
  };
  const data = row.data;
  if (!isRecord(data)) return null;

  if (row.type === "text") {
    const { x, y, text, size, color } = data;
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || typeof text !== "string" || !text) return null;
    return {
      ...base,
      type: "text",
      data: {
        x,
        y,
        text: text.slice(0, MAX_TEXT_LENGTH),
        size: isFiniteNumber(size) ? size : TEXT_SIZE,
        color: typeof color === "string" ? color : NOTE_COLORS[row.scope].text,
      },
    };
  }

  const { points, color, width } = data;
  if (!Array.isArray(points) || points.length < 2 || points.length % 2 !== 0) return null;
  if (!points.every(isFiniteNumber)) return null;
  return {
    ...base,
    type: row.type,
    data: {
      points: points as number[],
      color: typeof color === "string" ? color : NOTE_COLORS[row.scope][row.type],
      width: isFiniteNumber(width) ? width : STROKE_WIDTH[row.type],
    },
  };
}

/** 화면용 필기 객체를 저장용 데이터로 바꾼다. */
export function annotationToInsert(a: Annotation) {
  return {
    id: a.id,
    sheet_id: a.sheetId,
    sheet_version: a.sheetVersion,
    page: a.page,
    type: a.type,
    data: a.data as unknown as Json,
    scope: a.scope,
  };
}
