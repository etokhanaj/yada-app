import { verseOrd } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { isParagraphStart } from "./paragraphs";

describe("isParagraphStart", () => {
  it("has the BSB's breaks in John 1:1–18", () => {
    const starts = Array.from({ length: 18 }, (_, i) => i + 1).filter((v) => isParagraphStart(verseOrd("JHN", 1, v)));
    expect(starts).toEqual([1, 6, 9, 14, 15, 16]);
  });

  it("reads the first and last books", () => {
    expect(isParagraphStart(verseOrd("GEN", 1, 1))).toBe(true);
    expect(isParagraphStart(verseOrd("REV", 1, 1))).toBe(true);
  });

  it("is false outside the Bible", () => {
    expect(isParagraphStart(67_001_001)).toBe(false);
  });
});
