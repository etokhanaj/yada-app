import { describe, expect, it } from "vitest";

import { canonicalStrongs, StrongsSchema } from "@yada/schema";

import { splitMorphemes, stripApparatus, toStrongs } from "./parsers.js";

/**
 * These cover the specific ways the derivation was wrong before the oracle
 * caught it. Each case is a bug that shipped silently once.
 */

describe("toStrongs", () => {
  it("pads to four digits so lexicon joins match", () => {
    // The bug: `H430` and TBESH's `H0430` are the same number and different
    // strings, so half the corpus joins and half silently does not.
    expect(toStrongs("430")).toBe("H0430");
    expect(toStrongs("776")).toBe("H0776");
    expect(toStrongs("7225")).toBe("H7225");
  });

  it("keeps the homograph letter, which distinguishes two lexemes", () => {
    expect(toStrongs("7462 b")).toBe("H7462b");
    expect(toStrongs("1254 a")).toBe("H1254a");
  });

  it("returns nothing for prefix particles, which have no lexeme", () => {
    for (const particle of ["b", "l", "c", "d", "m"]) {
      expect(toStrongs(particle)).toBeUndefined();
    }
  });

  it("produces values the schema accepts", () => {
    for (const raw of ["430", "7462 b", "1", "8064"]) {
      expect(() => StrongsSchema.parse(toStrongs(raw))).not.toThrow();
    }
  });
});

describe("canonicalStrongs", () => {
  it("folds every spelling in the wild onto one form", () => {
    expect(canonicalStrongs("G746", "G")).toBe("G0746");
    expect(canonicalStrongs("G0746", "G")).toBe("G0746");
    expect(canonicalStrongs("746", "G")).toBe("G0746");
  });

  it("rejects the schema's old permissive spelling", () => {
    // 1.3.0 is a tightening: the unpadded form must now fail.
    expect(() => StrongsSchema.parse("G746")).toThrow();
    expect(() => StrongsSchema.parse("G0746")).not.toThrow();
  });
});

describe("splitMorphemes", () => {
  it("aligns lemmas to non-suffix parts only", () => {
    // A pronominal suffix carries no lemma of its own, so lemma parts and morph
    // parts are different lengths and cannot be zipped naively.
    const morphemes = splitMorphemes("מִ/פְּשָׁעֵ/נוּ", "m/6588/Sp1cp", "HR/Ncmpc/Sp1cp");
    expect(morphemes?.map((m) => m.role)).toEqual(["prefix", "stem", "suffix"]);
    expect(morphemes?.[1]?.strongs).toBe("H6588");
    expect(morphemes?.[2]?.strongs).toBeUndefined();
    expect(morphemes?.[2]?.lemma_ref).toBeUndefined();
  });

  it("returns nothing for a single-morpheme word", () => {
    expect(splitMorphemes("אֱלֹהִים", "430", "HNcmpa")).toBeUndefined();
  });

  it("handles a four-morpheme word", () => {
    const morphemes = splitMorphemes("וּ/בַ/חֲבֻרָת/וֹ", "c/b/2250/Sp3ms", "HC/Rd/Ncfsc/Sp3ms");
    expect(morphemes).toHaveLength(4);
    expect(morphemes?.map((m) => m.role)).toEqual(["prefix", "prefix", "stem", "suffix"]);
  });
});

describe("stripApparatus", () => {
  it("removes editorial sigla from the display surface and flags the word", () => {
    const { clean, marked } = stripApparatus("⸀γυναῖκες");
    expect(clean).toBe("γυναῖκες");
    expect(marked).toBe(true);
  });

  it("leaves unmarked words untouched", () => {
    const { clean, marked } = stripApparatus("λόγος");
    expect(clean).toBe("λόγος");
    expect(marked).toBe(false);
  });
});
