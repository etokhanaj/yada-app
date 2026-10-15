import { describe, expect, it } from "vitest";

import { leadingInPhrase, sharedOpening } from "./sameWords";

const JOHN = "In the beginning was the Word, and the Word was with God, and the Word was God.";
const GENESIS = "In the beginning God created the heavens and the earth.";

describe("same first words (MM-02)", () => {
  it("finds John 1:1 and Genesis 1:1 opening alike in the BSB", () => {
    expect(sharedOpening(JOHN, GENESIS)).toBe("In the beginning");
    expect(sharedOpening("In the days of Herod", GENESIS)).toBeNull();
  });

  it("takes the original words that carry the phrase, and stops at the first that doesn't", () => {
    const greek = [
      { surface: "Ἐν", gloss: "In" },
      { surface: "ἀρχῇ", gloss: "beginning" },
      { surface: "ἦν", gloss: "was" },
    ];
    expect(leadingInPhrase(greek, "In the beginning").map((t) => t.surface)).toEqual(["Ἐν", "ἀρχῇ"]);
    expect(leadingInPhrase([{ surface: "בְּרֵאשִׁית", gloss: "in beginning" }, { surface: "בָּרָא", gloss: "created" }], "In the beginning").map((t) => t.surface)).toEqual(["בְּרֵאשִׁית"]);
  });
});
