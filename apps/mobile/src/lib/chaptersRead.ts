/**
 * Chapters read (build 10a; docs/build-10-ux-pass.md rules 4 and 5, RT-03, RT-04, MM-05): which chapters of a book
 * the reader has reached the end of. Pure, so it is tested.
 *
 * - A chapter counts once, whatever the translation or how often it is read again ("distinct chapters, not
 *   translations").
 * - "You've read Mark" is said only when every chapter of the book is in the set; otherwise the screen says
 *   "End of Mark" and no claim (CLAUDE.md rule 4: never state what the data lacks).
 * - A book of more than 30 chapters shows one continuous bar, not segments (UX pass rule 4: Psalms is 150).
 */

import { BOOK_CODES, BOOK_ORDER, type BookCode } from "@yada/schema";

/** "MRK.4": how a read chapter is stored and synced. */
export function chapterKey(book: BookCode, chapter: number): string {
  return `${book}.${chapter}`;
}

/** Back from a stored key; null for anything that is not a real chapter (iCloud holds what other copies wrote). */
export function parseChapterKey(key: string): { book: BookCode; chapter: number } | null {
  const [book, chapter, ...rest] = key.split(".");
  if (book === undefined || chapter === undefined || rest.length > 0 || !/^\d+$/u.test(chapter)) return null;
  if (!Object.hasOwn(BOOK_CODES, book)) return null;
  const code = book as BookCode;
  const n = Number(chapter);
  return n >= 1 && n <= BOOK_CODES[code].chapters ? { book: code, chapter: n } : null;
}

export interface BookProgress {
  readonly read: number;
  readonly total: number;
  /** Every chapter, so the end of the book may say "You've read". */
  readonly complete: boolean;
}

export function bookProgress(book: BookCode, readKeys: ReadonlySet<string>): BookProgress {
  const total = BOOK_CODES[book].chapters;
  let read = 0;
  for (let chapter = 1; chapter <= total; chapter += 1) if (readKeys.has(chapterKey(book, chapter))) read += 1;
  return { read, total, complete: read === total };
}

/** The bar's lit chapters in order, for a book that gets segments. */
export function chapterCells(book: BookCode, readKeys: ReadonlySet<string>): boolean[] {
  return Array.from({ length: BOOK_CODES[book].chapters }, (_, i) => readKeys.has(chapterKey(book, i + 1)));
}

export const SEGMENT_LIMIT = 30;

export function usesSegments(total: number): boolean {
  return total <= SEGMENT_LIMIT;
}

/** "Mark, 4 of 16 chapters read": the bar lights chapters read, not position. */
export function progressLabel(name: string, p: BookProgress): string {
  return `${name}, ${p.read} of ${p.total} ${p.total === 1 ? "chapter" : "chapters"} read`;
}

/** The end of a book: the claim only when every chapter was read. */
export function endTitle(name: string, p: BookProgress): string {
  return p.complete ? `You’ve read ${name}.` : `End of ${name}.`;
}

/**
 * The card after a book's last chapter. After Revelation it points to Psalms, the book readers return to (John,
 * 18 Oct 2026); after any other book, the next one.
 */
export function nextBookAfter(book: BookCode): BookCode {
  return BOOK_ORDER[BOOK_CODES[book].order + 1] ?? "PSA";
}
