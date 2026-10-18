import { describe, expect, it } from "vitest";

import { booksReadThrough, rangeInBook, recentTag, verseLabel, yourReadingLine } from "./saved";

describe("verseLabel", () => {
  it("names a single psalm a Psalm", () => {
    expect(verseLabel({ book: "PSA", chapter: 23, verse: 1 })).toBe("Psalm 23:1");
    expect(verseLabel({ book: "1CO", chapter: 14, verse: 34 })).toBe("1 Corinthians 14:34");
  });

  it("names a psalm title rather than verse 0", () => {
    expect(verseLabel({ book: "PSA", chapter: 3, verse: 0 })).toBe("Psalm 3, title");
  });
});

describe("recentTag", () => {
  it("is the word for a word card, Understand for everything else", () => {
    expect(recentTag("word_open", "σιγάω")).toBe("σιγάω");
    expect(recentTag("word_open", null)).toBe("Understand");
    expect(recentTag("claim_open", null)).toBe("Understand");
    expect(recentTag("passage_open", "ignored")).toBe("Understand");
  });
});

describe("rangeInBook", () => {
  it("drops the book name the page already shows", () => {
    expect(rangeInBook("JHN.1.35-1.51")).toBe("1:35–51");
    expect(rangeInBook("JHN.7.53-8.11")).toBe("7:53–8:11");
  });
});

describe("Your reading (PS-04)", () => {
  it("says the days this year and the book read through, as the frame does", () => {
    expect(yourReadingLine(41, ["RUT"])).toBe("41 days this year · Ruth read through");
  });

  it("counts several books rather than naming one, and says one day", () => {
    expect(yourReadingLine(1, ["RUT", "JUD"])).toBe("1 day this year · 2 books read through");
  });

  it("leaves the row out when there is nothing to say", () => {
    expect(yourReadingLine(0, [])).toBeNull();
    expect(yourReadingLine(0, ["JUD"])).toBe("Jude read through");
  });

  it("finds a book read through only when every chapter is read", () => {
    expect(booksReadThrough(new Set(["RUT.1", "RUT.2", "RUT.3", "RUT.4", "JHN.1"]))).toEqual(["RUT"]);
    expect(booksReadThrough(new Set(["RUT.1", "RUT.2", "RUT.3"]))).toEqual([]);
  });
});
