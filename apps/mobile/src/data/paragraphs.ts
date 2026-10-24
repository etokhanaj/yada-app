/**
 * The BSB's own paragraph starts (RU-6, fresh-eyes review, approved by John 23 Oct 2026): the reader sets a chapter
 * in these paragraphs, verse numbers inline, instead of a line per verse. Generated from the BSB tables by
 * scripts/sync-paragraphs.mjs.
 *
 * Every translation the reader shows uses the BSB's breaks. The other public-domain texts carry no paragraph data in
 * the core bundle and the licensed ones come verse by verse; the BSB's breaks are a reasonable reading of any of them,
 * and one set means a verse sits in the same place whatever is chosen.
 */

import { PARAGRAPH_STARTS } from "./paragraphs.generated";

const decoded = new Map<number, ReadonlySet<number>>();

/** One book's starts as chapter*1000+verse, decoded once, the first time a chapter of it is read. */
function startsOf(book: number): ReadonlySet<number> {
  const hit = decoded.get(book);
  if (hit !== undefined) return hit;
  const set = new Set<number>();
  let at = 0;
  for (const d of (PARAGRAPH_STARTS[book - 1] ?? "").split(",")) {
    if (d === "") continue;
    at += parseInt(d, 36);
    set.add(at);
  }
  decoded.set(book, set);
  return set;
}

/** Whether the verse at `ord` (book*1000000 + chapter*1000 + verse) opens a BSB paragraph. */
export function isParagraphStart(ord: number): boolean {
  return startsOf(Math.floor(ord / 1_000_000)).has(ord % 1_000_000);
}
