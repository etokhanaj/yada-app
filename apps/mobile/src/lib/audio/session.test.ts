import { describe, expect, it } from "vitest";

import {
  afterVerse,
  canSpeak,
  followOffset,
  isSpeed,
  nowPlayingFor,
  progressSegments,
  rateFor,
  segmentFill,
  speedAccessibilityLabel,
  speedLabel,
} from "./session";

describe("canSpeak", () => {
  it("reads the built-in texts aloud and never a licensed or downloaded one", () => {
    for (const t of ["BSB", "WEB", "KJV", "LSV"]) expect(canSpeak(t)).toBe(true);
    for (const t of ["NIV", "NKJV", "NLT", "MSG", "YLT", "ASV"]) expect(canSpeak(t)).toBe(false);
  });
});

describe("speed", () => {
  it("offers 0.8, 1, 1.25 and 1.5 and nothing else", () => {
    expect([0.8, 1, 1.25, 1.5].every(isSpeed)).toBe(true);
    expect(isSpeed(2)).toBe(false);
  });

  it("labels the button as drawn and as VoiceOver reads it", () => {
    expect(speedLabel(1)).toBe("1×");
    expect(speedLabel(1.25)).toBe("1.25×");
    expect(speedAccessibilityLabel(1)).toBe("Speed, 1 times");
  });

  it("maps to AVSpeechUtterance's rate, 1× a step under the default 0.5", () => {
    expect(rateFor(1)).toBe(0.44);
    expect([0.8, 1, 1.25, 1.5].map(rateFor)).toEqual([0.25, 0.44, 0.525, 0.56]);
    expect(rateFor(3)).toBe(0.44);
  });
});

describe("afterVerse", () => {
  it("moves to the next verse, then the next chapter of the book", () => {
    expect(afterVerse(3, 51, "JHN", 1)).toEqual({ kind: "verse", index: 4 });
    expect(afterVerse(50, 51, "JHN", 1)).toEqual({ kind: "chapter", chapter: 2 });
  });

  it("stops at the end of a book", () => {
    expect(afterVerse(24, 25, "JHN", 21)).toEqual({ kind: "finished" });
    expect(afterVerse(0, 1, "OBA", 1)).toEqual({ kind: "finished" });
  });
});

describe("progressSegments", () => {
  // John 1's three passages (jhn.v2).
  const john1 = [
    { start_ord: 43001001, end_ord: 43001018 },
    { start_ord: 43001019, end_ord: 43001034 },
    { start_ord: 43001035, end_ord: 43001051 },
    { start_ord: 43002001, end_ord: 43002012 },
  ];

  it("splits John 1 at its passages", () => {
    expect(progressSegments(john1, 43001001, 51)).toEqual([
      { from: 1, to: 18 },
      { from: 19, to: 34 },
      { from: 35, to: 51 },
    ]);
  });

  it("is one segment when the chapter has no passages, and clips one that began earlier", () => {
    expect(progressSegments([], 1001001, 31)).toEqual([{ from: 1, to: 31 }]);
    expect(progressSegments([{ start_ord: 43006060, end_ord: 43007010 }], 43007001, 53)).toEqual([{ from: 1, to: 53 }]);
  });

  it("fills verse 5 of 1–18 to 5/18, as the frame does", () => {
    expect(segmentFill({ from: 1, to: 18 }, 5)).toBeCloseTo(5 / 18);
    expect(segmentFill({ from: 19, to: 34 }, 5)).toBe(0);
    expect(segmentFill({ from: 1, to: 18 }, 30)).toBe(1);
  });
});

describe("nowPlayingFor", () => {
  it("names the chapter and version over the verse", () => {
    expect(nowPlayingFor("John 1", "BSB", 5)).toEqual({ title: "John 1 · BSB", artist: "Verse 5" });
  });
});

describe("followOffset (AU-04, AU-05)", () => {
  it("puts the playing line 30% down the lyrics", () => {
    expect(followOffset(1000, 100, 600)).toBe(820);
  });

  it("starts a line too tall to finish above the bottom fade just under the top fade (AX5)", () => {
    expect(followOffset(1000, 400, 600)).toBeCloseTo(916);
  });

  it("never scrolls above the top", () => {
    expect(followOffset(50, 100, 600)).toBe(0);
  });
});
