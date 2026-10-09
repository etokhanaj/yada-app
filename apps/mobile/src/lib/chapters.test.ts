import { describe, expect, it } from "vitest";

import { chapterFromParams, formatRange, nextChapter, prevChapter, resolveRef } from "./chapters";

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

  it("formats ranges for display", () => {
    expect(formatRange("1CO.14.26-14.40")).toBe("1 Corinthians 14:26–40");
    expect(formatRange("JHN.7.53-8.11")).toBe("John 7:53–8:11");
    expect(formatRange("PSA.23.1")).toBe("Psalms 23:1");
    expect(formatRange("PSA.23.0-23.6")).toBe("Psalms 23, title–6");
  });
});
