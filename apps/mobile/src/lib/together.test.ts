import { describe, expect, it } from "vitest";

import { clock, comingLine, comingNotice, liveLine, myAnswer, nextTime, onNow, planLine, ringNotice, weekKey, weekdayOf } from "./together";

// First planned for Tuesday 13 Oct 2026, 8 pm on this phone.
const plan = { weekly: true, minutes: 20, once: new Date(2026, 9, 13, 20, 0).getTime() };

describe("Pray together (PC-14 to PC-22)", () => {
  it("writes a time as the frames do", () => {
    expect(clock(20, 0)).toBe("8:00 pm");
    expect(clock(0, 5)).toBe("12:05 am");
    expect(clock(12, 30)).toBe("12:30 pm");
    expect(planLine(plan, new Date(plan.once))).toBe("Every Tuesday · 8:00 pm");
    expect(planLine({ weekly: false }, new Date(2026, 9, 21, 20, 0))).toBe("Wednesday 21 Oct · 8:00 pm");
  });

  it("counts weeks the ISO way, across a new year", () => {
    expect(weekKey(new Date(2026, 9, 18))).toBe("2026-W42");
    expect(weekKey(new Date(2027, 0, 1))).toBe("2026-W53");
    expect(weekdayOf(new Date(2026, 9, 18))).toBe(7);
  });

  it("finds the next Tuesday, keeps today's while it runs, and drops a past one-off", () => {
    const sun = new Date(2026, 9, 18, 9, 0);
    expect(nextTime(plan, sun)?.toDateString()).toBe(new Date(2026, 9, 20).toDateString());
    const during = new Date(2026, 9, 20, 20, 10);
    expect(nextTime(plan, during)?.getDate()).toBe(20);
    const after = new Date(2026, 9, 20, 20, 30);
    expect(nextTime(plan, after)?.getDate()).toBe(27);
    expect(nextTime({ ...plan, weekly: false, once: new Date(2026, 9, 1, 20).getTime() }, sun)).toBeNull();
  });

  it("counts who is coming this week and says back a can't-make-it", () => {
    const week = "2026-W43";
    const coming = [
      { member: "a", week, going: true, mine: false },
      { member: "b", week, going: true, mine: false },
      { member: "c", week: "2026-W42", going: true, mine: false },
      { member: "me", week, going: false, mine: true },
    ];
    expect(comingLine(coming, week, 6)).toBe("2 of 6 coming · you can’t make it this week");
    expect(comingLine(coming.slice(0, 3), week, 6)).toBe("2 of 6 coming this week");
    expect(myAnswer(coming, week)).toBe(false);
    expect(myAnswer(coming, "2026-W44")).toBeNull();
  });

  it("names who is praying now, never the reader or a call long gone", () => {
    const now = Date.UTC(2026, 9, 18, 20);
    const marks = [
      { member: "s", kind: "on" as const, at: now - 60_000, mine: false },
      { member: "a", kind: "on" as const, at: now - 120_000, mine: false },
      { member: "me", kind: "on" as const, at: now, mine: true },
      { member: "old", kind: "on" as const, at: now - 4 * 3_600_000, mine: false },
      { member: "k", kind: "ask" as const, at: now, mine: false },
    ];
    expect(onNow(marks, now)).toEqual(["s", "a"]);
    expect(onNow(marks, now, "ask")).toEqual(["k"]);
    expect(liveLine(["Sam", "Ada"])).toBe("Sam and Ada are praying together");
    expect(liveLine(["Sam", "", "Kemi"])).toBe("Sam, Someone and Kemi are praying together");
    expect(liveLine([])).toBeNull();
  });

  it("never puts request text in a notice", () => {
    expect(comingNotice("Home group", new Date(2026, 9, 20, 20, 0), "Sam")).toEqual({ title: "Home group prays together at 8:00 pm", body: "Sam will ring you on FaceTime." });
    expect(ringNotice("Home group", 4)).toEqual({ title: "Time to ring Home group", body: "4 people said they’d come." });
    expect(ringNotice("Home group", 0).body).toBe("No one has said they’d come yet.");
  });
});
