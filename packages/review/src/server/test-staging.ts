/**
 * Temporary staging databases for tests, seeded from golden/*.json. Never
 * touches content/staging.db.
 */

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { REPO_ROOT } from "./config.js";
import { openReviewDb, type Db } from "./db.js";

/** The pre-review shape of the tables the review tool reads, as the pipeline creates them. */
const STAGING_DDL = `
CREATE TABLE entries (
  verse_id       TEXT PRIMARY KEY,
  pericope_id    TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  payload        TEXT NOT NULL
);
CREATE TABLE review_state (
  verse_id   TEXT PRIMARY KEY,
  status     TEXT NOT NULL,
  rating     INTEGER,
  reason     TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE texts (
  translation TEXT NOT NULL,
  verse_id    TEXT NOT NULL,
  text        TEXT NOT NULL,
  PRIMARY KEY (translation, verse_id)
);
`;

export type Payload = Record<string, unknown>;

export function goldenPayloads(): Payload[] {
  const dir = path.join(REPO_ROOT, "golden");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Payload);
}

export function golden(verseId: string): Payload {
  const found = goldenPayloads().find((p) => p["verse_id"] === verseId);
  if (found === undefined) throw new Error(`no golden fixture for ${verseId}`);
  return found;
}

/** A deep copy of a payload under a different verse id. */
export function asVerse(payload: Payload, verseId: string): Payload {
  return { ...(structuredClone(payload) as Payload), verse_id: verseId };
}

export interface TempStaging {
  dir: string;
  dbPath: string;
  reviewDir: string;
  db: Db;
  insert(payload: Payload, status?: string): void;
  flag(row: {
    verse_id: string;
    claim_id: string;
    verdict: string;
    severity: string;
    model?: string;
    note?: string | null;
  }): void;
  cleanup(): void;
}

function insertInto(db: DatabaseSync | Db, payload: Payload, status: string): void {
  db.prepare(
    "INSERT INTO entries (verse_id, pericope_id, schema_version, prompt_version, payload) VALUES (?, ?, ?, ?, ?)",
  ).run(
    String(payload["verse_id"]),
    String(payload["pericope_id"]),
    String(payload["schema_version"]),
    String(payload["prompt_version"]),
    JSON.stringify(payload),
  );
  db.prepare(
    "INSERT INTO review_state (verse_id, status, rating, reason, updated_at) VALUES (?, ?, NULL, ?, ?)",
  ).run(String(payload["verse_id"]), status, "imported from golden/", "2026-09-01T00:00:00.000Z");
}

export function createTempStaging(payloads: Payload[] = goldenPayloads()): TempStaging {
  const dir = mkdtempSync(path.join(tmpdir(), "yada-review-"));
  const dbPath = path.join(dir, "staging.db");

  const seed = new DatabaseSync(dbPath);
  seed.exec(STAGING_DDL);
  for (const payload of payloads) insertInto(seed, payload, "flagged");
  seed
    .prepare("INSERT INTO texts (translation, verse_id, text) VALUES (?, ?, ?)")
    .run("BSB", "1CO.14.34", "Women are to be silent in the churches.");
  seed.close();

  const db = openReviewDb(dbPath);
  return {
    dir,
    dbPath,
    reviewDir: path.join(dir, "review"),
    db,
    insert: (payload, status = "flagged") => insertInto(db, payload, status),
    flag: (row) => {
      db.prepare(
        `INSERT INTO adversary_flags (verse_id, claim_id, verdict, severity, note, model, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.verse_id,
        row.claim_id,
        row.verdict,
        row.severity,
        row.note ?? null,
        row.model ?? "adversary-model",
        "2026-09-02T00:00:00.000Z",
      );
    },
    cleanup: () => {
      if (db.isOpen) db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
