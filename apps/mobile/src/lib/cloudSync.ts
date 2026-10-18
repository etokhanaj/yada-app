/**
 * iCloud backup and sync of the reader's own data: the merge, kept pure so it
 * can be tested without a phone (data/cloud.ts does the reading and writing).
 *
 * What syncs: bookmarks, highlights, notes, the reading place, thread progress and four reading
 * settings. What does not: the event log (local history, PRD §14, read only by
 * this app), and installed bundles and translations (downloads are per device).
 *
 * Every synced value is a last-writer-wins register, `[value, at]` with `at` in
 * milliseconds, merged key by key. Why that and nothing cleverer:
 *
 * - Bookmarks are a map of verse → present/removed, not one whole-set value. A
 *   whole set with one timestamp would drop a bookmark added on the iPad while
 *   the iPhone, offline, added a different one: the later set replaces the
 *   earlier. Per verse, the two adds never meet. A removal is kept as a
 *   tombstone (`false`) so it can beat the add it removes on another device;
 *   deleting the key instead would let the other device's copy bring it back.
 *   Tombstones are never pruned: pruning one lets a device that was offline
 *   longer than the window resurrect it, and the map is bounded by the verses
 *   anyone could bookmark, a few dozen bytes each, far inside KVS's 1 MB.
 * - Thread progress is last-writer-wins too, not the maximum step. Tapping an
 *   earlier passage deliberately makes the one after it next (thread.tsx: "the
 *   thread follows the reader rather than grading them"), and a maximum would
 *   undo that tap at the next sync, on the device it was made on. Start
 *   here's finished passages ride in the same kind, one register per passage
 *   (`start-here-john/read/<pericope id>` → 1, data/user.ts markPassageRead),
 *   so two devices that finished different passages keep both: nothing ever
 *   removes one, so the merged set is the union, and progress counts it.
 * - Clock skew: a device whose clock runs behind would lose to the value it is
 *   replacing. So a local write is stamped after the value it overwrites
 *   (`nextStamp`), whatever the clock says, and an edit made after seeing
 *   another device's value always wins over it. A clock far in the future only
 *   carries its stamp forward; it cannot freeze a value.
 * - Ties (equal stamps, different values) go to the larger value as text, so
 *   both devices settle on the same answer without talking to each other.
 */

import { parseVerseId } from "@yada/schema";

import { parseChapterKey } from "./chaptersRead";
import { isHighlightColor, isNoteTarget, NOTE_MAX } from "./highlights";

export type Register<T> = readonly [value: T, at: number];
export type Registers<T> = Readonly<Record<string, Register<T>>>;

export interface SyncState {
  /** Verse id → bookmarked; `false` is a removal (a tombstone). */
  bookmarks: Registers<boolean>;
  /** One key, POSITION_KEY → the verse id to continue from. */
  position: Registers<string>;
  /** Thread id → the next step. */
  threads: Registers<number>;
  /** A SYNCED_SETTINGS key → its stored text. */
  settings: Registers<string>;
  /** The streak's counted days (lib/rhythm.ts), "2026-10-16" → true: a union across devices (plan §6). */
  days: Registers<boolean>;
  /** Chapters the reader reached the end of (lib/chaptersRead.ts), "MRK.4" → true: a union across devices (build 10a). */
  chapters: Registers<boolean>;
  /**
   * Verse id → highlight colour (lib/highlights.ts); "" is a removal. Per verse, as bookmarks are, so two devices
   * colouring different verses keep both.
   */
  highlights: Registers<string>;
  /** A verse id or "JHN.3" → the note's text; "" is a deleted note. Last writer wins, the whole note at once. */
  notes: Registers<string>;
}

export type SyncKind = keyof SyncState;

export const SYNC_KINDS: readonly SyncKind[] = ["bookmarks", "position", "threads", "settings", "days", "chapters", "highlights", "notes"];

/**
 * One iCloud key per kind, versioned so a later format can live beside this one.
 * A sync rewrites a kind with only the entries it can read, so an older app
 * would strip anything new: a new kind of value, or a new synced setting, goes
 * under a new key rather than into one of these.
 */
export const CLOUD_KEYS: Readonly<Record<SyncKind, string>> = {
  bookmarks: "v1.bookmarks",
  position: "v1.position",
  threads: "v1.threads",
  settings: "v1.settings",
  // Build 7: its own key, so a build 6 app, which rewrites only the four kinds it knows, never strips it.
  days: "v1.days",
  // Build 10a: its own key, for the same reason.
  chapters: "v1.chapters",
  // Your space (PS-01–PS-03): their own keys, for the same reason.
  highlights: "v1.highlights",
  notes: "v1.notes",
};

export const POSITION_KEY = "reading";

/**
 * The reading settings that follow the reader. Not `launched` and the two hint
 * flags (each device shows its own first visit), and not the translations
 * catalogue (a cache of a download manifest). A synced translation that is not
 * installed on this device falls back as a removed one does (state/settings.ts).
 */
export const SYNCED_SETTINGS = ["appearance", "textScale", "translation", "compareWith"] as const;

export function isSyncedSetting(key: string): boolean {
  return (SYNCED_SETTINGS as readonly string[]).includes(key);
}

export const EMPTY_STATE: SyncState = { bookmarks: {}, position: {}, threads: {}, settings: {}, days: {}, chapters: {}, highlights: {}, notes: {} };

/** The stamp for a local write that replaces a value stamped `previous`. */
export function nextStamp(now: number, previous: number | undefined): number {
  return previous === undefined || previous < now ? now : previous + 1;
}

function wins<T>(a: Register<T>, b: Register<T>): boolean {
  if (a[1] !== b[1]) return a[1] > b[1];
  return String(a[0]) > String(b[0]);
}

export function mergeRegisters<T>(a: Registers<T>, b: Registers<T>): Record<string, Register<T>> {
  const out: Record<string, Register<T>> = { ...a };
  for (const [key, theirs] of Object.entries(b)) {
    const ours = out[key];
    if (ours === undefined || wins(theirs, ours)) out[key] = theirs;
  }
  return out;
}

export interface MergeOptions {
  /**
   * iCloud's first download for this device and account (KVS "initial sync").
   * The reading place is written as soon as anything is read, so a reinstalled
   * app that opened John 1 before its backup arrived would otherwise beat the
   * place the reader actually left off.
   */
  initialSync?: boolean;
}

export function mergeState(local: SyncState, remote: SyncState, options: MergeOptions = {}): SyncState {
  const remotePosition = remote.position[POSITION_KEY];
  return {
    bookmarks: mergeRegisters(local.bookmarks, remote.bookmarks),
    position:
      options.initialSync === true && remotePosition !== undefined
        ? { [POSITION_KEY]: remotePosition }
        : mergeRegisters(local.position, remote.position),
    threads: mergeRegisters(local.threads, remote.threads),
    settings: mergeRegisters(local.settings, remote.settings),
    days: mergeRegisters(local.days, remote.days),
    chapters: mergeRegisters(local.chapters, remote.chapters),
    highlights: mergeRegisters(local.highlights, remote.highlights),
    notes: mergeRegisters(local.notes, remote.notes),
  };
}

/** The entries of `to` that `from` lacks or holds differently: what to write to reach `to`. */
export function changedEntries<T>(from: Registers<T>, to: Registers<T>): Array<[key: string, register: Register<T>]> {
  return Object.entries(to).filter(([key, [value, at]]) => {
    const old = from[key];
    return old === undefined || old[0] !== value || old[1] !== at;
  });
}

/** Stable text for a kind's registers: keys sorted, so equal states serialize equally. */
export function serializeRegisters<T>(registers: Registers<T>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(registers).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))));
}

const VALID: { [K in SyncKind]: (key: string, value: unknown) => value is SyncState[K][string][0] } = {
  bookmarks: (key, value): value is boolean => parseVerseId(key) !== null && typeof value === "boolean",
  position: (key, value): value is string => key === POSITION_KEY && typeof value === "string" && parseVerseId(value) !== null,
  threads: (key, value): value is number => key.length > 0 && key.length <= 64 && Number.isInteger(value) && (value as number) >= 0,
  settings: (key, value): value is string => isSyncedSetting(key) && typeof value === "string" && value.length <= 200,
  days: (key, value): value is boolean => /^\d{4}-\d{2}-\d{2}$/u.test(key) && value === true,
  chapters: (key, value): value is boolean => parseChapterKey(key) !== null && value === true,
  highlights: (key, value): value is string => parseVerseId(key) !== null && (value === "" || isHighlightColor(value)),
  notes: (key, value): value is string => isNoteTarget(key) && typeof value === "string" && value.length <= NOTE_MAX,
};

/**
 * What iCloud holds for one kind. Anything unreadable counts as absent, entry by
 * entry: the value was written by another copy of the app, possibly a newer one,
 * and a bad entry must never stop the good ones or break the launch.
 */
export function parseCloud<K extends SyncKind>(kind: K, raw: string | null | undefined): SyncState[K] {
  if (raw === null || raw === undefined) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: Record<string, Register<SyncState[K][string][0]>> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [value, at] = entry as [unknown, unknown];
    if (typeof at !== "number" || !Number.isFinite(at) || at < 0) continue;
    if (VALID[kind](key, value)) out[key] = [value, at];
  }
  return out as SyncState[K];
}
