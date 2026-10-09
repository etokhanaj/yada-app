/**
 * Understand content from the per-book bundles, parsed and checked.
 */

import { type BookCode, type PericopeEntry, PericopeEntrySchema, type VerseEntry, VerseEntrySchema } from "@yada/schema";

import type { EntryRow, PericopeRow } from "../lib/pericopes";
import { asDb } from "./AppData";
import { openBook } from "./bundles";
import { getEntriesInRange, getEntryRow, getPericopes } from "./queries";

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
