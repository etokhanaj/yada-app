import { verseOrd } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { shortRange } from "./orientation";

describe("a book's orientation (OR-01 to OR-05)", () => {
  it("writes a section's range within its book", () => {
    expect(shortRange(verseOrd("JHN", 1, 1), verseOrd("JHN", 1, 18))).toBe("1:1–18");
    expect(shortRange(verseOrd("JHN", 1, 19), verseOrd("JHN", 2, 11))).toBe("1:19–2:11");
    expect(shortRange(verseOrd("JHN", 3, 16), verseOrd("JHN", 3, 16))).toBe("3:16");
  });
});
