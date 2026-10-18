/**
 * Chapter navigation across the canon, and resolving any ref the content
 * carries into somewhere the reader can go.
 */

import { BOOK_CODES, BOOK_ORDER, isBookCode, lookupBook, parseVerseRef, verseOrd, type BookCode } from "@yada/schema";

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

/** Psalm 119, the longest chapter in the canon. */
const MOST_VERSES = 176;

/**
 * "1 Jn 4:9-10", "Matthew 14:13–21", "Gen 3:16" as the data prints them (a note's named references, a
 * passage's "also told in") to the id form the sheets open: "1JN.4.9-4.10". Null for anything else, so a row
 * is never offered for a reference Yada cannot open (Read it alongside, VS-02 and JR-05).
 */
export function printedRef(text: string): string | null {
  const m = /^((?:[1-3]\s?)?[A-Za-z]+\.?(?:\s(?:of\s)?[A-Za-z]+)?)\s+(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(?:(\d{1,3}):)?(\d{1,3}))?$/u.exec(text.trim());
  if (m === null) return null;
  const book = lookupBook((m[1] ?? "").replace(/\.$/u, ""));
  if (book === null) return null;
  const c = Number(m[2]);
  const v = Number(m[3]);
  // No chapter has more verses than Psalm 119's 176. The per-chapter counts live only in the bundle, which this
  // pure parser cannot read, so this is the tightest bound it can hold without guessing (rule 4).
  if (c < 1 || c > BOOK_CODES[book].chapters || v < 1 || v > MOST_VERSES) return null;
  if (m[5] === undefined) return `${book}.${c}.${v}`;
  if (Number(m[5]) > MOST_VERSES) return null;
  const id = `${book}.${c}.${v}-${m[4] ?? c}.${m[5]}`;
  return resolveRef(id) === null ? null : id;
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

/** "1 Corinthians 14:26–40", "John 7:53–8:11", "Psalm 23:1". */
export function formatRange(ref: string): string {
  const range = parseVerseRef(ref);
  if (range === null) return ref;
  const { start, end } = range;
  // Inside one psalm it is a Psalm (canvas P-02); across psalms the book's name stays plural.
  const name = range.book === "PSA" && start.chapter === end.chapter ? "Psalm" : BOOK_CODES[range.book].name;
  return `${name} ${formatRangeInBook(ref)}`;
}

/** "14:26–40", "23, title–6": formatRange without the book, for a screen that already names it. */
export function formatRangeInBook(ref: string): string {
  const range = parseVerseRef(ref);
  if (range === null) return ref;
  const { start, end } = range;
  const startText = start.verse === 0 ? `${start.chapter}, title` : `${start.chapter}:${start.verse}`;
  if (start.chapter === end.chapter && start.verse === end.verse) return startText;
  if (start.chapter === end.chapter) return `${startText}–${end.verse}`;
  return `${startText}–${end.chapter}:${end.verse}`;
}
