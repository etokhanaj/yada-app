/**
 * Per-book study bundles (`study-jhn.v1.db`): Tyndale's notes and OpenBible's cross-references,
 * downloaded on demand the way translations are (data/translations.ts): listed by the published
 * manifest's `study` entries, fetched into a temporary file, checked against the manifest's size
 * and sha256, then moved into place and recorded in user.db's `installed_study`. A file that fails
 * its size or sha256 check is deleted, never opened; one that fails its content check is never
 * recorded, so the next launch's sweep deletes it.
 *
 * Each book's file is its own connection, opened lazily like a book's Understand bundle
 * (data/bundles.ts rule 2), never ATTACHed: 66 of them would pass SQLite's limit of 10. The study
 * DDL has no FTS5 table, so the close-crash of rule 1 does not apply, but a file still goes only
 * at launch, before anything opens it, which keeps one rule for every downloaded file.
 *
 * John's file ships inside the app (decision for build 3, 11 Oct 2026; BUNDLED_STUDY), so John
 * works offline from first launch; a newer published version still replaces it.
 *
 * Nothing asks first (canvas SN brief 4): ensureStudy fetches a book's file the first time the
 * book opens while online. Understand shows one line while it runs, if it failed, or offline.
 *
 * Nothing read here leaves the phone, and nothing here is passed to any model (CLAUDE.md rule 9:
 * the notes quote the NLT). The app makes no AI calls at all; the pipeline's side of this is held
 * by packages/pipeline/src/ai-boundary.test.ts.
 */

import { type BookCode, isBookCode } from "@yada/schema";
import { Directory, File, Paths } from "expo-file-system";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { create } from "zustand";

import {
  guideNote,
  isBookQuery,
  parseStudyCatalogue,
  peopleInVerse,
  profileMatches,
  type StudyCatalogueEntry,
  type StudyNoteRow,
  sweepStudy,
} from "../lib/study";
import { verifyDownload } from "../lib/translations";
import { asDb } from "./AppData";
import {
  checkStudyFile,
  getProfile,
  getPassageNote,
  getProfiles,
  getStudyNotes,
  getStudySources,
  getXrefs,
  noteOrdsInRange,
  type StudySource,
  type StudyXref,
} from "./studyQueries";
import { BUNDLED_STUDY } from "./bundled.generated";
import type { PassageNoteSource } from "./passageNote";
import { MANIFEST_URL } from "./translations";
import { loadSettings, saveSetting } from "./user";

const CATALOGUE_KEY = "studyCatalogue";

export interface InstalledStudy {
  readonly book: BookCode;
  readonly version: number;
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  /** Shipped inside the app (John's, build 3) and copied to the SQLite directory by installBundles. */
  readonly shipped?: boolean;
}

/** The shipped study bundles, each standing as installed until a newer download replaces it. */
function shippedStudy(): Partial<Record<BookCode, InstalledStudy>> {
  return Object.fromEntries(
    BUNDLED_STUDY.map((s) => [s.book, { book: s.book, version: s.version, file: s.file, sha256: s.sha256, bytes: s.bytes, shipped: true }]),
  );
}

interface StudyState {
  catalogue: Partial<Record<BookCode, StudyCatalogueEntry>>;
  installed: Partial<Record<BookCode, InstalledStudy>>;
  /** False once the manifest could not be fetched this launch; null before the first try. */
  online: boolean | null;
  /** Decompressed bytes written so far, while a book's notes download (lib/study.ts downloadingLine). */
  downloading: Partial<Record<BookCode, number>>;
  /** A download that failed its check or its connection this launch, until "Try again". */
  failed: Partial<Record<BookCode, true>>;
}

export const useStudy = create<StudyState>(() => ({ catalogue: {}, installed: {}, online: null, downloading: {}, failed: {} }));

const set = (patch: Partial<StudyState> | ((s: StudyState) => Partial<StudyState>)) => useStudy.setState(patch);

const folder = () => new Directory(Paths.document, "study");

/** SQLite takes a path, not a file:// URI. */
const pathOf = (item: File | Directory) => decodeURIComponent(item.uri.replace(/^file:\/\//, "")).replace(/\/$/, "");

function byBook(entries: readonly StudyCatalogueEntry[]): Partial<Record<BookCode, StudyCatalogueEntry>> {
  return Object.fromEntries(entries.map((e) => [e.book, e]));
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function fileNames(dir: Directory): string[] {
  try {
    return dir.exists ? dir.list().flatMap((item) => (item instanceof File ? [item.name] : [])) : [];
  } catch {
    return [];
  }
}

function deleteQuietly(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // Retried by the next launch's sweep.
  }
}

/** Launch: delete leftovers, then list what is on the phone and the last good catalogue. Opens nothing. */
export async function openInstalledStudy(user: SQLiteDatabase): Promise<void> {
  const rows = await user.getAllAsync<InstalledStudy & { removed: number }>(
    "SELECT book, version, file, sha256, bytes, removed FROM installed_study",
  );
  const dir = folder();
  const plan = sweepStudy(rows, fileNames(dir));
  for (const name of plan.deleteFiles) deleteQuietly(new File(dir, name));
  for (const book of plan.dropRows) await user.runAsync("DELETE FROM installed_study WHERE book = ?", [book]);
  const installed = shippedStudy();
  for (const row of plan.keep) {
    if (!isBookCode(row.book)) continue;
    const shipped = installed[row.book];
    // A download no newer than the shipped copy is spare: the shipped one serves, the row goes and
    // the next sweep deletes the file.
    if (new File(dir, row.file).exists && (shipped === undefined || row.version > shipped.version)) {
      installed[row.book] = { book: row.book, version: row.version, file: row.file, sha256: row.sha256, bytes: row.bytes };
    } else {
      await user.runAsync("DELETE FROM installed_study WHERE book = ?", [row.book]);
    }
  }
  const stored = (await loadSettings(user))[CATALOGUE_KEY];
  const catalogue = stored === undefined ? [] : parseStudyCatalogue(safeJson(stored), MANIFEST_URL);
  set({ installed, catalogue: byBook(catalogue) });
}

let refreshing: Promise<void> | null = null;

/** Fetch the manifest's `study` list, once a launch: Understand asks the first time a book lacks its notes. */
export function refreshStudyCatalogue(user: SQLiteDatabase): Promise<void> {
  refreshing ??= (async () => {
    if (MANIFEST_URL === "") {
      set({ online: false });
      return;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(MANIFEST_URL, { signal: controller.signal, headers: { "Cache-Control": "no-cache" } });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`manifest ${response.status}`);
      const entries = parseStudyCatalogue(await response.json(), MANIFEST_URL);
      set({ catalogue: byBook(entries), online: true });
      // Kept in the manifest's own shape, so the copy goes through the same schema check next launch.
      await saveSetting(user, CATALOGUE_KEY, JSON.stringify({ study: entries.map(({ url: _url, ...info }) => info) }));
    } catch {
      set({ online: false });
      // A later Understand may try again: the reader may have come back online.
      refreshing = null;
    }
  })();
  return refreshing;
}

const connections = new Map<string, Promise<SQLiteDatabase | null>>();

/** The book's study bundle, or null when its notes are not on the phone. */
export function openStudy(book: BookCode): Promise<SQLiteDatabase | null> {
  const row = useStudy.getState().installed[book];
  if (row === undefined) return Promise.resolve(null);
  // A shipped file sits in the SQLite directory, a download in the study folder, under the same
  // kind of name: the key says which.
  const key = `${row.shipped === true ? "shipped" : "download"}:${row.file}`;
  let connection = connections.get(key);
  if (connection === undefined) {
    connection = (row.shipped === true ? openDatabaseAsync(row.file) : openDatabaseAsync(row.file, undefined, pathOf(folder()))).catch(() => null);
    connections.set(key, connection);
  }
  return connection;
}

export interface VerseStudy {
  readonly notes: StudyNoteRow[];
  readonly xrefs: StudyXref[];
  /** The book's profiles named in the verse's BSB text (canvas TD-01). */
  readonly people: StudyNoteRow[];
}

/** The verse's notes, cross-references and people, or null when the book's notes are not on the phone. */
export async function loadVerseStudy(book: BookCode, ord: number, bsbText: string): Promise<VerseStudy | null> {
  const db = await openStudy(book);
  if (db === null) return null;
  const [notes, xrefs, profiles] = await Promise.all([getStudyNotes(asDb(db), ord), getXrefs(asDb(db), ord), getProfiles(asDb(db))]);
  return { notes, xrefs, people: peopleInVerse(profiles, bsbText, book, ord) };
}

/**
 * Tyndale's note on a whole passage, for the passage guide's opener: the shortest ranged note
 * covering the pericope, or null (also while the book's notes are not on the phone). The guide
 * shows it as published with TYNDALE_SHORT beside it, and replaces it with Yada's own reviewed
 * opener once there is one.
 */
export async function loadPassageNote(book: BookCode, startOrd: number, endOrd: number): Promise<StudyNoteRow | null> {
  const db = await openStudy(book);
  return db === null ? null : getPassageNote(asDb(db), startOrd, endOrd);
}

/** The passage guide's fallback opener (registerPassageNoteSource, data/passageNote.ts): lib/study.ts guideNote. */
export const passageNoteSource: PassageNoteSource = async ({ book, startOrd, endOrd }) => {
  const row = await loadPassageNote(book, startOrd, endOrd);
  return row === null ? null : guideNote(row.text);
};

/**
 * Verses of a chapter with something for Understand to show: a study note, a cross-reference, or a
 * person named in the verse's BSB text (the rule loadVerseStudy applies), so the bar offers
 * Understand exactly where it would open with something in it (edge case: Understand never opens
 * empty). Empty while the book's notes are not on the phone.
 */
export async function loadStudyOrds(
  book: BookCode,
  lo: number,
  hi: number,
  bsb: ReadonlyArray<{ ord: number; text: string }> = [],
): Promise<Set<number>> {
  const db = await openStudy(book);
  if (db === null) return new Set();
  const [out, profiles] = await Promise.all([noteOrdsInRange(asDb(db), lo, hi), getProfiles(asDb(db))]);
  for (const v of bsb) if (!out.has(v.ord) && peopleInVerse(profiles, v.text, book, v.ord).length > 0) out.add(v.ord);
  return out;
}

export async function loadProfile(book: BookCode, id: number): Promise<StudyNoteRow | null> {
  const db = await openStudy(book);
  return db === null ? null : getProfile(asDb(db), id);
}

/** Profiles in every downloaded book whose name matches a search (canvas TD-03). */
export async function searchProfiles(query: string): Promise<Array<StudyNoteRow & { book: BookCode }>> {
  const out: Array<StudyNoteRow & { book: BookCode }> = [];
  // "John" is the book, not John the Baptist (edge case 1).
  if (isBookQuery(query)) return out;
  for (const row of Object.values(useStudy.getState().installed)) {
    if (row === undefined) continue;
    const db = await openStudy(row.book);
    if (db === null) continue;
    for (const p of await getProfiles(asDb(db))) {
      if (typeof p.title === "string" && profileMatches(p.title, query)) out.push({ ...p, book: row.book });
    }
  }
  return out;
}

/** The licence rows inside a downloaded file (rule 3: read from the file, not written into the app). */
export async function loadStudySources(): Promise<StudySource[]> {
  for (const row of Object.values(useStudy.getState().installed)) {
    if (row === undefined) continue;
    const db = await openStudy(row.book);
    if (db !== null) return getStudySources(asDb(db));
  }
  return [];
}

const controllers = new Map<BookCode, AbortController>();

/**
 * Downloads ask nothing (canvas SN brief 4): the first time a book is opened while online, its
 * study notes (about 125 KB for John) are fetched. Once a launch per book: a failure waits for
 * "Try again" (`retry`), so a bad connection is not hammered on every chapter turn.
 */
export async function ensureStudy(user: SQLiteDatabase, book: BookCode, retry = false): Promise<void> {
  const state = useStudy.getState();
  if (controllers.has(book)) return;
  if (state.failed[book] === true && !retry) return;
  const installed = state.installed[book];
  if (retry) {
    set((s) => {
      const { [book]: _cleared, ...rest } = s.failed;
      return { failed: rest };
    });
    refreshing = null;
  }
  await refreshStudyCatalogue(user);
  const entry = useStudy.getState().catalogue[book];
  if (entry === undefined || useStudy.getState().online !== true) return;
  // A newer version replaces the one on the phone the next time the book opens online (edge
  // case 7): the old file keeps serving until the new one has passed its check, and the launch
  // sweep deletes it once no row names it.
  if (installed !== undefined && installed.version >= entry.version) return;
  await downloadStudy(user, entry);
}

/** Download, check and record one book's notes. Resolves when they are readable, or quietly on failure. */
export async function downloadStudy(user: SQLiteDatabase, entry: StudyCatalogueEntry): Promise<void> {
  if (controllers.has(entry.book)) return;
  const controller = new AbortController();
  controllers.set(entry.book, controller);
  set((s) => ({ downloading: { ...s.downloading, [entry.book]: 0 } }));
  const dir = folder();
  const partial = new File(dir, `${entry.file}.partial`);
  const final = new File(dir, entry.file);
  try {
    dir.create({ intermediates: true, idempotent: true });
    deleteQuietly(partial);
    await File.downloadFileAsync(entry.url, partial, {
      idempotent: true,
      signal: controller.signal,
      // Against the decompressed size, as for translations (data/translations.ts): NSURLSession
      // counts decoded bytes of a gzipped object.
      onProgress: ({ bytesWritten }) => {
        const written = Math.min(entry.bytes, bytesWritten);
        set((s) => ({ downloading: { ...s.downloading, [entry.book]: written } }));
      },
    });
    if (!(await verifyDownload(await partial.bytes(), entry))) throw new Error("size or sha256 mismatch");
    // A name already open (a removed-and-restored version) is never overwritten in place.
    if (connections.has(`download:${entry.file}`)) throw new Error("open under the same name");
    deleteQuietly(final);
    await partial.move(final);
    const db = await openDatabaseAsync(entry.file, undefined, pathOf(dir));
    connections.set(`download:${entry.file}`, Promise.resolve(db));
    // Left open and unrecorded, never closed or deleted here (gate review, 11 Oct 2026: mobile
    // never closes a database); with no installed_study row, the launch sweep deletes it.
    if (!(await checkStudyFile(asDb(db), entry.book))) throw new Error("not the study file the manifest describes");
    await user.runAsync(
      `INSERT INTO installed_study (book, version, file, sha256, bytes, removed, saved_at) VALUES (?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(book) DO UPDATE SET version = excluded.version, file = excluded.file, sha256 = excluded.sha256,
         bytes = excluded.bytes, removed = 0, saved_at = excluded.saved_at`,
      [entry.book, entry.version, entry.file, entry.sha256, entry.bytes, new Date().toISOString()],
    );
    const row: InstalledStudy = { book: entry.book, version: entry.version, file: entry.file, sha256: entry.sha256, bytes: entry.bytes };
    // No announcement: the download starts on its own when a book opens, and Understand's own
    // status line already speaks while it runs (canvas SN brief 4).
    set((s) => ({ installed: { ...s.installed, [entry.book]: row }, online: true }));
  } catch {
    deleteQuietly(partial);
    set((s) => ({ failed: { ...s.failed, [entry.book]: true } }));
    // A dropped connection then shows as offline once the manifest fails to answer too.
    refreshing = null;
    void refreshStudyCatalogue(user);
  } finally {
    controllers.delete(entry.book);
    set((s) => {
      const { [entry.book]: _done, ...rest } = s.downloading;
      return { downloading: rest };
    });
  }
}
