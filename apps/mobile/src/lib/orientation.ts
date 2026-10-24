/**
 * A book's orientation in the About sheet (OR-01 to OR-09, Build 10 and 11 canvases; docs/build-11g-data-check.md):
 * its shape, where, and who, each only from the book's own files, and only for a book John has approved (rule 2).
 */

import { type BookCode, ordToParts } from "@yada/schema";

/**
 * Books whose orientation John approved (rule 2): John, 1 John and Mark, in chat on 23 Oct 2026 ("I approve ... number
 * 1"). A book not listed shows its sections only in a debug build, marked as a draft; a release build shows only the
 * introduction.
 */
export const ORIENTATION_APPROVED: ReadonlySet<BookCode> = new Set<BookCode>(["JHN", "1JN", "MRK"]);

/** OR-01 lists this many sections, then "All N sections". */
export const SHAPE_FIRST = 6;

/** "1:1–18", "1:19–2:11": a section's range within its book. */
export function shortRange(startOrd: number, endOrd: number): string {
  const a = ordToParts(startOrd);
  const b = ordToParts(endOrd);
  if (a.chapter !== b.chapter) return `${a.chapter}:${a.verse}–${b.chapter}:${b.verse}`;
  return a.verse === b.verse ? `${a.chapter}:${a.verse}` : `${a.chapter}:${a.verse}–${b.verse}`;
}

/** The credit lines under Where and Who: the source's name, opening Sources (components/SourceLine.tsx). */
export const PLACES_CREDIT = "OpenBible.info · Natural Earth";
export const PEOPLE_CREDIT = "Tyndale";

/** The introduction's line: the full notice, and that it was shortened, is on Sources (SC-08). */
export const INTRO_CREDIT = "unfoldingWord, adapted";
