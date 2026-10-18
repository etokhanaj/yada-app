/**
 * iCloud backup and sync: reads user.db, merges with the iCloud key-value
 * store (lib/cloudSync.ts holds the rules), writes the result to both.
 *
 * user.db stays the source of truth every screen reads; iCloud is a copy that
 * other devices merge with. Without the native module (Android, a binary from
 * before it) nothing here runs, and any failure is swallowed: a reader signed
 * out of iCloud, or with the store unavailable, gets the app exactly as it was
 * before sync, with nothing shown about it.
 */

import { AppState } from "react-native";
import type { SQLiteDatabase } from "expo-sqlite";

import { CloudChangeReason, cloudStore } from "../../modules/yada-cloud";
import {
  changedEntries,
  CLOUD_KEYS,
  mergeState,
  parseCloud,
  POSITION_KEY,
  type Register,
  serializeRegisters,
  SYNC_KINDS,
  SYNCED_SETTINGS,
  type SyncKind,
  type SyncState,
} from "../lib/cloudSync";
import { exclusiveWrite, setUserDataListener, yourSpaceChanged } from "./user";

/** Local writes come in bursts (a range bookmarked, a scroll settling); one sync per burst. */
const SYNC_DELAY_MS = 1500;

/**
 * The most one kind may take in the key-value store. iCloud allows 1 MB for the whole app, and a write past it is a
 * quotaViolation that stops every key syncing, so a kind grown past this (hundreds of long notes) stays on this device
 * and the rest keep syncing (code review, 18 Oct 2026).
 */
export const KIND_BUDGET_BYTES = 400_000;

/** UTF-8 length, as iCloud counts it; a note in Greek or with emoji takes more than its character count. */
function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    // Each half of a surrogate pair: the pair is one 4-byte character.
    else if (code >= 0xd800 && code <= 0xdfff) bytes += 2;
    else bytes += 3;
  }
  return bytes;
}

const ms = (iso: string | null | undefined): number => {
  const value = iso === null || iso === undefined ? Number.NaN : Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
};
const iso = (at: number): string => new Date(at).toISOString();

async function readLocal(db: SQLiteDatabase): Promise<SyncState> {
  const bookmarks: Record<string, Register<boolean>> = {};
  for (const r of await db.getAllAsync<{ verse_id: string; removed_at: string }>("SELECT verse_id, removed_at FROM bookmark_removals")) {
    bookmarks[r.verse_id] = [false, ms(r.removed_at)];
  }
  for (const r of await db.getAllAsync<{ verse_id: string; created_at: string }>("SELECT verse_id, created_at FROM bookmarks")) {
    const removal = bookmarks[r.verse_id];
    if (removal === undefined || removal[1] < ms(r.created_at)) bookmarks[r.verse_id] = [true, ms(r.created_at)];
  }
  const place = await db.getFirstAsync<{ verse_id: string; updated_at: string }>("SELECT verse_id, updated_at FROM position WHERE id = 1");
  const threads = await db.getAllAsync<{ thread: string; step: number; updated_at: string }>("SELECT thread, step, updated_at FROM thread_progress");
  const settings = await db.getAllAsync<{ key: string; value: string; at: string | null }>(
    `SELECT s.key, s.value, t.at FROM settings s LEFT JOIN setting_stamps t ON t.key = s.key
     WHERE s.key IN (${SYNCED_SETTINGS.map(() => "?").join(", ")})`,
    [...SYNCED_SETTINGS],
  );
  const days = await db.getAllAsync<{ day: string }>("SELECT day FROM rhythm_days");
  const chapters = await db.getAllAsync<{ chapter_key: string }>("SELECT chapter_key FROM chapters_read");
  const highlights = await db.getAllAsync<{ verse_id: string; color: string; updated_at: string }>("SELECT verse_id, color, updated_at FROM highlights");
  const notes = await db.getAllAsync<{ target: string; body: string; updated_at: string }>("SELECT target, body, updated_at FROM notes");
  return {
    bookmarks,
    position: place === null ? {} : { [POSITION_KEY]: [place.verse_id, ms(place.updated_at)] },
    threads: Object.fromEntries(threads.map((r) => [r.thread, [r.step, ms(r.updated_at)]])),
    settings: Object.fromEntries(settings.map((r) => [r.key, [r.value, ms(r.at)]])),
    // A counted day never changes, so its stamp is 0 on every device and the merge is a plain union.
    days: Object.fromEntries(days.map((r) => [r.day, [true, 0]])),
    // A chapter read stays read, so its stamp is 0 everywhere and the merge is a union too.
    chapters: Object.fromEntries(chapters.map((r) => [r.chapter_key, [true, 0]])),
    highlights: Object.fromEntries(highlights.map((r) => [r.verse_id, [r.color, ms(r.updated_at)]])),
    notes: Object.fromEntries(notes.map((r) => [r.target, [r.body, ms(r.updated_at)]])),
  };
}

/** Brings user.db to `merged`. Returns whether any setting changed, so the store can follow. */
async function writeLocal(db: SQLiteDatabase, local: SyncState, merged: SyncState): Promise<boolean> {
  for (const [verse, [present, at]] of changedEntries(local.bookmarks, merged.bookmarks)) {
    if (present) {
      await db.runAsync("DELETE FROM bookmark_removals WHERE verse_id = ?", [verse]);
      await db.runAsync(
        "INSERT INTO bookmarks (verse_id, created_at) VALUES (?, ?) ON CONFLICT(verse_id) DO UPDATE SET created_at = excluded.created_at",
        [verse, iso(at)],
      );
    } else {
      await db.runAsync("DELETE FROM bookmarks WHERE verse_id = ?", [verse]);
      await db.runAsync(
        "INSERT INTO bookmark_removals (verse_id, removed_at) VALUES (?, ?) ON CONFLICT(verse_id) DO UPDATE SET removed_at = excluded.removed_at",
        [verse, iso(at)],
      );
    }
  }
  for (const [, [verse, at]] of changedEntries(local.position, merged.position)) {
    await db.runAsync(
      "INSERT INTO position (id, verse_id, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET verse_id = excluded.verse_id, updated_at = excluded.updated_at",
      [verse, iso(at)],
    );
  }
  for (const [thread, [step, at]] of changedEntries(local.threads, merged.threads)) {
    await db.runAsync(
      "INSERT INTO thread_progress (thread, step, updated_at) VALUES (?, ?, ?) ON CONFLICT(thread) DO UPDATE SET step = excluded.step, updated_at = excluded.updated_at",
      [thread, step, iso(at)],
    );
  }
  for (const [day] of changedEntries(local.days, merged.days)) {
    await db.runAsync("INSERT OR IGNORE INTO rhythm_days (day) VALUES (?)", [day]);
  }
  for (const [key] of changedEntries(local.chapters, merged.chapters)) {
    await db.runAsync("INSERT OR IGNORE INTO chapters_read (chapter_key) VALUES (?)", [key]);
  }
  for (const [verse, [color, at]] of changedEntries(local.highlights, merged.highlights)) {
    await db.runAsync(
      "INSERT INTO highlights (verse_id, color, updated_at) VALUES (?, ?, ?) ON CONFLICT(verse_id) DO UPDATE SET color = excluded.color, updated_at = excluded.updated_at",
      [verse, color, iso(at)],
    );
  }
  for (const [target, [body, at]] of changedEntries(local.notes, merged.notes)) {
    await db.runAsync(
      "INSERT INTO notes (target, body, updated_at) VALUES (?, ?, ?) ON CONFLICT(target) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at",
      [target, body, iso(at)],
    );
  }
  const settings = changedEntries(local.settings, merged.settings);
  for (const [key, [value, at]] of settings) {
    await db.runAsync("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
    await db.runAsync("INSERT INTO setting_stamps (key, at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at", [key, iso(at)]);
  }
  return settings.some(([key, [value]]) => local.settings[key]?.[0] !== value);
}

/** The part of the native store a sync uses; tests pass an in-memory one. */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  synchronize(): boolean;
}

// One sync at a time: the launch sync, a local burst and an iCloud change can overlap.
let queue: Promise<boolean> = Promise.resolve(false);

/** Merge user.db with the store and write the result to both. Resolves whether a setting changed here. */
/** Resolves once no sync is running (Remove my data waits for it before it deletes). */
export function cloudIdle(): Promise<unknown> {
  return queue;
}

/** Settings › iCloud (ST-01): off, nothing is read from or written to the store. */
let paused = false;
export function setCloudPaused(value: boolean): void {
  paused = value;
}

export function syncWithCloud(db: SQLiteDatabase, store: KeyValueStore, initialSync = false): Promise<boolean> {
  const run = async (): Promise<boolean> => {
    if (paused) return false;
    const raw = new Map<SyncKind, string | null>();
    for (const kind of SYNC_KINDS) raw.set(kind, store.get(CLOUD_KEYS[kind]));
    const remote: SyncState = {
      bookmarks: parseCloud("bookmarks", raw.get("bookmarks")),
      position: parseCloud("position", raw.get("position")),
      threads: parseCloud("threads", raw.get("threads")),
      settings: parseCloud("settings", raw.get("settings")),
      days: parseCloud("days", raw.get("days")),
      chapters: parseCloud("chapters", raw.get("chapters")),
      highlights: parseCloud("highlights", raw.get("highlights")),
      notes: parseCloud("notes", raw.get("notes")),
    };
    const { merged, settingsChanged } = await exclusiveWrite(async () => {
      const local = await readLocal(db);
      const next = mergeState(local, remote, { initialSync });
      const changed = await writeLocal(db, local, next);
      if (changedEntries(local.highlights, next.highlights).length + changedEntries(local.notes, next.notes).length > 0) yourSpaceChanged();
      return { merged: next, settingsChanged: changed };
    });
    let wrote = false;
    for (const kind of SYNC_KINDS) {
      const text = serializeRegisters<unknown>(merged[kind]);
      // Compared with the raw value, so entries this version could not read are rewritten out.
      if (text === (raw.get(kind) ?? serializeRegisters({}))) continue;
      // Over budget it stays local-only: iCloud keeps its last copy, which merges as older and loses nothing here.
      if (utf8Bytes(text) > KIND_BUDGET_BYTES) continue;
      store.set(CLOUD_KEYS[kind], text);
      wrote = true;
    }
    if (wrote) store.synchronize();
    return settingsChanged;
  };
  queue = queue.then(run, run).catch(() => false);
  return queue;
}

let started = false;

/**
 * Merge with iCloud now, then whenever a synced value changes here or there.
 * `settingsChanged` runs when a setting arrived from another device, so the
 * live settings store can be refreshed from user.db.
 */
export async function startCloudSync(db: SQLiteDatabase, settingsChanged: () => void): Promise<void> {
  const store = cloudStore;
  if (store === null || started) return;
  started = true;
  try {
    // Listening first: a change that lands during the launch sync is not lost.
    store.addListener("onChange", ({ reason }) => {
      if (reason === CloudChangeReason.quotaViolation) return;
      // A new account's first download is treated like a reinstall's: its reading place wins.
      const initial = reason === CloudChangeReason.initialSync || reason === CloudChangeReason.accountChange;
      void syncWithCloud(db, store, initial).then((changed) => {
        if (changed) settingsChanged();
      });
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      clearTimeout(timer);
      timer = undefined;
      void syncWithCloud(db, store);
    };
    setUserDataListener(() => {
      clearTimeout(timer);
      timer = setTimeout(flush, SYNC_DELAY_MS);
    });
    // A change still waiting when the app leaves the screen is sent before iOS suspends it.
    AppState.addEventListener("change", (next) => {
      if (next !== "active" && timer !== undefined) flush();
    });

    store.synchronize();
  } catch {
    return;
  }
  await syncWithCloud(db, store);
}

/**
 * Whether this binary has the iCloud store at all (not Android, not a build
 * before the module): only then does Bookmarks mention iCloud.
 *
 * There is deliberately no signed-in test. The one Apple offers without
 * CloudKit, FileManager.ubiquityIdentityToken, is nil when iCloud Drive is off,
 * yet the key-value store still syncs then, so IC-02's "On this iPhone only"
 * would have told a syncing reader their bookmarks were not kept (package F,
 * 11 Oct 2026). CloudKit's accountStatus, possible since Pray brought the
 * container entitlement (build 8), is what Saved asks for IC-02's line.
 */
export function cloudAvailable(): boolean {
  return cloudStore !== null;
}

/**
 * Remove my data (ST-03): this device's copy in iCloud emptied. Another signed-in device still holds its
 * own and sends it back at its next sync; the alert names this iPhone and iCloud, as that is what goes.
 */
export function clearCloud(): void {
  const store = cloudStore;
  if (store === null) return;
  try {
    for (const kind of SYNC_KINDS) store.set(CLOUD_KEYS[kind], serializeRegisters({}));
    store.synchronize();
  } catch {
    // No store reachable: nothing in iCloud to clear from here.
  }
}
