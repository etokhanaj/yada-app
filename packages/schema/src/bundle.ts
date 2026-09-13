/**
 * The bundle format: the contract between the pipeline and the app.
 *
 * Build plan §4. One immutable SQLite file per book for Understand content,
 * plus one core file carrying all 66 books' text and complete interlinear, so
 * the whole Bible and its original language work offline from first launch.
 *
 * The DDL lives here rather than in the pipeline because the app reads these
 * tables by name. A column renamed on one side and not the other is a crash on
 * a phone; one definition makes it a type error instead.
 *
 * Size matters: the core file ships inside the app, and the build plan moves
 * the interlinear to per-book downloads if it passes ~150MB. The first build
 * was 135MB, and most of that was structural waste rather than content — a
 * second copy of every translation inside the search index, JSON key names
 * repeated on every Hebrew word, and a primary-key index duplicating the token
 * table. The layout below removes all three.
 */

import { z } from "zod";

import { BOOK_ORDER, type BookCode, BookCodeSchema } from "./refs.js";

/** Bumped when a table or column changes in a way an older app cannot read. */
export const BUNDLE_FORMAT = 2;

export function bundleFileName(name: string, version: number): string {
  return `${name.toLowerCase()}.v${version}.db`;
}

/**
 * A single integer that orders every verse in the Bible. Range questions —
 * "does this selection cross a pericope boundary?" — become integer
 * comparisons, and tokens and texts key on it instead of repeating a verse-id
 * string on every row.
 */
export function verseOrd(book: BookCode, chapter: number, verse: number): number {
  return (BOOK_ORDER.indexOf(book) + 1) * 1_000_000 + chapter * 1000 + verse;
}

export function ordToParts(ord: number): { book: BookCode; chapter: number; verse: number } {
  const book = BOOK_ORDER[Math.floor(ord / 1_000_000) - 1];
  if (book === undefined) throw new Error(`ord ${ord} is outside the canon`);
  return { book, chapter: Math.floor((ord % 1_000_000) / 1000), verse: ord % 1000 };
}

export const CORE_DDL = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE books (
  code      TEXT PRIMARY KEY,
  ord       INTEGER NOT NULL,
  name      TEXT NOT NULL,
  testament TEXT NOT NULL,
  chapters  INTEGER NOT NULL,
  script    TEXT NOT NULL
);

-- Every addressable verse: English verses, plus Hebrew-only verse 0 titles.
CREATE TABLE verses (
  ord      INTEGER PRIMARY KEY,
  verse_id TEXT NOT NULL UNIQUE,
  book     TEXT NOT NULL,
  chapter  INTEGER NOT NULL,
  verse    INTEGER NOT NULL
);

-- A rowid table, because the search index reads its text from here rather than
-- keeping a second copy of all three translations.
CREATE TABLE texts (
  translation TEXT NOT NULL,
  ord         INTEGER NOT NULL,
  text        TEXT NOT NULL
);
CREATE UNIQUE INDEX texts_by_verse ON texts (translation, ord);

CREATE VIRTUAL TABLE texts_fts USING fts5(
  text,
  content = 'texts',
  content_rowid = 'rowid',
  tokenize = 'unicode61 remove_diacritics 2'
);

-- The interlinear, clustered on (ord, position) so the table is its own index.
-- gloss_source names whose gloss it is; nothing here is generated.
CREATE TABLE tokens (
  ord            INTEGER NOT NULL,
  position       INTEGER NOT NULL,
  surface        TEXT NOT NULL,
  translit       TEXT NOT NULL,
  gloss          TEXT,
  gloss_source   TEXT,
  lemma          TEXT NOT NULL,
  strongs        TEXT,
  morph          TEXT NOT NULL,
  morphemes      TEXT,
  variant_marked INTEGER NOT NULL,
  occurrence_key TEXT NOT NULL,
  PRIMARY KEY (ord, position)
) WITHOUT ROWID;
CREATE INDEX tokens_by_occurrence ON tokens (occurrence_key);

-- Word search: every distinct normalised form, pointing at its lexeme. Far
-- smaller than indexing a search key on 440,000 token rows.
CREATE TABLE word_forms (
  search_key     TEXT NOT NULL,
  occurrence_key TEXT NOT NULL,
  PRIMARY KEY (search_key, occurrence_key)
) WITHOUT ROWID;

-- One row per lexeme: dictionary form, its commonest sourced gloss, and how
-- often it occurs. Powers word cards and English word search ("love" finds
-- ἀγαπάω and אָהַב) without scanning 440,000 tokens.
CREATE TABLE lexemes (
  occurrence_key TEXT PRIMARY KEY,
  script         TEXT NOT NULL,
  lemma          TEXT NOT NULL,
  translit       TEXT NOT NULL,
  strongs        TEXT,
  gloss          TEXT,
  total          INTEGER NOT NULL
) WITHOUT ROWID;

-- "In this book": how often a lexeme occurs, precomputed per book.
CREATE TABLE occurrences (
  book           TEXT NOT NULL,
  occurrence_key TEXT NOT NULL,
  count          INTEGER NOT NULL,
  PRIMARY KEY (book, occurrence_key)
) WITHOUT ROWID;

-- In-app attribution, straight from sources.manifest.json.
CREATE TABLE sources (
  dataset     TEXT PRIMARY KEY,
  source      TEXT NOT NULL,
  license     TEXT NOT NULL,
  attribution TEXT NOT NULL,
  url         TEXT NOT NULL,
  encumbered  TEXT
);
`;

export const UNDERSTAND_DDL = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE entries (
  verse_id      TEXT PRIMARY KEY,
  ord           INTEGER NOT NULL,
  pericope_id   TEXT NOT NULL,
  review_status TEXT NOT NULL,
  payload       TEXT NOT NULL
);
CREATE INDEX entries_by_ord ON entries (ord);

-- Boundaries always; payload only once a pericope entry has been generated.
CREATE TABLE pericopes (
  pericope_id   TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  start_ord     INTEGER NOT NULL,
  end_ord       INTEGER NOT NULL,
  review_status TEXT,
  payload       TEXT
);
CREATE INDEX pericopes_by_range ON pericopes (start_ord, end_ord);
`;

// ---------------------------------------------------------------------------
// Morphemes, stored as tuples
// ---------------------------------------------------------------------------

export interface BundleMorpheme {
  surface: string;
  role: "prefix" | "stem" | "suffix";
  lemma_ref?: string;
  strongs?: string;
  morph?: string;
  gloss?: string;
}

type MorphemeTuple = Array<string | null>;

const ROLE_CODE: Readonly<Record<BundleMorpheme["role"], string>> = { prefix: "p", stem: "s", suffix: "x" };
const CODE_ROLE: Readonly<Record<string, BundleMorpheme["role"]>> = { p: "prefix", s: "stem", x: "suffix" };

/**
 * Object JSON repeated its key names on every one of ~147,000 Hebrew words,
 * averaging 187 bytes a word — more than the words themselves. Positional
 * tuples with trailing nulls trimmed carry the same data in well under half.
 * Tuple order: surface, role, lemma_ref, strongs, morph, gloss.
 */
export function encodeMorphemes(morphemes: readonly BundleMorpheme[]): string {
  return JSON.stringify(
    morphemes.map((m) => {
      const tuple: MorphemeTuple = [
        m.surface,
        ROLE_CODE[m.role],
        m.lemma_ref ?? null,
        m.strongs ?? null,
        m.morph ?? null,
        m.gloss ?? null,
      ];
      while (tuple.length > 2 && tuple[tuple.length - 1] === null) tuple.pop();
      return tuple;
    }),
  );
}

export function decodeMorphemes(encoded: string | null | undefined): BundleMorpheme[] | undefined {
  if (encoded === null || encoded === undefined || encoded === "") return undefined;
  const tuples = JSON.parse(encoded) as MorphemeTuple[];
  return tuples.map((tuple) => {
    const [surface, role, lemmaRef, strongs, morph, gloss] = tuple;
    return {
      surface: surface ?? "",
      role: CODE_ROLE[role ?? "s"] ?? "stem",
      ...(lemmaRef == null ? {} : { lemma_ref: lemmaRef }),
      ...(strongs == null ? {} : { strongs }),
      ...(morph == null ? {} : { morph }),
      ...(gloss == null ? {} : { gloss }),
    };
  });
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export const ReviewGateSchema = z.enum(["reviewed", "unreviewed-dev"]);
export type ReviewGate = z.infer<typeof ReviewGateSchema>;

export const BundleInfoSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["core", "understand"]),
  book: BookCodeSchema.optional(),
  version: z.number().int().positive(),
  file: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().positive(),
  format: z.number().int().positive(),
  schema_version: z.string().min(1),
  /**
   * `unreviewed-dev` bundles contain entries no human has approved. They exist
   * so the app can be built and tested before review has happened, must say so
   * on screen, and must never be published — `publish` refuses them.
   */
  review_gate: ReviewGateSchema,
  entries: z.number().int().nonnegative(),
});
export type BundleInfo = z.infer<typeof BundleInfoSchema>;

export const BundleManifestSchema = z.object({
  format: z.number().int().positive(),
  generated_at: z.string().min(1),
  min_app_version: z.string().min(1),
  /** The entry schema versions an app must support to read these bundles. */
  schema_versions: z.array(z.string().min(1)).min(1),
  bundles: z.array(BundleInfoSchema),
});
export type BundleManifest = z.infer<typeof BundleManifestSchema>;
