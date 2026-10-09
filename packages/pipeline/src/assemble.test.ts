import { describe, expect, it } from "vitest";

import {
  PericopeEntrySchema,
  VerseEntrySchema,
  hasErrors,
  validatePericopeEntry,
  validateVerseEntry,
  type PericopeEntry,
  type VerseEntry,
} from "@yada/schema";

import { PROMPT_VERSION, assemble, clean, derivedGloss, isComposed, shapeEvidence, type DeriveWords } from "./assemble.js";
import { composed1Co14 } from "./test-staging.js";

/**
 * assemble is where model output becomes an entry, so it is where a model
 * could otherwise stamp its own review status or write its own gloss. None of
 * this needs staging.db: the word derivation is injected.
 */

const deriveWords: DeriveWords = (verseId) =>
  verseId === "1CO.14.34"
    ? [
        { surface: "αἱ", translit: "hai", gloss: "the", strongs: "G3588", morph: "RA-NPF", variant_marked: false },
        // Unglossed in every source and with no transliteration.
        { surface: "γυναῖκες", translit: "", strongs: "G1135", morph: "N-NPF", variant_marked: false },
      ]
    : [];

function assembled(): { pericope: PericopeEntry; verse: VerseEntry } {
  const [pericope, verse] = assemble(composed1Co14(), "1CO.14.26-14.40", "claude-opus-5", deriveWords);
  return { pericope: pericope as PericopeEntry, verse: verse as VerseEntry };
}

describe("clean", () => {
  it("drops empty strings and nulls at any depth", () => {
    expect(clean({ a: "", b: null, c: "kept", d: { e: "", f: 1 } })).toEqual({ c: "kept", d: { f: 1 } });
  });

  it("drops no_significant_dispute when false, keeps it when true", () => {
    expect(clean({ no_significant_dispute: false })).toEqual({});
    expect(clean({ no_significant_dispute: true })).toEqual({ no_significant_dispute: true });
  });

  it("drops only the lists the entry schema makes optional", () => {
    const out = clean({ positions: [], discussion_questions: [], movement: [], witnesses: [], evidence: [], claims: [], key_ideas: [] });
    expect(out).toEqual({ evidence: [], claims: [], key_ideas: [] });
  });

  it("recurses through arrays of objects and leaves scalars in arrays alone", () => {
    expect(clean([{ a: "", b: "x" }, "", 0])).toEqual([{ b: "x" }, "", 0]);
  });
});

describe("shapeEvidence", () => {
  it("keeps only the fields each evidence kind has", () => {
    const shaped = shapeEvidence([
      { type: "verse", ref: "JHN.1.1", lemma: "λόγος", strongs: "G3056", note: "n" },
      { type: "lexical", ref: "JHN.1.1", lemma: "λόγος", strongs: "G3056", dataset: "MorphGNT", analysis_tradition: "t", witnesses: ["x"], note: "n" },
      { type: "apparatus", ref: "JHN.1.1", lemma: "λόγος", witnesses: ["P66"], dataset: "SBLGNT", note: "n" },
    ]);
    expect(shaped).toEqual([
      { type: "verse", ref: "JHN.1.1", note: "n" },
      { type: "lexical", lemma: "λόγος", strongs: "G3056", dataset: "MorphGNT", analysis_tradition: "t", note: "n" },
      { type: "apparatus", ref: "JHN.1.1", witnesses: ["P66"], dataset: "SBLGNT", note: "n" },
    ]);
  });

  it("leaves an unknown kind whole for the schema to reject, and passes non-arrays through", () => {
    expect(shapeEvidence([{ type: "rumour", ref: "JHN.1.1" }])).toEqual([{ type: "rumour", ref: "JHN.1.1" }]);
    expect(shapeEvidence(undefined)).toBeUndefined();
  });
});

describe("isComposed", () => {
  it("recognises model output and refuses stamped entries and a null pericope", () => {
    expect(isComposed(composed1Co14())).toBe(true);
    expect(isComposed({ pericope: {}, verses: [{ schema_version: "1.3.0" }] })).toBe(false);
    expect(isComposed({ pericope: null, verses: [] })).toBe(false);
    expect(isComposed([])).toBe(false);
  });
});

describe("assemble", () => {
  it("produces a pericope entry and verse entries that pass the schema and the contract", () => {
    const { pericope, verse } = assembled();
    const parsedPericope = PericopeEntrySchema.safeParse(pericope);
    const parsedVerse = VerseEntrySchema.safeParse(verse);
    expect(parsedPericope.success).toBe(true);
    expect(parsedVerse.success).toBe(true);
    expect(hasErrors(validatePericopeEntry(pericope))).toBe(false);
    expect(hasErrors(validateVerseEntry(verse))).toBe(false);
  });

  it("stamps ids, versions and span from the request, not from the model", () => {
    const { pericope, verse } = assembled();
    expect(pericope).toMatchObject({
      pericope_id: "1CO.14.26-14.40",
      book: "1CO",
      span: { start: "1CO.14.26", end: "1CO.14.40" },
      prompt_version: PROMPT_VERSION,
    });
    expect(verse).toMatchObject({ verse_id: "1CO.14.34", pericope_id: "1CO.14.26-14.40", versification: "english" });
  });

  it("marks everything flagged even when the model claims a review", () => {
    const input = composed1Co14();
    const [first] = input.verses;
    if (first === undefined) throw new Error("fixture has no verse");
    Object.assign(first, { review: { status: "human_reviewed", flags: [] } });
    const [, verse] = assemble(input, "1CO.14.26-14.40", "claude-opus-5", deriveWords);
    expect((verse as VerseEntry).review).toEqual({
      status: "flagged",
      flags: ["generated by claude-opus-5", `prompt ${PROMPT_VERSION}`],
    });
  });

  it("takes the gloss from derivation, with a dash for an unglossed word, never the model", () => {
    const input = composed1Co14();
    const [first] = input.verses;
    if (first === undefined) throw new Error("fixture has no verse");
    Object.assign(first, { gloss: [{ surface: "αἱ", translit: "hai", gloss: "invented" }] });
    const [, verse] = assemble(input, "1CO.14.26-14.40", "claude-opus-5", deriveWords);
    expect((verse as VerseEntry).gloss).toEqual([
      { surface: "αἱ", translit: "hai", gloss: "the", strongs: "G3588", morph: "RA-NPF" },
      { surface: "γυναῖκες", translit: "γυναῖκες", gloss: "—", strongs: "G1135", morph: "N-NPF" },
    ]);
  });

  it("shapes evidence, fills omitted evidence with [], and gives every claim empty sources", () => {
    const { verse } = assembled();
    const [c1, c2, c3] = verse.claims;
    expect(c1?.evidence).toEqual([{ type: "lexical", lemma: "σιγάω", strongs: "G4601", dataset: "MorphGNT" }]);
    expect(c1?.positions).toBeUndefined();
    expect(c2?.evidence).toEqual([{ type: "apparatus", ref: "1CO.14.34-35", witnesses: ["D", "F", "G"], dataset: "SBLGNT" }]);
    expect(c2?.positions?.[0]?.evidence).toEqual([{ type: "verse", ref: "1CO.14.33" }]);
    expect(c3?.evidence).toEqual([]);
    expect(verse.claims.every((c) => c.sources.length === 0)).toBe(true);
  });

  it("drops the model's empty optional fields", () => {
    const { pericope, verse } = assembled();
    expect(verse.translation_note).toBeUndefined();
    expect(verse.no_significant_dispute).toBeUndefined();
    expect(verse.key_words[0]?.note).toBeUndefined();
    expect(pericope.discussion_questions).toBeUndefined();
    expect(pericope.related_passages).toEqual([{ ref: "1CO.11.5" }]);
  });

  it("prefixes book-less movement ranges and leaves prefixed ones alone", () => {
    expect(assembled().pericope.movement?.map((step) => step.range)).toEqual(["1CO.14.26-14.33", "1CO.14.34-14.35"]);
  });

  it("prefixes three-digit Psalm chapters too", () => {
    // "119.1-119.8" starts with three characters and a dot, which the first
    // version took for a book code: the range went unprefixed and failed
    // movement-range, so every long-psalm pericope entry was rejected.
    const input = composed1Co14();
    input.pericope.movement = [{ range: "119.1-119.8", label: "Aleph" }];
    const [pericope] = assemble({ pericope: input.pericope, verses: [] }, "PSA.119.1-119.8", "claude-opus-5", deriveWords);
    expect((pericope as PericopeEntry).movement).toEqual([{ range: "PSA.119.1-119.8", label: "Aleph" }]);
    expect(validatePericopeEntry(pericope as PericopeEntry).filter((f) => f.rule === "movement-range")).toEqual([]);
  });

  it("refuses an id that is not a pericope", () => {
    expect(() => assemble(composed1Co14(), "not-a-pericope", "claude-opus-5", deriveWords)).toThrow(/not a pericope id/);
  });
});

describe("derivedGloss", () => {
  it("dashes an unglossed morpheme rather than leaving it empty", () => {
    const gloss = derivedGloss("PSA.23.1", () => [
      {
        surface: "לְדָוִד",
        translit: "lə·ḏā·wiḏ",
        gloss: "of David",
        morph: "HR/Np",
        morphemes: [
          { surface: "לְ", role: "prefix", gloss: "of" },
          { surface: "דָוִד", role: "stem", strongs: "H1732" },
        ],
        variant_marked: false,
      },
    ]);
    expect(gloss[0]?.morphemes).toEqual([
      { surface: "לְ", role: "prefix", gloss: "of" },
      { surface: "דָוִד", role: "stem", strongs: "H1732", gloss: "—" },
    ]);
  });
});
