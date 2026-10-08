import { describe, expect, it } from "vitest";
import { baseName, extensionOf, formatBytes, kindOfFile, kindOfPath } from "./files";

describe("파일 종류", () => {
  it("저장 경로의 확장자로 종류를 정한다", () => {
    expect(kindOfPath("a/b/c.pdf")).toBe("pdf");
    expect(kindOfPath("a/b/c.MP3")).toBe("audio");
    expect(kindOfPath("a/b/c.mov")).toBe("video");
    expect(kindOfPath("a/b/c.jpg")).toBe("image");
    expect(kindOfPath("a/b/c.hwp")).toBe("other");
    expect(kindOfPath("a/b/c")).toBe("other");
  });

  it("고른 파일은 브라우저가 알려 준 형식을 먼저 본다", () => {
    expect(kindOfFile({ name: "악보", type: "application/pdf" })).toBe("pdf");
    expect(kindOfFile({ name: "IMG_0001.HEIC", type: "" })).toBe("image");
    expect(kindOfFile({ name: "사진.png", type: "image/png" })).toBe("image");
    expect(kindOfFile({ name: "연습.m4a", type: "audio/x-m4a" })).toBe("audio");
    expect(kindOfFile({ name: "가사.hwp", type: "" })).toBe("other");
  });

  it("확장자와 이름", () => {
    expect(extensionOf("주님의 은혜.PDF")).toBe("pdf");
    expect(extensionOf("이상한.확장자")).toBe("");
    expect(baseName("주님의 은혜 G키.pdf")).toBe("주님의 은혜 G키");
    expect(formatBytes(2048)).toBe("2KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0MB");
  });
});
