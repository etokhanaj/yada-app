import { describe, expect, it } from "vitest";

import { ClaimSchema, displayGroup, EvidenceRefSchema } from "./claims.js";

const baseClaim = {
  id: "1CO.14.34.c1",
  claim: "σιγάτωσαν is a present active imperative, third person plural.",
  category: "text" as const,
  evidence_strength: "strong" as const,
  confidence: "high",
  grounding: "source_data" as const,
  evidence: [{ type: "lexical" as const, lemma: "σιγάω", strongs: "G4601" }],
  sources: [],
  display_rank: 1,
};

describe("ClaimSchema", () => {
  it("accepts a well-formed text claim", () => {
    expect(ClaimSchema.safeParse(baseClaim).success).toBe(true);
  });

  it("rejects model_knowledge grounding with strong evidence", () => {
    const result = ClaimSchema.safeParse({
      ...baseClaim,
      category: "context",
      grounding: "model_knowledge",
      evidence_strength: "strong",
      evidence: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["evidence_strength"]);
  });

  it("allows model_knowledge grounding capped at supported", () => {
    const result = ClaimSchema.safeParse({
      ...baseClaim,
      category: "context",
      grounding: "model_knowledge",
      evidence_strength: "supported",
      evidence: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects positions on a non-debated claim", () => {
    const result = ClaimSchema.safeParse({
      ...baseClaim,
      positions: [
        { label: "A", case: "because", evidence: [] },
        { label: "B", case: "because", evidence: [] },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["positions"]);
  });

  it("accepts positions on a debated claim", () => {
    const result = ClaimSchema.safeParse({
      ...baseClaim,
      category: "debated",
      evidence_strength: "disputed",
      positions: [
        { label: "Women generally", case: "The plural is unqualified.", evidence: [] },
        { label: "Wives specifically", case: "Verse 35 supplies the frame.", evidence: [] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("has no winner field on positions", () => {
    const parsed = ClaimSchema.parse({
      ...baseClaim,
      category: "debated",
      evidence_strength: "disputed",
      positions: [
        { label: "A", case: "case a", evidence: [], winner: true },
        { label: "B", case: "case b", evidence: [] },
      ],
    });
    expect(parsed.positions?.[0]).not.toHaveProperty("winner");
  });
});

describe("EvidenceRefSchema", () => {
  it("discriminates the three evidence types", () => {
    expect(EvidenceRefSchema.safeParse({ type: "verse", ref: "1CO.14.34" }).success).toBe(true);
    expect(EvidenceRefSchema.safeParse({ type: "lexical", lemma: "σιγάω" }).success).toBe(true);
    expect(
      EvidenceRefSchema.safeParse({ type: "apparatus", ref: "1CO.14.34-35 transposition" }).success,
    ).toBe(true);
    expect(EvidenceRefSchema.safeParse({ type: "hunch", ref: "somewhere" }).success).toBe(false);
  });
});

describe("displayGroup", () => {
  it("maps four categories onto the two neutral reader groups", () => {
    expect(displayGroup("text")).toBe("what_we_can_see");
    expect(displayGroup("context")).toBe("what_we_can_see");
    expect(displayGroup("interpretation")).toBe("where_interpretation_differs");
    expect(displayGroup("debated")).toBe("where_interpretation_differs");
  });
});
