import { describe, expect, it } from "vitest";

import { describeGreekMorph, describeHebrewMorph, describeMorph, morphLine } from "./morph.js";

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
