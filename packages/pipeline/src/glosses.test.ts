import { describe, expect, it } from "vitest";

import { cleanGloss, normalizeGreek, normalizeHebrew } from "./glosses.js";

describe("surface normalisation for alignment", () => {
  it("folds Greek accents, breathings, case and final sigma", () => {
    expect(normalizeGreek("Λόγος")).toBe(normalizeGreek("λογος"));
    expect(normalizeGreek("Ἀβραάμ.")).toBe("αβρααμ");
    expect(normalizeGreek("ᾧ")).toBe("ω");
  });

  it("reduces Hebrew to consonants, ignoring pointing, cantillation and separators", () => {
    // OSHB separates morphemes with "/"; TAHOT does too, and adds "\" before punctuation.
    expect(normalizeHebrew("בְּ/רֵאשִׁ֖ית")).toBe(normalizeHebrew("בְּרֵאשִׁית"));
    expect(normalizeHebrew("הָ/אָֽרֶץ\\׃")).toBe("הארצ");
  });

  it("folds final letter forms so a split word still matches", () => {
    expect(normalizeHebrew("שָּׁמַ֖יִם")).toBe("שמימ");
  });
});

describe("gloss cleaning", () => {
  it("drops words the original does not have", () => {
    // Square brackets mark English the translation needs but the Greek lacks.
    expect(cleanGloss("[The] book")).toBe("book");
    expect(cleanGloss("of [the] genealogy")).toBe("of genealogy");
  });

  it("keeps something the Hebrew has but a translation omits", () => {
    // Angle brackets: present in the Hebrew. A word-for-word gloss shows it.
    expect(cleanGloss("<obj.>")).toBe("obj");
  });

  it("strips trailing punctuation carried over from the running text", () => {
    expect(cleanGloss("of Abraham.")).toBe("of Abraham");
  });
});
