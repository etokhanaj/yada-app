/**
 * Understand without AI (docs/no-ai-understand.md; build plan Phase 0): each book's
 * `understand-<book>.vN.db`, read here. It replaces the AI entries the per-book bundles carried; those
 * stay in golden/ as test fixtures only, and nothing in the app reads them.
 *
 * John's file ships inside the app; every other book downloads the first time it opens online
 * (data/bookFiles.ts), and is listed under Downloads (DN-05). A book with no file keeps study notes
 * and the guide's fallback (SN-03, GD-04).
 */

import {
  type BookCode,
  type Passage,
  type PassageRow,
  type UnderstandVerse,
  UNDERSTAND_FORMAT,
  isBookCode,
  isMissingVerse,
  parsePassage,
  parseVerseLayers,
} from "@yada/schema";
import { type SQLiteDatabase } from "expo-sqlite";
import { useEffect } from "react";

import { type BookIntro, parseBookIntro } from "../lib/bookIntro";
import { formatRangeInBook } from "../lib/chapters";
import { type CoverWord } from "../lib/cover";
import { type PericopeRow, pericopeForVerse } from "../lib/pericopes";
import { hasUnderstand, parseUnderstandCatalogue, readerLines, type UnderstandCatalogueEntry } from "../lib/understand";
import { asDb, useAppData } from "./AppData";
import { createBookFiles } from "./bookFiles";
import { BUNDLED_UNDERSTAND } from "./bundled.generated";
import { type Db } from "./queries";

async function checkUnderstandFile(db: Db, book: BookCode): Promise<boolean> {
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM meta WHERE key IN ('format', 'book')", []);
  const meta = new Map(rows.map((r) => [r.key, r.value]));
  return meta.get("book") === book && Number(meta.get("format")) === UNDERSTAND_FORMAT;
}

const files = createBookFiles<UnderstandCatalogueEntry>({
  kind: "understand",
  shipped: BUNDLED_UNDERSTAND,
  parseCatalogue: parseUnderstandCatalogue,
  checkFile: checkUnderstandFile,
});

export const useUnderstand = files.useStore;
export const openInstalledUnderstand = files.openInstalled;
export const removeUnderstand = files.remove;
export const cancelUnderstandDownloads = files.cancelAll;
export const downloadUnderstand = files.download;

export function ensureUnderstand(user: SQLiteDatabase, book: BookCode, retry = false): Promise<void> {
  return files.ensure(user, book, retry);
}

/**
 * Whether the book's Understand file is here, coming, waiting for a connection, or not offered; fetching it the
 * first time. "offline" says so in one line (EG-02: "Understand for Luke downloads when you’re online.").
 */
export function useUnderstandFile(book: BookCode): "ready" | "fetching" | "offline" | "none" {
  const { user } = useAppData();
  const installed = files.useStore((s) => s.installed[book] !== undefined);
  const offered = files.useStore((s) => s.catalogue[book] !== undefined);
  const known = files.useStore((s) => Object.keys(s.catalogue).length > 0);
  const online = files.useStore((s) => s.online);
  const downloading = files.useStore((s) => s.downloading[book] !== undefined);
  const failed = files.useStore((s) => s.failed[book] === true);
  useEffect(() => {
    if (!installed) void ensureUnderstand(user, book);
  }, [installed, user, book]);
  if (installed) return "ready";
  if (downloading || (offered && online !== false && !failed)) return "fetching";
  // Offline before the manifest is known, the book may well be offered: say what waits for a connection.
  if (online === false && (offered || !known)) return "offline";
  return "none";
}


async function db(book: BookCode): Promise<Db | null> {
  const opened = await files.open(book);
  return opened === null ? null : asDb(opened);
}

const passageCache = new Map<string, Promise<Passage[]>>();

/** Every passage in the book, in order; empty while its file is not on the phone. */
export async function loadPassages(book: BookCode): Promise<Passage[]> {
  const file = files.useStore.getState().installed[book]?.file;
  if (file === undefined) return [];
  let cached = passageCache.get(file);
  if (cached === undefined) {
    cached = (async () => {
      const d = await db(book);
      if (d === null) throw new Error(`${file} could not be opened`);
      const rows = await d.getAllAsync<PassageRow>("SELECT * FROM passages ORDER BY start_ord, end_ord", []);
      return rows.flatMap((r) => parsePassage(r) ?? []);
    })();
    passageCache.set(file, cached);
    // A failed open is not remembered for the launch: the next ask tries again.
    cached.catch(() => passageCache.delete(file));
  }
  return cached;
}

/**
 * The passages as pericope rows, for the reader, Home, the player and progress: one source of passage
 * boundaries for every book (build plan Phase 2: "A verse's section is the guide passage that contains it").
 */
export async function loadPericopes(book: BookCode): Promise<PericopeRow[]> {
  return (await loadPassages(book)).map(asPericope);
}

export const asPericope = (p: Passage): PericopeRow => ({ pericope_id: p.id, label: p.label, start_ord: p.startOrd, end_ord: p.endOrd, review_status: null, payload: null });

export async function loadPassageFor(book: BookCode, ord: number): Promise<Passage | null> {
  const passages = await loadPassages(book);
  const row = pericopeForVerse(passages.map(asPericope), ord);
  return row === null ? null : (passages.find((p) => p.id === row.pericope_id) ?? null);
}

export async function loadVerse(book: BookCode, ord: number): Promise<UnderstandVerse | null> {
  const d = await db(book);
  if (d === null) return null;
  const row = await d.getFirstAsync<{ layers: string }>("SELECT layers FROM verses WHERE ord = ?", [ord]);
  return row === null ? null : parseVerseLayers(row.layers);
}

export async function loadVersesInRange(book: BookCode, lo: number, hi: number): Promise<Array<{ ord: number; verse: UnderstandVerse }>> {
  const d = await db(book);
  if (d === null) return [];
  const rows = await d.getAllAsync<{ ord: number; layers: string }>("SELECT ord, layers FROM verses WHERE ord BETWEEN ? AND ? ORDER BY ord", [lo, hi]);
  return rows.flatMap((r) => {
    const verse = parseVerseLayers(r.layers);
    return verse === null ? [] : [{ ord: r.ord, verse }];
  });
}

/**
 * For a chapter: the verses Understand has something for (the bar offers it exactly there) and the verses
 * readers differ on (the one marker in the text).
 */
export async function loadChapterUnderstand(book: BookCode, lo: number, hi: number): Promise<{ ords: Set<number>; differs: Set<number> }> {
  const verses = await loadVersesInRange(book, lo, hi);
  return {
    ords: new Set(verses.filter(({ verse }) => hasUnderstand(verse)).map(({ ord }) => ord)),
    // Only where a reading shows: a held or undecided debate shows nothing (Phase 1), so no marker either.
    differs: new Set(verses.filter(({ verse }) => !isMissingVerse(verse) && readerLines(verse).length > 0).map(({ ord }) => ord)),
  };
}

export interface UnderstandSource {
  readonly key: string;
  readonly name: string;
  readonly license: string;
  readonly license_notice: string;
  readonly credit: string;
  readonly original: string | null;
}

/** The licence rows inside the book's file (rule 3: read from the file, never written into the app). */
export async function loadUnderstandSources(book: BookCode): Promise<UnderstandSource[]> {
  const d = await db(book);
  return d === null ? [] : d.getAllAsync<UnderstandSource>("SELECT key, name, license, license_notice, credit, original FROM sources ORDER BY rowid", []);
}

/** From any installed book: the same sources and credits for every book (Sources screen, ST-04). */
export async function loadAnyUnderstandSources(): Promise<UnderstandSource[]> {
  for (const row of Object.values(files.useStore.getState().installed)) {
    if (row === undefined) continue;
    const sources = await loadUnderstandSources(row.book);
    if (sources.length > 0) return sources;
  }
  return [];
}

export interface PassageCover {
  readonly title: string;
  /** "1:1–18" */
  readonly range: string;
  readonly script: "greek" | "hebrew";
  /**
   * The opening word the cover shows (DP-03). It was chosen from the AI entries' key words, which are
   * retired (docs/no-ai-understand.md); Translation Words name English terms, so no word is chosen now.
   */
  readonly word: CoverWord | null;
}

/** The cover of the passage holding `ord` (Depth, brief §8.14); null when the book has no passages. */
export async function loadPassageCover(book: BookCode, ord: number, script: "greek" | "hebrew"): Promise<PassageCover | null> {
  const passage = await loadPassageFor(book, ord);
  if (passage === null) return null;
  return { title: passage.label, range: formatRangeInBook(passage.id), script, word: null };
}

/** One line on what a passage is, for a list of passages: its In short headline (Phase 2). */
export async function loadOrientation(pericope: PericopeRow): Promise<string | null> {
  const book = pericope.pericope_id.split(".")[0];
  if (book === undefined || !isBookCode(book)) return null;
  const passage = (await loadPassages(book)).find((p) => p.id === pericope.pericope_id);
  return passage === undefined || passage.headline === "" ? null : passage.headline;
}

/** Build 6 item G: the book's introduction, once John approved it (lib/bookIntro.ts). Files before build 6 have none. */
export async function loadBookIntro(book: BookCode): Promise<BookIntro | null> {
  const d = await db(book);
  if (d === null) return null;
  const row = await d.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'book_intro'", []);
  return parseBookIntro(row?.value);
}

/** The book's Understand file, for the build-6 tables read in data/wordsAndPlaces.ts; null while it is not on the phone. */
export const openUnderstandDb = db;

