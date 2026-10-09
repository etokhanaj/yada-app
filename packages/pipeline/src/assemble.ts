/**
 * What the model writes, and how the pipeline turns it into entries.
 *
 * Milestone 0's first run returned 40 entries and every one failed the schema:
 * the prompt said "schema JSON only" but never gave the schema, so each model
 * invented its own field names (`id` for `verse_id`, `grounding: "supplied_text"`).
 * The content was sound; the contract was missing.
 *
 * The fix divides the work by who can be trusted with it. The model writes only
 * the composed fields, constrained by GENERATION_SCHEMA: the JSON Schema below,
 * given in the prompt and enforced on the way back in. Everything mechanical —
 * ids, versions, review status, the derived word-for-word gloss — is filled in
 * here, because a model asked to copy a gloss or stamp a review status can get
 * it wrong, and the derived gloss is explicitly not the model's to write
 * (PRD §11.3).
 */

import {
  SCHEMA_VERSION,
  bookOfRef,
  parseVerseRef,
  type PericopeEntry,
  type VerseEntry,
} from "@yada/schema";

import { deriveVerse, type DerivedWord } from "./derive.js";

export const PROMPT_VERSION = "pericope@1.1.0";

// ---------------------------------------------------------------------------
// The output contract, as JSON Schema for `output_config.format`
// ---------------------------------------------------------------------------

const str = { type: "string" } as const;
const strArray = { type: "array", items: str } as const;
const array = (items: unknown) => ({ type: "array", items });
const enumOf = (...values: string[]) => ({ type: "string", enum: values });

/**
 * Structured outputs refused this schema twice before any tokens were spent:
 * first for 45 optional parameters (limit 24), then, with those made nullable,
 * for 45 union-typed parameters (limit 16). So the contract uses neither. Every
 * property is required; an absent string is "", an absent list is [], and the
 * three evidence kinds share one flat object discriminated by `type`.
 * `clean` and `shapeEvidence` turn that back into the entry schema's shape.
 */
function object(properties: Record<string, unknown>): Record<string, unknown> {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

const evidenceItem = object({
  type: enumOf("verse", "lexical", "apparatus"),
  ref: str,
  lemma: str,
  strongs: str,
  dataset: str,
  analysis_tradition: str,
  witnesses: strArray,
  note: str,
});
const evidence = array(evidenceItem);

const claim = object({
  id: str,
  claim: str,
  category: enumOf("text", "context", "interpretation", "debated"),
  evidence_strength: enumOf("strong", "supported", "disputed"),
  confidence: enumOf("high", "medium", "low"),
  grounding: enumOf("source_data", "model_knowledge"),
  evidence,
  positions: array(object({ label: str, case: str, evidence })),
  display_rank: { type: "integer" },
});

const related = object({
  ref: str,
  relationship: enumOf("", "parallel", "quotation", "allusion", "thematic", "development", "contrast", "fulfillment"),
  note: str,
});

export const GENERATION_SCHEMA = object({
  pericope: object({
    summary_one_sentence: str,
    key_ideas: strArray,
    discussion_questions: strArray,
    movement: array(object({ range: str, label: str })),
    claims: array(claim),
    related_passages: array(related),
    no_significant_dispute: { type: "boolean" },
  }),
  verses: array(
    object({
      verse_id: str,
      close_rendering: str,
      whats_happening: str,
      key_words: array(object({ surface: str, lemma: str, gloss: str, note: str, strongs: str })),
      translation_note: str,
      claims: array(claim),
      related_passages: array(related),
      no_significant_dispute: { type: "boolean" },
    }),
  ),
});

/** Lists that are optional in the entry schema, so an empty one means absent. */
const OPTIONAL_LISTS = new Set(["positions", "discussion_questions", "movement", "witnesses"]);

/** "" and `false` and empty optional lists mean "absent"; the entry schema wants the key missing. */
export function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (inner === "" || inner === null) continue;
    if (key === "no_significant_dispute" && inner === false) continue;
    if (OPTIONAL_LISTS.has(key) && Array.isArray(inner) && inner.length === 0) continue;
    out[key] = clean(inner);
  }
  return out as T;
}

/** Back from the flat evidence object to the entry schema's discriminated union. */
const EVIDENCE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  verse: ["type", "ref", "note"],
  lexical: ["type", "lemma", "strongs", "dataset", "analysis_tradition", "note"],
  apparatus: ["type", "ref", "witnesses", "dataset", "note"],
};

export function shapeEvidence(items: unknown): unknown {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    const record = item as Record<string, unknown>;
    const fields = EVIDENCE_FIELDS[String(record["type"])] ?? Object.keys(record);
    return Object.fromEntries(fields.filter((f) => f in record).map((f) => [f, record[f]]));
  });
}

function shapeClaims(claims: unknown[] | undefined): unknown[] {
  return (claims ?? []).map((raw) => {
    const c = raw as Record<string, unknown>;
    const positions = Array.isArray(c["positions"])
      ? (c["positions"] as Array<Record<string, unknown>>).map((p) => ({ ...p, evidence: shapeEvidence(p["evidence"]) }))
      : undefined;
    return {
      ...c,
      // An omitted list and an empty one mean the same thing; Opus omitted it on
      // claims citing nothing. The rules still flag a source_data claim with no
      // evidence, so this changes the shape, not what gets caught.
      evidence: shapeEvidence(c["evidence"] ?? []),
      ...(positions === undefined ? {} : { positions }),
      // Every claim carries `sources: []` in v1 (PRD §11.4); the model never writes them.
      sources: [],
    };
  });
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

type Composed = Record<string, unknown> & { claims?: unknown[] };

/** True for the composed shape, which has verses but none of the stamped fields. */
export function isComposed(value: unknown): value is { pericope: Composed; verses: Composed[] } {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const verses = record["verses"];
  return (
    Array.isArray(verses) &&
    typeof record["pericope"] === "object" &&
    record["pericope"] !== null &&
    verses.every((v) => typeof v === "object" && v !== null && !("schema_version" in v))
  );
}


/**
 * Derives a verse's words. Ingest passes one bound to the database it is
 * storing into; without that, a temp or alternate staging.db got its glosses
 * from the shared content/staging.db instead.
 */
export type DeriveWords = (verseId: string) => DerivedWord[];

/** The derived word-for-word gloss. A word the sources leave unglossed shows a dash, never a guess. */
export function derivedGloss(verseId: string, derive: DeriveWords = deriveVerse): VerseEntry["gloss"] {
  return derive(verseId).map((word) => ({
    surface: word.surface,
    translit: word.translit.length > 0 ? word.translit : word.surface,
    gloss: word.gloss ?? "—",
    ...(word.strongs === undefined ? {} : { strongs: word.strongs }),
    morph: word.morph,
    ...(word.morphemes === undefined
      ? {}
      : { morphemes: word.morphemes.map((m) => ({ ...m, gloss: m.gloss ?? "—" })) }),
  }));
}

export function assemble(
  composed: { pericope: Composed; verses: Composed[] },
  pericopeId: string,
  model: string,
  derive: DeriveWords = deriveVerse,
): Array<VerseEntry | PericopeEntry> {
  composed = clean(composed);
  const range = parseVerseRef(pericopeId);
  if (range === null) throw new Error(`cannot assemble: ${pericopeId} is not a pericope id`);
  const review = { status: "flagged" as const, flags: [`generated by ${model}`, `prompt ${PROMPT_VERSION}`] };
  const stamp = { schema_version: SCHEMA_VERSION, prompt_version: PROMPT_VERSION };

  const pericope = {
    ...composed.pericope,
    ...stamp,
    pericope_id: pericopeId,
    book: range.book,
    span: {
      start: `${range.book}.${range.start.chapter}.${range.start.verse}`,
      end: `${range.book}.${range.end.chapter}.${range.end.verse}`,
    },
    claims: shapeClaims(composed.pericope.claims),
    // The prompt's own example showed "14.26-14.33" without a book, and the
    // models followed it; a movement step is a verse range and needs one.
    // Checked by book code, not by shape: "119.1-119.8" also starts with three
    // characters and a dot, and went unprefixed.
    ...(Array.isArray(composed.pericope["movement"])
      ? {
          movement: (composed.pericope["movement"] as Array<{ range: string; label: string }>).map((step) => ({
            ...step,
            range: bookOfRef(step.range) === null ? `${range.book}.${step.range}` : step.range,
          })),
        }
      : {}),
    review,
  } as unknown as PericopeEntry;

  const verses = composed.verses.map((verse) => {
    const verseId = String(verse["verse_id"]);
    return {
      ...verse,
      ...stamp,
      verse_id: verseId,
      pericope_id: pericopeId,
      gloss: derivedGloss(verseId, derive),
      claims: shapeClaims(verse.claims),
      versification: "english",
      review,
    } as unknown as VerseEntry;
  });

  return [pericope, ...verses];
}
