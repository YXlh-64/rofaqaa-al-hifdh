import { describe, expect, it } from "vitest";
import { coveredAyahs, uniqueAyahs } from "../src/components/RangeEditor";
import {
  localToday,
  shiftDate,
  startOfWeek,
} from "../src/components/presentation";

describe("readable progress denominators", () => {
  const target = [{ surah: 24, from: 1, to: 10 }];
  it("keeps Aya and Maryam partial results independent", () => {
    expect(coveredAyahs(target, [{ surah: 24, from: 1, to: 7 }])).toBe(7);
    expect(coveredAyahs(target, [{ surah: 24, from: 1, to: 4 }])).toBe(4);
    expect(uniqueAyahs(target)).toBe(10);
  });
  it("counts overlapping actuals once and does not add off-plan ayahs to completion", () => {
    expect(
      coveredAyahs(target, [
        { surah: 24, from: 1, to: 7 },
        { surah: 24, from: 5, to: 15 },
        { surah: 23, from: 1, to: 7 },
      ]),
    ).toBe(10);
    expect(
      uniqueAyahs([
        { surah: 24, from: 1, to: 7 },
        { surah: 24, from: 5, to: 10 },
      ]),
    ).toBe(10);
  });
  it("keeps an absent target empty rather than inventing a percentage", () => {
    expect(coveredAyahs([], [{ surah: 24, from: 1, to: 7 }])).toBe(0);
    expect(uniqueAyahs([])).toBe(0);
  });
});

describe("local Sunday calendar", () => {
  it("moves correctly across Saturday and a year boundary", () => {
    expect(startOfWeek("2027-01-02")).toBe("2026-12-27");
    expect(startOfWeek("2027-01-03")).toBe("2027-01-03");
    expect(shiftDate("2026-12-27", 7)).toBe("2027-01-03");
  });
  it("always returns a calendar date in Algeria", () => {
    expect(localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
