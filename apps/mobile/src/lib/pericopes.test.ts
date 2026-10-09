import { describe, expect, it } from "vitest";

import { overlaps, pericopeForVerse, resolvePassage, type EntryRow, type PericopeRow } from "./pericopes";

const p = (id: string, label: string, start: number, end: number): PericopeRow => ({
  pericope_id: id, label, start_ord: start, end_ord: end, review_status: null, payload: null,
});
const e = (id: string, ord: number): EntryRow => ({
  verse_id: id, ord, pericope_id: "x", review_status: "flagged", payload: "{}",
});

const JOHN = [
  p("JHN.1.1-1.18", "The Word became flesh", 43001001, 43001018),
  p("JHN.1.19-1.34", "The testimony of John the Baptist", 43001019, 43001034),
  p("JHN.7.53-8.11", "The woman caught in adultery", 43007053, 43008011),
];

describe("passage resolution", () => {
  it("detects overlap at the edges", () => {
    expect(overlaps(1, 5, 5, 9)).toBe(true);
    expect(overlaps(1, 4, 5, 9)).toBe(false);
  });

  it("resolves a selection inside one pericope to that pericope", () => {
    const r = resolvePassage(JOHN, [e("JHN.1.1", 43001001)], 43001001, 43001003);
    expect(r.pericopes.map((x) => x.pericope.label)).toEqual(["The Word became flesh"]);
    expect(r.pericopes[0]?.entries.map((x) => x.verse_id)).toEqual(["JHN.1.1"]);
    expect(r.loose).toEqual([]);
  });

  it("splits a selection that crosses a boundary, clipped, in reading order", () => {
    const r = resolvePassage([...JOHN].reverse(), [], 43001017, 43001020);
    expect(r.pericopes.map((x) => [x.pericope.pericope_id, x.startOrd, x.endOrd])).toEqual([
      ["JHN.1.1-1.18", 43001017, 43001018],
      ["JHN.1.19-1.34", 43001019, 43001020],
    ]);
  });

  it("follows a pericope across a chapter boundary", () => {
    const r = resolvePassage(JOHN, [], 43008001, 43008002);
    expect(r.pericopes[0]?.pericope.label).toBe("The woman caught in adultery");
  });

  it("keeps entries no pericope covers instead of dropping them", () => {
    const r = resolvePassage([], [e("1CO.14.34", 46014034), e("1CO.14.40", 46014040)], 46014033, 46014035);
    expect(r.pericopes).toEqual([]);
    expect(r.loose.map((x) => x.verse_id)).toEqual(["1CO.14.34"]);
  });

  it("never assigns one entry to two overlapping pericopes", () => {
    const nested = [p("A", "outer", 10, 20), p("B", "inner", 12, 14)];
    const r = resolvePassage(nested, [e("v13", 13)], 10, 20);
    const all = r.pericopes.flatMap((x) => x.entries.map((y) => y.verse_id));
    expect(all).toEqual(["v13"]);
  });

  it("picks the narrowest pericope containing a verse", () => {
    const nested = [p("A", "outer", 10, 20), p("B", "inner", 12, 14)];
    expect(pericopeForVerse(nested, 13)?.pericope_id).toBe("B");
    expect(pericopeForVerse(nested, 19)?.pericope_id).toBe("A");
    expect(pericopeForVerse(nested, 30)).toBeNull();
  });
});
