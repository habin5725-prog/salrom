import { describe, expect, it } from "vitest";
import type { Tables } from "../database.types";
import { hitStroke, hitText, simplifyPoints, toFlatPoints, toSvgPath } from "./geometry";
import { annotationToInsert, parseAnnotation } from "./model";

const row = (overrides: Partial<Tables<"annotations">>): Tables<"annotations"> => ({
  id: "a1",
  sheet_id: "s1",
  sheet_version: 1,
  user_id: "u1",
  page: 1,
  type: "pen",
  data: { points: [0.1, 0.1, 0.2, 0.2], color: "#000", width: 0.004 },
  scope: "personal",
  created_at: "2026-10-08T00:00:00Z",
  updated_at: "2026-10-08T00:00:00Z",
  ...overrides,
});

describe("필기 좌표", () => {
  it("직선 위의 점은 줄이고 꺾이는 점은 남긴다", () => {
    const line = [0, 0.1, 0.2, 0.3, 0.4].map((x) => ({ x, y: 0 }));
    expect(simplifyPoints(line, 0.001)).toEqual([
      { x: 0, y: 0 },
      { x: 0.4, y: 0 },
    ]);
    const corner = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0 },
      { x: 0.1, y: 0.1 },
    ];
    expect(simplifyPoints(corner, 0.001)).toHaveLength(3);
  });

  it("평면 배열은 소수 넷째 자리로 반올림하고 점 하나도 그릴 수 있게 한다", () => {
    expect(toFlatPoints([{ x: 0.123456, y: 0.5 }])).toEqual([0.1235, 0.5, 0.1235, 0.5]);
  });

  it("SVG 경로를 만든다", () => {
    expect(toSvgPath([0, 0, 1, 1])).toBe("M0 0L1 1");
    expect(toSvgPath([0, 0, 0.5, 0.5, 1, 0])).toBe("M0 0Q0.5 0.5 0.75 0.25L1 0");
  });

  it("지우개가 선 근처에 닿으면 지운다", () => {
    const flat = [0, 0, 1, 0];
    expect(hitStroke(flat, 0.004, { x: 0.5, y: 0.01 }, 0.01)).toBe(true);
    expect(hitStroke(flat, 0.004, { x: 0.5, y: 0.05 }, 0.01)).toBe(false);
  });

  it("글자 상자 안을 누르면 글자를 찾는다", () => {
    const text = { x: 0.1, y: 0.2, text: "후렴", size: 0.04 };
    expect(hitText(text, { x: 0.12, y: 0.19 }, 0)).toBe(true);
    expect(hitText(text, { x: 0.5, y: 0.19 }, 0)).toBe(false);
  });
});

describe("필기 데이터 변환", () => {
  it("펜 필기를 읽는다", () => {
    const a = parseAnnotation(row({}));
    expect(a?.type).toBe("pen");
    expect(a && annotationToInsert(a)).toMatchObject({ id: "a1", sheet_id: "s1", scope: "personal" });
  });

  it("글자 필기는 색이 없으면 범위별 기본색을 쓴다", () => {
    const a = parseAnnotation(row({ type: "text", scope: "global", data: { x: 0.1, y: 0.1, text: "Stop" } }));
    expect(a?.type === "text" && a.data.color).toBe("#dc2626");
  });

  it("형식이 깨진 데이터는 무시한다", () => {
    expect(parseAnnotation(row({ data: { points: [0.1] } }))).toBeNull();
    expect(parseAnnotation(row({ data: { points: [0.1, "x"] } }))).toBeNull();
    expect(parseAnnotation(row({ type: "text", data: { x: 0, y: 0, text: "" } }))).toBeNull();
    expect(parseAnnotation(row({ data: null }))).toBeNull();
  });
});
