import { describe, expect, it } from "vitest";

import { DEFAULT_REMINDER, type ReminderPrefs } from "./reminder";
import { anchorAt, ANCHORS, minutesSpoken, quietUntil, remindersBeforeWelcome, showReturn, smallOptions, welcomeBackAt, welcomeBackTitle } from "./lapse";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 18, 12);
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
const base = { now: NOW, lastOpenAt: iso(31), shownAt: undefined, hasPlace: true, plainOpen: true };

describe("RT-01: back after 30 days or more", () => {
  it("shows on a plain open after 30 days", () => {
    expect(showReturn(base)).toBe(true);
    expect(showReturn({ ...base, lastOpenAt: iso(30) })).toBe(true);
  });

  it("does not show before 30 days, however the days run", () => {
    expect(showReturn({ ...base, lastOpenAt: iso(29) })).toBe(false);
    expect(showReturn({ ...base, lastOpenAt: iso(8) })).toBe(false);
  });

  it("never intercepts a way in: widget, notification, Siri, Spotlight, link (rule 1)", () => {
    expect(showReturn({ ...base, plainOpen: false })).toBe(false);
  });

  it("needs a saved place and a history (rule 3)", () => {
    expect(showReturn({ ...base, hasPlace: false })).toBe(false);
    expect(showReturn({ ...base, lastOpenAt: undefined })).toBe(false);
    expect(showReturn({ ...base, lastOpenAt: "not a date" })).toBe(false);
  });

  it("is not shown again within 14 days of being shown", () => {
    expect(showReturn({ ...base, shownAt: iso(13) })).toBe(false);
    expect(showReturn({ ...base, shownAt: iso(14) })).toBe(true);
  });
});

describe("RT-06: one welcome back, then silence", () => {
  const prefs: ReminderPrefs = { ...DEFAULT_REMINDER, on: true, hour: 7, minute: 30 };
  const now = new Date(2026, 9, 18, 9, 0);

  it("falls seven days on, at the reminder's time", () => {
    expect(welcomeBackAt(now, prefs)).toEqual(new Date(2026, 9, 25, 7, 30));
  });

  it("keeps the ordinary reminders to the days before it", () => {
    const times = remindersBeforeWelcome(now, prefs);
    expect(times).toHaveLength(6);
    expect(times[0]).toEqual(new Date(2026, 9, 19, 7, 30));
    expect(times.at(-1)).toEqual(new Date(2026, 9, 24, 7, 30));
  });

  it("moves to the next day the reader allows", () => {
    const weekdays = { ...prefs, days: [true, true, true, true, true, false, false] };
    // 17 Oct 2026 is a Saturday: seven days on is Saturday 24, so Monday 26.
    expect(welcomeBackAt(new Date(2026, 9, 17, 9, 0), weekdays)).toEqual(new Date(2026, 9, 26, 7, 30));
  });

  it("counts reminders as paused only after three weeks", () => {
    expect(quietUntil(now).getTime() - now.getTime()).toBe(21 * DAY);
  });

  it("says the place and nothing from the reader", () => {
    expect(welcomeBackTitle("Mark 4")).toBe("You were in Mark 4");
  });
});

describe("RT-07: start small", () => {
  it("offers three ways in with how long each takes", () => {
    expect(smallOptions("Mark 4")).toEqual([
      { kind: "verse", title: "The day’s verse", minutes: 1 },
      { kind: "psalm", title: "A psalm", minutes: 3 },
      { kind: "continue", title: "Continue Mark 4", minutes: 5 },
    ]);
  });

  it("offers no Continue without a place", () => {
    expect(smallOptions(null).map((o) => o.kind)).toEqual(["verse", "psalm"]);
  });

  it("speaks minutes in words", () => {
    expect(minutesSpoken(1)).toBe("1 minute");
    expect(minutesSpoken(3)).toBe("3 minutes");
  });
});

describe("RT-05: the anchor", () => {
  it("has four ways in, each with its own default time", () => {
    expect(ANCHORS.map((a) => `${a.hour}:${String(a.minute).padStart(2, "0")}`)).toEqual(["7:30", "12:30", "18:00", "21:00"]);
  });

  it("finds the anchor a time belongs to, and none once the reader has moved it", () => {
    expect(anchorAt(12, 30)).toBe("midday");
    expect(anchorAt(8, 15)).toBeNull();
  });
});
