import { describe, expect, it } from "vitest";

import { verseFor } from "./dailyLight";
import TABLE from "../data/dailyLight.json";

describe("Daily Light headline verses, checked against the CCEL source", () => {
  it("reads 1 January morning as Philippians 3:13–14", () => {
    expect(verseFor(new Date(2026, 0, 1), "morning")).toEqual({ book: "PHP", chapter: 3, verse: 13, to: 14 });
  });
  it("reads 1 November as Proverbs 8:34 and Isaiah 9:6", () => {
    expect(verseFor(new Date(2026, 10, 1), "morning")).toEqual({ book: "PRO", chapter: 8, verse: 34 });
    expect(verseFor(new Date(2026, 10, 1), "evening")).toEqual({ book: "ISA", chapter: 9, verse: 6 });
  });
  it("has 29 February, so a leap day is never skipped", () => {
    expect(verseFor(new Date(2028, 1, 29), "morning").book).toBe("PRO");
  });
  it("covers all 366 days, morning and evening", () => {
    expect(Object.keys(TABLE)).toHaveLength(366);
    for (const day of Object.values(TABLE)) {
      expect(day.am.chapter).toBeGreaterThan(0);
      expect(day.pm.chapter).toBeGreaterThan(0);
    }
  });
});
