/**
 * Daily prayer's steps for a morning (build 8; DO-04–06, John 17 Oct 2026) or an evening (Build 10), every word the
 * BSB's, read from core. Morning: the opening sentence, the Venite, the day's psalms, its lessons and the Lord's Prayer.
 * Evening: the same opening sentence (the lectionary carries no sentences of its own, so the morning's BSB verse is
 * reused), the evening psalms, the first lesson, Mary's song (Luke 1:46–55), any second lesson, Simeon's song (Luke
 * 2:29–32) and the Lord's Prayer. The lectionary gives only references (office.generated.ts); a lesson from a book the
 * BSB lacks, or one whose reference cannot be read, is skipped, never filled (rule 4). No collects: no source on disk
 * carries them under a licence that permits it (the 1662 book is Crown copyright in the UK).
 */

import { BOOK_CODES, type BookCode, isBookCode } from "@yada/schema";

import { officeKey } from "../lib/office";
import { psalmSpans, type Span, spans } from "../lib/officeRange";
import type { Part } from "../lib/today";
import { OFFICE_EVENINGS, OFFICE_MORNINGS, type OfficeLesson } from "./office.generated";
import { type Db, getChapter } from "./queries";

export interface OfficeStep {
  readonly label: string;
  readonly text: string;
  readonly ref: string;
}

async function textOf(core: Db, book: BookCode, parts: readonly Span[]): Promise<string> {
  const out: string[] = [];
  for (const s of parts) {
    const verses = await getChapter(core, book, s.chapter, "BSB");
    out.push(...verses.filter((v) => v.verse >= s.from && v.verse <= s.to).map((v) => v.text));
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

/** The prayer's own words: Matthew 6:9 opens with the lead-in, cut at its colon with the quotation marks it needed. */
export function prayerOnly(text: string): string {
  return text.replace(/^So then, this is how you should pray:\s*/, "").replace(/[‘’]/g, "");
}

/** Mary's and Simeon's words alone: Luke 1:46's lead-in goes, with the quotation marks that open and close the song. */
export function songOnly(text: string): string {
  return text.replace(/^Then Mary said:\s*/, "").replace(/[“”]/g, "");
}

/**
 * A lesson's spans. "4:13–17; 5:7–11" is read piece by piece, each piece naming its own chapter. A piece without one
 * (the source's slip "4;43–54") would be read as a whole chapter or as chapter 1, so the lesson is skipped (rule 4).
 */
export function lessonSpans(verses: string): Span[] {
  const pieces = verses.split(";").map((p) => p.trim());
  if (pieces.length > 1 && pieces.some((p) => !/^\d+:/.test(p))) return [];
  return pieces.flatMap(spans);
}

export async function loadOffice(core: Db, day: Date, part: Part = "morning"): Promise<OfficeStep[]> {
  const key = officeKey(day);
  const steps: OfficeStep[] = [];
  const add = async (label: string, book: BookCode, parts: Span[], ref: string, shape: (t: string) => string = (t) => t) => {
    const text = shape(await textOf(core, book, parts));
    if (text !== "") steps.push({ label, text, ref });
  };
  const psalms = async (entries: readonly string[]) => {
    for (const entry of entries) {
      const parts = psalmSpans(entry);
      const first = parts[0];
      if (first !== undefined) await add(`Psalm ${first.chapter}`, "PSA", parts, `Psalm ${entry.replace(/\([^)]*\)/g, "")}`);
    }
  };
  const lesson = async (l: OfficeLesson | undefined, label: string) => {
    if (l === undefined || l.book === null || !isBookCode(l.book) || l.verses === "") return;
    const parts = lessonSpans(l.verses);
    if (parts.length > 0) await add(label, l.book, parts, `${BOOK_CODES[l.book].name} ${l.verses.replace(/\([^)]*\)/g, "")}`);
  };

  await add("Opening sentence", "PHP", [{ chapter: 1, from: 2, to: 2 }], "Philippians 1:2");
  if (part === "morning") {
    const morning = OFFICE_MORNINGS[key];
    await add("Psalm 95", "PSA", [{ chapter: 95, from: 1, to: 7 }], "Psalm 95:1–7");
    await psalms(morning?.psalms ?? []);
    for (const [i, l] of (morning?.lessons ?? []).entries()) await lesson(l, i === 0 ? "First reading" : "Second reading");
  } else {
    const evening = OFFICE_EVENINGS[key];
    // The source's own note on a few Christmas dates gives Saturday evening other psalms.
    await psalms((day.getDay() === 6 ? evening?.saturday : undefined) ?? evening?.psalms ?? []);
    const [first, ...rest] = evening?.lessons ?? [];
    await lesson(first, "First reading");
    await add("Mary’s song", "LUK", [{ chapter: 1, from: 46, to: 55 }], "Luke 1:46b–55", songOnly);
    for (const l of rest) await lesson(l, "Second reading");
    await add("Simeon’s song", "LUK", [{ chapter: 2, from: 29, to: 32 }], "Luke 2:29–32", songOnly);
  }
  await add("The Lord’s Prayer", "MAT", [{ chapter: 6, from: 9, to: 13 }], "Matthew 6:9b–13", prayerOnly);
  return steps;
}
