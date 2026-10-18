import { describe, expect, it } from "vitest";

import { chapterFromParams, formatRange, formatRangeInBook, nextChapter, prevChapter, printedRef, resolveRef } from "./chapters";

describe("chapter navigation", () => {
  it("moves within a book", () => {
    expect(nextChapter("JHN", 1)).toEqual({ book: "JHN", chapter: 2 });
    expect(prevChapter("JHN", 2)).toEqual({ book: "JHN", chapter: 1 });
  });

  it("crosses book boundaries", () => {
    expect(nextChapter("MAL", 4)).toEqual({ book: "MAT", chapter: 1 });
    expect(prevChapter("MAT", 1)).toEqual({ book: "MAL", chapter: 4 });
    expect(nextChapter("OBA", 1)).toEqual({ book: "JON", chapter: 1 });
  });

  it("stops at the ends of the canon", () => {
    expect(prevChapter("GEN", 1)).toBeNull();
    expect(nextChapter("REV", 22)).toBeNull();
  });

  it("sanitises route params", () => {
    expect(chapterFromParams("1co", "14")).toEqual({ book: "1CO", chapter: 14 });
    expect(chapterFromParams("1CO", "99")).toEqual({ book: "1CO", chapter: 1 });
    expect(chapterFromParams("XYZ", "2")).toEqual({ book: "JHN", chapter: 2 });
    expect(chapterFromParams(undefined, undefined)).toEqual({ book: "JHN", chapter: 1 });
  });
});

describe("refs", () => {
  it("resolves the shapes content uses", () => {
    expect(resolveRef("1CO.14.34")).toMatchObject({ book: "1CO", chapter: 14, startVerse: 34, startOrd: 46014034, endOrd: 46014034 });
    expect(resolveRef("1TI.2.11-12")).toMatchObject({ book: "1TI", chapter: 2, startVerse: 11, endOrd: 54002012 });
    expect(resolveRef("JHN.7.53-8.11")).toMatchObject({ startOrd: 43007053, endOrd: 43008011 });
    expect(resolveRef("nonsense")).toBeNull();
  });

  it("reads a printed reference as the data prints it (Read it alongside, VS-02, JR-05)", () => {
    expect(resolveRef("1 Jn 4:9-10")).toBeNull();
    expect(printedRef("1 Jn 4:9-10")).toBe("1JN.4.9-4.10");
    expect(printedRef("Matthew 14:13–21")).toBe("MAT.14.13-14.21");
    expect(printedRef("Gen 3:16")).toBe("GEN.3.16");
    expect(printedRef("1 Tim 2:11-15")).toBe("1TI.2.11-2.15");
    expect(printedRef("Song of Songs 2:1")).toBe("SNG.2.1");
    expect(printedRef("Luke 3:23–4:2")).toBe("LUK.3.23-4.2");
    expect(printedRef("Nowhere 3:1")).toBeNull();
    expect(printedRef("John 30:1")).toBeNull();
    expect(printedRef("Psalm 119:176")).toBe("PSA.119.176");
    expect(printedRef("John 3:177")).toBeNull();
    expect(printedRef("John 3:16-177")).toBeNull();
  });

  it("formats ranges for display", () => {
    expect(formatRange("1CO.14.26-14.40")).toBe("1 Corinthians 14:26–40");
    expect(formatRange("JHN.7.53-8.11")).toBe("John 7:53–8:11");
    expect(formatRange("PSA.23.1")).toBe("Psalm 23:1");
    expect(formatRange("PSA.23.0-23.6")).toBe("Psalm 23, title–6");
    expect(formatRange("PSA.23.1-24.2")).toBe("Psalms 23:1–24:2");
  });

  it("formats ranges without the book for a screen that names it", () => {
    expect(formatRangeInBook("JHN.1.1-1.18")).toBe("1:1–18");
    expect(formatRangeInBook("PSA.23.0-23.6")).toBe("23, title–6");
  });
});
