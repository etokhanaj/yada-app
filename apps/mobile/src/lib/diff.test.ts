import { describe, expect, it } from "vitest";

import { foldWord, hasRealDivergence, markReadingDifferences, splitWords } from "./diff";

describe("word diff", () => {
  it("folds case, curly quotes and punctuation", () => {
    expect(foldWord("“Word,”")).toBe("word");
    expect(foldWord("hasn’t")).toBe("hasn't");
    expect(foldWord("—")).toBe("");
  });

  it("splits words and keeps the whitespace that followed", () => {
    expect(splitWords("In the  beginning").map((w) => [w.text, w.trailing])).toEqual([
      ["In", " "], ["the", "  "], ["beginning", ""],
    ]);
  });

  it("does not call punctuation a divergence", () => {
    expect(hasRealDivergence(["Jesus wept.", "Jesus wept!", "jesus  wept"])).toBe(false);
    expect(hasRealDivergence(["Jesus wept.", "Jesus cried."])).toBe(true);
  });
});

describe("markReadingDifferences (amendment 2)", () => {
  const BSB = "Women are to be silent in the churches. They are not permitted to speak, but must be in submission, as the law says.";
  const WEB = "Let the wives be quiet in the assemblies, for it has not been permitted for them to be talking except in submission, as the law also says,";
  const KJV = "Let your women keep silence in the churches: for it is not permitted unto them to speak; but they are commanded to be under obedience, as also saith the law.";

  it("treats a shared stem as the same word (silent / silence)", () => {
    const marked = markReadingDifferences(BSB, [WEB, KJV]).filter((w) => w.divergent).map((w) => w.text);
    expect(marked).not.toContain("silent");
    expect(marked).not.toContain("churches.");
  });

  it("never marks function words", () => {
    const marked = markReadingDifferences("must be in the", ["quite different words"]).filter((w) => w.divergent);
    expect(marked).toEqual([]);
  });

  it("marks a content word no other version uses", () => {
    expect(markReadingDifferences("ask something", ["ask anything"]).find((w) => w.text === "something")?.divergent).toBe(true);
  });

  it("marks nothing when the versions agree (JN-06)", () => {
    const t = "In the beginning was the Word, and the Word was with God, and the Word was God.";
    expect(markReadingDifferences(t, [t, t]).some((w) => w.divergent)).toBe(false);
  });
});
