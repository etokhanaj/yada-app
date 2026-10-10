import { describe, expect, it } from "vitest";

import { pickCoverWord } from "./cover";

const john11 = [
  { surface: "Ἐν", translit: "en", gloss: "In" },
  { surface: "λόγος", translit: "logos", gloss: "Word" },
];

describe("pickCoverWord (DP-01)", () => {
  it("takes the first key word, with the token's sourced transliteration and gloss", () => {
    expect(pickCoverWord([{ surface: "λόγος" }], john11)).toEqual({ surface: "λόγος", translit: "logos", gloss: "Word" });
  });

  it("skips a key word that is not in the verse", () => {
    expect(pickCoverWord([{ surface: "θεός" }, { surface: "λόγος" }], john11)?.surface).toBe("λόγος");
  });

  it("gives no word when there is none to show (the title takes the slot)", () => {
    expect(pickCoverWord([], john11)).toBeNull();
  });
});
