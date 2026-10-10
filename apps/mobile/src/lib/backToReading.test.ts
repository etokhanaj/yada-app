import { describe, expect, it } from "vitest";

import { LEAVE_ROUTES, trailingSheets } from "./backToReading";

const READER = "read/[book]/[chapter]";

describe("back to reading", () => {
  it("pops both sheets above the reader; pushes inside a sheet are its own stack", () => {
    expect(trailingSheets(["index", READER, "understand", "evidence"])).toBe(2);
    expect(trailingSheets(["index", READER, "understand"])).toBe(1);
  });

  it("returns to the most recent reader after a jump", () => {
    expect(trailingSheets(["index", READER, READER, "understand"])).toBe(1);
  });

  it("returns to search when the sheet was opened from search", () => {
    expect(trailingSheets(["index", "search", "evidence"])).toBe(1);
  });

  it("does nothing when no sheet is open", () => {
    expect(trailingSheets(["index", READER])).toBe(0);
    expect(trailingSheets([])).toBe(0);
  });

  it("closes Search as well when leaving to read elsewhere", () => {
    expect(trailingSheets(["index", "search", "evidence"], LEAVE_ROUTES)).toBe(2);
    expect(trailingSheets(["index", "search"], LEAVE_ROUTES)).toBe(1);
  });
});
