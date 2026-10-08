import { describe, expect, it } from "vitest";
import { chosungOf, matchesSearch, searchSongs, toChosung } from "./hangul";

describe("초성", () => {
  it("완성형 글자의 초성을 구한다", () => {
    expect(chosungOf("주")).toBe("ㅈ");
    expect(chosungOf("까")).toBe("ㄲ");
    expect(toChosung("주님의 은혜")).toBe("ㅈㄴㅇ ㅇㅎ");
  });

  it("한글이 아닌 글자는 그대로 둔다", () => {
    expect(toChosung("Way Maker 2")).toBe("Way Maker 2");
  });
});

describe("곡명 검색", () => {
  it("일반 검색은 부분 일치와 공백 무시를 지원한다", () => {
    expect(matchesSearch("주님의 은혜", "은혜")).toBe(true);
    expect(matchesSearch("주님의 은혜", "주님의은혜")).toBe(true);
    expect(matchesSearch("주님의 은혜", "감사")).toBe(false);
  });

  it("초성만으로 찾는다", () => {
    expect(matchesSearch("주님의 은혜", "ㅈㄴㅇ")).toBe(true);
    expect(matchesSearch("주님의 은혜", "ㅇㅎ")).toBe(true);
    expect(matchesSearch("주님의 은혜", "ㄱㅅ")).toBe(false);
  });

  it("글자와 초성을 섞어 쓸 수 있다", () => {
    expect(matchesSearch("주님의 은혜", "주ㄴ")).toBe(true);
  });

  it("받침을 입력하는 중인 마지막 글자도 맞춘다", () => {
    expect(matchesSearch("주님의 은혜", "주니")).toBe(true);
    expect(matchesSearch("주님의 은혜", "니의")).toBe(false);
  });

  it("영문은 대소문자를 구분하지 않는다", () => {
    expect(matchesSearch("Way Maker", "way")).toBe(true);
  });

  it("검색어가 비어 있으면 모두 맞는다", () => {
    expect(matchesSearch("아무 곡", "  ")).toBe(true);
  });

  it("앞부분이 맞는 곡을 먼저 보여준다", () => {
    const songs = [{ title: "나의 은혜" }, { title: "은혜 아니면" }, { title: "가장 큰 은혜" }];
    expect(searchSongs(songs, "은혜").map((s) => s.title)).toEqual([
      "은혜 아니면",
      "나의 은혜",
      "가장 큰 은혜",
    ]);
  });
});
