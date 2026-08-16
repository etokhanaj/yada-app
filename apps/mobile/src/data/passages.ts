/**
 * The three test passages, loaded from the real golden fixtures at the repo
 * root. One component set renders all three; if that works, the foundation is
 * right (design brief, "design against real content only").
 */

import type { VerseEntry } from "@yada/schema";

import co from "../../../../golden/1co.14.34.json";
import gen from "../../../../golden/gen.1.1.json";
import jhn from "../../../../golden/jhn.1.1.json";
import chapters from "./text.json";

export type Script = "greek" | "hebrew";

export interface Passage {
  verseId: string;
  chapterKey: keyof typeof chapters;
  reference: string;
  script: Script;
  entry: VerseEntry;
}

export const PASSAGES: Passage[] = [
  {
    verseId: "1CO.14.34",
    chapterKey: "1CO.14",
    reference: "1 Corinthians 14:34",
    script: "greek",
    entry: co as unknown as VerseEntry,
  },
  {
    verseId: "JHN.1.1",
    chapterKey: "JHN.1",
    reference: "John 1:1",
    script: "greek",
    entry: jhn as unknown as VerseEntry,
  },
  {
    verseId: "GEN.1.1",
    chapterKey: "GEN.1",
    reference: "Genesis 1:1",
    script: "hebrew",
    entry: gen as unknown as VerseEntry,
  },
];

export interface Verse {
  number: number;
  text: string;
}

export function chapterVerses(key: keyof typeof chapters): Verse[] {
  const chapter = chapters[key];
  return Object.entries(chapter.verses)
    .map(([number, text]) => ({ number: Number(number), text }))
    .sort((a, b) => a.number - b.number);
}

export function chapterLabel(key: keyof typeof chapters): string {
  return chapters[key].label;
}

export function chapterTranslation(key: keyof typeof chapters): string {
  return chapters[key].translation;
}

export function focalVerseNumber(passage: Passage): number {
  const parts = passage.verseId.split(".");
  return Number(parts[2] ?? 0);
}
