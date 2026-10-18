/**
 * Daily prayer's steps for a morning (build 8; DO-04–06, John 17 Oct 2026): the opening sentence, the Venite, the
 * day's psalms, its lessons and the Lord's Prayer, every word the BSB's, read from core. The lectionary gives only
 * references (office.generated.ts); a lesson from a book the BSB lacks is skipped, never filled (rule 4).
 */

import { BOOK_CODES, type BookCode, isBookCode } from "@yada/schema";

import { officeKey } from "../lib/office";
import { psalmSpans, type Span, spans } from "../lib/officeRange";
import { OFFICE_MORNINGS } from "./office.generated";
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

export async function loadOffice(core: Db, day: Date): Promise<OfficeStep[]> {
  const morning = OFFICE_MORNINGS[officeKey(day)];
  const steps: OfficeStep[] = [];
  const add = async (label: string, book: BookCode, parts: Span[], ref: string, shape: (t: string) => string = (t) => t) => {
    const text = shape(await textOf(core, book, parts));
    if (text !== "") steps.push({ label, text, ref });
  };
  await add("Opening sentence", "PHP", [{ chapter: 1, from: 2, to: 2 }], "Philippians 1:2");
  await add("Psalm 95", "PSA", [{ chapter: 95, from: 1, to: 7 }], "Psalm 95:1–7");
  for (const entry of morning?.psalms ?? []) {
    const parts = psalmSpans(entry);
    const first = parts[0];
    if (first !== undefined) await add(`Psalm ${first.chapter}`, "PSA", parts, `Psalm ${entry.replace(/\([^)]*\)/g, "")}`);
  }
  for (const [i, lesson] of (morning?.lessons ?? []).entries()) {
    if (lesson.book === null || !isBookCode(lesson.book) || lesson.verses === "") continue;
    await add(i === 0 ? "First reading" : "Second reading", lesson.book, spans(lesson.verses), `${BOOK_CODES[lesson.book].name} ${lesson.verses.replace(/\([^)]*\)/g, "")}`);
  }
  await add("The Lord’s Prayer", "MAT", [{ chapter: 6, from: 9, to: 13 }], "Matthew 6:9b–13", prayerOnly);
  return steps;
}
