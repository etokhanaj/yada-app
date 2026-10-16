import { describe, expect, it } from "vitest";

import { afterNotNow, askNow, DEFAULT_REMINDER, nextInMcheyne, parseAsk, parseReminder, pausedWhileAway, psalmForDay, reminderSummary, storeAsk, upcomingTimes } from "./reminder";

describe("the reminder", () => {
  it("reads what it stored, and falls back on anything else", () => {
    expect(parseReminder(undefined)).toEqual(DEFAULT_REMINDER);
    expect(parseReminder("{bad")).toEqual(DEFAULT_REMINDER);
    expect(parseReminder(JSON.stringify({ on: true, hour: 25, minute: 5, kind: "today" }))).toMatchObject({ on: true, hour: 7, minute: 5, kind: "today" });
  });

  it("says its value as Settings shows it (ST-01)", () => {
    expect(reminderSummary({ ...DEFAULT_REMINDER, on: true })).toBe("7:30 · every day");
    expect(reminderSummary({ ...DEFAULT_REMINDER, on: true, evening: { hour: 19, minute: 0 } })).toBe("7:30 and 19:00 · every day");
    expect(parseReminder(JSON.stringify({ evening: { hour: 19, minute: 5 } })).evening).toEqual({ hour: 19, minute: 5 });
    expect(parseReminder(JSON.stringify({ evening: { hour: 30, minute: 0 } })).evening).toBeNull();
    expect(reminderSummary({ ...DEFAULT_REMINDER, on: true, days: [true, true, true, true, true, false, false] })).toBe("7:30 · weekdays");
    expect(reminderSummary(DEFAULT_REMINDER)).toBe("Off");
  });

  it("schedules each chosen day two weeks ahead, never in the past", () => {
    const now = new Date(2026, 9, 13, 8, 0); // Tuesday 13 October, after 7:30
    const times = upcomingTimes(now, { ...DEFAULT_REMINDER, on: true });
    expect(times[0]?.getDate()).toBe(14);
    expect(times).toHaveLength(14);
    const mondays = upcomingTimes(now, { ...DEFAULT_REMINDER, on: true, days: [true, false, false, false, false, false, false] });
    expect(mondays.map((d) => d.getDay())).toEqual([1, 1]);
  });

  it("has paused itself once the last one scheduled has passed (NT-09)", () => {
    const on = { ...DEFAULT_REMINDER, on: true };
    expect(pausedWhileAway("2026-10-01T07:30:00Z", on, new Date("2026-10-13T08:00:00Z"))).toBe(true);
    expect(pausedWhileAway("2026-10-20T07:30:00Z", on, new Date("2026-10-13T08:00:00Z"))).toBe(false);
    expect(pausedWhileAway("2026-10-01T07:30:00Z", DEFAULT_REMINDER, new Date("2026-10-13T08:00:00Z"))).toBe(false);
  });

  it("gives the same psalm to everyone on a day, going through all 150", () => {
    expect(psalmForDay(new Date(2026, 0, 1))).toBe(1);
    expect(psalmForDay(new Date(2026, 4, 30))).toBe(150);
    expect(psalmForDay(new Date(2026, 4, 31))).toBe(1);
  });

  it("names a plan's reading, never a day (NT-07)", () => {
    expect(nextInMcheyne(2, ["Genesis 2", "Matthew 2", "Ezra 2", "Acts 2"])).toEqual({ title: "M’Cheyne · Reading 2", body: "Genesis 2 · Matthew 2 · Ezra 2 · Acts 2" });
  });
});

describe("asking to turn the reminder on (NP-01–03)", () => {
  const day = 86_400_000;
  const ctx = { readCount: 1, on: false, permission: "undetermined" as const, now: 10 * day };

  it("asks at the end of the first passage, never at launch before one is read", () => {
    expect(askNow("passage-end", { kind: "never" }, ctx)).toBe(true);
    expect(askNow("passage-end", { kind: "never" }, { ...ctx, readCount: 0 })).toBe(false);
    expect(askNow("home", { kind: "never" }, ctx)).toBe(false);
  });

  it("after Not now, asks once more on Home three or more days later, then never", () => {
    const later = afterNotNow({ kind: "never" }, 8 * day);
    expect(askNow("passage-end", later, ctx)).toBe(false);
    expect(askNow("home", later, ctx)).toBe(false);
    expect(askNow("home", later, { ...ctx, now: 11 * day })).toBe(true);
    expect(afterNotNow(later, 11 * day)).toEqual({ kind: "done" });
    expect(askNow("home", { kind: "done" }, { ...ctx, now: 99 * day })).toBe(false);
  });

  it("never asks while the reminder is on, or once iOS has answered", () => {
    expect(askNow("passage-end", { kind: "never" }, { ...ctx, on: true })).toBe(false);
    expect(askNow("passage-end", { kind: "never" }, { ...ctx, permission: "denied" })).toBe(false);
    expect(askNow("passage-end", { kind: "never" }, { ...ctx, permission: "granted" })).toBe(false);
  });

  it("keeps its state as one stored string", () => {
    for (const s of [{ kind: "never" }, { kind: "later", at: 123 }, { kind: "done" }] as const) expect(parseAsk(storeAsk(s))).toEqual(s);
    expect(parseAsk("later:x")).toEqual({ kind: "never" });
  });
});
