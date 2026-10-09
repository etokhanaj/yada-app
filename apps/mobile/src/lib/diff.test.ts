import { describe, expect, it } from "vitest";

import { compareTranslations, foldWord, hasRealDivergence, lcsMatches, splitWords } from "./diff";

const marked = (words: Array<{ text: string; divergent: boolean }>): string[] =>
  words.filter((w) => w.divergent).map((w) => w.text);

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

  it("matches a longest common subsequence", () => {
    const { a, b } = lcsMatches(splitWords("a b c d"), splitWords("a x c d"));
    expect(a).toEqual([true, false, true, true]);
    expect(b).toEqual([true, false, true, true]);
  });

  it("marks words that differ from the text being read", () => {
    const [base, kjv] = compareTranslations(
      { translation: "BSB", text: "In the beginning was the Word, and the Word was with God." },
      [{ translation: "KJV", text: "In the beginning was the Word, and the Word was with God." }],
    );
    expect(marked(base?.words ?? [])).toEqual([]);
    expect(marked(kjv?.words ?? [])).toEqual([]);

    const [bsb, web] = compareTranslations(
      { translation: "BSB", text: "The LORD is my shepherd; I shall not want." },
      [{ translation: "WEB", text: "The LORD is my shepherd; I shall lack nothing." }],
    );
    expect(marked(bsb?.words ?? [])).toEqual(["not", "want."]);
    expect(marked(web?.words ?? [])).toEqual(["lack", "nothing."]);
  });

  it("marks a base word only when no compared version shares it", () => {
    const [base, b, c] = compareTranslations({ translation: "A", text: "a b c d" }, [
      { translation: "B", text: "a b c" },
      { translation: "C", text: "a c" },
    ]);
    expect(marked(base?.words ?? [])).toEqual(["d"]);
    expect(marked(b?.words ?? [])).toEqual([]);
    expect(marked(c?.words ?? [])).toEqual([]);
  });

  it("does not call punctuation a divergence", () => {
    expect(hasRealDivergence(["Jesus wept.", "Jesus wept!", "jesus  wept"])).toBe(false);
    expect(hasRealDivergence(["Jesus wept.", "Jesus cried."])).toBe(true);
  });
});
