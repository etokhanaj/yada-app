import { describe, expect, it } from "vitest";

import {
  BOOK_ALIAS_CONFLICTS,
  BOOK_CODES,
  BOOK_ORDER,
  CANONICAL_VERSIFICATION,
  compareVerseRefs,
  isTitleVerse,
  VersificationSchema,
  formatDisplayRef,
  formatPericopeId,
  formatVerseId,
  isBookCode,
  isPericopeId,
  isVerseId,
  lookupBook,
  parseReference,
  parseVerseId,
  parseVerseRef,
  type BookCode,
} from "./refs.js";

describe("book table", () => {
  it("has all 66 books in canonical order", () => {
    expect(BOOK_ORDER).toHaveLength(66);
    expect(BOOK_ORDER[0]).toBe("GEN");
    expect(BOOK_ORDER[38]).toBe("MAL");
    expect(BOOK_ORDER[39]).toBe("MAT");
    expect(BOOK_ORDER[65]).toBe("REV");
  });

  it("splits 39 Old Testament and 27 New Testament books", () => {
    const testaments = BOOK_ORDER.map((code) => BOOK_CODES[code].testament);
    expect(testaments.filter((t) => t === "OT")).toHaveLength(39);
    expect(testaments.filter((t) => t === "NT")).toHaveLength(27);
  });

  it("uses unique 3-character codes whose order index matches position", () => {
    expect(new Set(BOOK_ORDER).size).toBe(66);
    BOOK_ORDER.forEach((code, index) => {
      expect(code).toHaveLength(3);
      expect(BOOK_CODES[code].order).toBe(index);
      expect(BOOK_CODES[code].chapters).toBeGreaterThan(0);
    });
  });

  it("has no book claiming another book's alias", () => {
    expect(BOOK_ALIAS_CONFLICTS).toEqual([]);
  });

  it("resolves every book by its own code and English name", () => {
    for (const code of BOOK_ORDER) {
      expect(lookupBook(code)).toBe(code);
      expect(lookupBook(BOOK_CODES[code].name)).toBe(code);
    }
  });

  it("rejects non-codes", () => {
    expect(isBookCode("JHN")).toBe(true);
    expect(isBookCode("XYZ")).toBe(false);
    expect(isBookCode(42)).toBe(false);
  });
});

describe("verse ids", () => {
  it("round-trips parse and format across all 66 books", () => {
    for (const code of BOOK_ORDER) {
      const chapters = BOOK_CODES[code].chapters;
      for (const chapter of [1, chapters]) {
        const id = formatVerseId(code, chapter, 1);
        const parsed = parseVerseId(id);
        expect(parsed, id).not.toBeNull();
        expect(parsed).toEqual({ book: code, chapter, verse: 1 });
        expect(formatVerseId(parsed!)).toBe(id);
      }
    }
  });

  it("rejects malformed ids, unknown books, and out-of-range chapters", () => {
    // Note: verse 0 is deliberately absent from this list — since schema 1.2.0
    // it addresses a superscription. Chapter 0 remains invalid.
    for (const bad of ["JHN.1", "JHN-1-1", "XYZ.1.1", "JHN.99.1", "JHN.0.1", "jhn.1.1", ""]) {
      expect(parseVerseId(bad), bad).toBeNull();
    }
    expect(isVerseId("1CO.14.34")).toBe(true);
    expect(isVerseId("1CO.14")).toBe(false);
  });

  it("orders refs canonically", () => {
    const gen = parseVerseId("GEN.1.1")!;
    const jhn1 = parseVerseId("JHN.1.1")!;
    const jhn3 = parseVerseId("JHN.1.3")!;
    expect(compareVerseRefs(gen, jhn1)).toBeLessThan(0);
    expect(compareVerseRefs(jhn3, jhn1)).toBeGreaterThan(0);
    expect(compareVerseRefs(jhn1, jhn1)).toBe(0);
  });

  it("formats a display reference", () => {
    expect(formatDisplayRef(parseVerseId("1CO.14.34")!)).toBe("1 Corinthians 14:34");
  });
});

describe("superscriptions", () => {
  it("addresses a Psalm title as verse 0", () => {
    const title = parseVerseId("PSA.23.0");
    expect(title).toEqual({ book: "PSA", chapter: 23, verse: 0 });
    expect(isTitleVerse(title!)).toBe(true);
    expect(isTitleVerse(parseVerseId("PSA.23.1")!)).toBe(false);
  });

  it("names a title rather than printing verse zero", () => {
    expect(formatDisplayRef(parseVerseId("PSA.23.0")!)).toBe("Psalm 23, title");
  });

  it("lets a range start at the title", () => {
    expect(parseVerseRef("PSA.23.0-23.6")?.start).toEqual({ chapter: 23, verse: 0 });
  });

  it("never accepts verse zero from human input", () => {
    // Someone typing "Psalm 23:0" has made a mistake, not asked for the title.
    expect(parseReference("Psalm 23:0")).toBeNull();
    expect(parseReference("psalm 23 0")).toBeNull();
  });

  it("normalises the corpus to one numbering tradition", () => {
    expect(CANONICAL_VERSIFICATION).toBe("english");
    expect(VersificationSchema.options).toContain("hebrew");
  });
});

describe("verse ranges", () => {
  it("accepts the four supported range shapes", () => {
    expect(parseVerseRef("1CO.14.34")).toEqual({
      book: "1CO",
      start: { chapter: 14, verse: 34 },
      end: { chapter: 14, verse: 34 },
    });
    expect(parseVerseRef("1CO.14.34-35")?.end).toEqual({ chapter: 14, verse: 35 });
    expect(parseVerseRef("1CO.14.26-14.40")?.end).toEqual({ chapter: 14, verse: 40 });
    expect(parseVerseRef("1CO.14.34-1CO.14.35")?.end).toEqual({ chapter: 14, verse: 35 });
  });

  it("rejects backwards ranges, cross-book ranges, and junk", () => {
    for (const bad of ["1CO.14.35-34", "1CO.14.34-JHN.1.1", "1CO.14.34-", "1CO.14.34-35-36", "nonsense"]) {
      expect(parseVerseRef(bad), bad).toBeNull();
    }
  });

  it("recognises pericope ids", () => {
    const start = parseVerseId("1CO.14.26")!;
    const end = parseVerseId("1CO.14.40")!;
    expect(formatPericopeId("1CO", start, end)).toBe("1CO.14.26-14.40");
    expect(isPericopeId("1CO.14.26-14.40")).toBe(true);
    expect(isPericopeId("1CO.14.26")).toBe(false);
    expect(isPericopeId("XYZ.1.1-1.2")).toBe(false);
  });
});

describe("parseReference", () => {
  const cases: Array<[string, BookCode, number, number | undefined]> = [
    ["John 3:16", "JHN", 3, 16],
    ["john 3 16", "JHN", 3, 16],
    ["Jn 3:16", "JHN", 3, 16],
    ["1 Cor 14:34", "1CO", 14, 34],
    ["1co 14 34", "1CO", 14, 34],
    ["Genesis 1", "GEN", 1, undefined],
    ["Rev 13:18", "REV", 13, 18],
    ["1 Corinthians 14:34", "1CO", 14, 34],
    ["I Corinthians 14:34", "1CO", 14, 34],
    ["II Cor 5:17", "2CO", 5, 17],
    ["First Peter 1:3", "1PE", 1, 3],
    ["  psalm   23:1  ", "PSA", 23, 1],
    ["ps 23", "PSA", 23, undefined],
    ["song of solomon 2:1", "SNG", 2, 1],
    ["Gen. 1:1", "GEN", 1, 1],
    ["1 sam 1:1", "1SA", 1, 1],
    ["MAT 5:44", "MAT", 5, 44],
    ["Isaiah 53.5", "ISA", 53, 5],
    ["Genesis", "GEN", 1, undefined],
  ];

  it.each(cases)("parses %s", (input, book, chapter, verse) => {
    const parsed = parseReference(input);
    expect(parsed, input).not.toBeNull();
    expect(parsed?.book).toBe(book);
    expect(parsed?.chapter).toBe(chapter);
    expect(parsed?.verse).toBe(verse);
  });

  it("reads a lone number as a verse in single-chapter books", () => {
    expect(parseReference("Jude 5")).toEqual({ book: "JUD", chapter: 1, verse: 5 });
    expect(parseReference("Obadiah 12")).toEqual({ book: "OBA", chapter: 1, verse: 12 });
    expect(parseReference("3 John 1")).toEqual({ book: "3JN", chapter: 1 });
  });

  it("returns null rather than guessing", () => {
    for (const bad of ["", "hello world", "42", "John Smith", "3:16", "Ezekiel 99:1", "gospel of thomas 1:1"]) {
      expect(parseReference(bad), bad).toBeNull();
    }
  });
});
