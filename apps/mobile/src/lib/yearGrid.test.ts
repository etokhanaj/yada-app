import { describe, expect, it } from "vitest";

import { gridSummary, thisWeek, yearGrid } from "./yearGrid";

// 18 Oct 2026 is a Sunday; its week runs Monday 12 to Sunday 18.
const T = "2026-10-18";

describe("the year grid (RT-02)", () => {
  it("is 24 weeks of 7 days, Monday first, the current week last", () => {
    const g = yearGrid([], T);
    expect(g.weeks).toHaveLength(24);
    expect(g.weeks.every((w) => w.length === 7)).toBe(true);
    expect(g.weeks.at(-1)?.[0]?.key).toBe("2026-10-12");
    expect(g.weeks.at(-1)?.[6]?.key).toBe(T);
  });

  it("marks counted days and leaves the rest plain, never as misses", () => {
    const g = yearGrid(["2026-10-12", T], T);
    const last = g.weeks.at(-1) ?? [];
    expect(last.map((c) => c.counted)).toEqual([true, false, false, false, false, false, true]);
  });

  it("draws days after today as future, and does not count them", () => {
    const g = yearGrid(["2026-10-17", T, "2026-10-19"], "2026-10-17");
    const last = g.weeks.at(-1) ?? [];
    expect(last[6]?.future).toBe(true);
    expect(last.filter((c) => c.counted)).toHaveLength(1);
  });

  it("names each month once, over the first week that starts in it", () => {
    const names = yearGrid([], T).months.map((m) => m.name);
    expect(names).toEqual(["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
  });

  it("summarises the days for VoiceOver", () => {
    expect(gridSummary(yearGrid(["2026-10-12", T], T))).toBe("2 days read since May");
    expect(gridSummary(yearGrid([T], T))).toBe("1 day read since May");
  });

  it("gives this week for the week row, with today marked", () => {
    const w = thisWeek(["2026-10-13"], "2026-10-15");
    expect(w.map((d) => d.counted)).toEqual([false, true, false, false, false, false, false]);
    expect(w.filter((d) => d.today).map((d) => d.key)).toEqual(["2026-10-15"]);
  });
});
