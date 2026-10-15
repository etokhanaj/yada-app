/**
 * The reader's own data: bookmarks, reading position, settings, thread
 * progress, and the local event log.
 *
 * Kept in a separate database from the content bundles (build plan §6) so a
 * bundle update can never touch anything the reader made. No accounts and no
 * analytics SDK. Bookmarks, the reading place, thread progress and the reading
 * settings are also kept in the reader's own iCloud (data/cloud.ts), which
 * Yada never sees; this database stays what every screen reads. The event log
 * is the PRD §14 instrument, read only by this app, and never leaves the phone.
 */

import type { SQLiteDatabase } from "expo-sqlite";

import { isSyncedSetting, nextStamp } from "../lib/cloudSync";
import { LICENSED_DDL } from "./licensed";

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

-- iCloud sync (lib/cloudSync.ts): a removed bookmark is remembered, so the
-- removal can beat the same bookmark still present on another device.
CREATE TABLE IF NOT EXISTS bookmark_removals (
  verse_id   TEXT PRIMARY KEY,
  removed_at TEXT NOT NULL
);

-- iCloud sync: when each setting last changed, for last-writer-wins. A setting
-- saved before sync existed has no row and loses to any synced value.
CREATE TABLE IF NOT EXISTS setting_stamps (
  key TEXT PRIMARY KEY,
  at  TEXT NOT NULL
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

-- Downloaded translations (more-translations plan): verified files in the
-- documents directory, attached to core at launch in the order saved.
-- removed = 1 marks one the reader removed: it is detached and its file
-- deleted at the next launch, never while attached (data/bundles.ts rule 1).
CREATE TABLE IF NOT EXISTS installed_translations (
  code       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  year       INTEGER,
  version    INTEGER NOT NULL,
  file       TEXT NOT NULL,
  sha256     TEXT NOT NULL,
  bytes      INTEGER NOT NULL,
  cover      TEXT NOT NULL,
  removed    INTEGER NOT NULL DEFAULT 0,
  saved_at   TEXT NOT NULL
);

-- Downloaded study bundles, one per book (data/study.ts): verified files in the documents
-- directory's study folder, opened lazily as their own connection. Kept apart from
-- installed_bundles, whose launch pass deletes every file the shipped manifest does not list.
CREATE TABLE IF NOT EXISTS installed_study (
  book       TEXT PRIMARY KEY,
  version    INTEGER NOT NULL,
  file       TEXT NOT NULL,
  sha256     TEXT NOT NULL,
  bytes      INTEGER NOT NULL,
  removed    INTEGER NOT NULL DEFAULT 0,
  saved_at   TEXT NOT NULL
);

-- When the reader first opened each book: the End page says "Begun 3 September" (MM-08), a date
-- from the reader's own use, never a guess.
CREATE TABLE IF NOT EXISTS books_begun (
  book TEXT PRIMARY KEY,
  at   TEXT NOT NULL
);

-- Downloaded Understand bundles, one per book (data/understand.ts), kept the same way.
CREATE TABLE IF NOT EXISTS installed_understand (
  book       TEXT PRIMARY KEY,
  version    INTEGER NOT NULL,
  file       TEXT NOT NULL,
  sha256     TEXT NOT NULL,
  bytes      INTEGER NOT NULL,
  removed    INTEGER NOT NULL DEFAULT 0,
  saved_at   TEXT NOT NULL
);
${LICENSED_DDL}`;

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

let onChange: () => void = () => undefined;

/** Called after every write of a synced value, so data/cloud.ts can send it to iCloud. */
export function setUserDataListener(listener: () => void): void {
  onChange = listener;
}

let writes: Promise<unknown> = Promise.resolve();

/**
 * Runs `task` alone among synced writes and iCloud merges. Gate review, 11 Oct 2026: a bookmark
 * made while a sync sat between reading user.db and writing the merge was deleted by an older
 * removal from iCloud (data/cloud.test.ts).
 */
export function exclusiveWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = writes.then(task, task);
  writes = run.catch(() => undefined);
  return run;
}

const now = (): string => new Date().toISOString();

/** An ISO stamp for a write that replaces `previous`: never earlier than it (lib/cloudSync.ts, clock skew). */
function stampAfter(previous: string | null | undefined): string {
  const before = previous === null || previous === undefined ? Number.NaN : Date.parse(previous);
  return new Date(nextStamp(Date.now(), Number.isNaN(before) ? undefined : before)).toISOString();
}

export async function logEvent(db: SQLiteDatabase, name: EventName, verseId?: string, detail?: string): Promise<void> {
  await db.runAsync("INSERT INTO events (name, verse_id, detail, at) VALUES (?, ?, ?, ?)", [
    name,
    verseId ?? null,
    detail ?? null,
    now(),
  ]);
}

export function savePosition(db: SQLiteDatabase, verseId: string): Promise<void> {
  return exclusiveWrite(async () => {
    const old = await db.getFirstAsync<{ verse_id: string; updated_at: string }>("SELECT verse_id, updated_at FROM position WHERE id = 1");
    // The reader settles on the same verse often; an unchanged place is not a new write to sync.
    if (old?.verse_id === verseId) return;
    await db.runAsync(
      "INSERT INTO position (id, verse_id, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET verse_id = excluded.verse_id, updated_at = excluded.updated_at",
      [verseId, stampAfter(old?.updated_at)],
    );
    onChange();
  });
}

/** The reading place and when it was saved (MM-05: back after a gap). */
export async function loadPositionAt(db: SQLiteDatabase): Promise<{ id: string; at: string } | null> {
  const row = await db.getFirstAsync<{ verse_id: string; updated_at: string }>("SELECT verse_id, updated_at FROM position WHERE id = 1", []);
  return row === null ? null : { id: row.verse_id, at: row.updated_at };
}

export async function loadPosition(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ verse_id: string }>("SELECT verse_id FROM position WHERE id = 1");
  return row?.verse_id ?? null;
}

export async function isBookmarked(db: SQLiteDatabase, verseId: string): Promise<boolean> {
  return (await db.getFirstAsync("SELECT 1 FROM bookmarks WHERE verse_id = ?", [verseId])) !== null;
}

/** When the verse was bookmarked, or null (MM-06: "Kept 3 Sep" under Understand's title). */
export async function keptAt(db: SQLiteDatabase, verseId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ created_at: string }>("SELECT created_at FROM bookmarks WHERE verse_id = ?", [verseId]);
  return row?.created_at ?? null;
}

/** Returns whether the verse is bookmarked after the toggle. */
export function toggleBookmark(db: SQLiteDatabase, verseId: string): Promise<boolean> {
  return exclusiveWrite(async () => {
    if (await isBookmarked(db, verseId)) {
      await unbookmark(db, verseId);
      return false;
    }
    const removal = await db.getFirstAsync<{ removed_at: string }>("SELECT removed_at FROM bookmark_removals WHERE verse_id = ?", [verseId]);
    await db.runAsync("DELETE FROM bookmark_removals WHERE verse_id = ?", [verseId]);
    await db.runAsync("INSERT INTO bookmarks (verse_id, created_at) VALUES (?, ?)", [verseId, stampAfter(removal?.removed_at)]);
    onChange();
    return true;
  });
}

export async function listBookmarks(db: SQLiteDatabase): Promise<Array<{ verse_id: string; created_at: string }>> {
  return db.getAllAsync("SELECT verse_id, created_at FROM bookmarks ORDER BY created_at DESC");
}

export function removeBookmark(db: SQLiteDatabase, verseId: string): Promise<void> {
  return exclusiveWrite(() => unbookmark(db, verseId));
}

async function unbookmark(db: SQLiteDatabase, verseId: string): Promise<void> {
  const row = await db.getFirstAsync<{ created_at: string }>("SELECT created_at FROM bookmarks WHERE verse_id = ?", [verseId]);
  if (row === null) return;
  await db.runAsync("DELETE FROM bookmarks WHERE verse_id = ?", [verseId]);
  await db.runAsync(
    "INSERT INTO bookmark_removals (verse_id, removed_at) VALUES (?, ?) ON CONFLICT(verse_id) DO UPDATE SET removed_at = excluded.removed_at",
    [verseId, stampAfter(row.created_at)],
  );
  onChange();
}

export async function loadSettings(db: SQLiteDatabase): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function saveSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  return exclusiveWrite(async () => {
    const old = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
    // Applying a value that came from iCloud re-saves it through the settings store; an
    // unchanged value must not gain a newer stamp, or the two devices would trade it back and forth.
    if (old?.value === value) return;
    await db.runAsync(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
    if (!isSyncedSetting(key)) return;
    const stamp = await db.getFirstAsync<{ at: string }>("SELECT at FROM setting_stamps WHERE key = ?", [key]);
    await db.runAsync(
      "INSERT INTO setting_stamps (key, at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at",
      [key, stampAfter(stamp?.at)],
    );
    onChange();
  });
}

export async function loadThreadStep(db: SQLiteDatabase, thread: string): Promise<number> {
  const row = await db.getFirstAsync<{ step: number }>("SELECT step FROM thread_progress WHERE thread = ?", [thread]);
  return row?.step ?? 0;
}

export function saveThreadStep(db: SQLiteDatabase, thread: string, step: number): Promise<void> {
  return exclusiveWrite(async () => {
    const old = await db.getFirstAsync<{ updated_at: string }>("SELECT updated_at FROM thread_progress WHERE thread = ?", [thread]);
    await db.runAsync(
      "INSERT INTO thread_progress (thread, step, updated_at) VALUES (?, ?, ?) ON CONFLICT(thread) DO UPDATE SET step = excluded.step, updated_at = excluded.updated_at",
      [thread, step, stampAfter(old?.updated_at)],
    );
    onChange();
  });
}

/**
 * Start here's finished passages (lib/startHere.ts): one row per passage,
 * keyed `start-here-john/read/<pericope id>`, beside the thread's own step.
 */
export async function loadReadPassages(db: SQLiteDatabase, prefix: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ thread: string }>("SELECT thread FROM thread_progress WHERE thread LIKE ? || '%'", [prefix]);
  return rows.map((r) => r.thread.slice(prefix.length));
}

/**
 * Marks a passage finished and makes the one after it next, in one
 * transaction so the count and the next passage never disagree. Idempotent:
 * reaching the Next row again changes nothing but the time.
 *
 * Each finished passage is its own thread_progress row, so iCloud sync
 * (lib/cloudSync.ts) carries it as its own last-writer-wins register: two
 * devices that finished different passages keep both, as bookmarks do. The
 * value is always 1 and nothing removes a row, so the merged set is the union.
 * Stamped after the row it replaces, as every synced write is (clock skew).
 */
export function markPassageRead(db: SQLiteDatabase, thread: string, readKey: string, nextStep: number): Promise<void> {
  return exclusiveWrite(async () => {
    await db.withTransactionAsync(async () => {
      const old = await db.getAllAsync<{ thread: string; updated_at: string }>(
        "SELECT thread, updated_at FROM thread_progress WHERE thread IN (?, ?)",
        [readKey, thread],
      );
      const stamp = (key: string) => stampAfter(old.find((r) => r.thread === key)?.updated_at);
      await db.runAsync(
        "INSERT INTO thread_progress (thread, step, updated_at) VALUES (?, 1, ?) ON CONFLICT(thread) DO UPDATE SET updated_at = excluded.updated_at",
        [readKey, stamp(readKey)],
      );
      await db.runAsync(
        "INSERT INTO thread_progress (thread, step, updated_at) VALUES (?, ?, ?) ON CONFLICT(thread) DO UPDATE SET step = excluded.step, updated_at = excluded.updated_at",
        [thread, nextStep, stamp(thread)],
      );
    });
    // Without this a finished passage reached iCloud only with the next unrelated write.
    onChange();
  });
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

/** Records the first time a book is opened; later opens keep the first date. */
export async function markBookBegun(db: SQLiteDatabase, book: string, at = new Date()): Promise<void> {
  await db.runAsync("INSERT OR IGNORE INTO books_begun (book, at) VALUES (?, ?)", [book, at.toISOString()]);
}

export async function bookBegun(db: SQLiteDatabase, book: string): Promise<Date | null> {
  const row = await db.getFirstAsync<{ at: string }>("SELECT at FROM books_begun WHERE book = ?", [book]);
  return row === null ? null : new Date(row.at);
}
