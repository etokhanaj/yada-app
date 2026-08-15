/**
 * The golden corpus: every fixture must parse and must return zero errors from
 * the quality contract. New fixtures are added here, not to a list somewhere
 * else, so a fixture cannot join the repo without being held to the bar.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { VerseEntrySchema, type VerseEntry } from "./entries.js";
import { countByCategory, formatFinding, validateVerseEntry } from "./validate.js";

const FIXTURES = ["1co.14.34", "jhn.1.1", "gen.1.1"] as const;

function load(name: string): VerseEntry {
  const url = new URL(`../../../golden/${name}.json`, import.meta.url);
  return VerseEntrySchema.parse(JSON.parse(readFileSync(url, "utf8")) as unknown);
}

describe.each(FIXTURES)("golden/%s.json", (name) => {
  const entry = load(name);

  it("parses as a VerseEntry", () => {
    expect(entry.verse_id.length).toBeGreaterThan(0);
  });

  it("returns zero findings from the quality contract", () => {
    expect(validateVerseEntry(entry).map(formatFinding)).toEqual([]);
  });

  it("cites a dataset on every source_data claim", () => {
    for (const claim of entry.claims) {
      if (claim.grounding !== "source_data") continue;
      expect(claim.evidence.length, claim.id).toBeGreaterThan(0);
    }
  });

  it("caps model_knowledge claims at supported", () => {
    for (const claim of entry.claims) {
      if (claim.grounding !== "model_knowledge") continue;
      expect(claim.evidence_strength, claim.id).not.toBe("strong");
    }
  });
});

describe("spike fixtures carry their provenance", () => {
  it.each(["jhn.1.1", "gen.1.1"])("%s is marked hand-authored and unreviewed", (name) => {
    const entry = load(name);
    expect(entry.prompt_version).toBe("hand-authored@0a-spike");
    expect(entry.review.status).toBe("flagged");
    expect(entry.review.flags.length).toBeGreaterThan(0);
  });
});

describe("density bar for the rendering spike", () => {
  it("John 1:1 carries at least 8 claims and 2 debated items", () => {
    const entry = load("jhn.1.1");
    const counts = countByCategory(entry.claims);
    expect(entry.claims.length).toBeGreaterThanOrEqual(8);
    expect(counts.debated).toBeGreaterThanOrEqual(2);
  });

  it("Genesis 1:1 carries at least 6 claims", () => {
    expect(load("gen.1.1").claims.length).toBeGreaterThanOrEqual(6);
  });

  it("1 Cor 14:34 remains the UX regression verse", () => {
    const entry = load("1co.14.34");
    const positions = entry.claims.flatMap((c) => c.positions ?? []);
    expect(positions.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Hebrew fixture keeps its pointing", () => {
  it("every Genesis gloss surface carries niqqud", () => {
    const entry = load("gen.1.1");
    // Hebrew points and accents live in U+0591-U+05C7.
    const pointing = /[֑-ׇ]/;
    for (const word of entry.gloss) {
      expect(pointing.test(word.surface), word.surface).toBe(true);
    }
  });
});
