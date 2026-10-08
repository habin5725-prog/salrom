import { describe, expect, it } from "vitest";
import { addDays, formatServiceDate, relativeDayLabel, todayISO, upcomingSundayISO, weekdayOf } from "./dates";

describe("날짜", () => {
  it("한국 시간 기준으로 오늘을 구한다", () => {
    // UTC 10월 10일 16시 = 한국 10월 11일 01시
    expect(todayISO(new Date("2026-10-10T16:00:00Z"))).toBe("2026-10-11");
    expect(todayISO(new Date("2026-10-10T14:00:00Z"))).toBe("2026-10-10");
  });

  it("요일과 날짜 더하기", () => {
    expect(weekdayOf("2026-10-11")).toBe(0);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("다가오는 주일을 구한다", () => {
    expect(upcomingSundayISO("2026-10-08")).toBe("2026-10-11");
    expect(upcomingSundayISO("2026-10-11")).toBe("2026-10-11");
    expect(upcomingSundayISO("2026-10-12")).toBe("2026-10-18");
  });

  it("화면 표시 형식", () => {
    expect(formatServiceDate("2026-10-11")).toBe("10월 11일 (일)");
    expect(formatServiceDate("2026-10-11", { withYear: true })).toBe("2026년 10월 11일 (일)");
  });

  it("남은 날 안내", () => {
    expect(relativeDayLabel("2026-10-11", "2026-10-11")).toBe("오늘");
    expect(relativeDayLabel("2026-10-12", "2026-10-11")).toBe("내일");
    expect(relativeDayLabel("2026-10-18", "2026-10-11")).toBe("7일 후");
    expect(relativeDayLabel("2026-10-04", "2026-10-11")).toBe("지난 예배");
  });

  it("잘못된 형식은 오류", () => {
    expect(() => formatServiceDate("2026/10/11")).toThrow();
  });
});

describe("시각 표시", () => {
  it("한국 시간으로 날짜와 시각을 보여준다", async () => {
    const { formatDateTime, formatTime } = await import("./dates");
    // UTC 05:30 = 한국 14:30
    expect(formatDateTime("2026-10-08T05:30:00Z")).toBe("10월 8일 (목) 오후 2:30");
    expect(formatTime("2026-10-08T05:30:00Z")).toBe("오후 2:30");
  });
});
