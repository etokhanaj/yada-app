/**
 * Entry schemas: the corpus payload. PRD §11.4.
 *
 * Three entry types ship in v1:
 *   VerseEntry    — meaning at a point
 *   PericopeEntry — meaning in relationship (passage Understand)
 *   BookEntry     — orientation, all 66 at launch
 *
 * The derived/generated boundary is carried in the data, not just in prose:
 * `gloss` is mechanical (from alignment data, no AI) and `close_rendering` is
 * composed and reviewed. The UI must never label the latter literal.
 */

import { z } from "zod";
import { ClaimSchema, StrongsSchema } from "./claims.js";
import { BookCodeSchema, PericopeIdSchema, VerseIdSchema } from "./refs.js";

/**
 * Bumped when the entry shape changes; bundles and the app negotiate on it.
 *
 * 1.1.0 — Hebrew: WordGloss gains `morphemes[]`, because one Hebrew surface
 * word routinely carries several morphemes with their own lemma references
 * (`וּ/בַ/חֲבֻרָת/וֹ` is four), and lexical evidence gains `analysis_tradition`.
 */
export const SCHEMA_VERSION = "1.1.0";

const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+$/, "expected a semver string");

/** Identifies the exact prompt that produced an entry, e.g. `verse@2026-08-16.1`. */
const PromptVersionSchema = z.string().min(1);

export const ReviewStatusSchema = z.enum([
  "auto_passed",
  "flagged",
  "human_reviewed",
  "expert_reviewed",
]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const ReviewSchema = z.object({
  status: ReviewStatusSchema,
  flags: z.array(z.string().min(1)),
});
export type Review = z.infer<typeof ReviewSchema>;

export const MorphemeRoleSchema = z.enum(["prefix", "stem", "suffix"]);
export type MorphemeRole = z.infer<typeof MorphemeRoleSchema>;

/**
 * One morpheme of a surface word. Hebrew needs this: OSHB writes a single
 * written word as several morphemes with their own lemma references
 * (`לְ/רֵעֲ/ךָ` is preposition + noun + pronominal suffix), and the Original
 * layer promises morpheme-level alignment. Greek words are single morphemes and
 * omit it.
 */
export const MorphemeSchema = z.object({
  surface: z.string().min(1),
  gloss: z.string().min(1),
  role: MorphemeRoleSchema,
  /** Raw lemma reference exactly as the source dataset writes it: `l`, `7462 b`. */
  lemma_ref: z.string().min(1).optional(),
  strongs: StrongsSchema.optional(),
  /** Source morphology code for this morpheme, e.g. `HR` or `Ncmsc`. */
  morph: z.string().min(1).optional(),
});
export type Morpheme = z.infer<typeof MorphemeSchema>;

/** Derived, per-word, from the alignment tables. No AI touches this. */
export const WordGlossSchema = z.object({
  surface: z.string().min(1),
  translit: z.string().min(1),
  gloss: z.string().min(1),
  strongs: StrongsSchema.optional(),
  /** Source morphology code for the whole word, e.g. `HR/Ncmsc/Sp2ms`. */
  morph: z.string().min(1).optional(),
  morphemes: z.array(MorphemeSchema).optional(),
});
export type WordGloss = z.infer<typeof WordGlossSchema>;

export const KeyWordSchema = z.object({
  surface: z.string().min(1),
  lemma: z.string().min(1),
  gloss: z.string().min(1),
  note: z.string().min(1).optional(),
  strongs: StrongsSchema,
});
export type KeyWord = z.infer<typeof KeyWordSchema>;

export const RelationshipSchema = z.enum([
  "parallel",
  "quotation",
  "allusion",
  "thematic",
  "development",
  "contrast",
  "fulfillment",
]);
export type Relationship = z.infer<typeof RelationshipSchema>;

/** The relationship label is the information; a bare ref list is a junk drawer. */
export const RelatedPassageSchema = z.object({
  ref: z.string().min(1),
  relationship: RelationshipSchema.optional(),
  note: z.string().min(1).optional(),
});
export type RelatedPassage = z.infer<typeof RelatedPassageSchema>;

/** One step of "How the passage moves": `1CO.14.26-33` -> "Order in worship". */
export const MovementStepSchema = z.object({
  range: z.string().min(1),
  label: z.string().min(1),
});
export type MovementStep = z.infer<typeof MovementStepSchema>;

// ---------------------------------------------------------------------------
// Verse entry
// ---------------------------------------------------------------------------

export const VerseEntrySchema = z.object({
  verse_id: VerseIdSchema,
  pericope_id: PericopeIdSchema,
  schema_version: SemverSchema,
  prompt_version: PromptVersionSchema,

  gloss: z.array(WordGlossSchema),
  close_rendering: z.string().min(1),
  whats_happening: z.string().min(1),
  key_words: z.array(KeyWordSchema),
  translation_note: z.string().min(1).optional(),

  claims: z.array(ClaimSchema),
  related_passages: z.array(RelatedPassageSchema),

  /**
   * Explicit marker that this entry has no live interpretive dispute. Lets the
   * debated-positions rule distinguish "nothing to show" from "positions
   * missing", instead of inferring silence.
   */
  no_significant_dispute: z.boolean().optional(),

  review: ReviewSchema,
});
export type VerseEntry = z.infer<typeof VerseEntrySchema>;

// ---------------------------------------------------------------------------
// Pericope entry
// ---------------------------------------------------------------------------

export const PericopeEntrySchema = z.object({
  pericope_id: PericopeIdSchema,
  book: BookCodeSchema,
  schema_version: SemverSchema,
  prompt_version: PromptVersionSchema,

  span: z.object({
    start: VerseIdSchema,
    end: VerseIdSchema,
  }),

  summary_one_sentence: z.string().min(1),
  key_ideas: z.array(z.string().min(1)),
  /** Derived from debated claims; powers G0 study packs. */
  discussion_questions: z.array(z.string().min(1)).optional(),

  claims: z.array(ClaimSchema),
  related_passages: z.array(RelatedPassageSchema).optional(),
  /** Powers "How the passage moves". */
  movement: z.array(MovementStepSchema).optional(),

  no_significant_dispute: z.boolean().optional(),

  review: ReviewSchema,
});
export type PericopeEntry = z.infer<typeof PericopeEntrySchema>;

// ---------------------------------------------------------------------------
// Book entry
// ---------------------------------------------------------------------------

/**
 * One per book, all 66 at launch. Each section is claims, not prose, so book
 * orientation goes through the same pipeline, categories, and review as
 * everything else.
 */
export const BookEntrySchema = z.object({
  book: BookCodeSchema,
  schema_version: SemverSchema,
  prompt_version: PromptVersionSchema,

  author: z.array(ClaimSchema),
  setting: z.array(ClaimSchema),
  audience: z.array(ClaimSchema),
  structure: z.array(ClaimSchema),
  themes: z.array(ClaimSchema),

  review: ReviewSchema,
});
export type BookEntry = z.infer<typeof BookEntrySchema>;

export const BOOK_ENTRY_SECTIONS = ["author", "setting", "audience", "structure", "themes"] as const;
export type BookEntrySection = (typeof BOOK_ENTRY_SECTIONS)[number];
