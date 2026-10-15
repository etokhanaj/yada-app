/**
 * Downloaded translations (brief §8.20, docs/more-translations-plan.md): the
 * catalogue, downloading with progress, checking, attaching and removing.
 *
 * - The catalogue is the `translations` list in the manifest the pipeline
 *   publishes to R2. Its last good copy is kept in user.db, so the Download
 *   group still lists what exists when there is no connection (MT-05).
 * - A download lands in a temporary file, is checked against the manifest's
 *   sha256, then moves into place and is ATTACHed to the core connection.
 *   Reads route to it by code (data/queries.ts), so it behaves exactly like a
 *   built-in version. A file that fails the check is deleted, never attached.
 * - Remove stops routing at once and marks the row; the file is detached and
 *   deleted at the next launch, before anything attaches it. Detaching closes
 *   its FTS5 tables, the operation that crashes expo-sqlite (bundles.ts rule 1).
 *   The same launch pass deletes any file no live row names, so one that failed
 *   its check after ATTACH is deleted then too.
 * - SQLite attaches at most 10 databases by default; the first catalogue has
 *   five versions. More than that needs a limit raised or a second connection.
 *
 * Nothing here runs under vitest; the steps it strings together (parse,
 * verify, check, route, read) run end to end on a real file in
 * data/translationFile.test.ts.
 */

import { BUNDLE_FORMAT } from "@yada/schema";
import { Directory, File, Paths } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import { AccessibilityInfo } from "react-native";
import { create } from "zustand";

import { percent, progressAnnouncement } from "../lib/progress";
import {
  afterRemove, type CatalogueEntry, type CoverTone, coverTone, parseCatalogue, schemaName, sweepTranslations, verifyDownload,
} from "../lib/translations";
import { useSettings } from "../state/settings";
import { asDb } from "./AppData";
import { checkTranslationFile, routeTranslation, type TranslationExpectation, unrouteTranslation } from "./queries";
import { loadSettings, saveSetting } from "./user";

/**
 * Where the published manifest lives. Release builds pass EXPO_PUBLIC_TRANSLATIONS_MANIFEST_URL at
 * build time (from build 5: content.yadabible.com, R2 behind John's domain, so the address outlives
 * any change of storage); it is never a default in source. A development build reads a local static
 * server, e.g. `npx serve -p 8787` over a folder holding manifest.json and the bundles.
 */
const DEV_MANIFEST_URL = "http://localhost:8787/manifest.json";
export const MANIFEST_URL: string = process.env.EXPO_PUBLIC_TRANSLATIONS_MANIFEST_URL ?? (__DEV__ ? DEV_MANIFEST_URL : "");

const CATALOGUE_KEY = "translationCatalogue";

export interface InstalledTranslation {
  readonly code: string;
  readonly name: string;
  readonly year: number | null;
  readonly version: number;
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly cover: CoverTone;
}

export interface DownloadProgress {
  readonly written: number;
  readonly total: number;
}

interface TranslationsState {
  /** Attached and routed downloads, in the order they were saved. */
  installed: InstalledTranslation[];
  catalogue: CatalogueEntry[];
  /** The manifest offers versions in a format this build cannot read. */
  needsUpdate: boolean;
  /** False once a manifest fetch or download has failed for want of a network; null before the first try. */
  online: boolean | null;
  downloading: Record<string, DownloadProgress>;
  /** A download that failed its check or its connection, until it is tried again. */
  /** Why the last download of a code failed: no room (US-06), or it didn't download (US-05). */
  failed: Record<string, "space" | "failed">;
}

export const useTranslations = create<TranslationsState>(() => ({
  installed: [],
  catalogue: [],
  needsUpdate: false,
  online: null,
  downloading: {},
  failed: {},
}));

const set = (patch: Partial<TranslationsState> | ((s: TranslationsState) => Partial<TranslationsState>)) => useTranslations.setState(patch);

/** The display name of any readable version, built in or downloaded. */
export function useTranslationName(code: string): string {
  const installed = useTranslations((s) => s.installed);
  return translationName(code, installed);
}

export function translationName(code: string, installed: readonly InstalledTranslation[]): string {
  const builtIn: Record<string, string> = {
    BSB: "Berean Standard Bible",
    WEB: "World English Bible",
    KJV: "King James Version",
    LSV: "Literal Standard Version",
  };
  return builtIn[code] ?? installed.find((t) => t.code === code)?.name ?? code;
}

const folder = () => new Directory(Paths.document, "translations");

/** SQLite takes a path, not a file:// URI. */
const pathOf = (file: File) => decodeURIComponent(file.uri.replace(/^file:\/\//, ""));

/** Schemas attached on this connection, whether or not still routed: ATTACH twice is an error. */
const attachedSchemas = new Set<string>();

async function attach(core: SQLiteDatabase, row: InstalledTranslation, expected?: TranslationExpectation): Promise<boolean> {
  const schema = schemaName(row.code, row.version);
  if (!attachedSchemas.has(schema)) {
    const file = new File(folder(), row.file);
    if (!file.exists) return false;
    await core.runAsync(`ATTACH DATABASE ? AS ${schema}`, [pathOf(file)]);
    attachedSchemas.add(schema);
  }
  const check = await checkTranslationFile(asDb(core), schema, row.code, expected);
  if (!check.ok) return false;
  routeTranslation(row.code, schema);
  return true;
}

/**
 * Launch: delete what was removed or orphaned, attach the rest, and load the last
 * good catalogue. Returns the codes now readable, for the settings to hydrate against.
 */
export async function openInstalledTranslations(core: SQLiteDatabase, user: SQLiteDatabase): Promise<string[]> {
  const rows = await user.getAllAsync<Omit<InstalledTranslation, "cover"> & { cover: string; removed: number }>(
    "SELECT code, name, year, version, file, sha256, bytes, cover, removed FROM installed_translations ORDER BY saved_at",
  );
  const dir = folder();
  const plan = sweepTranslations(rows, fileNames(dir));
  // Nothing has attached a translation yet this launch, so deleting cannot pull a file from under a connection.
  for (const name of plan.deleteFiles) deleteQuietly(new File(dir, name));
  for (const code of plan.dropRows) await user.runAsync("DELETE FROM installed_translations WHERE code = ?", [code]);

  const installed: InstalledTranslation[] = [];
  for (const row of plan.attach) {
    const entry: InstalledTranslation = { ...row, cover: coverTone(row.code, row.cover) };
    if (await attach(core, entry).catch(() => false)) {
      installed.push(entry);
    } else if (attachedSchemas.has(schemaName(row.code, row.version))) {
      // Attached but failed its check: the file cannot go until it is detached, so the next launch's sweep deletes it.
      await user.runAsync("UPDATE installed_translations SET removed = 1 WHERE code = ?", [row.code]);
    } else {
      deleteQuietly(new File(dir, row.file));
      await user.runAsync("DELETE FROM installed_translations WHERE code = ?", [row.code]);
    }
  }
  const stored = (await loadSettings(user))[CATALOGUE_KEY];
  const { entries, needsUpdate } = stored === undefined ? { entries: [], needsUpdate: false } : parseCatalogue(safeJson(stored), MANIFEST_URL);
  set({ installed, catalogue: entries, needsUpdate });
  return installed.map((t) => t.code);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** A folder that cannot be listed sweeps nothing; the translations in it must still open. */
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
    // A file that cannot be deleted now is retried at the next launch.
  }
}

/**
 * Fetch the manifest. A failure means "no connection" to the reader (MT-05):
 * rows stay listed from the last good copy and only the download actions go.
 */
export async function refreshCatalogue(user: SQLiteDatabase): Promise<void> {
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
    const manifest: unknown = await response.json();
    const { entries: catalogue, needsUpdate } = parseCatalogue(manifest, MANIFEST_URL);
    set({ catalogue, needsUpdate, online: true });
    // Saved in the manifest's own shape (the parsed entries, `url` dropped on re-parse), so the
    // last good copy goes through the same schema check as a fresh one. A newer format is kept
    // as a bare `format`, so the update line still shows offline.
    await saveSetting(
      user,
      CATALOGUE_KEY,
      JSON.stringify({ translations: needsUpdate ? [...catalogue, { format: BUNDLE_FORMAT + 1 }] : catalogue }),
    );
  } catch {
    set({ online: false });
  }
}

const controllers = new Map<string, AbortController>();

export function cancelDownload(code: string): void {
  controllers.get(code)?.abort();
}

/**
 * Download, check and attach one version. Resolves when it is readable, or
 * quietly when cancelled; a failed check or connection marks the row.
 */
export async function downloadTranslation(core: SQLiteDatabase, user: SQLiteDatabase, entry: CatalogueEntry): Promise<void> {
  if (controllers.has(entry.code)) return;
  const row: InstalledTranslation = {
    code: entry.code,
    name: entry.name,
    year: entry.year,
    version: entry.version,
    // TranslationInfoSchema has already held `file` to translationFileName(code, version).
    file: entry.file,
    sha256: entry.sha256,
    bytes: entry.bytes,
    cover: entry.cover,
  };

  // Removed earlier this launch and still attached: the same verified file comes back.
  const schema = schemaName(entry.code, entry.version);
  const restored = await user.getFirstAsync<{ sha256: string }>("SELECT sha256 FROM installed_translations WHERE code = ? AND removed = 1", [entry.code]);
  if (attachedSchemas.has(schema) && restored?.sha256 === entry.sha256 && (await attach(core, row))) {
    await user.runAsync("UPDATE installed_translations SET removed = 0 WHERE code = ?", [entry.code]);
    set((s) => ({ installed: [...s.installed.filter((t) => t.code !== row.code), row] }));
    return;
  }

  // Still attached from earlier this launch, with other bytes: the file cannot be replaced
  // until the next launch's sweep has deleted it (data/bundles.ts rule 1).
  if (attachedSchemas.has(schema)) {
    set((s) => ({ failed: { ...s.failed, [entry.code]: "failed" } }));
    return;
  }

  // US-06: no room is said before anything is fetched, and the button stays.
  if (Paths.availableDiskSpace < entry.bytes * 1.1) {
    set((s) => ({ failed: { ...s.failed, [entry.code]: "space" } }));
    return;
  }

  const controller = new AbortController();
  controllers.set(entry.code, controller);
  set((s) => ({ downloading: { ...s.downloading, [entry.code]: { written: 0, total: entry.bytes } }, failed: omit(s.failed, entry.code) }));
  let spoken = 0;
  const dir = folder();
  const partial = new File(dir, `${row.file}.partial`);
  const final = new File(dir, row.file);
  try {
    dir.create({ intermediates: true, idempotent: true });
    deleteQuietly(partial);
    await File.downloadFileAsync(entry.url, partial, {
      idempotent: true,
      signal: controller.signal,
      // Progress is against the decompressed size, the manifest's `bytes`, and never the server's
      // total. Translations are served with Content-Encoding gzip (publish.ts). expo-file-system
      // passes NSURLSession's didWriteData counts straight through (FileSystemDownload.swift), and
      // those count the decoded bytes written to the file, while the expected total is the gzipped
      // Content-Length or unknown (-1). Mixing the two would fill the ring less than halfway
      // through; the final event expo sends is the file's own (decompressed) size. Read from the
      // sources, not yet watched on a device against a gzipped object.
      onProgress: ({ bytesWritten }) => {
        const total = entry.bytes;
        set((s) => ({ downloading: { ...s.downloading, [entry.code]: { written: bytesWritten, total } } }));
        const pct = percent(bytesWritten, total);
        const line = progressAnnouncement(spoken, pct, entry.name);
        spoken = pct;
        if (line !== null) AccessibilityInfo.announceForAccessibility(line);
      },
    });
    if (!(await verifyDownload(await partial.bytes(), entry))) throw new Error("size or sha256 mismatch");
    deleteQuietly(final);
    await partial.move(final);
    if (!(await attach(core, row, entry))) throw new Error("not the translation file the manifest describes");
    await user.runAsync(
      `INSERT INTO installed_translations (code, name, year, version, file, sha256, bytes, cover, removed, saved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(code) DO UPDATE SET name = excluded.name, year = excluded.year, version = excluded.version, file = excluded.file,
         sha256 = excluded.sha256, bytes = excluded.bytes, cover = excluded.cover, removed = 0, saved_at = excluded.saved_at`,
      [row.code, row.name, row.year, row.version, row.file, row.sha256, row.bytes, row.cover, new Date().toISOString()],
    );
    set((s) => ({ installed: [...s.installed.filter((t) => t.code !== row.code), row], online: true }));
    AccessibilityInfo.announceForAccessibility(`${entry.name}, downloaded`);
  } catch {
    deleteQuietly(partial);
    // One that failed its check after ATTACH has no row; the next launch's sweep deletes it.
    if (!attachedSchemas.has(schema)) deleteQuietly(final);
    if (!controller.signal.aborted) {
      set((s) => ({ failed: { ...s.failed, [entry.code]: "failed" } }));
      // A dropped connection shows as MT-05; a bad file shows only on its row.
      void refreshCatalogue(user);
    }
  } finally {
    controllers.delete(entry.code);
    set((s) => ({ downloading: omit(s.downloading, entry.code) }));
  }
}

/** Remove (MT-04's ⋯ menu). Reading it falls back to BSB; Compare drops it. */
export async function removeTranslation(user: SQLiteDatabase, code: string): Promise<void> {
  unrouteTranslation(code);
  await user.runAsync("UPDATE installed_translations SET removed = 1 WHERE code = ?", [code]);
  set((s) => ({ installed: s.installed.filter((t) => t.code !== code) }));
  const settings = useSettings.getState();
  settings.setTranslation(afterRemove(settings.translation, code));
  if (settings.compareWith?.includes(code) === true) {
    const left = settings.compareWith.filter((c) => c !== code);
    settings.setCompareWith(left.length === 0 ? null : left);
  }
}

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _gone, ...rest } = record;
  return rest;
}
