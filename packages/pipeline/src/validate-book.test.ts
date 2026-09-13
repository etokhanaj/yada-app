import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { VerseEntry } from "@yada/schema";

import { storeVerseEntry } from "./store.js";
import { seed1Co1434, seedVerse, tempStaging, type TempStaging } from "./test-staging.js";
import { PIPELINE_RULES, checkLexicalRef, validateBook } from "./validate-book.js";

/**
 * The 0C checks that need source data. Each test starts from 1 Cor 14:34 made
 * valid against a temp staging.db, then breaks exactly one thing — a validator
 * that has only ever seen good data is not known to work.
 */

let staging: TempStaging;
let entry: VerseEntry;

beforeEach(() => {
  staging = tempStaging();
  entry = seed1Co1434(staging.db);
});

afterEach(() => staging.cleanup());

function store(e: VerseEntry): void {
  storeVerseEntry(staging.db, e, "flagged", "test");
}

function errorsFor(rule: string): string[] {
  return validateBook(staging.db, "1CO")
    .findings.filter((f) => f.rule === rule && f.level === "error")
    .map((f) => f.message);
}

const clone = (e: VerseEntry): VerseEntry => JSON.parse(JSON.stringify(e)) as VerseEntry;

describe("yada validate", () => {
  it("passes the golden entry against source data that supports it", () => {
    store(entry);
    const report = validateBook(staging.db, "1CO");
    expect(report.stagingReady).toBe(true);
    expect(report.verseEntries).toBe(1);
    expect(report.findings.filter((f) => f.level === "error").map((f) => `${f.rule}: ${f.message}`)).toEqual([]);
  });

  it("catches a Strong's number the source pairs with a different lemma", () => {
    // The derive-findings incident: well-formed, plausible, and invented.
    const broken = clone(entry);
    const lexical = broken.claims[0]!.evidence[0] as { strongs?: string };
    // G1135 is in this verse — on γυναῖκες, not on σιγάτωσαν.
    lexical.strongs = "G1135";
    store(broken);
    expect(errorsFor(PIPELINE_RULES.LEXICAL_IN_SOURCE).join(" ")).toMatch(/pairs G1135 with γυνή, not σιγάω/);
  });

  it("catches a cited lemma that occurs nowhere the claim looks", () => {
    const broken = clone(entry);
    broken.claims[0]!.evidence[0] = { type: "lexical", lemma: "ἀγάπη", dataset: "MorphGNT" };
    store(broken);
    expect(errorsFor(PIPELINE_RULES.LEXICAL_IN_SOURCE).join(" ")).toMatch(/ἀγάπη.*does not occur/);
  });

  it("looks for a lexical item in the verses the claim cites, not only the entry's own verse", () => {
    // ἀνήρ is in v. 35, cited by the same position. Removing that verse from
    // staging must turn the citation into a finding.
    store(entry);
    expect(errorsFor(PIPELINE_RULES.LEXICAL_IN_SOURCE)).toEqual([]);
    staging.db.prepare("DELETE FROM tokens WHERE verse_id = '1CO.14.35'").run();
    expect(errorsFor(PIPELINE_RULES.LEXICAL_IN_SOURCE).join(" ")).toMatch(/ἀνήρ/);
  });

  it("requires verse evidence to resolve in staging, not merely to parse", () => {
    const broken = clone(entry);
    broken.claims[4]!.evidence = [{ type: "verse", ref: "1CO.16.1" }];
    store(broken);
    expect(errorsFor(PIPELINE_RULES.VERSE_REF_IN_STAGING).join(" ")).toMatch(/1CO\.16\.1/);
  });

  it("requires related passages to resolve in staging", () => {
    const broken = clone(entry);
    broken.related_passages.push({ ref: "REV.22.21", relationship: "thematic" });
    store(broken);
    expect(errorsFor(PIPELINE_RULES.RELATED_IN_STAGING).join(" ")).toMatch(/REV\.22\.21/);
  });

  it("holds gloss[] to the oracle: surfaces, word count and Strong's must match derivation", () => {
    const broken = clone(entry);
    broken.gloss[1]!.strongs = "G9999";
    broken.gloss.pop();
    store(broken);
    const messages = errorsFor(PIPELINE_RULES.GLOSS_MATCHES_DERIVED).join(" ");
    expect(messages).toMatch(/G9999/);
    expect(messages).toMatch(/gloss has 17 words, derivation has 18/);
  });

  it("reports an entry whose verse has no tokens rather than passing its gloss", () => {
    store(entry);
    staging.db.prepare("DELETE FROM tokens WHERE verse_id = '1CO.14.34'").run();
    expect(errorsFor(PIPELINE_RULES.GLOSS_MATCHES_DERIVED).join(" ")).toMatch(/no tokens/);
  });

  it("carries the pure schema rules through unchanged", () => {
    const broken = clone(entry);
    broken.claims[0]!.claim = "The verb is an imperative. Paul is addressing the assembly.";
    store(broken);
    expect(errorsFor("claim-atomicity")).toHaveLength(1);
  });

  it("never mutates an entry or its review state", () => {
    const broken = clone(entry);
    broken.claims[0]!.evidence[0] = { type: "lexical", lemma: "ἀγάπη" };
    store(broken);
    const before = staging.db.prepare("SELECT e.payload, r.status, r.reason FROM entries e JOIN review_state r USING (verse_id)").all();
    validateBook(staging.db, "1CO");
    const after = staging.db.prepare("SELECT e.payload, r.status, r.reason FROM entries e JOIN review_state r USING (verse_id)").all();
    expect(after).toEqual(before);
  });

  it("says when staging has no text for the book, instead of reporting every ref as missing", () => {
    expect(validateBook(staging.db, "OBA").stagingReady).toBe(false);
  });
});

describe("Hebrew lexical references", () => {
  const hebrewScope = (strongs: string[]) => [{ verseId: "GEN.1.1", lemma: "b/7225", strongs: new Set(strongs), greek: false }];

  it("match through Strong's, including a number carried by a morpheme", () => {
    staging.db.exec("DELETE FROM tokens");
    seedVerse(staging.db, "GEN.1.1", [
      { surface: "בְּרֵאשִׁית", lemma: "b/7225", strongs: "H7225", morphemes: [{ surface: "בְּ", role: "prefix" }, { surface: "רֵאשִׁית", role: "stem", strongs: "H7225" }] },
    ]);
    expect(checkLexicalRef({ type: "lexical", lemma: "רֵאשִׁית", strongs: "H7225" }, hebrewScope(["H7225"]))).toBeNull();
  });

  it("cannot be shown to exist without a Strong's number, because OSHB tokens carry lemma refs, not headwords", () => {
    expect(checkLexicalRef({ type: "lexical", lemma: "רֵאשִׁית" }, hebrewScope(["H7225"]))).toMatch(/cannot be shown to exist/);
  });

  it("fail when the number is absent from the verse", () => {
    expect(checkLexicalRef({ type: "lexical", lemma: "בָּרָא", strongs: "H1254a" }, hebrewScope(["H7225"]))).toMatch(/does not occur/);
  });
});
