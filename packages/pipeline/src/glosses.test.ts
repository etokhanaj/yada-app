import { describe, expect, it } from "vitest";

import { cleanGloss, normalizeGreek, normalizeHebrew, tahotSurface, tbeshGlosses } from "./glosses.js";

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

describe("TAHOT surfaces", () => {
  // TAHOT's verse-final words carry the paragraph mark; with it, 3,103 OSHB words had no gloss in core v5.
  it("drops a trailing paragraph mark so a verse-final word matches OSHB", () => {
    expect(normalizeHebrew(tahotSurface("אֶחָֽד\\׃\\ \\פ"))).toBe(normalizeHebrew("אֶחָֽד׃")); // Genesis 1:5
    expect(normalizeHebrew(tahotSurface("מַלְכִֽין\\׃\\ \\ס"))).toBe(normalizeHebrew("מַלְכִֽין׃")); // Ezra 4:22, Aramaic
    expect(normalizeHebrew(tahotSurface("יִשְׂרָאֵֽל\\׃\\ \\׆\\ \\ס"))).toBe("ישראל"); // Numbers 10:36, inverted nun
  });

  it("keeps letters that follow a maqaf or paseq inside one TAHOT row", () => {
    expect(normalizeHebrew(tahotSurface("כְּדָרְ\\־לָעֹ֔מֶר"))).toBe("כדרלעמר"); // Genesis 14:17, Kedorlaomer
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

describe("TBESH glosses", () => {
  it("takes column 6 of the first row for each number, never the BDB meaning in column 7", () => {
    const text = [
      "H0430\tH0430G = a Name of\tH3068G\tאֱלֹהִים\te.lo.him\tH:N-M\tGod\tThis name means...",
      "H0430\tH0430H = a Part of\tH3068G\tאֱלֹהִים\te.lo.him\tH:N-M\t(LORD)-Elohe\t...",
      "H7311a\tH7311a\tH7311a\tרוּם\trum\tH:V\tto exalt/rise\tto be high",
      "eStrong#\tThese Extended Strong Numbers...",
    ].join("\n");
    expect([...tbeshGlosses(text)]).toEqual([
      ["H0430", "God"],
      ["H7311a", "to exalt"],
    ]);
  });
});
