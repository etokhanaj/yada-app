import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { Claim } from "./claims.js";
import { VerseEntrySchema, type VerseEntry } from "./entries.js";
import {
  countByCategory,
  countSentenceTerminators,
  formatFinding,
  hasErrors,
  isAtomicClaimText,
  RULES,
  validateClaims,
  validateVerseEntry,
} from "./validate.js";

const goldenUrl = new URL("../../../golden/1co.14.34.json", import.meta.url);
const golden: VerseEntry = VerseEntrySchema.parse(
  JSON.parse(readFileSync(goldenUrl, "utf8")) as unknown,
);

/** Structured clone so a mutation in one test cannot leak into another. */
function entryCopy(): VerseEntry {
  return structuredClone(golden);
}

function claimOf(entry: VerseEntry, id: string): Claim {
  const claim = entry.claims.find((c) => c.id === id);
  if (claim === undefined) throw new Error(`fixture is missing claim ${id}`);
  return claim;
}

describe("the golden entry", () => {
  it("passes the quality contract with no findings", () => {
    const findings = validateVerseEntry(golden);
    expect(findings.map(formatFinding)).toEqual([]);
    expect(hasErrors(findings)).toBe(false);
  });

  it("counts claims by category", () => {
    expect(countByCategory(golden.claims)).toEqual({
      text: 3,
      context: 3,
      interpretation: 0,
      debated: 1,
    });
  });
});

describe("atomicity", () => {
  it("accepts one assertion, including bracketed references and abbreviations", () => {
    expect(isAtomicClaimText("σιγάτωσαν is a present active imperative, third person plural.")).toBe(
      true,
    );
    expect(isAtomicClaimText("The verse sits in a block about order (1 Cor 14:26-40).")).toBe(true);
    expect(isAtomicClaimText("The same verb appears in v. 28 and v. 30.")).toBe(true);
  });

  it("rejects compound claims", () => {
    expect(isAtomicClaimText("The verb is an imperative; the subject is plural.")).toBe(false);
    expect(
      isAtomicClaimText("Paul commands the women to be silent. The command concerns speech."),
    ).toBe(false);
  });

  it("counts sentence terminators without tripping on abbreviations", () => {
    expect(countSentenceTerminators("One sentence.")).toBe(1);
    expect(countSentenceTerminators("See v. 35 for the frame.")).toBe(1);
    expect(countSentenceTerminators("First. Second.")).toBe(2);
  });

  it("flags a compound claim on a real entry", () => {
    const entry = entryCopy();
    claimOf(entry, "1CO.14.34.c1").claim =
      "σιγάτωσαν is an imperative; the subject is αἱ γυναῖκες.";
    const findings = validateVerseEntry(entry);
    expect(findings).toContainEqual(
      expect.objectContaining({ rule: RULES.CLAIM_ATOMICITY, claimId: "1CO.14.34.c1" }),
    );
  });
});

describe("grounding", () => {
  it("rejects a text claim grounded in model knowledge", () => {
    const entry = entryCopy();
    const claim = claimOf(entry, "1CO.14.34.c1");
    claim.grounding = "model_knowledge";
    claim.evidence_strength = "supported";
    const findings = validateVerseEntry(entry);
    expect(findings).toContainEqual(
      expect.objectContaining({ rule: RULES.TEXT_CLAIM_GROUNDING, claimId: "1CO.14.34.c1" }),
    );
  });

  it("allows a context claim grounded in model knowledge", () => {
    const findings = validateVerseEntry(golden);
    expect(findings.filter((f) => f.claimId === "1CO.14.34.c6")).toEqual([]);
  });

  it("rejects a source_data claim that cites nothing", () => {
    const entry = entryCopy();
    claimOf(entry, "1CO.14.34.c5").evidence = [];
    expect(hasErrors(validateVerseEntry(entry))).toBe(true);
  });
});

describe("evidence refs", () => {
  it("flags a verse ref that does not resolve", () => {
    const entry = entryCopy();
    claimOf(entry, "1CO.14.34.c5").evidence = [{ type: "verse", ref: "1CO.99.5" }];
    const findings = validateVerseEntry(entry);
    expect(findings).toContainEqual(
      expect.objectContaining({ rule: RULES.EVIDENCE_REF_RESOLVES, claimId: "1CO.14.34.c5" }),
    );
  });

  it("flags an unresolvable ref inside a debated position", () => {
    const entry = entryCopy();
    const firstPosition = claimOf(entry, "1CO.14.34.c7").positions?.[0];
    if (firstPosition === undefined) throw new Error("fixture is missing positions");
    firstPosition.evidence = [{ type: "verse", ref: "not-a-ref" }];
    expect(hasErrors(validateVerseEntry(entry))).toBe(true);
  });

  it("flags a related passage that does not resolve", () => {
    const entry = entryCopy();
    entry.related_passages = [{ ref: "1CO.14.40-14.26" }];
    const findings = validateVerseEntry(entry);
    expect(findings).toContainEqual(expect.objectContaining({ rule: RULES.RELATED_PASSAGE_REF }));
  });
});

describe("debated positions", () => {
  it("requires at least two positions", () => {
    const entry = entryCopy();
    const claim = claimOf(entry, "1CO.14.34.c7");
    claim.positions = (claim.positions ?? []).slice(0, 1);
    const findings = validateVerseEntry(entry);
    expect(findings).toContainEqual(
      expect.objectContaining({
        level: "error",
        rule: RULES.DEBATED_CLAIM_POSITIONS,
        claimId: "1CO.14.34.c7",
      }),
    );
  });

  it("downgrades to a warning when the entry is marked no_significant_dispute", () => {
    const entry = entryCopy();
    entry.no_significant_dispute = true;
    const claim = claimOf(entry, "1CO.14.34.c7");
    claim.positions = [];
    const findings = validateVerseEntry(entry);
    expect(hasErrors(findings)).toBe(false);
    expect(findings).toContainEqual(
      expect.objectContaining({ level: "warn", rule: RULES.DEBATED_CLAIM_POSITIONS }),
    );
  });
});

describe("display ranks", () => {
  it("requires uniqueness within a display group, across categories", () => {
    const entry = entryCopy();
    // c1 is text, c4 is context: same "What we can see" group.
    claimOf(entry, "1CO.14.34.c4").display_rank = claimOf(entry, "1CO.14.34.c1").display_rank;
    const findings = validateVerseEntry(entry);
    expect(findings).toContainEqual(
      expect.objectContaining({ rule: RULES.DISPLAY_RANK_UNIQUE, claimId: "1CO.14.34.c4" }),
    );
  });

  it("allows the same rank in the other display group", () => {
    // The fixture already reuses rank 1 for the debated claim.
    expect(validateClaims(golden.claims)).toEqual([]);
  });
});

describe("entry reference consistency", () => {
  it("flags a verse outside its own pericope", () => {
    const entry = entryCopy();
    entry.pericope_id = "1CO.14.1-14.25";
    const findings = validateVerseEntry(entry);
    expect(findings).toContainEqual(
      expect.objectContaining({ rule: RULES.ENTRY_REF_CONSISTENCY }),
    );
  });

  it("flags a pericope from another book", () => {
    const entry = entryCopy();
    entry.pericope_id = "JHN.1.1-1.18";
    expect(hasErrors(validateVerseEntry(entry))).toBe(true);
  });
});
