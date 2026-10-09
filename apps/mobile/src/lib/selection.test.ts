import { describe, expect, it } from "vitest";

import { EMPTY_SELECTION, formatSpan, isSelected, selectionSpan, spanRef, tapVerse } from "./selection";

describe("tap-to-extend selection", () => {
  it("selects a verse on the first tap", () => {
    expect(selectionSpan(tapVerse(EMPTY_SELECTION, 34))).toEqual({ start: 34, end: 34 });
  });

  it("clears when the only selected verse is tapped again", () => {
    expect(tapVerse(tapVerse(EMPTY_SELECTION, 34), 34)).toEqual(EMPTY_SELECTION);
  });

  it("extends forwards and backwards without dragging", () => {
    const one = tapVerse(EMPTY_SELECTION, 34);
    expect(selectionSpan(tapVerse(one, 36))).toEqual({ start: 34, end: 36 });
    expect(selectionSpan(tapVerse(one, 31))).toEqual({ start: 31, end: 34 });
  });

  it("starts afresh after a range exists", () => {
    const range = tapVerse(tapVerse(EMPTY_SELECTION, 1), 5);
    expect(selectionSpan(tapVerse(range, 3))).toEqual({ start: 3, end: 3 });
  });

  it("reports membership inclusively", () => {
    const range = tapVerse(tapVerse(EMPTY_SELECTION, 5), 2);
    expect([1, 2, 3, 5, 6].map((v) => isSelected(range, v))).toEqual([false, true, true, true, false]);
    expect(isSelected(EMPTY_SELECTION, 1)).toBe(false);
  });

  it("formats labels and refs", () => {
    expect(formatSpan("John", 1, { start: 1, end: 1 })).toBe("John 1:1");
    expect(formatSpan("1 Corinthians", 14, { start: 34, end: 35 })).toBe("1 Corinthians 14:34–35");
    expect(spanRef("1CO", 14, { start: 34, end: 34 })).toBe("1CO.14.34");
    expect(spanRef("1CO", 14, { start: 34, end: 35 })).toBe("1CO.14.34-35");
  });
});
