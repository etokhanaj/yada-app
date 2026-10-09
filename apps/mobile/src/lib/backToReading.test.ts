import { describe, expect, it } from "vitest";

import { trailingSheets } from "./backToReading";

const READER = "read/[book]/[chapter]";

describe("back to reading", () => {
  it("pops every sheet above the reader, however deep", () => {
    expect(trailingSheets(["index", READER, "understand", "why"])).toBe(2);
    expect(trailingSheets(["index", READER, "understand", "word", "occurrences"])).toBe(3);
  });

  it("returns to the most recent reader after a jump", () => {
    expect(trailingSheets(["index", READER, READER, "understand"])).toBe(1);
  });

  it("returns to search when the sheet was opened from search", () => {
    expect(trailingSheets(["index", "search", "occurrences"])).toBe(1);
  });

  it("does nothing when no sheet is open", () => {
    expect(trailingSheets(["index", READER])).toBe(0);
    expect(trailingSheets([])).toBe(0);
  });
});
