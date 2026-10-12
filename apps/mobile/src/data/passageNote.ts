/**
 * The hook for a passage guide's opener when the passage has no Yada payload:
 * Tyndale's note on the passage (build plan, "Content the guide can show
 * before the John batch"). data/study.ts registers the source at launch
 * (_layout.tsx); this file only shows what it returns. With no source
 * registered, or no note for the passage, the guide opens on the text: a
 * missing field shows nothing.
 *
 * Shown verbatim with its credit line and never passed to any AI call:
 * Tyndale's notes quote the NLT (CLAUDE.md rule 9).
 */

import type { BookCode } from "@yada/schema";

export interface PassageNote {
  /** The note's text, as published; paragraphs separated by blank lines. */
  readonly text: string;
  /** The attribution the licence requires, shown under the note: "Tyndale Open Study Notes, CC BY-SA 4.0". */
  readonly credit: string;
}

export interface PassageNoteQuery {
  readonly book: BookCode;
  /** "JHN.1.19-1.34" */
  readonly pericopeId: string;
  readonly startOrd: number;
  readonly endOrd: number;
}

/** Resolves to null when there is no note, the bundle is not downloaded yet, or the device is offline. */
export type PassageNoteSource = (query: PassageNoteQuery) => Promise<PassageNote | null>;

let source: PassageNoteSource | null = null;

/** Called once by the study-notes package at start-up. */
export function registerPassageNoteSource(next: PassageNoteSource | null): void {
  source = next;
}

export async function loadPassageNote(query: PassageNoteQuery): Promise<PassageNote | null> {
  if (source === null) return null;
  try {
    return await source(query);
  } catch {
    // A study note is an extra; failing to read one must never stop the guide opening.
    return null;
  }
}
