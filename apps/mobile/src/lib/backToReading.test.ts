import { describe, expect, it } from "vitest";

import { backPill, LEAVE_ROUTES, trailingSheets } from "./backToReading";

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

describe("‹ names a verse it goes back to (DN-06)", () => {
  it("shortens a verse or passage title to its reference", () => {
    expect(backPill("1 Corinthians 14:34")).toBe("14:34");
    expect(backPill("John 1:1–18")).toBe("1:1–18");
    expect(backPill("John 7:53–8:11")).toBe("7:53–8:11");
  });

  it("leaves any other page to the round glyph", () => {
    expect(backPill("Key words")).toBeNull();
    expect(backPill("Compare")).toBeNull();
    expect(backPill(null)).toBeNull();
  });
});
