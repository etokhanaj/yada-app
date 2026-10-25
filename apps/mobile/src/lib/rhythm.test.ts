import { describe, expect, it } from "vitest";

import { dayKey, rhythmOf, thisWeek, todayKey } from "./rhythm";

// 15 Oct 2026 is a Thursday; its week runs Monday 12 to Sunday 18.
const T = "2026-10-15";

describe("the streak (plan §2 row 8)", () => {
  it("counts consecutive days, and today lights the lamp", () => {
    expect(rhythmOf(["2026-10-13", "2026-10-14", T], T)).toMatchObject({ streak: 3, lit: true, begun: true });
  });

  it("keeps the run while today is still open", () => {
    expect(rhythmOf(["2026-10-13", "2026-10-14"], T)).toMatchObject({ streak: 2, lit: false });
  });

  it("lets one rest day a week pass", () => {
    expect(rhythmOf(["2026-10-12", "2026-10-14", T], T).streak).toBe(3);
  });

  it("ends at a second missed day in the same week", () => {
    expect(rhythmOf(["2026-10-12", T], T).streak).toBe(1);
  });

  it("allows a rest day in each week", () => {
    // Rest Sat 10 (week of 5 Oct) and Tue 13 (week of 12 Oct).
    expect(rhythmOf(["2026-10-09", "2026-10-11", "2026-10-12", "2026-10-14", T], T).streak).toBe(5);
  });

  it("ends at two missed days in a row, even across weeks", () => {
    expect(rhythmOf(["2026-10-10", "2026-10-13", "2026-10-14"], T).streak).toBe(2);
  });

  it("restarts quietly: nothing for a while is 0, not an error", () => {
    expect(rhythmOf(["2026-09-01"], T)).toMatchObject({ streak: 0, lit: false, begun: true, thisYear: 1 });
  });

  it("ignores days after today (the clock moved back)", () => {
    expect(rhythmOf(["2026-10-16", "2026-10-20"], T)).toMatchObject({ streak: 0, begun: false, thisYear: 0 });
  });

  it("counts this year only", () => {
    expect(rhythmOf(["2025-12-31", "2026-01-01", T], T).thisYear).toBe(2);
  });

  it("is empty on the first day", () => {
    expect(rhythmOf([], T)).toEqual({ streak: 0, lit: false, thisYear: 0, begun: false });
  });

  it("keys days on Today's clock: 1 am is still yesterday", () => {
    expect(todayKey(new Date(2026, 9, 16, 1, 0))).toBe(T);
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("this week (YO-30)", () => {
  it("runs Monday to Sunday with today marked", () => {
    const w = thisWeek(["2026-10-13"], T);
    expect(w.map((d) => d.counted)).toEqual([false, true, false, false, false, false, false]);
    expect(w.filter((d) => d.today).map((d) => d.key)).toEqual([T]);
  });

  it("never counts a day after today", () => {
    expect(thisWeek(["2026-10-17"], T).some((d) => d.counted)).toBe(false);
  });
});
