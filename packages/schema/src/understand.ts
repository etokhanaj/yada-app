/**
 * Understand without AI (docs/no-ai-understand.md): the shape of `understand-<book>.vN.db`, written by
 * packages/pipeline/src/understand/package.ts and read by the app. A verse row's `layers` and a passage
 * row's JSON columns are parsed here, so a row the app cannot read is left out rather than drawn half-broken.
 *
 * Every line inside is a published source adapted by rule, a fact in a fixed sentence, or a reference:
 * nothing here is generated prose, so nothing carries a review status (rule 2 has nothing to label).
 */

import { z } from "zod";

import { BookCodeSchema } from "./refs.js";

/** The bundle format the app reads; a newer one is ignored until the app knows it. */
export const UNDERSTAND_FORMAT = 1;

export const understandFileName = (book: string, version: number): string => `understand-${book.toLowerCase()}.v${version}.db`;

/** The manifest entry for one book's Understand bundle (`understand` in the bundle manifest). */
export const UnderstandInfoSchema = z
  .object({
    book: BookCodeSchema,
    version: z.number().int().positive(),
    file: z.string().min(1),
    /** Of the decompressed file, which the app verifies, as for study bundles and translations. */
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    bytes: z.number().int().positive(),
    /** The gzip-compressed size publish uploads and Downloads shows (DN-05). */
    download_bytes: z.number().int().positive(),
    format: z.number().int().positive(),
    verses: z.number().int().nonnegative(),
    passages: z.number().int().nonnegative(),
  })
  // publish uploads `file` from disk by this name; free text could point it anywhere.
  .refine((info) => info.file === understandFileName(info.book, info.version), {
    message: "file must be the book's own understand name and version, e.g. understand-jhn.v2.db",
    path: ["file"],
  });
export type UnderstandInfo = z.infer<typeof UnderstandInfoSchema>;

// ---------------------------------------------------------------------------
// A verse's layers (verses.layers)
// ---------------------------------------------------------------------------

const PlainSchema = z.object({
  /** The UST line; words it adds for meaning are marked {…} and shown grey (VS-02). */
  text: z.string(),
  added: z.array(z.string()),
  bracketed: z.boolean(),
  credit: z.string(),
  one_reading: z.boolean(),
  label: z.enum(["One way to read it", "In plain words"]),
});

const ReadingSchema = z.object({
  about: z.string().nullable(),
  sentence: z.string(),
  options: z.array(z.string()),
  /** True when the note was cut at its first sentence, so "Read the full note" follows. */
  full_note: z.boolean(),
  source: z.enum(["tn", "jps", "position"]),
  id: z.string().optional(),
  credit: z.string(),
  held_by: z.string().optional(),
});
export type Reading = z.infer<typeof ReadingSchema>;

const BsbNoteSchema = z.object({
  kind: z.enum(["or", "literally", "cited", "manuscripts", "other"]),
  on: z.string(),
  text: z.string(),
});
export type BsbNote = z.infer<typeof BsbNoteSchema>;

// lead: the sentence of the definition that fits this verse (pipeline leadSentence, 23 Oct 2026). Optional because
// Understand bundles built before it are still on phones; the app shows the first sentence for those.
const KeyWordSchema = z.object({ term: z.string(), definition: z.string(), kind: z.string(), lead: z.string().optional() });
export type TranslationWord = z.infer<typeof KeyWordSchema>;

const VerseLayersSchema = z.object({
  verse: z.string(),
  where: z.object({
    frame: z.string().nullable(),
    section: z.string().nullable(),
    range: z.tuple([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number()])]).nullable(),
  }),
  beginner: z.object({
    order: z.tuple([z.string(), z.string()]),
    voice: z.string().nullable(),
    plain: PlainSchema.nullable(),
    translators: z.array(BsbNoteSchema),
    readers_differ: z.array(ReadingSchema),
    manuscripts: z.array(z.string()),
    debate: z.object({ kind: z.string().nullable() }).nullable(),
    readers_half: z.number().int().nonnegative(),
    readers_more: z.number().int().nonnegative(),
    readers_lead: z.enum(["Readers differ", "Readers explain this in more than one way"]).nullable(),
  }),
  facts: z.array(z.string()),
  alongside: z.array(z.string()),
  deeper: z.object({
    explained: z.array(z.object({ text: z.string(), id: z.string() })),
    key_words: z.array(KeyWordSchema),
    study_note: z
      .object({ range: z.tuple([z.number(), z.number()]), text: z.string(), named_refs: z.array(z.string()), credit: z.string() })
      .nullable(),
    check: z.array(z.object({ q: z.string(), a: z.string() })),
  }),
});
export type VerseLayers = z.infer<typeof VerseLayersSchema>;

/** A verse the BSB leaves out (John 5:4): the manuscripts fact and the UST's bracketed line, if any. */
const MissingVerseSchema = z.object({
  verse: z.string(),
  missing: z.literal(true),
  manuscripts: z.array(z.string()),
  plain: PlainSchema.omit({ one_reading: true, label: true }).nullable(),
});
export type MissingVerse = z.infer<typeof MissingVerseSchema>;

export type UnderstandVerse = VerseLayers | MissingVerse;

export const isMissingVerse = (v: UnderstandVerse): v is MissingVerse => "missing" in v;

export function parseVerseLayers(json: string): UnderstandVerse | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const missing = MissingVerseSchema.safeParse(raw);
  if (missing.success) return missing.data;
  const layers = VerseLayersSchema.safeParse(raw);
  return layers.success ? layers.data : null;
}

// ---------------------------------------------------------------------------
// A passage (the passages table)
// ---------------------------------------------------------------------------

const SentenceSchema = z.object({
  text: z.string(),
  where: z.tuple([z.number(), z.number()]).nullable().optional(),
  source: z.string(),
  credit: z.string(),
});

const LabelledLineSchema = z.object({ label: z.string(), text: z.string(), source: z.string() });
export type LabelledLine = z.infer<typeof LabelledLineSchema>;

const FixedLineSchema = z.object({ line: z.string(), source: z.string(), status: z.string() });
export type FixedLine = z.infer<typeof FixedLineSchema>;

/**
 * A line Yada drafted from a source (a setting or purpose line) shows only once John approved it
 * (prophets.json, kinds.json: "approved"). A source's own sentence carries no status ("") and needs none.
 */
const shown = (line: FixedLine): boolean => line.status === "" || line.status === "approved";

const PassageJsonSchema = z.object({
  sentences: z.array(SentenceSchema),
  speakers: z.array(z.string()),
  facts: z.array(z.object({ fact: z.string(), rest: z.string() })),
  psalm_lead: z.array(LabelledLineSchema),
  psalm_about: z.array(LabelledLineSchema),
  debates: z.array(z.object({ sentence: z.string(), credit: z.string() })),
  also_told_in: z.array(z.string()),
  themes: z.array(z.string()),
  settings: z.array(FixedLineSchema),
  purpose: FixedLineSchema.nullable(),
  around: z.object({ before: z.string().nullable(), after: z.string().nullable() }).nullable(),
});

export const HEADLINE_KINDS = ["What happens", "Part of", "Genealogy", "Topic", "What John sees"] as const;

export interface PassageRow {
  readonly passage_id: string;
  readonly label: string;
  readonly start_ord: number;
  readonly end_ord: number;
  readonly headline: string;
  readonly headline_kind: string;
  readonly mode: string;
  readonly summary: string;
  readonly sentences: string;
  readonly credit: string;
  readonly speakers: string;
  readonly facts: string;
  readonly psalm_lead: string;
  readonly psalm_about: string;
  readonly debates: string;
  readonly purpose: string | null;
  readonly around: string | null;
  readonly also_told_in: string;
  readonly themes: string;
  readonly settings: string;
  readonly flagged: number;
}

export interface Passage extends z.infer<typeof PassageJsonSchema> {
  readonly id: string;
  readonly label: string;
  readonly startOrd: number;
  readonly endOrd: number;
  /** "Jesus teaches Nicodemus about being born again."; empty when the passage has none (a psalm). */
  readonly headline: string;
  readonly headlineKind: (typeof HEADLINE_KINDS)[number];
  readonly mode: string;
  /** "From unfoldingWord Translation Questions, the UST, adapted": the Sources row's line. */
  readonly credit: string;
  /**
   * A summary that failed the gate (docs/no-ai-understand.md, the six checks) is held back: its
   * sentences are emptied here, while its facts and verses stay (EG-01).
   */
  readonly flagged: boolean;
}

export function parsePassage(row: PassageRow): Passage | null {
  let json: unknown;
  try {
    json = {
      sentences: JSON.parse(row.sentences),
      speakers: JSON.parse(row.speakers),
      facts: JSON.parse(row.facts),
      psalm_lead: JSON.parse(row.psalm_lead),
      psalm_about: JSON.parse(row.psalm_about),
      debates: JSON.parse(row.debates),
      also_told_in: JSON.parse(row.also_told_in),
      themes: JSON.parse(row.themes),
      settings: JSON.parse(row.settings),
      purpose: row.purpose === null ? null : JSON.parse(row.purpose),
      around: row.around === null ? null : JSON.parse(row.around),
    };
  } catch {
    return null;
  }
  const parsed = PassageJsonSchema.safeParse(json);
  const kind = HEADLINE_KINDS.find((k) => k === row.headline_kind);
  if (!parsed.success || kind === undefined) return null;
  const flagged = row.flagged === 1;
  return {
    ...parsed.data,
    sentences: flagged ? [] : parsed.data.sentences,
    settings: parsed.data.settings.filter(shown),
    purpose: parsed.data.purpose !== null && shown(parsed.data.purpose) ? parsed.data.purpose : null,
    id: row.passage_id,
    label: row.label,
    startOrd: row.start_ord,
    endOrd: row.end_ord,
    headline: row.headline,
    headlineKind: kind,
    mode: row.mode,
    credit: row.credit,
    flagged,
  };
}

// ---------------------------------------------------------------------------
// Recorded audio (the manifest's `audio` list; packages/pipeline/src/audio.ts)
// ---------------------------------------------------------------------------

const AudioChapterSchema = z.object({
  chapter: z.number().int().positive(),
  /** "audio/hays/jhn-001.m4a": the path beside the manifest. */
  // The BSB at audio/heart/, WEB, KJV and LSV a folder below: a build before those readings rejects the
  // deeper path and skips the entry, so it never plays a WEB reading under BSB text.
  file: z.string().regex(/^audio\/[a-z]+\/(?:(?:web|kjv|lsv)\/)?[a-z0-9]{3}-\d{3}\.m4a$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().positive(),
  timings: z.string().regex(/^audio\/[a-z]+\/(?:(?:web|kjv|lsv)\/)?[a-z0-9]{3}-\d{3}\.json$/),
  timings_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  duration: z.number().positive(),
});

/**
 * The voice saying each chapter's name, "John, chapter three", all in one short file per book: played
 * where listening goes on into the next chapter (John, 13 Oct 2026, from Dwell's chapter references).
 */
export const AudioTitlesSchema = z.object({
  file: z.string().regex(/^audio\/[a-z]+\/[a-z0-9]{3}-titles\.m4a$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().positive(),
  spans: z.array(z.object({ chapter: z.number().int().positive(), start: z.number().nonnegative(), end: z.number().positive() })).min(1),
});
export type AudioTitles = z.infer<typeof AudioTitlesSchema>;

/** One narrator's recording of one book: Downloads and the voice sheet read sizes from here (BA-03, DN-05). */
export const AudioInfoSchema = z.object({
  book: BookCodeSchema,
  /** The text read; Heart and George read the WEB, KJV and LSV too (John, 13 Oct 2026). */
  translation: z.enum(["BSB", "WEB", "KJV", "LSV"]).default("BSB"),
  narrator: z.string().regex(/^[a-z]+$/),
  narrator_name: z.string().min(1),
  /** A computer voice is named as one wherever it is chosen (Phase 4, John, 12 Oct 2026). */
  kind: z.enum(["human", "computer"]).default("human"),
  /** The licence line for Sources, as the pipeline recorded it from the source (rule 3). */
  credit: z.string().optional(),
  credit_url: z.string().optional(),
  chapters: z.array(AudioChapterSchema).min(1),
  titles: AudioTitlesSchema.optional(),
});
export type AudioInfo = z.infer<typeof AudioInfoSchema>;

/** A chapter's timings file (audio.ts ChapterTimings): when each verse and word starts, in seconds. */
export const ChapterTimingsSchema = z.object({
  format: z.literal(1),
  book: BookCodeSchema,
  chapter: z.number().int().positive(),
  narrator: z.string(),
  duration: z.number(),
  verses: z.array(z.object({ verse: z.number().int(), start: z.number(), end: z.number(), words: z.array(z.number()) })),
  matched: z.number(),
});
export type ChapterTimings = z.infer<typeof ChapterTimingsSchema>;
