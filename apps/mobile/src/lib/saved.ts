/**
 * Labels for the page lists: Bookmarks, Recent, Sources' explained verses and
 * Start here. Pure, so the wording is tested once.
 */

import { BOOK_CODES, type BookCode } from "@yada/schema";

import type { EventName } from "../data/user";
import { formatRange } from "./chapters";
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
  const full = formatRange(pericopeId);
  const book = pericopeId.split(".")[0] as BookCode;
  const name = BOOK_CODES[book]?.name;
  return name !== undefined && full.startsWith(`${name} `) ? full.slice(name.length + 1) : full;
}

export type ThreadMark = "done" | "next" | "todo";

/** `step` is the index of the next passage: everything before it has been read. */
export function threadMark(index: number, step: number): ThreadMark {
  if (index < step) return "done";
  return index === step ? "next" : "todo";
}
