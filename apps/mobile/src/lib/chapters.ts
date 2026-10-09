/**
 * Chapter navigation across the canon, and resolving any ref the content
 * carries into somewhere the reader can go.
 */

import { BOOK_CODES, BOOK_ORDER, isBookCode, parseVerseRef, verseOrd, type BookCode } from "@yada/schema";

export interface ChapterRef {
  readonly book: BookCode;
  readonly chapter: number;
}

export function nextChapter(book: BookCode, chapter: number): ChapterRef | null {
  if (chapter < BOOK_CODES[book].chapters) return { book, chapter: chapter + 1 };
  const next = BOOK_ORDER[BOOK_CODES[book].order + 1];
  return next === undefined ? null : { book: next, chapter: 1 };
}

export function prevChapter(book: BookCode, chapter: number): ChapterRef | null {
  if (chapter > 1) return { book, chapter: chapter - 1 };
  const prev = BOOK_ORDER[BOOK_CODES[book].order - 1];
  return prev === undefined ? null : { book: prev, chapter: BOOK_CODES[prev].chapters };
}

/** Route params arrive as strings from anywhere; anything invalid falls back to a real chapter. */
export function chapterFromParams(book: unknown, chapter: unknown): ChapterRef {
  const code = typeof book === "string" ? book.toUpperCase() : "";
  const safeBook: BookCode = isBookCode(code) ? code : "JHN";
  const n = Number(chapter);
  const max = BOOK_CODES[safeBook].chapters;
  return { book: safeBook, chapter: Number.isInteger(n) && n >= 1 && n <= max ? n : 1 };
}

export interface OrdSpan {
  readonly book: BookCode;
  readonly chapter: number;
  readonly startVerse: number;
  readonly startOrd: number;
  readonly endOrd: number;
}

/**
 * `1CO.14.34`, `1CO.14.34-35`, `1TI.2.11-12`, `1CO.14.26-14.40`: the shapes
 * related passages, evidence and the sheets use. Null rather than a guess.
 */
export function resolveRef(ref: string): OrdSpan | null {
  const range = parseVerseRef(ref);
  if (range === null) return null;
  return {
    book: range.book,
    chapter: range.start.chapter,
    startVerse: range.start.verse,
    startOrd: verseOrd(range.book, range.start.chapter, range.start.verse),
    endOrd: verseOrd(range.book, range.end.chapter, range.end.verse),
  };
}

/** "1 Corinthians 14:26–40", "John 7:53–8:11", "Psalms 23:1". */
export function formatRange(ref: string): string {
  const range = parseVerseRef(ref);
  if (range === null) return ref;
  const name = BOOK_CODES[range.book].name;
  const { start, end } = range;
  const startText = start.verse === 0 ? `${start.chapter}, title` : `${start.chapter}:${start.verse}`;
  if (start.chapter === end.chapter && start.verse === end.verse) return `${name} ${startText}`;
  if (start.chapter === end.chapter) return `${name} ${startText}–${end.verse}`;
  return `${name} ${startText}–${end.chapter}:${end.verse}`;
}
