import { describe, expect, it } from "vitest";
import { addDays, today, weekDays, weekStart } from "../src/lib/dates";
import { SURAHS, validateRanges } from "../src/lib/surahs";
import { makeDemo } from "../src/lib/demo";

describe("Arabic Quran range validation", () => {
  it("includes all 114 surahs with the Hafs total and permits inclusive chapter edges", () => {
    expect(SURAHS).toHaveLength(114);
    expect(SURAHS.reduce((sum, surah) => sum + surah.ayahs, 0)).toBe(6236);
    expect(() =>
      validateRanges([
        { surah: 24, from: 1, to: 64 },
        { surah: 114, from: 1, to: 6 },
      ]),
    ).not.toThrow();
  });
  it.each([
    { surah: 24, from: 10, to: 1 },
    { surah: 24, from: 1, to: 65 },
    { surah: 0, from: 1, to: 1 },
    { surah: 24, from: 0, to: 1 },
    { surah: 24, from: 1.5, to: 2 },
  ])("rejects invalid range %j with Arabic guidance", (range) => {
    expect(() => validateRanges([range])).toThrow(/نطاق الآيات غير صالح/);
  });
});

describe("pair local calendar", () => {
  it("changes Sunday week at local Algiers midnight, independent of UTC date", () => {
    expect(today("Africa/Algiers", new Date("2026-11-21T22:59:59Z"))).toBe(
      "2026-11-21",
    );
    const next = today("Africa/Algiers", new Date("2026-11-21T23:00:00Z"));
    expect(next).toBe("2026-11-22");
    expect(weekStart("2026-11-21")).toBe("2026-11-15");
    expect(weekStart(next)).toBe("2026-11-22");
  });
  it("navigates month/year/leap boundaries with seven local calendar days", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekDays("2026-11-22")).toEqual([
      "2026-11-22",
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
      "2026-11-28",
    ]);
  });
});

describe("isolated pilot fixture", () => {
  it("retains separately attributed seven/four ayahs and independent revision records", () => {
    const fixture = makeDemo();
    expect(
      fixture.entries.find((e) => e.owner_id === "demo-aya")?.actual_hifdh
        .ranges,
    ).toEqual([{ surah: 24, from: 1, to: 7 }]);
    expect(
      fixture.entries.find((e) => e.owner_id === "demo-maryam")?.actual_hifdh
        .ranges,
    ).toEqual([{ surah: 24, from: 1, to: 4 }]);
    expect(fixture.entries[0].actual_revision).not.toEqual(
      fixture.entries[1].actual_revision,
    );
    expect(fixture.profiles.filter((p) => p.is_admin)).toHaveLength(1);
    expect(fixture.pairs[0].members).toHaveLength(2);
    expect(
      fixture.profiles.every((p) => p.email.endsWith("@example.test")),
    ).toBe(true);
  });
});
