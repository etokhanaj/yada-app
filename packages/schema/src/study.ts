/**
 * The study bundles (`study-<book>.vN.db`, one per book): openly licensed reference material shown beside the text.
 *
 * Everything here is third-party work shown verbatim with its attribution. None of it is Yada's
 * own explanation, none of it passes through the review tool, and none of it is AI-generated. It
 * is a separate file from core and the Understand bundles so that it can never be mistaken for
 * reviewed Yada content, and so the share-alike notice for the Tyndale notes travels with the
 * notes themselves: every row names its row in `sources`, which carries the licence statement as
 * the package printed it (CLAUDE.md rule 3).
 *
 * Note text is a small HTML fragment so that Tyndale's distinctions survive: `<h>` a heading
 * paragraph, `<x>` words quoted from the Bible text, `<i>` italic, `<b>` bold, `<sc>` small caps
 * (the divine name, BC/AD). Paragraphs are separated by "\n". `&amp;`, `&lt;` and `&gt;` stay
 * escaped.
 */

import { z } from "zod";

import { LicenseSchema } from "./manifest.js";
import { BOOK_ORDER, type BookCode, BookCodeSchema } from "./refs.js";

export const STUDY_FORMAT = 1;

/**
 * Cross-references kept per verse in a book's study bundle. OpenBible lists up to a few hundred
 * for one verse; Understand shows three and "Show all" the rest, so five ranked by votes is what
 * ships. Votes stay in the file: they order the list and are never shown.
 */
export const XREFS_PER_VERSE = 5;

export const NoteKindSchema = z.enum(["note", "intro", "intro_summary", "profile", "theme"]);
export type NoteKind = z.infer<typeof NoteKindSchema>;

/** Tags a note's text may contain; anything else in a fragment is a packaging bug. */
export const STUDY_TAGS: readonly string[] = ["h", "x", "i", "b", "sc"];

export const STUDY_DDL = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- One row per dataset. license_notice is the licence statement read from the downloaded files
-- themselves; attribution is the credit line the licence requires.
CREATE TABLE sources (
  id             INTEGER PRIMARY KEY,
  key            TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  license        TEXT NOT NULL,
  license_notice TEXT NOT NULL,
  attribution    TEXT NOT NULL,
  homepage       TEXT NOT NULL,
  sha256         TEXT NOT NULL,
  modifications  TEXT NOT NULL
);

-- Verse ords as in core (verseOrd). A book introduction spans the whole book.
CREATE TABLE notes (
  id        INTEGER PRIMARY KEY,
  ord_start INTEGER NOT NULL,
  ord_end   INTEGER NOT NULL CHECK (ord_end >= ord_start),
  kind      TEXT NOT NULL CHECK (kind IN ('note', 'intro', 'intro_summary', 'profile', 'theme')),
  title     TEXT,
  text      TEXT NOT NULL,
  source    INTEGER NOT NULL REFERENCES sources (id)
);
CREATE INDEX notes_by_range ON notes (ord_start, ord_end);

-- Every cross-reference comes from the one row in sources with key 'openbible'.
CREATE TABLE xrefs (
  from_ord     INTEGER NOT NULL,
  to_ord_start INTEGER NOT NULL,
  to_ord_end   INTEGER NOT NULL CHECK (to_ord_end >= to_ord_start),
  votes        INTEGER NOT NULL,
  PRIMARY KEY (from_ord, to_ord_start, to_ord_end)
) WITHOUT ROWID;

-- People and places linked to verses. Empty until a source for them is cleared.
CREATE TABLE people (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL,
  source INTEGER NOT NULL REFERENCES sources (id)
);
CREATE TABLE people_verses (
  person INTEGER NOT NULL REFERENCES people (id),
  ord    INTEGER NOT NULL,
  PRIMARY KEY (person, ord)
) WITHOUT ROWID;
CREATE INDEX people_verses_by_ord ON people_verses (ord);

CREATE TABLE places (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  latitude  REAL,
  longitude REAL,
  source    INTEGER NOT NULL REFERENCES sources (id)
);
CREATE TABLE places_verses (
  place INTEGER NOT NULL REFERENCES places (id),
  ord   INTEGER NOT NULL,
  PRIMARY KEY (place, ord)
) WITHOUT ROWID;
CREATE INDEX places_verses_by_ord ON places_verses (ord);
`;

/**
 * One book's study bundle, downloaded on demand like a translation: `study-jhn.v1.db`. Every
 * Tyndale note, introduction, profile and theme article is anchored inside one book (a Tyndale
 * range never crosses books), so the split loses nothing and needs no shared articles file.
 */
export function studyBookName(book: BookCode): string {
  return `study-${book.toLowerCase()}`;
}

export function studyBookFileName(book: BookCode, version: number): string {
  return `${studyBookName(book)}.v${version}.db`;
}

/** The book a verse ord belongs to (verseOrd in bundle.ts). */
export function bookOfOrd(ord: number): BookCode | undefined {
  return BOOK_ORDER[Math.floor(ord / 1_000_000) - 1];
}

export interface RankedXref {
  readonly to_ord_start: number;
  readonly to_ord_end: number;
  readonly votes: number;
}

/** Most votes first; ties in canonical order, so the same file always lists the same three. */
export function compareXrefs(a: RankedXref, b: RankedXref): number {
  return b.votes - a.votes || a.to_ord_start - b.to_ord_start || a.to_ord_end - b.to_ord_end;
}

/** The manifest entry for one book's study bundle (`study` in the bundle manifest). */
export const StudyInfoSchema = z
  .object({
    book: BookCodeSchema,
    version: z.number().int().positive(),
    file: z.string().min(1),
    /** Of the decompressed file, which is what the app verifies, as for translations. */
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    bytes: z.number().int().positive(),
    /** The gzip-compressed size publish uploads and the download row shows. */
    download_bytes: z.number().int().positive(),
    format: z.number().int().positive(),
    /** The licences of the rows inside, read from the file's own `sources` table. */
    licenses: z.array(LicenseSchema).min(1),
    notes: z.number().int().nonnegative(),
    xrefs: z.number().int().nonnegative(),
  })
  // publish uploads `file` from disk by this name; free text could point it anywhere.
  .refine((info) => info.file === studyBookFileName(info.book, info.version), {
    message: "file must be the book's own study name and version, e.g. study-jhn.v1.db",
    path: ["file"],
  });
export type StudyInfo = z.infer<typeof StudyInfoSchema>;

/** Tags used in a note fragment that are not in STUDY_TAGS. */
export function unknownStudyTags(fragment: string): string[] {
  const found = new Set<string>();
  for (const match of fragment.matchAll(/<\/?([a-z]+)[^>]*>/g)) {
    const tag = match[1] ?? "";
    if (!STUDY_TAGS.includes(tag)) found.add(tag);
  }
  return [...found];
}
