import { describe, expect, it } from "vitest";

import { changeLine, changeText, foldWord, hasRealDivergence, splitWords } from "./diff";

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
