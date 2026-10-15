import { describe, expect, it } from "vitest";

import {
  backAfterGap,
  bookThread,
  homeLead,
  listMark,
  nextPassage,
  nextRowReached,
  type Passage,
  passageIndexAt,
  pericopeOfReadThread,
  progressLabel,
  progressLine,
  readIndexes,
  READ_PREFIX,
  readThread,
  stepAfter,
} from "./startHere";

// The first four of John's 46 passages as the John bundle holds them, and the one that crosses a chapter.
const p = (pericope_id: string, label: string, start_ord: number, end_ord: number): Passage => ({ pericope_id, label, start_ord, end_ord });
const JOHN: Passage[] = [
  p("JHN.1.1-1.18", "The Word became flesh", 43001001, 43001018),
  p("JHN.1.19-1.34", "The testimony of John the Baptist", 43001019, 43001034),
  p("JHN.1.35-1.51", "The first disciples", 43001035, 43001051),
  p("JHN.2.1-2.12", "The wedding at Cana", 43002001, 43002012),
  p("JHN.7.53-8.11", "The woman caught in adultery", 43007053, 43008011),
];
const none = new Set<number>();

describe("read rows", () => {
  it("keys one thread_progress row per finished passage", () => {
    expect(readThread("JHN.1.1-1.18")).toBe("start-here-john/read/JHN.1.1-1.18");
    expect(pericopeOfReadThread("start-here-john/read/JHN.7.53-8.11")).toBe("JHN.7.53-8.11");
    expect(pericopeOfReadThread("start-here-john")).toBeNull();
  });

  it("counts finished passages by id and ignores ids it does not know", () => {
    expect([...readIndexes(JOHN, ["JHN.1.19-1.34", "JHN.99.1-99.2"])]).toEqual([1]);
  });
});

describe("nextPassage", () => {
  it("is the first passage before anything is read", () => {
    expect(nextPassage(5, none, -1)).toBe(0);
  });

  it("follows the passage last finished, not the lowest unread (edge case 3)", () => {
    // Read 3 first: 4 is next, though 1 and 2 are unread.
    expect(nextPassage(5, new Set([2]), 2)).toBe(3);
  });

  it("skips a passage already read and wraps to the start", () => {
    expect(nextPassage(5, new Set([1, 4]), 0)).toBe(2);
    expect(nextPassage(5, new Set([3, 4]), 4)).toBe(0);
  });

  it("is null once every passage is read (edge case 2)", () => {
    expect(nextPassage(5, new Set([0, 1, 2, 3, 4]), 4)).toBeNull();
  });
});

describe("passageIndexAt", () => {
  it("finds the passage across a chapter break (John 8:3 in 7:53–8:11)", () => {
    expect(passageIndexAt(JOHN, 43008003)).toBe(4);
    expect(passageIndexAt(JOHN, 43003001)).toBe(-1);
  });
});

describe("homeLead", () => {
  const lead = (read: Set<number>, lastFinished: number, place: { book: string; ord: number } | null) =>
    homeLead({ passages: JOHN, read, lastFinished, place });

  it("starts with Start here on first launch (ON-01)", () => {
    expect(lead(none, -1, null)).toEqual({ kind: "start" });
  });

  it("is Continue while a John passage is in progress (ON-05)", () => {
    expect(lead(new Set([0, 1]), 1, { book: "JHN", ord: 43001039 })).toEqual({ kind: "continue", passage: 2, johnNext: null });
  });

  it("becomes Next once the passage being read is finished (ON-07)", () => {
    expect(lead(new Set([0]), 0, { book: "JHN", ord: 43001001 })).toEqual({ kind: "next", passage: 1 });
  });

  it("never shows Next beside Continue inside John", () => {
    const l = lead(new Set([0]), 0, { book: "JHN", ord: 43001020 });
    expect(l).toEqual({ kind: "continue", passage: 1, johnNext: null });
  });

  it("outside John, Continues there with John's next as a quiet row (edge case 1)", () => {
    expect(lead(new Set([0]), 0, { book: "GEN", ord: 1003001 })).toEqual({ kind: "continue", passage: null, johnNext: 1 });
  });

  it("with all read, Continues at the place with no Next (edge case 2)", () => {
    const all = new Set([0, 1, 2, 3, 4]);
    expect(lead(all, 4, { book: "JHN", ord: 43001001 })).toEqual({ kind: "continue", passage: 0, johnNext: null });
    expect(lead(all, 4, { book: "GEN", ord: 1001001 })).toEqual({ kind: "continue", passage: null, johnNext: null });
  });

  it("shows Next, not Start here, when progress synced in without a place (edge case 8)", () => {
    expect(lead(new Set([0]), 0, null)).toEqual({ kind: "next", passage: 1 });
  });

  it("is Continue at a place between passages, or in a book with none", () => {
    expect(lead(none, -1, { book: "JHN", ord: 43003001 })).toEqual({ kind: "continue", passage: null, johnNext: null });
  });
});

describe("Start here list", () => {
  it("marks finished passages done and one Next, the rest plain (PG-06)", () => {
    const read = new Set([0, 2]);
    expect(JOHN.map((_, i) => listMark(i, read, nextPassage(5, read, 2)))).toEqual(["done", "todo", "done", "next", "todo"]);
  });

  it("has no Next once everything is read", () => {
    const all = new Set([0, 1, 2, 3, 4]);
    expect(JOHN.map((_, i) => listMark(i, all, nextPassage(5, all, 4)))).toEqual(["done", "done", "done", "done", "done"]);
  });

  it("counts finished passages, not the highest one reached", () => {
    expect(progressLine(new Set([9]).size, 46)).toBe("1 of 46 passages read");
  });

  it("names John to VoiceOver, as ON-05's label does", () => {
    expect(progressLabel(2, 46)).toBe("2 of 46 passages in John read");
  });
});

describe("nextRowReached (ON-04)", () => {
  it("counts the row once its bottom edge is on screen", () => {
    expect(nextRowReached(1200, 60, 600, 600)).toBe(false);
    expect(nextRowReached(1200, 60, 660, 600)).toBe(true);
  });

  it("counts a short guide whose row is visible without scrolling", () => {
    expect(nextRowReached(300, 60, 0, 600)).toBe(true);
  });

  it("does not count before the row or the sheet has been measured", () => {
    expect(nextRowReached(0, 0, 0, 600)).toBe(false);
    expect(nextRowReached(300, 60, 0, 0)).toBe(false);
  });
});

describe("progress from the passage boundary (MM-01)", () => {
  it("finishing passage k leaves step k + 1, the passage after it", () => {
    expect(stepAfter(0)).toBe(1);
    expect(stepAfter(4)).toBe(5);
  });

  it("keeps each book's rows under its own thread; John's stay Start here's", () => {
    expect(readThread("JHN.1.1-1.18", bookThread("JHN"))).toBe(`${READ_PREFIX}JHN.1.1-1.18`);
    expect(readThread("MRK.1.1-1.8", bookThread("MRK"))).toBe("book-MRK/read/MRK.1.1-1.8");
  });
});

describe("back after a gap (MM-05)", () => {
  it("is three days or more since the place was saved, and never without one", () => {
    const now = new Date("2026-10-13T08:00:00Z");
    expect(backAfterGap("2026-10-10T08:00:00Z", now)).toBe(true);
    expect(backAfterGap("2026-10-11T08:00:00Z", now)).toBe(false);
    expect(backAfterGap(null, now)).toBe(false);
    expect(backAfterGap("not a date", now)).toBe(false);
  });
});
