import { describe, expect, it } from "vitest";

import { verseRun } from "./sitVoice";

const words = (s: string) => s.split(" ");
const PSALM_23 = [
  { verse: 1, words: words("A Psalm of David. The LORD is my shepherd; I shall not want.") },
  { verse: 2, words: words("He makes me lie down in green pastures;") },
  { verse: 3, words: words("He restores my soul;") },
];

describe("Sit's words in the chapter's recording", () => {
  it("finds one verse whole", () => {
    expect(verseRun(words("He makes me lie down in green pastures;"), PSALM_23, 2)).toEqual([{ verse: 2, first: 0, count: 8, sitFirst: 0 }]);
  });

  it("starts past a psalm's title, which Sit leaves off", () => {
    expect(verseRun(words("The LORD is my shepherd; I shall not want."), PSALM_23, 1)).toEqual([{ verse: 1, first: 4, count: 9, sitFirst: 0 }]);
  });

  it("runs on through a short passage", () => {
    expect(verseRun(words("He makes me lie down in green pastures; He restores my soul;"), PSALM_23, 2)).toEqual([
      { verse: 2, first: 0, count: 8, sitFirst: 0 },
      { verse: 3, first: 0, count: 4, sitFirst: 8 },
    ]);
  });

  it("is null for words that aren't this text's, or that run past the chapter", () => {
    expect(verseRun(words("He maketh me to lie down in green pastures"), PSALM_23, 2)).toBeNull();
    expect(verseRun(words("He restores my soul; He leads me"), PSALM_23, 3)).toBeNull();
    expect(verseRun(words("He restores my soul;"), PSALM_23, 9)).toBeNull();
  });
});
