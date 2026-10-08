import { describe, expect, it } from "vitest";
import { moveItem, nextPosition, normalizeKey } from "./setlist";

describe("곡 순서", () => {
  it("항목을 위아래로 옮긴다", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });

  it("범위를 벗어나면 그대로 둔다", () => {
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 2)).toEqual(["a", "b"]);
  });

  it("원본 배열은 바꾸지 않는다", () => {
    const list = ["a", "b"];
    moveItem(list, 0, 1);
    expect(list).toEqual(["a", "b"]);
  });

  it("다음 순서 번호", () => {
    expect(nextPosition([])).toBe(1);
    expect(nextPosition([{ position: 3 }, { position: 1 }])).toBe(4);
  });
});

describe("Key 입력 정리", () => {
  it("앞글자를 대문자로 바꾸고 공백을 정리한다", () => {
    expect(normalizeKey(" g ")).toBe("G");
    expect(normalizeKey("bb")).toBe("Bb");
    expect(normalizeKey("A  → B")).toBe("A → B");
    expect(normalizeKey("")).toBe("");
  });
});
