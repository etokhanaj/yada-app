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

CREATE TABLE IF NOT EXISTS pericope_entries (
  pericope_id    TEXT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS texts (
  translation TEXT NOT NULL,
  verse_id    TEXT NOT NULL,
  text        TEXT NOT NULL,
  PRIMARY KEY (translation, verse_id)
);

-- One adversarial verdict per claim per attacking model (PRD §11.7.2). Keyed on
-- the model as well as the claim because disagreement *between* models is the
-- signal: a second adversary must add rows, not overwrite the first one's.
-- The review tool reads this table directly, so its shape is a contract:
--   verdict  upheld | unsupported | miscategorised | compound | overclaimed
--   severity critical | minor | none
CREATE TABLE IF NOT EXISTS adversary_flags (
  verse_id   TEXT NOT NULL,
  claim_id   TEXT NOT NULL,
  verdict    TEXT NOT NULL,
  severity   TEXT NOT NULL,
  note       TEXT,
  model      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (verse_id, claim_id, model)
);

CREATE INDEX IF NOT EXISTS tokens_by_verse ON tokens (verse_id);
CREATE INDEX IF NOT EXISTS verses_by_book ON verses (book, chapter, verse);
`;

export function openStaging(): DatabaseSync {
  ensureDirs();
  return openDatabase(STAGING_DB);
}

/**
 * Open any file with the staging schema. Stages that take a database handle
 * rather than opening staging.db themselves are testable against a temp file,
 * which matters because the shared staging.db is absent in CI and a test that
 * silently skips there proves nothing about the gate it claims to cover.
 */
export function openDatabase(file: string): DatabaseSync {
  const db = new DatabaseSync(file);
  // Wait rather than fail instantly when another reader holds the file. WAL
  // itself is not enough: setting the journal mode is a write, so concurrent
  // opens collide on it.
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(DDL);
  migrate(db);
  return db;
}

/**
 * Additive column migrations for staging.db files created before a column
 * existed. `CREATE TABLE IF NOT EXISTS` never alters an existing table, so
 * without this an old staging.db silently lacks the column and every insert
 * that names it fails.
 */
function migrate(db: DatabaseSync): void {
  const columns = new Set(
    db.prepare("PRAGMA table_info(tokens)").all().map((row) => String(row["name"])),
  );
  if (!columns.has("gloss")) db.exec("ALTER TABLE tokens ADD COLUMN gloss TEXT");
  if (!columns.has("gloss_source")) db.exec("ALTER TABLE tokens ADD COLUMN gloss_source TEXT");
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
