/**
 * The review tool's view of staging.db.
 *
 * The pipeline owns this database (packages/pipeline/src/db.ts). The review
 * tool reads `entries`, `texts` and `adversary_flags`, and writes only
 * `review_state`. Its schema changes are additive: the adversary table is
 * created if the adversary pass has not run yet, and `review_state` gains a
 * `decision` column. Nothing is renamed, dropped or retyped.
 */

import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;
export type Row = Record<string, unknown>;

/**
 * Shared contract with the adversary pass, which writes these rows. The shape
 * must match exactly on both sides.
 */
export const ADVERSARY_FLAGS_DDL = `
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
`;

const REQUIRED_TABLES = ["entries", "review_state"] as const;

export function tableExists(db: Db, name: string): boolean {
  return (
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined
  );
}

export function tableColumns(db: Db, table: string): Set<string> {
  return new Set(
    db
      .prepare("SELECT name FROM pragma_table_info(?)")
      .all(table)
      .map((row) => String(row["name"])),
  );
}

function assertExists(file: string): void {
  if (!existsSync(file)) {
    throw new Error(
      `staging.db not found at ${file}. Build it with the pipeline, or point YADA_STAGING_DB at a copy.`,
    );
  }
}

/** Opens staging.db for review: checks the tables exist, then migrates additively. */
export function openReviewDb(file: string): Db {
  assertExists(file);
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 5000");
  for (const table of REQUIRED_TABLES) {
    if (!tableExists(db, table)) {
      db.close();
      throw new Error(`${file} has no ${table} table. Is it a staging.db built by the pipeline?`);
    }
  }
  migrateReviewSchema(db);
  return db;
}

/** Read-only, no migrations. Used by `export`, which must never write the database. */
export function openReadOnly(file: string): Db {
  assertExists(file);
  const db = new DatabaseSync(file, { readOnly: true });
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

export function migrateReviewSchema(db: Db): void {
  db.exec(ADVERSARY_FLAGS_DDL);
  if (!tableColumns(db, "review_state").has("decision")) {
    db.exec("ALTER TABLE review_state ADD COLUMN decision TEXT");
  }
}

// ---------------------------------------------------------------------------
// Row helpers: node:sqlite hands back loosely typed values.
// ---------------------------------------------------------------------------

export function textOrNull(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : String(value);
}

export function text(row: Row, key: string): string {
  return textOrNull(row, key) ?? "";
}

export function intOrNull(row: Row, key: string): number | null {
  const value = row[key];
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  return null;
}
