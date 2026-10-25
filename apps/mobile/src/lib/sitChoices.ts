/**
 * Choose a verse (SW-02): what each filter lists. Pure, so it is tested; the screen loads the rows and the words.
 *
 * Saved is one list of the verses a reader kept, however they kept them: a highlight, a bookmark or a note, newest
 * first, one row per verse. The row says the newest way it was kept and carries its highlight colour as a swatch.
 */

import { parseVerseId } from "@yada/schema";

import type { HighlightColor } from "./highlights";

export type SitFilter = "today" | "saved" | "moods" | "recent";

export const SIT_FILTERS: ReadonlyArray<{ key: SitFilter; title: string }> = [
  { key: "today", title: "Today" },
  { key: "saved", title: "Saved" },
  { key: "moods", title: "For when you’re" },
  { key: "recent", title: "Recent" },
];

export type KeptAs = "Highlighted" | "Bookmarked" | "Note";

export interface SavedVerse {
  readonly verseId: string;
  readonly kept: KeptAs;
  readonly color: HighlightColor | null;
  readonly at: string;
}

export function mergeSaved(
  bookmarks: ReadonlyArray<{ verse_id: string; created_at: string }>,
  highlights: ReadonlyArray<{ verse_id: string; color: HighlightColor; updated_at: string }>,
  notes: ReadonlyArray<{ target: string; updated_at: string }>,
): SavedVerse[] {
  const colors = new Map(highlights.map((h) => [h.verse_id, h.color]));
  const all = [
    ...highlights.map((h) => ({ verseId: h.verse_id, kept: "Highlighted" as const, at: h.updated_at })),
    ...bookmarks.map((b) => ({ verseId: b.verse_id, kept: "Bookmarked" as const, at: b.created_at })),
    // A note on a whole chapter ("JHN.3") is not a verse to sit with.
    ...notes.filter((n) => parseVerseId(n.target) !== null).map((n) => ({ verseId: n.target, kept: "Note" as const, at: n.updated_at })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const seen = new Set<string>();
  const out: SavedVerse[] = [];
  for (const k of all) {
    if (seen.has(k.verseId)) continue;
    seen.add(k.verseId);
    out.push({ ...k, color: colors.get(k.verseId) ?? null });
  }
  return out;
}

/** SW-06: a kept word goes on its own line under whatever the note already says (decision 2: "Kept: still"). */
export function withKeptWord(note: string, word: string): string {
  const kept = `Kept: ${word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")}`;
  const body = note.trimEnd();
  if (body.split("\n").includes(kept)) return body;
  return body === "" ? kept : `${body}\n${kept}`;
}
