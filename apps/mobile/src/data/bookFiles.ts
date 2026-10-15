/**
 * Per-book files downloaded on demand: study bundles (data/study.ts) and Understand bundles
 * (data/understand.ts). Each kind is listed by its own list in the published manifest, fetched into
 * a temporary file, checked against the manifest's size and sha256, then moved into place and
 * recorded in user.db's `installed_<kind>`. A file that fails its size or sha256 check is deleted,
 * never opened; one that fails its content check is never recorded, so the next launch's sweep
 * deletes it.
 *
 * Each book's file is its own connection, opened lazily, never ATTACHed: 66 of them would pass
 * SQLite's limit of 10 (data/bundles.ts rule 2). Neither DDL has an FTS5 table, so the close-crash of
 * rule 1 does not apply, but a file still goes only at launch, before anything opens it, which keeps
 * one rule for every downloaded file.
 *
 * John's files ship inside the app (BUNDLED_STUDY, BUNDLED_UNDERSTAND), so John works offline from
 * first launch; a newer published version still replaces them.
 *
 * Nothing asks first (canvas SN brief 4): `ensure` fetches a book's file the first time the book opens
 * while online.
 */

import { type BookCode, isBookCode } from "@yada/schema";
import { Directory, File, Paths } from "expo-file-system";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { create, type UseBoundStore, type StoreApi } from "zustand";

import { sweepStudy } from "../lib/study";
import { verifyDownload } from "../lib/translations";
import { asDb } from "./AppData";
import { type Db } from "./queries";
import { MANIFEST_URL } from "./translations";
import { loadSettings, saveSetting } from "./user";

export interface CatalogueEntry {
  readonly book: BookCode;
  readonly version: number;
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly url: string;
}

export interface InstalledFile {
  readonly book: BookCode;
  readonly version: number;
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  /** Shipped inside the app and copied to the SQLite directory by installBundles. */
  readonly shipped?: boolean;
}

export interface BookFilesState<E extends CatalogueEntry> {
  catalogue: Partial<Record<BookCode, E>>;
  installed: Partial<Record<BookCode, InstalledFile>>;
  /** False once the manifest could not be fetched this launch; null before the first try. */
  online: boolean | null;
  /** Decompressed bytes written so far, while a book's file downloads. */
  downloading: Partial<Record<BookCode, number>>;
  /** A download that failed its check or its connection this launch, until "Try again". */
  failed: Partial<Record<BookCode, true>>;
}

export interface BookFiles<E extends CatalogueEntry> {
  readonly useStore: UseBoundStore<StoreApi<BookFilesState<E>>>;
  /** Launch: delete leftovers, then list what is on the phone and the last good catalogue. Opens nothing. */
  openInstalled(user: SQLiteDatabase): Promise<void>;
  /** Fetch the manifest's list, once a launch. */
  refreshCatalogue(user: SQLiteDatabase): Promise<void>;
  /** The book's file, or null when it is not on the phone. */
  open(book: BookCode): Promise<SQLiteDatabase | null>;
  /** The first time a book opens online its file downloads; a failure waits for "Try again" (`retry`). */
  ensure(user: SQLiteDatabase, book: BookCode, retry?: boolean): Promise<void>;
  download(user: SQLiteDatabase, entry: E): Promise<void>;
  /** Marks a download removed: its row goes and the file with it at the next launch (Downloads, DN-05). */
  remove(user: SQLiteDatabase, book: BookCode): Promise<void>;
  /** Stops every download under way (Remove my data, DN-04). */
  cancelAll: () => void;
}

interface Options<E extends CatalogueEntry> {
  /** "study" or "understand": the folder, the user.db table and the catalogue setting are named from it. */
  readonly kind: string;
  readonly shipped: ReadonlyArray<Omit<InstalledFile, "shipped">>;
  /** The manifest's list for this kind, checked by its schema; unknown formats and repeats are dropped. */
  readonly parseCatalogue: (manifest: unknown, manifestUrl: string) => E[];
  /** True when the file is the one the manifest describes (its own meta table says so). */
  readonly checkFile: (db: Db, book: BookCode) => Promise<boolean>;
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

/** SQLite takes a path, not a file:// URI. */
const pathOf = (item: File | Directory) => decodeURIComponent(item.uri.replace(/^file:\/\//, "")).replace(/\/$/, "");

export function createBookFiles<E extends CatalogueEntry>({ kind, shipped, parseCatalogue, checkFile }: Options<E>): BookFiles<E> {
  const table = `installed_${kind}`;
  const catalogueKey = `${kind}Catalogue`;
  const useStore = create<BookFilesState<E>>(() => ({ catalogue: {}, installed: {}, online: null, downloading: {}, failed: {} }));
  const set = (patch: Partial<BookFilesState<E>> | ((s: BookFilesState<E>) => Partial<BookFilesState<E>>)) => useStore.setState(patch);
  const folder = () => new Directory(Paths.document, kind);
  const byBook = (entries: readonly E[]): Partial<Record<BookCode, E>> => Object.fromEntries(entries.map((e) => [e.book, e]));
  const shippedFiles = (): Partial<Record<BookCode, InstalledFile>> => Object.fromEntries(shipped.map((s) => [s.book, { ...s, shipped: true }]));

  const connections = new Map<string, Promise<SQLiteDatabase | null>>();
  const controllers = new Map<BookCode, AbortController>();
  let refreshing: Promise<void> | null = null;

  async function openInstalled(user: SQLiteDatabase): Promise<void> {
    const rows = await user.getAllAsync<InstalledFile & { removed: number }>(`SELECT book, version, file, sha256, bytes, removed FROM ${table}`);
    const dir = folder();
    const plan = sweepStudy(rows, fileNames(dir));
    for (const name of plan.deleteFiles) deleteQuietly(new File(dir, name));
    for (const book of plan.dropRows) await user.runAsync(`DELETE FROM ${table} WHERE book = ?`, [book]);
    const installed = shippedFiles();
    for (const row of plan.keep) {
      if (!isBookCode(row.book)) continue;
      const inApp = installed[row.book];
      // A download no newer than the shipped copy is spare: the shipped one serves, the row goes and
      // the next sweep deletes the file.
      if (new File(dir, row.file).exists && (inApp === undefined || row.version > inApp.version)) {
        installed[row.book] = { book: row.book, version: row.version, file: row.file, sha256: row.sha256, bytes: row.bytes };
      } else {
        await user.runAsync(`DELETE FROM ${table} WHERE book = ?`, [row.book]);
      }
    }
    const stored = (await loadSettings(user))[catalogueKey];
    const catalogue = stored === undefined ? [] : parseCatalogue(safeJson(stored), MANIFEST_URL);
    set({ installed, catalogue: byBook(catalogue) });
  }

  function refreshCatalogue(user: SQLiteDatabase): Promise<void> {
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
        const entries = parseCatalogue(await response.json(), MANIFEST_URL);
        set({ catalogue: byBook(entries), online: true });
        // Kept in the manifest's own shape, so the copy goes through the same schema check next launch.
        await saveSetting(user, catalogueKey, JSON.stringify({ [kind]: entries.map(({ url: _url, ...info }) => info) }));
      } catch {
        set({ online: false });
        // A later open may try again: the reader may have come back online.
        refreshing = null;
      }
    })();
    return refreshing;
  }

  function open(book: BookCode): Promise<SQLiteDatabase | null> {
    const row = useStore.getState().installed[book];
    if (row === undefined) return Promise.resolve(null);
    // A shipped file sits in the SQLite directory, a download in the kind's folder, under the same
    // kind of name: the key says which.
    const key = `${row.shipped === true ? "shipped" : "download"}:${row.file}`;
    let connection = connections.get(key);
    if (connection === undefined) {
      connection = (row.shipped === true ? openDatabaseAsync(row.file) : openDatabaseAsync(row.file, undefined, pathOf(folder()))).catch(() => null);
      connections.set(key, connection);
    }
    return connection;
  }

  async function ensure(user: SQLiteDatabase, book: BookCode, retry = false): Promise<void> {
    const state = useStore.getState();
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
    await refreshCatalogue(user);
    const entry = useStore.getState().catalogue[book];
    if (entry === undefined || useStore.getState().online !== true) return;
    // A newer version replaces the one on the phone the next time the book opens online: the old
    // file keeps serving until the new one has passed its check, and the launch sweep deletes it.
    if (installed !== undefined && installed.version >= entry.version) return;
    await download(user, entry);
  }

  async function download(user: SQLiteDatabase, entry: E): Promise<void> {
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
        // Against the decompressed size, as for translations: NSURLSession counts decoded bytes of a
        // gzipped object.
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
      // never closes a database); with no row, the launch sweep deletes it.
      if (!(await checkFile(asDb(db), entry.book))) throw new Error(`not the ${kind} file the manifest describes`);
      // Stopped by Remove my data while it finished: nothing is installed after the reader removed all.
      if (controller.signal.aborted) throw new Error("stopped");
      await user.runAsync(
        `INSERT INTO ${table} (book, version, file, sha256, bytes, removed, saved_at) VALUES (?, ?, ?, ?, ?, 0, ?)
         ON CONFLICT(book) DO UPDATE SET version = excluded.version, file = excluded.file, sha256 = excluded.sha256,
           bytes = excluded.bytes, removed = 0, saved_at = excluded.saved_at`,
        [entry.book, entry.version, entry.file, entry.sha256, entry.bytes, new Date().toISOString()],
      );
      const row: InstalledFile = { book: entry.book, version: entry.version, file: entry.file, sha256: entry.sha256, bytes: entry.bytes };
      set((s) => ({ installed: { ...s.installed, [entry.book]: row }, online: true }));
    } catch {
      deleteQuietly(partial);
      set((s) => ({ failed: { ...s.failed, [entry.book]: true } }));
      // A dropped connection then shows as offline once the manifest fails to answer too.
      refreshing = null;
      void refreshCatalogue(user);
    } finally {
      controllers.delete(entry.book);
      set((s) => {
        const { [entry.book]: _done, ...rest } = s.downloading;
        return { downloading: rest };
      });
    }
  }

  async function remove(user: SQLiteDatabase, book: BookCode): Promise<void> {
    const row = useStore.getState().installed[book];
    if (row === undefined || row.shipped === true) return;
    // A connection may be open, so the file is not touched now: the row is marked and the launch
    // sweep deletes both (data/bundles.ts rule 3).
    await user.runAsync(`UPDATE ${table} SET removed = 1 WHERE book = ?`, [book]);
    const fallback = shippedFiles()[book];
    set((s) => {
      const { [book]: _gone, ...rest } = s.installed;
      return { installed: fallback === undefined ? rest : { ...rest, [book]: fallback } };
    });
  }

  /** Remove my data (DN-04): every download under way stops first. */
  function cancelAll(): void {
    for (const c of controllers.values()) c.abort();
  }

  return { useStore, openInstalled, refreshCatalogue, open, ensure, download, remove, cancelAll };
}
