/**
 * Claims: the unit of everything Yada asserts.
 *
 * PRD §11.4 / §11.6. A claim is one independently testable assertion, carrying
 * its category, how strong the evidence is (user-facing), where it is grounded,
 * and the evidence itself. Nothing here adjudicates meaning: debated claims
 * carry positions, and no position is ever marked as the winner — there is no
 * winner field, deliberately.
 *
 * Structural rules live in Zod (below). Semantic quality-contract rules live in
 * validate.ts, so the CI regression tier can report findings instead of
 * throwing on parse.
 */

import { z } from "zod";

export const ClaimCategorySchema = z.enum(["text", "context", "interpretation", "debated"]);
export type ClaimCategory = z.infer<typeof ClaimCategorySchema>;

export const EvidenceStrengthSchema = z.enum(["strong", "supported", "disputed"]);
export type EvidenceStrength = z.infer<typeof EvidenceStrengthSchema>;

export const GroundingSchema = z.enum(["source_data", "model_knowledge"]);
export type Grounding = z.infer<typeof GroundingSchema>;

/**
 * The two neutral display groups of PRD §8.2: "What we can see" and
 * "Where interpretation differs". Categories map onto groups; the user never
 * learns the four-category taxonomy.
 */
export type DisplayGroup = "what_we_can_see" | "where_interpretation_differs";

export function displayGroup(category: ClaimCategory): DisplayGroup {
  return category === "text" || category === "context"
    ? "what_we_can_see"
    : "where_interpretation_differs";
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

/** A verse id or range: `1CO.14.34`, `1CO.14.34-35`, `1CO.14.26-14.40`. */
export const VerseEvidenceRefSchema = z.object({
  type: z.literal("verse"),
  ref: z.string().min(1),
  note: z.string().min(1).optional(),
});

/**
 * Strong's number: testament letter, **at least four digits, zero-padded**, and
 * an optional homograph letter — `G4601`, `G0746`, `H1254a`, `H0430`.
 *
 * The padding is load-bearing, not cosmetic. `G746` and `G0746` are the same
 * number and different strings, so a corpus mixing them joins against a lexicon
 * for some words and silently fails for others. The STEPBible lexicons (TBESG,
 * TBESH) both write the padded form, so that is the form Yada canonicalises to;
 * OSHB writes the bare number and is padded on the way in.
 *
 * Source datasets write the homograph separately (OSHB: `7462 b`); Yada folds it
 * onto the end, because dropping it silently merges two distinct lexemes.
 */
export const StrongsSchema = z
  .string()
  .regex(/^[GH]\d{4,5}[a-z]?$/, "expected a zero-padded Strong's number such as G0746 or H7462b");

/**
 * Fold any of the spellings in the wild onto the canonical one. Accepts a bare
 * or padded number, with or without a homograph letter, and with the letter
 * either attached or space-separated as OSHB writes it.
 */
export function canonicalStrongs(raw: string, testament: "G" | "H"): string | undefined {
  const match = /^([GH])?\s*(\d{1,5})\s*([a-z])?$/.exec(raw.trim());
  if (match === null) return undefined;
  const prefix = match[1] ?? testament;
  return `${prefix}${(match[2] as string).padStart(4, "0")}${match[3] ?? ""}`;
}

export const LexicalEvidenceRefSchema = z.object({
  type: z.literal("lexical"),
  lemma: z.string().min(1),
  strongs: StrongsSchema.optional(),
  /** Which dataset the parsing or gloss came from, e.g. "MorphGNT". */
  dataset: z.string().min(1).optional(),
  /**
   * The analytical tradition a parse depends on, where the parse is not
   * recoverable from the base text alone.
   *
   * Pointed Hebrew is the case this exists for: OSHB parses רֵאשִׁית as
   * absolute, but that parse *is* the Masoretic vocalisation, added centuries
   * after the consonantal text — and in Genesis 1:1 it is the decisive evidence
   * for one side of the verse's central dispute. Naming the tradition keeps a
   * Text claim honest; asserting the parse bare takes a side while looking
   * neutral. Required on Old Testament text claims (see validate.ts).
   */
  analysis_tradition: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
});

/** Textual-critical evidence: manuscript variants and their witnesses. */
export const ApparatusEvidenceRefSchema = z.object({
  type: z.literal("apparatus"),
  ref: z.string().min(1),
  witnesses: z.array(z.string().min(1)).optional(),
  dataset: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
});

export const EvidenceRefSchema = z.discriminatedUnion("type", [
  VerseEvidenceRefSchema,
  LexicalEvidenceRefSchema,
  ApparatusEvidenceRefSchema,
]);
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type VerseEvidenceRef = z.infer<typeof VerseEvidenceRefSchema>;
export type LexicalEvidenceRef = z.infer<typeof LexicalEvidenceRefSchema>;
export type ApparatusEvidenceRef = z.infer<typeof ApparatusEvidenceRefSchema>;

/** Cited scholarly sources. Empty in v1; the Sources layer ships post-v1. */
export const SourceRefSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  citation: z.string().min(1).optional(),
  url: z.string().url().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

/** One named reading of a debated claim. Powers "Compare this claim". */
export const PositionSchema = z.object({
  label: z.string().min(1),
  case: z.string().min(1),
  evidence: z.array(EvidenceRefSchema),
});
export type Position = z.infer<typeof PositionSchema>;

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

export const ClaimSchema = z
  .object({
    id: z.string().min(1),
    /** One independently testable assertion. Atomicity is checked in validate.ts. */
    claim: z.string().min(1),
    category: ClaimCategorySchema,
    /** User-facing. */
    evidence_strength: EvidenceStrengthSchema,
    /** Internal metadata. Never rendered, never shown as a score. */
    confidence: z.string().min(1),
    grounding: GroundingSchema,
    evidence: z.array(EvidenceRefSchema),
    sources: z.array(SourceRefSchema),
    /** Debated claims only. */
    positions: z.array(PositionSchema).optional(),
    /** Orientation order within the claim's display group, not importance. */
    display_rank: z.number().int().nonnegative(),
  })
  .superRefine((claim, ctx) => {
    if (claim.positions !== undefined && claim.category !== "debated") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["positions"],
        message: 'positions may only be present when category is "debated"',
      });
    }
    // PRD §11.1 model-knowledge policy: ungrounded historical claims are
    // capped at "supported" and can never present as strong.
    if (claim.grounding === "model_knowledge" && claim.evidence_strength === "strong") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidence_strength"],
        message: 'grounding "model_knowledge" caps evidence_strength at "supported"',
      });
    }
  });

export type Claim = z.infer<typeof ClaimSchema>;
