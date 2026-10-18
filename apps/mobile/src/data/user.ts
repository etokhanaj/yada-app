/**
 * The reader's own data: bookmarks, highlights and notes, reading position,
 * settings, thread progress, and the local event log.
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
import { type HighlightColor, type ImageGround, isHighlightColor, NOTE_MAX } from "../lib/highlights";
import { todayKey } from "../lib/rhythm";
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

-- The days that count towards the streak (build 7, lib/rhythm.ts): a local date on Today's clock, once.
CREATE TABLE IF NOT EXISTS rhythm_days (
  day TEXT PRIMARY KEY
);

-- Chapters the reader reached the end of (build 10a, lib/chaptersRead.ts): "MRK.4", once, in any translation.
CREATE TABLE IF NOT EXISTS chapters_read (
  chapter_key TEXT PRIMARY KEY
);

-- Your space (PS-01–PS-03, lib/highlights.ts). A highlight is a colour on one verse; '' is a removal, kept so it can
-- beat the same highlight still on another device (the bookmark_removals rule, in one table).
CREATE TABLE IF NOT EXISTS highlights (
  verse_id   TEXT PRIMARY KEY,
  color      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- A note on a verse ("JHN.3.16") or a whole chapter ("JHN.3"); '' is a deleted note, for the same reason.
CREATE TABLE IF NOT EXISTS notes (
  target     TEXT PRIMARY KEY,
  body       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Images made from a verse (PS-05), listed under Saved › Images (PS-04). Kept on this iPhone only: the picture is
-- redrawn from these fields, so nothing large is stored or synced.
CREATE TABLE IF NOT EXISTS verse_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  verse_id    TEXT NOT NULL,
  through     INTEGER NOT NULL,
  translation TEXT NOT NULL,
  ground      TEXT NOT NULL,
  picture_day INTEGER NOT NULL,
  created_at  TEXT NOT NULL
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

/**
 * Your space changed (a highlight, a note, from here or from iCloud): the reader redraws its marks. A sheet over the
 * reader never takes its focus, so a focus refresh missed a note saved in the Note sheet (simulator, 18 Oct 2026).
 */
const spaceListeners = new Set<() => void>();
export function subscribeYourSpace(listener: () => void): () => void {
  spaceListeners.add(listener);
  return () => void spaceListeners.delete(listener);
}
export function yourSpaceChanged(): void {
  for (const listener of spaceListeners) listener();
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

/** Colours `verseIds` (PS-01), or clears them with null; one write, so a range lands as one. */
export function setHighlight(db: SQLiteDatabase, verseIds: readonly string[], color: HighlightColor | null): Promise<void> {
  return exclusiveWrite(async () => {
    let changed = false;
    for (const id of verseIds) {
      const old = await db.getFirstAsync<{ color: string; updated_at: string }>("SELECT color, updated_at FROM highlights WHERE verse_id = ?", [id]);
      if ((old?.color ?? "") === (color ?? "")) continue;
      await db.runAsync(
        "INSERT INTO highlights (verse_id, color, updated_at) VALUES (?, ?, ?) ON CONFLICT(verse_id) DO UPDATE SET color = excluded.color, updated_at = excluded.updated_at",
        [id, color ?? "", stampAfter(old?.updated_at)],
      );
      changed = true;
    }
    // Re-choosing the same colour is no write: no iCloud sync and no redraw for it, as saveNote and saveSetting.
    if (!changed) return;
    onChange();
    yourSpaceChanged();
  });
}

/** The chapter's highlighted verses, verse number → colour (PS-02). */
export async function loadHighlights(db: SQLiteDatabase, book: string, chapter: number): Promise<Map<number, HighlightColor>> {
  const rows = await db.getAllAsync<{ verse_id: string; color: string }>("SELECT verse_id, color FROM highlights WHERE verse_id LIKE ? AND color != ''", [`${book}.${chapter}.%`]);
  const out = new Map<number, HighlightColor>();
  for (const r of rows) {
    const verse = Number(r.verse_id.split(".")[2]);
    if (Number.isInteger(verse) && isHighlightColor(r.color)) out.set(verse, r.color);
  }
  return out;
}

/** Every highlight, newest first (PS-04 Saved › Highlights). */
export async function listHighlights(db: SQLiteDatabase): Promise<Array<{ verse_id: string; color: HighlightColor; updated_at: string }>> {
  const rows = await db.getAllAsync<{ verse_id: string; color: string; updated_at: string }>("SELECT verse_id, color, updated_at FROM highlights WHERE color != '' ORDER BY updated_at DESC");
  return rows.flatMap((r) => (isHighlightColor(r.color) ? [{ verse_id: r.verse_id, color: r.color, updated_at: r.updated_at }] : []));
}

/** Saves the note on `target` (a verse id or "JHN.3"); an empty note deletes it (PS-03). */
export function saveNote(db: SQLiteDatabase, target: string, body: string): Promise<void> {
  const text = body.trim().slice(0, NOTE_MAX);
  return exclusiveWrite(async () => {
    const old = await db.getFirstAsync<{ body: string; updated_at: string }>("SELECT body, updated_at FROM notes WHERE target = ?", [target]);
    if ((old?.body ?? "") === text) return;
    await db.runAsync(
      "INSERT INTO notes (target, body, updated_at) VALUES (?, ?, ?) ON CONFLICT(target) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at",
      [target, text, stampAfter(old?.updated_at)],
    );
    onChange();
    yourSpaceChanged();
  });
}

export async function loadNote(db: SQLiteDatabase, target: string): Promise<string> {
  const row = await db.getFirstAsync<{ body: string }>("SELECT body FROM notes WHERE target = ?", [target]);
  return row?.body ?? "";
}

/** The chapter's notes: which verses carry one (PS-02's mark) and whether the whole chapter does. */
export async function loadChapterNotes(db: SQLiteDatabase, book: string, chapter: number): Promise<{ verses: Set<number>; chapter: boolean }> {
  const key = `${book}.${chapter}`;
  const rows = await db.getAllAsync<{ target: string }>("SELECT target FROM notes WHERE (target = ? OR target LIKE ?) AND body != ''", [key, `${key}.%`]);
  const verses = new Set<number>();
  let whole = false;
  for (const r of rows) {
    if (r.target === key) whole = true;
    else {
      const verse = Number(r.target.split(".")[2]);
      if (Number.isInteger(verse)) verses.add(verse);
    }
  }
  return { verses, chapter: whole };
}

/** Every note, newest first (PS-04 Saved › Notes). */
export async function listNotes(db: SQLiteDatabase): Promise<Array<{ target: string; body: string; updated_at: string }>> {
  return db.getAllAsync("SELECT target, body, updated_at FROM notes WHERE body != '' ORDER BY updated_at DESC");
}

export interface VerseImage {
  readonly id: number;
  readonly verse_id: string;
  readonly through: number;
  readonly translation: string;
  readonly ground: ImageGround;
  readonly picture_day: number;
  readonly created_at: string;
}

/** An image the reader saved or shared (PS-05), so Saved › Images can show it again. */
export async function recordVerseImage(db: SQLiteDatabase, image: Omit<VerseImage, "id" | "created_at">): Promise<void> {
  await db.runAsync("INSERT INTO verse_images (verse_id, through, translation, ground, picture_day, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    image.verse_id,
    image.through,
    image.translation,
    image.ground,
    image.picture_day,
    now(),
  ]);
}

export async function listVerseImages(db: SQLiteDatabase): Promise<VerseImage[]> {
  return db.getAllAsync<VerseImage>("SELECT id, verse_id, through, translation, ground, picture_day, created_at FROM verse_images ORDER BY id DESC");
}

export async function removeVerseImage(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync("DELETE FROM verse_images WHERE id = ?", [id]);
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

/** Reading or listening counts today (lib/rhythm.ts). Today reads it on focus; a second call the same day does nothing. */
export async function countDay(db: SQLiteDatabase, now = new Date()): Promise<void> {
  const result = await db.runAsync("INSERT OR IGNORE INTO rhythm_days (day) VALUES (?)", [todayKey(now)]);
  // A new day goes to iCloud, so a second device's lamp counts it too.
  if (result.changes > 0) onChange();
}

export async function loadDays(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ day: string }>("SELECT day FROM rhythm_days");
  return rows.map((r) => r.day);
}

/**
 * The reader reached the end of a chapter (the same moment that counts the day). Returns whether it was new, so the
 * caller can refresh what shows it. A new chapter goes to iCloud, so a second device's bar has it too.
 */
export async function markChapterRead(db: SQLiteDatabase, key: string): Promise<boolean> {
  const result = await db.runAsync("INSERT OR IGNORE INTO chapters_read (chapter_key) VALUES (?)", [key]);
  if (result.changes > 0) onChange();
  return result.changes > 0;
}

export async function loadChaptersRead(db: SQLiteDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ chapter_key: string }>("SELECT chapter_key FROM chapters_read");
  return new Set(rows.map((r) => r.chapter_key));
}
