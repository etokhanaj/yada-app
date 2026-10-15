/**
 * MM-04, a word's footprints: while a word's uses are open over the reader, its other uses in the chapter
 * behind are ticked in the margin (canvas J01-08, VS-04). Set by the uses page, cleared when it closes.
 */

import type { BookCode } from "@yada/schema";
import { create } from "zustand";

interface Footprints {
  readonly book: BookCode | null;
  readonly chapter: number;
  readonly verses: ReadonlySet<number>;
}

export const useFootprints = create<Footprints>(() => ({ book: null, chapter: 0, verses: new Set() }));

export function showFootprints(book: BookCode, chapter: number, verses: readonly number[]): void {
  useFootprints.setState({ book, chapter, verses: new Set(verses) });
}

export function clearFootprints(): void {
  useFootprints.setState({ book: null, chapter: 0, verses: new Set() });
}
