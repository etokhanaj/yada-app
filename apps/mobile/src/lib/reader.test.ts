import { describe, expect, it } from "vitest";

import {
  barItems,
  chapterTitle,
  HEADER_START,
  headerOnScroll,
  type HeaderScroll,
  excerptOf,
  moreActions,
  splitSuperscription,
  scrollToClearBar,
  shortRef,
  splitDivineName,
} from "./reader";

describe("splitDivineName", () => {
  it("marks LORD for small capitals (Psalm 23:1)", () => {
    expect(splitDivineName("The LORD is my shepherd; I shall not want.")).toEqual([
      { text: "The ", smallCaps: false },
      { text: "LORD", smallCaps: true },
      { text: " is my shepherd; I shall not want.", smallCaps: false },
    ]);
  });

  it("handles the possessive and GOD", () => {
    expect(splitDivineName("the LORD’s house, O Lord GOD").filter((s) => s.smallCaps).map((s) => s.text)).toEqual([
      "LORD",
      "GOD",
    ]);
  });

  it("leaves Lord and God alone", () => {
    expect(splitDivineName("the Lord Jesus and God")).toEqual([{ text: "the Lord Jesus and God", smallCaps: false }]);
  });

  it("never changes the text", () => {
    const t = "Then the LORD God said, “LORD, LORD.”";
    expect(splitDivineName(t).map((s) => s.text).join("")).toBe(t);
  });
});

describe("titles", () => {
  it("names a psalm in the singular", () => {
    expect(chapterTitle("PSA", 23)).toBe("Psalm 23");
    expect(chapterTitle("1CO", 14)).toBe("1 Corinthians 14");
  });

  it("shortens the return chip the canvas way", () => {
    expect(shortRef({ book: "1CO", chapter: 14, verse: 34 })).toBe("1 Cor 14:34");
    expect(shortRef({ book: "2TH", chapter: 3, verse: 10 })).toBe("2 Thess 3:10");
    expect(shortRef({ book: "JHN", chapter: 1, verse: 1 })).toBe("John 1:1");
    expect(shortRef({ book: "SNG", chapter: 8, verse: 6 })).toBe("Song 8:6");
  });
});

describe("barItems", () => {
  it("leads with Understand when the verse has an entry", () => {
    expect(barItems(true, false)).toEqual(["understand", "original", "compare", "more"]);
  });

  it("drops Understand, with no placeholder, when it has none (J01-15)", () => {
    expect(barItems(false, false)).toEqual(["original", "compare", "more"]);
  });

  it("is two rows at AX sizes so the verse stays visible (E-02)", () => {
    expect(barItems(true, true)).toEqual(["understand", "more"]);
    expect(barItems(false, true)).toEqual(["original", "more"]);
  });

  it("moves the dropped actions into More at AX sizes", () => {
    expect(moreActions(true, true, false)).toEqual(["Original", "Compare", "Copy", "Share", "Bookmark"]);
    expect(moreActions(false, true, true)).toEqual(["Compare", "Copy", "Share", "Remove bookmark"]);
    expect(moreActions(true, false, false)).toEqual(["Copy", "Share", "Bookmark"]);
  });
});

describe("scrollToClearBar", () => {
  const bounds = { headerBottom: 100, barTop: 700 };

  it("leaves a verse that already fits", () => {
    expect(scrollToClearBar({ top: 300, bottom: 400 }, bounds)).toBe(0);
  });

  it("lifts a verse the bar would cover", () => {
    expect(scrollToClearBar({ top: 650, bottom: 760 }, bounds)).toBe(72);
  });

  it("brings down a verse under the header", () => {
    expect(scrollToClearBar({ top: 60, bottom: 160 }, bounds)).toBe(-52);
  });

  it("starts a too-tall selection at the header so its opening is visible", () => {
    expect(scrollToClearBar({ top: 400, bottom: 1400 }, bounds)).toBe(288);
  });
});

describe("headerOnScroll", () => {
  const run = (ys: number[], userDriven = true) =>
    ys.reduce<HeaderScroll>((s, y) => headerOnScroll(s, y, userDriven), HEADER_START);

  it("steps back after 24 pt of downward scroll", () => {
    expect(run([10, 20]).collapsed).toBe(false);
    expect(run([10, 20, 30]).collapsed).toBe(true);
  });

  it("restores on a small upward scroll", () => {
    expect(run([10, 40, 200, 195]).collapsed).toBe(true);
    expect(run([10, 40, 200, 190]).collapsed).toBe(false);
  });

  it("measures from where the direction changed", () => {
    // Up to 100, then down 20: not yet 24 from the turn.
    expect(run([40, 200, 100, 120]).collapsed).toBe(false);
    expect(run([40, 200, 100, 125]).collapsed).toBe(true);
  });

  it("is always expanded at the top", () => {
    expect(run([10, 200, 0]).collapsed).toBe(false);
  });

  it("never moves on scrolls the reader did not drag (VoiceOver, jumps)", () => {
    expect(run([10, 200, 400], false).collapsed).toBe(false);
  });
});

describe("splitSuperscription", () => {
  it("lifts Psalm 23's title onto its own line, losing no words", () => {
    const t = "A Psalm of David. The LORD is my shepherd; I shall not want.";
    const { title, body } = splitSuperscription(t);
    expect(title).toBe("A Psalm of David.");
    expect(body).toBe("The LORD is my shepherd; I shall not want.");
  });

  it("leaves other verses whole", () => {
    expect(splitSuperscription("In the beginning God created").title).toBeNull();
  });
});

describe("excerptOf", () => {
  it("drops a psalm's superscription (S18)", () => {
    expect(excerptOf("A Psalm of David. The LORD is my shepherd; I shall not want.")).toBe("The LORD is my shepherd; I shall not want.");
  });

  it("leaves ordinary verses alone", () => {
    expect(excerptOf("Early in the morning He went back into the temple courts.")).toBe(
      "Early in the morning He went back into the temple courts.",
    );
  });
});
