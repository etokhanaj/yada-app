import { describe, expect, it } from "vitest";

import { sameOpening } from "./echo";

// Glosses as the core bundle has them (STEPBible TAGNT / TAHOT).
const john11 = [
  { surface: "Ἐν", gloss: "In" },
  { surface: "ἀρχῇ", gloss: "beginning" },
  { surface: "ἦν", gloss: "was" },
];
const gen11 = [
  { surface: "בְּרֵאשִׁ֖ית", gloss: "in beginning" },
  { surface: "בָּרָ֣א", gloss: "he created" },
];
const psa231 = [
  { surface: "יְהוָ֥ה", gloss: "Yahweh" },
  { surface: "רֹ֝עִ֗י", gloss: "shepherd my" },
];
const jhn1011 = [
  { surface: "Ἐγώ", gloss: "I myself" },
  { surface: "εἰμι", gloss: "am" },
];

describe("sameOpening (D-03)", () => {
  it("pairs Ἐν ἀρχῇ with בְּרֵאשִׁית", () => {
    const pair = sameOpening(john11, gen11);
    expect(pair?.a.map((w) => w.surface)).toEqual(["Ἐν", "ἀρχῇ"]);
    expect(pair?.b.map((w) => w.surface)).toEqual(["בְּרֵאשִׁ֖ית"]);
    expect(pair?.gloss).toBe("in beginning");
  });

  it("finds nothing when the openings differ (Psalm 23:1, John 10:11)", () => {
    expect(sameOpening(psa231, jhn1011)).toBeNull();
  });

  it("never calls a single shared word an echo", () => {
    expect(sameOpening([{ surface: "καὶ", gloss: "and" }], [{ surface: "וְ", gloss: "and" }])).toBeNull();
  });

  it("ignores words without a gloss", () => {
    expect(sameOpening([{ surface: "x", gloss: null }], gen11)).toBeNull();
  });
});
