import { BOOK_CODES, isBookCode } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { keyOf, MCHEYNE_READINGS, MCHEYNE_TOTAL, nextPortion, portionLabel, portionOfThread, portionSpoken, portionThread, readingsDone } from "./plans";

const none = { read: new Set<`${number}.${number}`>(), last: null };

describe("M'Cheyne's table", () => {
  it("has 365 readings of four portions, opening with Genesis 1 · Matthew 1 · Ezra 1 · Acts 1 (RP-02)", () => {
    expect(MCHEYNE_TOTAL).toBe(365);
    expect(MCHEYNE_READINGS.every((r) => r.length === 4)).toBe(true);
    expect(MCHEYNE_READINGS[0]?.map(portionLabel)).toEqual(["Genesis 1", "Matthew 1", "Ezra 1", "Acts 1"]);
  });

  it("names joined chapters and verse ranges as a reader would", () => {
    expect(portionLabel(MCHEYNE_READINGS[8]?.[0] ?? [])).toBe("Genesis 9, 10");
    const ps119 = MCHEYNE_READINGS.flat().find((p) => p[0]?.b === "PSA" && p[0].c === 119);
    expect(portionLabel(ps119 ?? [])).toBe("Psalms 119:1–24");
    expect(portionSpoken(ps119 ?? [])).toBe("Psalms 119, verses 1 to 24");
  });
});

describe("the next portion, with no dates", () => {
  it("is Genesis 1 before anything is read", () => {
    expect(nextPortion(none)).toEqual({ reading: 0, portion: 0 });
  });

  it("follows the last one finished, after a gap too (RP-03)", () => {
    const read = new Set([keyOf(0, 0), keyOf(0, 1), keyOf(0, 2), keyOf(0, 3), keyOf(1, 0)]);
    expect(nextPortion({ read, last: { reading: 1, portion: 0 } })).toEqual({ reading: 1, portion: 1 });
    expect(readingsDone({ read, last: null })).toEqual([0]);
  });

  it("is null once all 1,460 portions are read (DN-03)", () => {
    const read = new Set(MCHEYNE_READINGS.flatMap((r, ri) => r.map((_, pi) => keyOf(ri, pi))));
    expect(nextPortion({ read, last: { reading: 364, portion: 3 } })).toBeNull();
  });

  it("keys a finished portion as a synced thread row", () => {
    expect(portionThread(4, 2)).toBe("plan-mcheyne/read/4.2");
    expect(portionOfThread("plan-mcheyne/read/4.2")).toEqual({ reading: 4, portion: 2 });
    expect(portionOfThread("start-here-john/read/JHN.1.1-1.18")).toBeNull();
  });
});

describe("the table's shape (the JSON is cast, so it is checked here)", () => {
  it("names only real books and chapters, and verse ranges that run forwards", () => {
    for (const reading of MCHEYNE_READINGS) {
      for (const portion of reading) {
        expect(portion.length).toBeGreaterThan(0);
        for (const s of portion) {
          expect(isBookCode(s.b)).toBe(true);
          expect(s.c >= 1 && s.c <= BOOK_CODES[s.b].chapters).toBe(true);
          if (s.vs !== undefined) expect((s.ve ?? 0) >= s.vs).toBe(true);
        }
      }
    }
  });
});
