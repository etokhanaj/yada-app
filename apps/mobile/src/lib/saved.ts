/**
 * Labels for the page lists: Bookmarks, Recent, Sources' explained verses and
 * Start here. Pure, so the wording is tested once.
 */

import type { BookCode } from "@yada/schema";

import type { EventName } from "../data/user";
import { formatRangeInBook } from "./chapters";
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

/** You's Saved row (YO-30): "4 highlights · 1 note", only what is there; null when nothing is kept. */
export function savedLine(counts: { highlights: number; notes: number; bookmarks: number; images: number }): string | null {
  const parts = (
    [
      [counts.highlights, "highlight"],
      [counts.notes, "note"],
      [counts.bookmarks, "bookmark"],
      [counts.images, "image"],
    ] as const
  ).flatMap(([n, word]) => (n === 0 ? [] : [`${n} ${word}${n === 1 ? "" : "s"}`]));
  return parts.length === 0 ? null : parts.join(" · ");
}
