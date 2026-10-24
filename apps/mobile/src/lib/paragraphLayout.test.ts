import { describe, expect, it } from "vitest";

import { cutRuns, groupParagraphs, runSpans, textLength, verseRects } from "./paragraphLayout";

const v = (verse: number) => ({ ord: 43_001_000 + verse, verse });

describe("groupParagraphs", () => {
  it("starts a paragraph where asked, and always at the first verse", () => {
    const groups = groupParagraphs([1, 2, 3, 4, 5, 6].map(v), (x) => x.verse === 4);
    expect(groups.map((g) => g.map((x) => x.verse))).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it("passes the verse before, so a gap can break", () => {
    const groups = groupParagraphs([2, 3, 5].map(v), (x, before) => before !== undefined && before.verse + 1 < x.verse);
    expect(groups.map((g) => g.map((x) => x.verse))).toEqual([[2, 3], [5]]);
  });
});

describe("runSpans", () => {
  // "1 In the beginning" + " " + "2 He was"
  const runs = [
    { verse: 1, prefix: 2, body: 16, suffix: 0 },
    { verse: 2, prefix: 2, body: 6, suffix: 2 },
  ];

  it("joins runs by one space outside either verse", () => {
    expect(runSpans(runs)).toEqual([
      { verse: 1, start: 0, bodyStart: 2, end: 18 },
      { verse: 2, start: 19, bodyStart: 21, end: 29 },
    ]);
    expect(textLength(runs)).toBe(29);
  });

  it("cuts inside a verse's words, never inside its marks", () => {
    expect(cutRuns(runs, 10)).toEqual([
      { verse: 1, joinBefore: false, prefixBefore: true, bodyBefore: 8, suffixBefore: false },
      { verse: 2, joinBefore: false, prefixBefore: false, bodyBefore: 0, suffixBefore: false },
    ]);
    // A line that ends on the joining space: the next verse starts the second block whole.
    expect(cutRuns(runs, 19)[1]).toEqual({ verse: 2, joinBefore: true, prefixBefore: false, bodyBefore: 0, suffixBefore: false });
    expect(cutRuns(runs, 29)[1]).toEqual({ verse: 2, joinBefore: true, prefixBefore: true, bodyBefore: 6, suffixBefore: true });
  });

  it("finds each verse's lines, across two blocks", () => {
    const spans = runSpans(runs);
    const rects = verseRects(spans, [
      { offset: 0, top: 0, lines: [{ text: "1 In the ", y: 0, height: 30 }, { text: "beginning ", y: 30, height: 30 }] },
      { offset: 19, top: 60, lines: [{ text: "2 He was⁠￼", y: 0, height: 30 }] },
    ]);
    expect(rects.get(1)).toEqual({ top: 0, bottom: 60 });
    expect(rects.get(2)).toEqual({ top: 60, bottom: 90 });
  });

  it("lets two verses share a line", () => {
    const rects = verseRects(runSpans(runs), [{ offset: 0, top: 0, lines: [{ text: "x".repeat(25), y: 0, height: 30 }, { text: "abcd", y: 30, height: 30 }] }]);
    expect(rects.get(1)).toEqual({ top: 0, bottom: 30 });
    expect(rects.get(2)).toEqual({ top: 0, bottom: 60 });
  });
});
