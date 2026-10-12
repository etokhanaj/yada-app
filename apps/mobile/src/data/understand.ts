/**
 * Understand content from the per-book bundles, parsed and checked.
 */

import { BOOK_CODES, type BookCode, type PericopeEntry, PericopeEntrySchema, type VerseEntry, VerseEntrySchema } from "@yada/schema";

import { formatRangeInBook } from "../lib/chapters";
import { type CoverWord, pickCoverWord } from "../lib/cover";
import { type EntryRow, pericopeForVerse, type PericopeRow } from "../lib/pericopes";
import { asDb } from "./AppData";
import { openBook } from "./bundles";
import { type Db, entryOrdsInRange, getEntriesInRange, getEntryRow, getPericopes, getTokens } from "./queries";

/**
 * Anything a human has not approved says so on screen (John's decision 2).
 * `flagged` is the case today; `auto_passed` has not had human eyes either, so
 * it carries the same label. Only human or expert review removes it.
 */
export function isUnreviewed(status: string | null | undefined): boolean {
  return status !== "human_reviewed" && status !== "expert_reviewed";
}

export interface LoadedEntry {
  readonly entry: VerseEntry;
  readonly reviewStatus: string;
}

/**
 * A payload that fails the schema is treated as absent rather than rendered
 * half-broken; the "not yet available" state is honest, a garbled claim is not.
 * The stricter of the row's status and the payload's own status wins.
 */
export function parseEntry(row: EntryRow): LoadedEntry | null {
  let json: unknown;
  try {
    json = JSON.parse(row.payload);
  } catch {
    return null;
  }
  const parsed = VerseEntrySchema.safeParse(json);
  if (!parsed.success) return null;
  const status = isUnreviewed(row.review_status) ? row.review_status : parsed.data.review.status;
  return { entry: parsed.data, reviewStatus: status };
}

export function parsePericopePayload(row: PericopeRow): PericopeEntry | null {
  if (row.payload === null || row.payload === "") return null;
  try {
    const parsed = PericopeEntrySchema.safeParse(JSON.parse(row.payload));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function loadEntry(book: BookCode, verseId: string): Promise<LoadedEntry | null> {
  const db = await openBook(book);
  if (db === null) return null;
  const row = await getEntryRow(asDb(db), verseId);
  return row === null ? null : parseEntry(row);
}

export async function loadPericopes(book: BookCode): Promise<PericopeRow[]> {
  const db = await openBook(book);
  return db === null ? [] : getPericopes(asDb(db));
}

export async function loadEntriesInRange(book: BookCode, lo: number, hi: number): Promise<EntryRow[]> {
  const db = await openBook(book);
  return db === null ? [] : getEntriesInRange(asDb(db), lo, hi);
}

/** Which verses of a chapter have an entry: the reader's explanation markers (amendment 10). */
export async function loadEntryOrds(book: BookCode, lo: number, hi: number): Promise<Set<number>> {
  const db = await openBook(book);
  return db === null ? new Set() : entryOrdsInRange(asDb(db), lo, hi);
}

export interface PassageCover {
  readonly title: string;
  /** "1:1–18" */
  readonly range: string;
  readonly script: "greek" | "hebrew";
  readonly word: CoverWord | null;
}

/** The cover of the passage holding `ord` (Depth, brief §8.14); null when the book has no passages. */
export async function loadPassageCover(core: Db, book: BookCode, ord: number): Promise<PassageCover | null> {
  const pericope = pericopeForVerse(await loadPericopes(book), ord);
  if (pericope === null) return null;
  const first = (await loadEntriesInRange(book, pericope.start_ord, pericope.end_ord))[0];
  const entry = first === undefined ? null : parseEntry(first);
  const word =
    entry === null || first === undefined ? null : pickCoverWord(entry.entry.key_words, (await getTokens(core, first.ord)).words);
  return {
    title: pericope.label,
    // A psalm's passage starts at its title (verse 0); readers count from verse 1.
    range: formatRangeInBook(pericope.pericope_id).replace(/(\d+), title/u, "$1:1"),
    script: BOOK_CODES[book].testament === "NT" ? "greek" : "hebrew",
    word,
  };
}
