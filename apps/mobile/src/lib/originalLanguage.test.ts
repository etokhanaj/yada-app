import { describe, expect, it } from "vitest";

import { originalLanguage } from "./originalLanguage";

describe("originalLanguage", () => {
  it("reads the morphology's language letter, not the book's script", () => {
    expect(originalLanguage("hebrew", ["A"])).toBe("Aramaic");
    expect(originalLanguage("hebrew", ["H"])).toBe("Hebrew");
    expect(originalLanguage("hebrew", ["H", "A"])).toBe("Hebrew and Aramaic");
  });

  it("falls back to the script where the verse has no words, and Greek stays Greek", () => {
    expect(originalLanguage("hebrew", [])).toBe("Hebrew");
    expect(originalLanguage("greek", ["A"])).toBe("Greek");
  });
});
