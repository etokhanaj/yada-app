import { describe, expect, it } from "vitest";

import { describeGreekMorph, describeHebrewMorph, describeMorph, grammarKey, morphLine, morphTerms } from "./morph.js";

describe("grammar terms (build 6, item H)", () => {
  it("names a Greek verb's tense, voice and mood, in the Form line's order", () => {
    expect(morphTerms("V- 3PAD-P--")).toEqual([
      { label: "present", language: "greek" },
      { label: "active", language: "greek" },
      { label: "imperative", language: "greek" },
    ]);
  });

  it("names a participle's case and a comparative's degree", () => {
    expect(morphTerms("V- -PAPNSM-").map((t) => t.label)).toEqual(["present", "active", "participle", "nominative"]);
    expect(morphTerms("A- ----NSMC").map((t) => t.label)).toEqual(["nominative", "comparative"]);
  });

  it("keeps Greek and Hebrew imperfect apart", () => {
    expect(morphTerms("V- 3IAI-S--")[0]).toEqual({ label: "imperfect", language: "greek" });
    expect(morphTerms("HVqi3ms")[1]).toEqual({ label: "imperfect", language: "hebrew" });
    expect(grammarKey({ label: "imperfect", language: "greek" })).not.toBe(grammarKey({ label: "imperfect", language: "hebrew" }));
  });

  it("names a Hebrew stem and conjugation, a state, a suffix and the object marker", () => {
    expect(morphTerms("HVqp3ms").map((t) => t.label)).toEqual(["qal", "perfect"]);
    expect(morphTerms("HR/Ncfsa").map((t) => t.label)).toEqual(["absolute"]);
    expect(morphTerms("HNcmsc/Sp2ms").map((t) => t.label)).toEqual(["construct", "pronominal suffix"]);
    expect(morphTerms("HTo").map((t) => t.label)).toEqual(["direct object marker"]);
    expect(morphTerms("HVqrmsa").map((t) => t.label)).toEqual(["qal", "participle", "absolute"]);
    expect(morphTerms("HNcmdc").map((t) => t.label)).toEqual(["dual", "construct"]);
  });

  it("every term is a word morphLine prints", () => {
    for (const m of ["V- 3PAD-P--", "A- ----NSMC", "HVqp3ms", "HNcmsc/Sp2ms", "HTo", "HVqrmsa", "AVqp3ms", "ANcmsd"]) {
      for (const t of morphTerms(m)) expect(morphLine(m)).toContain(t.label);
    }
  });

  it("uses Aramaic stems and the determined state for Aramaic", () => {
    expect(morphTerms("AVqp3ms")).toEqual([
      { label: "peal", language: "aramaic" },
      { label: "perfect", language: "aramaic" },
    ]);
    expect(morphTerms("ANcmsd").map((t) => t.label)).toEqual(["determined"]);
  });
});

describe("Greek (MorphGNT)", () => {
  it("reads the brief's own example: σιγάτωσαν is a present active imperative, 3rd plural", () => {
    expect(describeGreekMorph("V- 3PAD-P--")).toEqual({
      partOfSpeech: "verb",
      detail: "present active imperative, 3rd person plural",
    });
  });

  it("gives a participle its case, gender and number rather than a person", () => {
    expect(describeGreekMorph("V- -PAPNSM-").detail).toBe("present active participle, nominative masculine singular");
  });

  it("gives an infinitive no person or number", () => {
    expect(describeGreekMorph("V- -AAN----").detail).toBe("aorist active infinitive");
  });

  it("reads nominals as case, gender and number", () => {
    expect(describeGreekMorph("RA ----NPF-")).toEqual({ partOfSpeech: "article", detail: "nominative feminine plural" });
    expect(describeGreekMorph("N- ----NPF-")).toEqual({ partOfSpeech: "noun", detail: "nominative feminine plural" });
  });

  it("says nothing more about an indeclinable word than its part of speech", () => {
    expect(describeGreekMorph("P- --------")).toEqual({ partOfSpeech: "preposition", detail: "" });
  });

  it("names a comparative", () => {
    expect(describeGreekMorph("A- ----NSMC").detail).toBe("nominative masculine singular, comparative");
  });
});

describe("Hebrew (OpenScriptures)", () => {
  it("reads בָּרָא in Genesis 1:1 as a qal perfect", () => {
    expect(describeHebrewMorph("HVqp3ms")).toEqual([
      { partOfSpeech: "verb", detail: "qal perfect, 3rd person masculine singular" },
    ]);
  });

  it("gives each morpheme its own description", () => {
    expect(describeHebrewMorph("HR/Ncfsa")).toEqual([
      { partOfSpeech: "preposition", detail: "" },
      { partOfSpeech: "common noun", detail: "feminine singular absolute" },
    ]);
  });

  it("reads the direct object marker and the article", () => {
    expect(morphLine("HTo")).toBe("direct object marker");
    expect(morphLine("HTd/Ncmpa")).toBe("definite article + common noun, masculine plural absolute");
  });

  it("reads a pronominal suffix", () => {
    expect(describeHebrewMorph("HNcmsc/Sp2ms")[1]).toEqual({
      partOfSpeech: "pronominal suffix",
      detail: "2nd person masculine singular",
    });
  });

  it("gives a proper noun no inflection", () => {
    expect(morphLine("HNp")).toBe("proper noun");
  });

  it("reads a participle's state and an infinitive's bare form", () => {
    expect(morphLine("HVqrmsa")).toBe("verb, qal participle, masculine singular absolute");
    expect(morphLine("HVqc")).toBe("verb, qal infinitive construct");
  });

  it("uses Aramaic stem names for Aramaic text", () => {
    expect(describeHebrewMorph("AVqp3ms")[0]?.detail).toBe("peal perfect, 3rd person masculine singular");
  });
});

describe("either script", () => {
  it("tells Greek from Hebrew by the space in the Greek code", () => {
    expect(describeMorph("V- 3PAD-P--")[0]?.partOfSpeech).toBe("verb");
    expect(describeMorph("HR/Ncfsa")).toHaveLength(2);
  });
});
