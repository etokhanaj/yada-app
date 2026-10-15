import { describe, expect, it } from "vitest";

import { afterVerse, keepStop, minutesLeft, passageStartIndex, statusLine, stopChoices, stopFrom, type VerseEnd } from "./stop";

// John 1 in miniature: passages open at verses 1, 4 and 7 (ords 101, 104, 107); the chapter has 9 verses.
const ords = [101, 102, 103, 104, 105, 106, 107, 108, 109];
const starts = new Set([101, 104, 107]);
const at = (index: number, rest: Partial<VerseEnd> = {}): VerseEnd => ({ index, ords, starts, stop: null, repeat: null, now: 0, ...rest });

describe("afterVerse with nothing set", () => {
  it("goes on to the next verse, and at the chapter's end too (advance turns the chapter)", () => {
    expect(afterVerse(at(0))).toEqual({ kind: "next" });
    expect(afterVerse(at(8))).toEqual({ kind: "next" });
  });
});

describe("Stop playing (LB-02, LB-04)", () => {
  it("stops at the end of this passage, not before", () => {
    const stop = { kind: "passage" } as const;
    expect(afterVerse(at(1, { stop }))).toEqual({ kind: "next" });
    expect(afterVerse(at(2, { stop }))).toEqual({ kind: "stop" });
  });

  it("stops at the end of this chapter", () => {
    const stop = { kind: "chapter" } as const;
    expect(afterVerse(at(2, { stop }))).toEqual({ kind: "next" });
    expect(afterVerse(at(8, { stop }))).toEqual({ kind: "stop" });
  });

  it("a timer finishes the verse it runs out in", () => {
    const stop = { kind: "time", until: 1000 } as const;
    expect(afterVerse(at(1, { stop, now: 999 }))).toEqual({ kind: "next" });
    expect(afterVerse(at(1, { stop, now: 1000 }))).toEqual({ kind: "stop" });
  });

  it("a book with no passages ends its passage at the chapter's end", () => {
    expect(afterVerse(at(2, { starts: null, stop: { kind: "passage" } }))).toEqual({ kind: "next" });
    expect(afterVerse(at(8, { starts: null, stop: { kind: "passage" } }))).toEqual({ kind: "stop" });
  });
});

describe("Repeat (LB-05, LB-06)", () => {
  it("a verse loops on itself", () => {
    expect(afterVerse(at(4, { repeat: "verse" }))).toEqual({ kind: "loop", index: 4 });
  });

  it("a passage loops to its own start, the latest passage start at or before the verse", () => {
    expect(afterVerse(at(4, { repeat: "passage" }))).toEqual({ kind: "next" });
    expect(afterVerse(at(5, { repeat: "passage" }))).toEqual({ kind: "loop", index: 3 });
    expect(afterVerse(at(8, { repeat: "passage" }))).toEqual({ kind: "loop", index: 6 });
  });

  it("a chapter loops at its end", () => {
    expect(afterVerse(at(5, { repeat: "chapter" }))).toEqual({ kind: "next" });
    expect(afterVerse(at(8, { repeat: "chapter" }))).toEqual({ kind: "loop", index: 0 });
  });

  it("a passage begun in the last chapter loops from verse 1", () => {
    expect(passageStartIndex(1, [201, 202, 203], new Set([204]))).toBe(0);
  });
});

describe("Stop and Repeat together (LB-07)", () => {
  it("the end of this passage while it repeats is the end of this time through", () => {
    expect(afterVerse(at(5, { repeat: "passage", stop: { kind: "passage" } }))).toEqual({ kind: "stop" });
  });

  it("a timer stops a repeated verse", () => {
    expect(afterVerse(at(4, { repeat: "verse", stop: { kind: "time", until: 10 }, now: 20 }))).toEqual({ kind: "stop" });
    expect(afterVerse(at(4, { repeat: "verse", stop: { kind: "time", until: 30 }, now: 20 }))).toEqual({ kind: "loop", index: 4 });
  });

  it("offers only the stops the loop will reach", () => {
    expect(stopChoices("verse", true)).toEqual(["time:15", "time:30", "time:60"]);
    expect(stopChoices("passage", true)).toEqual(["passage", "time:15", "time:30", "time:60"]);
    expect(stopChoices(null, true)).toEqual(["passage", "chapter", "time:15", "time:30", "time:60"]);
    expect(stopChoices(null, false)).toEqual(["chapter", "time:15", "time:30", "time:60"]);
  });

  it("a smaller repeat clears a stop it would never reach", () => {
    expect(keepStop({ kind: "chapter" }, "passage")).toBeNull();
    expect(keepStop({ kind: "passage" }, "verse")).toBeNull();
    expect(keepStop({ kind: "passage" }, "passage")).toEqual({ kind: "passage" });
    expect(keepStop({ kind: "time", until: 5 }, "verse")).toEqual({ kind: "time", until: 5 });
  });
});

describe("the player's line (LB-03, LB-06)", () => {
  const place = { chapter: 1, verse: 5, passageFirst: 1, passageLast: 18, chapterLast: 51, chapterTitle: "John 1" };

  it("says when it stops, in whole minutes rounded up", () => {
    expect(statusLine({ kind: "passage" }, null, place, 0)).toBe("Stops after 1:18");
    expect(statusLine({ kind: "chapter" }, null, place, 0)).toBe("Stops after 1:51");
    const timer = stopFrom("time:30", 0);
    expect(statusLine(timer, null, place, 3 * 60_000 + 1)).toBe("Stops in 27 min");
    expect(minutesLeft(timer, 30 * 60_000 - 1)).toBe(1);
  });

  it("names the repeat, then the stop", () => {
    expect(statusLine(null, "verse", place, 0)).toBe("Repeats 1:5");
    expect(statusLine(null, "chapter", place, 0)).toBe("Repeats John 1");
    expect(statusLine(stopFrom("time:15", 0), "passage", place, 3 * 60_000)).toBe("Repeats 1:1–18 · Stops in 12 min");
  });

  it("says nothing when nothing is set", () => {
    expect(statusLine(null, null, place, 0)).toBeNull();
  });
});
