import { describe, expect, it } from "vitest";

import { SHEET_MEDIUM } from "../design/sheet";
import {
  barItems,
  barTopIn,
  sheetTopIn,
  chapterTitle,
  HEADER_START,
  headerOnScroll,
  type HeaderScroll,
  excerptOf,
  markSegments,
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
  it("leads with Understand, then Compare and More; Original leaves the bar (IA-05)", () => {
    expect(barItems(true, false)).toEqual(["understand", "compare", "more"]);
  });

  it("keeps Original when there is no Understand, as the only way to the Greek (J01-15)", () => {
    expect(barItems(false, false)).toEqual(["original", "compare", "more"]);
  });

  it("is two rows at AX sizes so the verse stays visible (E-02)", () => {
    expect(barItems(true, true)).toEqual(["understand", "more"]);
    expect(barItems(false, true)).toEqual(["original", "more"]);
  });

  it("moves Compare into More at AX sizes, and never Original", () => {
    expect(moreActions(true, false, true)).toEqual(["Compare", "Share as an image", "Share", "Bookmark"]);
    expect(moreActions(true, true, true)).toEqual(["Compare", "Share as an image", "Share", "Remove bookmark"]);
    expect(moreActions(false, false, true)).toEqual(["Share as an image", "Share", "Bookmark"]);
  });

  it("offers no image of a licensed translation's words (rule 9)", () => {
    expect(moreActions(false, false, false)).toEqual(["Share", "Bookmark"]);
  });
});

describe("markSegments", () => {
  it("flags the marked ranges and keeps the text whole", () => {
    const text = "In the beginning was the Word, and the Word was with God, and the Word was God.";
    const at = [...text.matchAll(/\bwas\b/g)].map((m) => [m.index, m.index + 3] as const);
    const out = markSegments([{ text, smallCaps: false }], at);
    expect(out.map((s) => s.text).join("")).toBe(text);
    expect(out.filter((s) => s.marked === true).map((s) => s.text)).toEqual(["was", "was", "was"]);
  });

  it("splits across a small-capitals segment", () => {
    const out = markSegments(splitDivineName("The LORD is my shepherd"), [[4, 11]]);
    expect(out.filter((s) => s.marked === true)).toEqual([
      { text: "LORD", smallCaps: true, marked: true },
      { text: " is", smallCaps: false, marked: true },
    ]);
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

  // Build-plan risk: the bar's placement logic needs its own tests (verse kept
  // above the bar). These follow the reader's two real callers.
  describe("in the reader", () => {
    // iPhone 15 portrait; the bar's height is measured on layout.
    const windowHeight = 852;
    const shift = (s: { top: number; bottom: number }, delta: number) => ({ top: s.top - delta, bottom: s.bottom - delta });

    it("puts the bar's top at the window height minus its measured height", () => {
      expect(barTopIn(windowHeight, 150)).toBe(702);
    });

    it("places nothing until the bar is measured, so the verse is never left under it", () => {
      expect(barTopIn(windowHeight, 0)).toBeNull();
    });

    it("keeps the selected verse 12 pt above the docked bar", () => {
      const barTop = barTopIn(windowHeight, 150) ?? 0;
      const verse = { top: 600, bottom: 720 };
      const delta = scrollToClearBar(verse, { headerBottom: 110, barTop });
      expect(delta).toBe(30);
      expect(shift(verse, delta).bottom).toBe(barTop - 12);
    });

    it("clears Understand's medium detent, which covers the bottom 55% (amendment 1)", () => {
      const sheetTop = sheetTopIn(windowHeight, SHEET_MEDIUM);
      expect(sheetTop).toBeCloseTo(383.4);
      const verse = { top: 500, bottom: 560 };
      const delta = scrollToClearBar(verse, { headerBottom: 110, barTop: sheetTop });
      expect(shift(verse, delta).bottom).toBeCloseTo(sheetTop - 12);
      expect(shift(verse, delta).top).toBeGreaterThanOrEqual(110 + 12);
    });

    it("leaves a selection that exactly fits the gap", () => {
      const bounds = { headerBottom: 110, barTop: 702 };
      expect(scrollToClearBar({ top: 122, bottom: 690 }, bounds)).toBe(0);
    });

    it("treats one point more than the gap as too tall: its opening stays at the header", () => {
      const bounds = { headerBottom: 110, barTop: 702 };
      expect(scrollToClearBar({ top: 122, bottom: 691 }, bounds)).toBe(0);
      expect(scrollToClearBar({ top: 300, bottom: 869 }, bounds)).toBe(178);
    });

    it("brings a verse down below the taller header at AX sizes", () => {
      // AX5: header and bar both grow; the bar shows two rows (E-02).
      const bounds = { headerBottom: 200, barTop: barTopIn(windowHeight, 260) ?? 0 };
      expect(scrollToClearBar({ top: 150, bottom: 300 }, bounds)).toBe(-62);
    });

    it("starts a long verse at the AX header when the gap cannot hold it", () => {
      const bounds = { headerBottom: 200, barTop: barTopIn(windowHeight, 260) ?? 0 };
      const verse = { top: 450, bottom: 900 };
      const delta = scrollToClearBar(verse, bounds);
      expect(shift(verse, delta).top).toBe(212);
    });
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
  it("skips a superscription that names a tune (Psalm 80, Psalm 8)", () => {
    expect(
      excerptOf("For the choirmaster. To the tune of “The Lilies of the Covenant.” A Psalm of Asaph. Hear us, O Shepherd of Israel"),
    ).toBe("Hear us, O Shepherd of Israel");
    expect(excerptOf("For the choirmaster. According to Gittith. A Psalm of David. O LORD, our Lord")).toBe("O LORD, our Lord");
  });

  it("drops a psalm's superscription (S18)", () => {
    expect(excerptOf("A Psalm of David. The LORD is my shepherd; I shall not want.")).toBe("The LORD is my shepherd; I shall not want.");
  });

  it("leaves ordinary verses alone", () => {
    expect(excerptOf("Early in the morning He went back into the temple courts.")).toBe(
      "Early in the morning He went back into the temple courts.",
    );
  });
});
