import { describe, expect, it } from "vitest";
import { gameDate, isoDay, seasonOf } from "@/lib/season";

describe("ゲームの中の日と季節", () => {
  it("入社式の日は、今日から見て次に来る 4月1日", () => {
    expect(isoDay(gameDate(new Date(2026, 10, 23)))).toBe("2027-04-01");
    expect(isoDay(gameDate(new Date(2027, 2, 31)))).toBe("2027-04-01");
    expect(isoDay(gameDate(new Date(2027, 3, 1, 15)))).toBe("2027-04-01");
    expect(isoDay(gameDate(new Date(2027, 3, 2)))).toBe("2028-04-01");
  });
  it("4月1日は春", () => {
    expect(seasonOf(gameDate(new Date(2026, 10, 23)))).toBe("spring");
  });
  it("月から季節が決まる", () => {
    expect(seasonOf(new Date(2027, 6, 1))).toBe("summer");
    expect(seasonOf(new Date(2026, 10, 23))).toBe("autumn");
    expect(seasonOf(new Date(2027, 0, 10))).toBe("winter");
    expect(seasonOf(new Date(2027, 2, 1))).toBe("spring");
  });
});
