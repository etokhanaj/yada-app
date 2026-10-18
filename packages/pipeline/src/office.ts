/**
 * The Daily Office lectionary of the 1979 Book of Common Prayer, for Daily prayer (DO-01–06): mornings first (John,
 * 17 Oct 2026: "morning only at first"), evenings since John moved evening Daily prayer into Build 10. From Reuben Lillie's JSON (github.com/reubenlillie/daily-office @ c4bac10,
 * MIT, read from its LICENSE; the README notes the Prayer Book itself was never under copyright). References only:
 * every word shown is the BSB's, read from core at the time of prayer. The 1979 book's own RSV quotations are never
 * used. A lesson from a book the BSB does not have (Sirach, Wisdom and the rest) is kept marked, and the app skips it
 * rather than fill it from another translation.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const OFFICE_FILES: Readonly<Record<string, string>> = {
  "daily-office/dol-year-1.json": "e6e0a6a0723666958c33a182d89c1a8f26da39cb4ebc082cbfd4a3c4f755eeba",
  "daily-office/dol-year-2.json": "cb65cd7e1c0b1f96c7680e95495cbd0aa842347b4234912bb0db6d3b9880cfab",
  "daily-office/LICENSE": "2aecf2526a8eda5761f2dc1b2f90361cf59602ef5d0ce6a264a9b158b559f37c",
};

export class OfficeRefused extends Error {}

/** The source's abbreviations, as USFM codes. A book the BSB lacks maps to null. */
const BOOKS: Readonly<Record<string, string | null>> = {
  gen: "GEN", exod: "EXO", lev: "LEV", num: "NUM", deut: "DEU", josh: "JOS", judg: "JDG", ruth: "RUT",
  "1 sam": "1SA", "2 sam": "2SA", "1 kgs": "1KI", "2 kgs": "2KI", "1 chr": "1CH", "2 chr": "2CH", ezra: "EZR", neh: "NEH",
  esth: "EST", job: "JOB", prov: "PRO", eccles: "ECC", isa: "ISA", jer: "JER", lam: "LAM", ezek: "EZK", dan: "DAN",
  hos: "HOS", joel: "JOL", amos: "AMO", obad: "OBA", jonah: "JON", mic: "MIC", nah: "NAM", hab: "HAB", zeph: "ZEP",
  hag: "HAG", zech: "ZEC", mal: "MAL", matt: "MAT", mark: "MRK", luke: "LUK", john: "JHN", acts: "ACT", rom: "ROM",
  "1 cor": "1CO", "2 cor": "2CO", gal: "GAL", eph: "EPH", phil: "PHP", col: "COL", "1 thess": "1TH", "2 thess": "2TH",
  "1 tim": "1TI", "2 tim": "2TI", titus: "TIT", phlm: "PHM", heb: "HEB", jas: "JAS", james: "JAS", "1 pet": "1PE",
  "2 pet": "2PE", "1 john": "1JN", "2 john": "2JN", "3 john": "3JN", jude: "JUD", rev: "REV",
  sir: null, wis: null, bar: null, jdt: null, tob: null, "1 macc": null, "2 macc": null,
};

export interface OfficeLesson {
  /** As the source writes it ("Isa 1:10–20"), with the book's USFM code; null when the BSB lacks the book. */
  readonly ref: string;
  readonly book: string | null;
  /** The chapter-and-verse part, optional verses in brackets dropped ("43:1–12(27–33)" -> "43:1–12"). */
  readonly verses: string;
}

/** "1 Cor5:1–8" and "1 cor 5:1–8" read alike: the source has a few such slips. */
export function parseLesson(ref: string): OfficeLesson {
  const m = /^\s*([1-3]?\s?[A-Za-z]+)\s*(\d.*)$/.exec(ref);
  // A reference the source writes in no readable form ("Col (3:18–4:1)2–18") is skipped, never guessed (rule 4).
  if (m === null) return { ref: ref.trim(), book: null, verses: "" };
  const name = (m[1] ?? "").toLowerCase().replace(/^([1-3])\s?/, "$1 ");
  if (!(name in BOOKS)) throw new OfficeRefused(`unknown book "${m[1]}" in "${ref}"`);
  return { ref: ref.trim(), book: BOOKS[name] ?? null, verses: (m[2] ?? "").replace(/\([^)]*\)/g, "").trim() };
}

interface SourceLessons {
  first?: unknown;
  second?: unknown;
  third?: unknown;
  gospel?: unknown;
}

interface SourceDay {
  season?: string;
  week?: string;
  day?: string;
  psalms?: { morning?: string[]; evening?: string[] };
  /** Most days give three lessons for the day; an eve or a great feast splits them into its own morning and evening. */
  lessons?: SourceLessons & { morning?: SourceLessons; evening?: SourceLessons };
  notes?: string[];
}

const lessonsOf = (refs: readonly unknown[]): OfficeLesson[] => refs.filter((l): l is string => typeof l === "string").map(parseLesson);

/** "Year One|Week of 1 Advent|Monday" -> the morning's psalms and two lessons. */
export function morningTable(days: readonly SourceDay[], year: 1 | 2): Record<string, { psalms: string[]; lessons: OfficeLesson[] }> {
  const out: Record<string, { psalms: string[]; lessons: OfficeLesson[] }> = {};
  for (const d of days) {
    const morning = d.psalms?.morning;
    if (d.week === undefined || d.day === undefined || morning === undefined) continue;
    // Christmas Eve, Easter Day and the other eves give the morning its own lessons; without this they had none.
    // Easter morning's own are a first lesson and a Gospel, with no second.
    const own = d.lessons?.morning;
    const lessons = own !== undefined ? lessonsOf([own.first, own.second ?? own.gospel]) : lessonsOf([d.lessons?.first, d.lessons?.second]);
    out[`${year}|${d.week}|${d.day}`] = { psalms: morning, lessons };
  }
  return out;
}

export interface OfficeEvening {
  psalms: string[];
  /** The source's own note on a few Christmas dates: "If today is Saturday, use Psalm 136 at Evening Prayer." */
  saturday?: string[];
  lessons: OfficeLesson[];
}

/** The only note the source carries. Any other shape is refused, so a new note is read by a person, not guessed at. */
const SATURDAY_NOTE = /^If today is Saturday, use Psalms? (.+) at Evening Prayer\.$/;

/**
 * "Year One|Week of 1 Advent|Monday" -> the evening's psalms and lessons. Where the source splits the day, the
 * evening reads its own lessons. Otherwise the morning has already read the first two of the day's three, so the
 * evening reads the one left, the Gospel (or Holy Saturday's third); alternatives ("altGospel") are not read.
 */
export function eveningTable(days: readonly SourceDay[], year: 1 | 2): Record<string, OfficeEvening> {
  const out: Record<string, OfficeEvening> = {};
  for (const d of days) {
    const evening = d.psalms?.evening;
    if (d.week === undefined || d.day === undefined || evening === undefined) continue;
    const own = d.lessons?.evening;
    const lessons = own !== undefined ? lessonsOf([own.first, own.second, own.third, own.gospel]) : lessonsOf([d.lessons?.third, d.lessons?.gospel]);
    const entry: OfficeEvening = { psalms: evening, lessons };
    for (const note of d.notes ?? []) {
      const m = SATURDAY_NOTE.exec(note);
      if (m === null) throw new OfficeRefused(`unread note "${note}" on ${d.week} ${d.day}`);
      entry.saturday = (m[1] ?? "").split(" and ").map((p) => p.trim());
    }
    out[`${year}|${d.week}|${d.day}`] = entry;
  }
  return out;
}

function readPinned(raw: string, file: string): string {
  const full = path.join(raw, file);
  if (!existsSync(full)) throw new OfficeRefused(`${full} is missing`);
  const bytes = readFileSync(full);
  if (createHash("sha256").update(bytes).digest("hex") !== OFFICE_FILES[file]) throw new OfficeRefused(`${full} does not match its pin`);
  return bytes.toString("utf8");
}

/** `yada office [--write]`: the morning and evening tables for the app, from the pinned lectionary. */
export function officeCommand(args: readonly string[], options: { raw: string; appFile: string }): number {
  let table: Record<string, { psalms: string[]; lessons: OfficeLesson[] }>;
  let evenings: Record<string, OfficeEvening>;
  try {
    if (!readPinned(options.raw, "daily-office/LICENSE").includes("MIT License")) throw new OfficeRefused("LICENSE no longer says MIT License");
    const year1 = JSON.parse(readPinned(options.raw, "daily-office/dol-year-1.json")) as SourceDay[];
    const year2 = JSON.parse(readPinned(options.raw, "daily-office/dol-year-2.json")) as SourceDay[];
    table = { ...morningTable(year1, 1), ...morningTable(year2, 2) };
    evenings = { ...eveningTable(year1, 1), ...eveningTable(year2, 2) };
  } catch (error) {
    if (error instanceof OfficeRefused) {
      console.error(`office: REFUSED. ${error.message}`);
      return 1;
    }
    throw error;
  }
  const days = Object.keys(table).length;
  const skipped = [...Object.values(table), ...Object.values(evenings)].flatMap((d) => d.lessons).filter((l) => l.book === null).length;
  console.log(`office: ${days} mornings, ${Object.keys(evenings).length} evenings, ${skipped} lessons from books the BSB does not have (skipped in the app)`);
  if (args.includes("--write")) {
    writeFileSync(
      options.appFile,
      [
        "// Generated by `yada office --write` from the 1979 Daily Office lectionary (Reuben Lillie's JSON, MIT). Do not edit.",
        "// References only; the words are the BSB's, read from core. Mornings and evenings.",
        "",
        "export interface OfficeLesson { readonly ref: string; readonly book: string | null; readonly verses: string }",
        "",
        `export const OFFICE_MORNINGS: Readonly<Record<string, { readonly psalms: readonly string[]; readonly lessons: readonly OfficeLesson[] }>> = ${JSON.stringify(table)};`,
        "",
        "export interface OfficeEvening { readonly psalms: readonly string[]; readonly saturday?: readonly string[]; readonly lessons: readonly OfficeLesson[] }",
        "",
        `export const OFFICE_EVENINGS: Readonly<Record<string, OfficeEvening>> = ${JSON.stringify(evenings)};`,
        "",
      ].join("\n"),
      "utf8",
    );
    console.log(`wrote ${options.appFile}`);
  }
  return 0;
}
