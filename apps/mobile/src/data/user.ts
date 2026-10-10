/**
 * The reader's own data: bookmarks, reading position, settings, thread
 * progress, and the local event log.
 *
 * Kept in a separate database from the content bundles (build plan §6) so a
 * bundle update can never touch anything the reader made. Nothing here leaves
 * the device: no accounts, no sync, no analytics SDK. The event log is the
 * PRD §14 instrument, read only by this app.
 */

import type { SQLiteDatabase } from "expo-sqlite";

export const USER_DB = "user.db";

export const USER_DDL = `
CREATE TABLE IF NOT EXISTS bookmarks (
  verse_id   TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS position (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  verse_id    TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS thread_progress (
  thread     TEXT PRIMARY KEY,
  step       INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  verse_id TEXT,
  detail   TEXT,
  at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_by_time ON events (at);

-- Which bundle files have been copied out of the app into the SQLite directory,
-- and from which build of them. A copy is redone when the digest changes and
-- deleted when the manifest stops listing it (see data/bundles.ts).
CREATE TABLE IF NOT EXISTS installed_bundles (
  file   TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL
);
`;

/**
 * The PRD §14 metrics, and nothing else. Counts only; no limits are hardcoded
 * anywhere against them (PRD §13).
 */
export type EventName =
  | "understand_open"
  | "passage_open"
  | "return_to_reading"
  | "go_deeper"
  | "word_open"
  | "claim_open"
  | "thread_step"
  | "search";

const now = (): string => new Date().toISOString();

export async function logEvent(db: SQLiteDatabase, name: EventName, verseId?: string, detail?: string): Promise<void> {
  await db.runAsync("INSERT INTO events (name, verse_id, detail, at) VALUES (?, ?, ?, ?)", [
    name,
    verseId ?? null,
    detail ?? null,
    now(),
  ]);
}

export async function savePosition(db: SQLiteDatabase, verseId: string): Promise<void> {
  await db.runAsync(
    "INSERT INTO position (id, verse_id, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET verse_id = excluded.verse_id, updated_at = excluded.updated_at",
    [verseId, now()],
  );
}

export async function loadPosition(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ verse_id: string }>("SELECT verse_id FROM position WHERE id = 1");
  return row?.verse_id ?? null;
}

export async function isBookmarked(db: SQLiteDatabase, verseId: string): Promise<boolean> {
  return (await db.getFirstAsync("SELECT 1 FROM bookmarks WHERE verse_id = ?", [verseId])) !== null;
}

/** Returns whether the verse is bookmarked after the toggle. */
export async function toggleBookmark(db: SQLiteDatabase, verseId: string): Promise<boolean> {
  if (await isBookmarked(db, verseId)) {
    await db.runAsync("DELETE FROM bookmarks WHERE verse_id = ?", [verseId]);
    return false;
  }
  await db.runAsync("INSERT INTO bookmarks (verse_id, created_at) VALUES (?, ?)", [verseId, now()]);
  return true;
}

export async function listBookmarks(db: SQLiteDatabase): Promise<Array<{ verse_id: string; created_at: string }>> {
  return db.getAllAsync("SELECT verse_id, created_at FROM bookmarks ORDER BY created_at DESC");
}

export async function removeBookmark(db: SQLiteDatabase, verseId: string): Promise<void> {
  await db.runAsync("DELETE FROM bookmarks WHERE verse_id = ?", [verseId]);
}

export async function loadSettings(db: SQLiteDatabase): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function saveSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}

export async function loadThreadStep(db: SQLiteDatabase, thread: string): Promise<number> {
  const row = await db.getFirstAsync<{ step: number }>("SELECT step FROM thread_progress WHERE thread = ?", [thread]);
  return row?.step ?? 0;
}

export async function saveThreadStep(db: SQLiteDatabase, thread: string, step: number): Promise<void> {
  await db.runAsync(
    "INSERT INTO thread_progress (thread, step, updated_at) VALUES (?, ?, ?) ON CONFLICT(thread) DO UPDATE SET step = excluded.step, updated_at = excluded.updated_at",
    [thread, step, now()],
  );
}

/**
 * "Recently explored" (PRD §8.6): the verses the reader looked underneath,
 * newest first, one row per verse.
 */
export async function recentlyExplored(
  db: SQLiteDatabase,
  limit = 40,
): Promise<Array<{ verse_id: string; name: EventName; detail: string | null; at: string }>> {
  // SQLite returns the bare columns from the row that holds MAX(at): the latest event per verse.
  return db.getAllAsync(
    `SELECT verse_id, name, detail, MAX(at) AS at FROM events
     WHERE verse_id IS NOT NULL AND name IN ('understand_open', 'passage_open', 'word_open', 'claim_open')
     GROUP BY verse_id ORDER BY at DESC LIMIT ?`,
    [limit],
  );
}
