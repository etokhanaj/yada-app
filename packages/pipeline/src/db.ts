/**
 * staging.db — the working database every stage reads and writes.
 *
 * SQLite because it is inspectable, transactional, and the review tool can sit
 * directly on it. `node:sqlite` is used so the pipeline has no native build
 * step; it ships FTS5, which the bundle format will need later.
 */

import { DatabaseSync } from "node:sqlite";

import { VerseEntrySchema } from "@yada/schema";

import { STAGING_DB, ensureDirs } from "./paths.js";

export const DDL = `
CREATE TABLE IF NOT EXISTS verses (
  verse_id      TEXT PRIMARY KEY,
  book          TEXT NOT NULL,
  chapter       INTEGER NOT NULL,
  verse         INTEGER NOT NULL,
  source_scheme TEXT NOT NULL,
  has_title     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tokens (
  verse_id       TEXT NOT NULL,
  position       INTEGER NOT NULL,
  surface        TEXT NOT NULL,
  raw_surface    TEXT NOT NULL,
  lemma          TEXT NOT NULL,
  strongs        TEXT,
  morph          TEXT NOT NULL,
  morphemes      TEXT,
  variant_marked INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (verse_id, position)
);

CREATE TABLE IF NOT EXISTS lexemes (
  strongs TEXT PRIMARY KEY,
  gloss   TEXT NOT NULL,
  source  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pericopes (
  pericope_id TEXT PRIMARY KEY,
  book        TEXT NOT NULL,
  start_verse TEXT NOT NULL,
  end_verse   TEXT NOT NULL,
  label       TEXT NOT NULL,
  authority   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  verse_id       TEXT PRIMARY KEY,
  pericope_id    TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  payload        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_state (
  verse_id   TEXT PRIMARY KEY,
  status     TEXT NOT NULL,
  rating     INTEGER,
  reason     TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS batches (
  batch_id   TEXT PRIMARY KEY,
  book       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  state      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS tokens_by_verse ON tokens (verse_id);
CREATE INDEX IF NOT EXISTS verses_by_book ON verses (book, chapter, verse);
`;

export function openStaging(): DatabaseSync {
  ensureDirs();
  const db = new DatabaseSync(STAGING_DB);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(DDL);
  return db;
}

/**
 * Schema drift protection (build plan §2): Zod is the single source of truth in
 * fact, not just in intent. Every top-level field of a VerseEntry must either
 * have a column in `entries` or be inside the JSON payload deliberately.
 */
const PAYLOAD_FIELDS = new Set([
  "gloss",
  "close_rendering",
  "whats_happening",
  "key_words",
  "translation_note",
  "claims",
  "related_passages",
  "no_significant_dispute",
  "versification",
  "review",
]);

export function assertSchemaAlignment(db: DatabaseSync): string[] {
  const columns = new Set(
    db.prepare("SELECT name FROM pragma_table_info('entries')").all().map((r) => String(r["name"])),
  );
  const problems: string[] = [];
  for (const field of Object.keys(VerseEntrySchema.shape)) {
    if (!columns.has(field) && !PAYLOAD_FIELDS.has(field)) {
      problems.push(`VerseEntry.${field} has no column in entries and is not a declared payload field`);
    }
  }
  return problems;
}
