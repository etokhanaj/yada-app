import { describe, expect, it } from "vitest";

import { bookProgress, chapterCells, chapterKey, endTitle, nextBookAfter, parseChapterKey, progressLabel, usesSegments } from "./chaptersRead";

describe("chapters read (build 10a)", () => {
  it("counts distinct chapters, once each", () => {
    const read = new Set([chapterKey("MRK", 1), chapterKey("MRK", 4), chapterKey("MRK", 4), chapterKey("LUK", 1)]);
    expect(bookProgress("MRK", read)).toEqual({ read: 2, total: 16, complete: false });
  });

  it("is complete only when every chapter is in", () => {
    const all = new Set(Array.from({ length: 16 }, (_, i) => chapterKey("MRK", i + 1)));
    expect(bookProgress("MRK", all).complete).toBe(true);
    all.delete(chapterKey("MRK", 9));
    expect(bookProgress("MRK", all)).toMatchObject({ read: 15, complete: false });
  });

  it("says \"You’ve read\" only for a complete book (rule 4)", () => {
    expect(endTitle("Mark", { read: 16, total: 16, complete: true })).toBe("You’ve read Mark.");
    expect(endTitle("Mark", { read: 13, total: 16, complete: false })).toBe("End of Mark.");
  });

  it("labels the bar with chapters read, not position", () => {
    expect(progressLabel("Mark", { read: 4, total: 16, complete: false })).toBe("Mark, 4 of 16 chapters read");
    expect(progressLabel("Jude", { read: 1, total: 1, complete: true })).toBe("Jude, 1 of 1 chapter read");
  });

  it("lights cells for the chapters read, in order", () => {
    expect(chapterCells("OBA", new Set([chapterKey("OBA", 1)]))).toEqual([true]);
    expect(chapterCells("MRK", new Set([chapterKey("MRK", 2)])).slice(0, 3)).toEqual([false, true, false]);
  });

  it("gives segments up to 30 chapters and one bar beyond (Psalms)", () => {
    expect(usesSegments(16)).toBe(true);
    expect(usesSegments(30)).toBe(true);
    expect(usesSegments(31)).toBe(false);
    expect(usesSegments(150)).toBe(false);
  });

  it("reads stored keys back and refuses what is not a chapter", () => {
    expect(parseChapterKey("MRK.4")).toEqual({ book: "MRK", chapter: 4 });
    for (const bad of ["MRK.17", "MRK.0", "XXX.1", "MRK", "MRK.4.1", "MRK.x", "constructor.1"]) expect(parseChapterKey(bad)).toBeNull();
  });

  it("goes on to the next book, and from Revelation to Psalms", () => {
    expect(nextBookAfter("MRK")).toBe("LUK");
    expect(nextBookAfter("REV")).toBe("PSA");
  });
});
