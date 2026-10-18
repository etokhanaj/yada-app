/**
 * Your space (PS-01–PS-05): the four highlight colours, notes on a verse or a whole chapter, and the images made from
 * a verse. Pure, so the cloud merge and the screens share one set of rules and the tests need no phone.
 */

import { parseVerseId } from "@yada/schema";

import { parseChapterKey } from "./chaptersRead";

/** PS-01's four dots, in the bar's order. */
export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export function isHighlightColor(value: unknown): value is HighlightColor {
  return typeof value === "string" && (HIGHLIGHT_COLORS as readonly string[]).includes(value);
}

/** What VoiceOver says after "highlighted": a word, never the colour's hex (PS-02, "verse 16, highlighted yellow"). */
export function highlightSpoken(color: HighlightColor): string {
  return `highlighted ${color}`;
}

/**
 * A note hangs on a verse ("JHN.3.16") or on the whole chapter ("JHN.3"), PS-03's two-way switch. Anything else is
 * not a note's target: a value from another copy of the app that this one cannot place.
 */
export function isNoteTarget(key: string): boolean {
  return parseVerseId(key) !== null || parseChapterKey(key) !== null;
}

/**
 * iCloud's key-value store holds at most 1 MB per app; a note is a few sentences, and one this long would let a
 * handful of notes crowd out the bookmarks beside them. The editor stops here and the merge drops anything longer.
 */
export const NOTE_MAX = 2000;

/** The share image's grounds (PS-05): the day's morning picture, its evening picture, plain white or dark. */
export const IMAGE_GROUNDS = ["picture", "evening", "white", "dark"] as const;
export type ImageGround = (typeof IMAGE_GROUNDS)[number];

export function isImageGround(value: unknown): value is ImageGround {
  return typeof value === "string" && (IMAGE_GROUNDS as readonly string[]).includes(value);
}
