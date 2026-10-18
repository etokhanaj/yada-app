/**
 * Labels for the page lists: Bookmarks, Recent, Sources' explained verses and
 * Start here. Pure, so the wording is tested once.
 */

import { BOOK_CODES, BOOK_ORDER, type BookCode } from "@yada/schema";

import type { EventName } from "../data/user";
import { formatRangeInBook } from "./chapters";
import { bookProgress } from "./chaptersRead";
import { chapterTitle } from "./reader";

/** "Psalm 23:1", "1 Corinthians 14:34": a single psalm is a Psalm (canvas SO-01). */
export function verseLabel(ref: { book: BookCode; chapter: number; verse: number }): string {
  const chapter = chapterTitle(ref.book, ref.chapter);
  return ref.verse === 0 ? `${chapter}, title` : `${chapter}:${ref.verse}`;
}

/** Recent's tag (brief §4): the word that was opened, else `Understand`, which every other event sits under. */
export function recentTag(name: EventName, word: string | null): string {
  return name === "word_open" && word !== null && word !== "" ? word : "Understand";
}

/** "1:35–51": the page already names the book (canvas ST-01). */
export function rangeInBook(pericopeId: string): string {
  return formatRangeInBook(pericopeId);
}

/** The books every chapter of which the reader has reached the end of, in Bible order. */
export function booksReadThrough(readKeys: ReadonlySet<string>): BookCode[] {
  return BOOK_ORDER.filter((book) => bookProgress(book, readKeys).complete);
}

/**
 * Saved's Your reading row (PS-04): "41 days this year · Ruth read through". Only what the reader's own data holds:
 * the counted days and the books read through; several books are counted, never ranked. Null when there is nothing
 * yet, and the row is left out.
 */
export function yourReadingLine(daysThisYear: number, readThrough: readonly BookCode[]): string | null {
  const parts = [
    daysThisYear === 0 ? null : `${daysThisYear} ${daysThisYear === 1 ? "day" : "days"} this year`,
    readThrough.length === 0 ? null : readThrough.length === 1 ? `${BOOK_CODES[readThrough[0] as BookCode].name} read through` : `${readThrough.length} books read through`,
  ].filter((p) => p !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}
