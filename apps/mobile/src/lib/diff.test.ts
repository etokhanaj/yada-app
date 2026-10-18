import { describe, expect, it } from "vitest";

import { agreeLine, changeLine, changeText, compareVerse, foldWord, hasRealDivergence, splitWords } from "./diff";

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

describe("Compare's line of changes (CP-01–04)", () => {
  it("names each run that differs, punctuation never counting", () => {
    expect(changeText(changeLine("The Light shines in the darkness, and the darkness has not overcome it.", "The light shines in the darkness, and the darkness hasn’t overcome it."))).toBe("has not → hasn’t");
  });

  it("shows two runs, then how many more", () => {
    const line = changeLine(
      "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.",
      "For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.",
    );
    expect(line.changes).toHaveLength(2);
    expect(changeText(line)).toMatch(/1 more change$/u);
  });

  it("says a verse worded differently throughout, rather than listing every word", () => {
    expect(changeText(changeLine("Women are to be silent in the churches.", "Let your women keep silence in the assemblies."))).toBe("Worded differently throughout");
  });

  it("is empty when only punctuation differs", () => {
    expect(changeText(changeLine("Jesus wept.", "Jesus wept"))).toBe("");
  });
});

const BSB_1_5 = "The Light shines in the darkness, and the darkness has not overcome it.";
const marks = (yours: string, other: string) => compareVerse(yours, other).pieces.filter((p) => p.marked).map((p) => p.text);

describe("Compare's difference marks (CP-01–05)", () => {
  it("marks the words said in place of yours and keeps the text exactly", () => {
    const web = "The light shines in the darkness, and the darkness hasn’t overcome it.";
    expect(compareVerse(BSB_1_5, web).pieces.map((p) => p.text).join("")).toBe(web);
    expect(marks(BSB_1_5, web)).toEqual(["hasn’t"]);
  });

  it("names replacements before additions, as CP-01 draws the KJV", () => {
    const kjv = "And the light shineth in darkness; and the darkness comprehended it not.";
    const c = compareVerse(BSB_1_5, kjv);
    expect(c.line.changes[0]).toBe("shines in the → shineth in");
    expect(c.line.more).toBe(1);
    // The opening "And" has nothing of yours opposite it: counted, not marked.
    expect(marks(BSB_1_5, kjv)).not.toContain("And");
    expect(marks(BSB_1_5, kjv).slice(0, 2)).toEqual(["shineth", "in"]);
  });

  it("marks a shared word inside a change on both sides (CP-02)", () => {
    const bsb = "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.";
    const web = "For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.";
    expect(changeText(compareVerse(bsb, web).line).replace(/\u00a0/gu, " ")).toBe("one and only → only born · everyone who → whoever · 1 more change");
    expect(marks(bsb, web)).toEqual(["only", "born", "whoever", "should"]);
  });

  it("leaves punctuation outside the mark (CP-04)", () => {
    const pieces = compareVerse("Women are to be silent in the churches.", "Women are to be silent in the assemblies, as the law says").pieces;
    expect(pieces).toContainEqual({ text: "assemblies", marked: true });
  });

  it("still calls 1 Corinthians 14:34 in the KJV worded differently throughout, and marks it (CP-04)", () => {
    const bsb = "Women are to be silent in the churches. They are not permitted to speak, but must be in submission, as the law says.";
    const kjv = "Let your women keep silence in the churches: for it is not permitted unto them to speak; but they are commanded to be under obedience, as also saith the law.";
    const c = compareVerse(bsb, kjv);
    expect(changeText(c.line)).toBe("Worded differently throughout");
    expect(marks(bsb, kjv)).toContain("obedience");
  });

  it("orders a deletion after the replacement (CP-05, John 1:3 in the WEB)", () => {
    const bsb = "Through Him all things were made, and without Him nothing was made that has been made.";
    const web = "All things were made through him. Without him, nothing was made that has been made.";
    expect(changeText(compareVerse(bsb, web).line).replace(/\u00a0/gu, " ")).toBe("and → through him · 1 more change");
    expect(marks(bsb, web)).toEqual(["through", "him"]);
  });
});

describe("agreeLine (CP-03)", () => {
  it("says the count in words", () => {
    expect(agreeLine(4)).toBe("All four say the same.");
    expect(agreeLine(3)).toBe("All three say the same.");
    expect(agreeLine(2)).toBe("Both say the same.");
  });
});
