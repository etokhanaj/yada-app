/**
 * Hebrew verse numbering onto Yada's English verse ids, for a translation printed in Hebrew order.
 *
 * The JPS 1917 Tanakh numbers its verses as the Hebrew Bible does: a psalm's superscription is
 * verse 1, Joel has four chapters, Malachi three. eBible's file of it is already keyed by English
 * reference and keeps the printed Hebrew number inline as "(4-1)" wherever the two differ. Neither
 * half is taken on trust (rule 5): every stretch of text is placed by its Hebrew number through
 * STEPBible's TVTMS, and kept only where TVTMS agrees with eBible's English key or the difference
 * is one checked by hand (ACCEPTED_DIVERGENCES). Anything else is left out and reported verse by
 * verse, never guessed.
 */

import { readFileSync } from "node:fs";

import { BOOK_ORDER, type BookCode } from "@yada/schema";

import { parseVpl } from "./english.js";

/**
 * TVTMS's table of English (KJV, NRSV, ESV) against Hebrew MT verse numbers. It lists only the
 * verses that differ; an unlisted Hebrew verse has the same number in English.
 */
const TABLE_HEADER = /^English \(NRSV, ESV, KJV etc\)\tHebrew MT/;

export interface TvtmsHebrew {
  /** Hebrew verse id (`JOL.4.1`) to the English verse ids holding its words, in order. */
  toEnglish: Map<string, string[]>;
  /** English verses with no Hebrew counterpart (Nehemiah 7:69 in TVTMS). */
  englishOnly: Set<string>;
}

/** TVTMS's SIL abbreviations ("Jol", "1Sa") are Yada's codes in upper case, for every OT book. */
function bookCode(abbrev: string): BookCode | null {
  const code = abbrev.toUpperCase();
  return (BOOK_ORDER as readonly string[]).includes(code) ? (code as BookCode) : null;
}

/**
 * English verse 0 is TVTMS's address for a psalm title that English prints inside verse 1
 * ("A Psalm of David. The LORD is my shepherd"). Yada has no English row at verse 0 (english.ts),
 * so the title belongs to verse 1, as in the BSB, WEB and KJV.
 */
function englishId(book: BookCode, chapter: number, verse: number): string {
  return `${book}.${chapter}.${verse === 0 ? 1 : verse}`;
}

/**
 * One Hebrew cell: "Gen.32:1", "Num.25:19; 26:1", "1Ki.22:43,44", "Isa.63:19b". The book and
 * chapter carry forward; a half-verse letter only says which part, so the verse is the same.
 */
export function parseHebrewCell(cell: string, book: BookCode): string[] {
  const out: string[] = [];
  let chapter = 0;
  for (const part of cell.split(";")) {
    const match = /^\s*(?:[1-3]?[A-Za-z]+\.)?(?:(\d+):)?([\d,\sab]+)$/.exec(part.trim());
    if (match === null) throw new Error(`TVTMS: unreadable Hebrew reference "${cell}"`);
    if (match[1] !== undefined) chapter = Number(match[1]);
    if (chapter === 0) throw new Error(`TVTMS: Hebrew reference without a chapter "${cell}"`);
    for (const verse of (match[2] ?? "").split(",")) {
      const v = Number(verse.trim().replace(/[ab]$/, ""));
      if (!Number.isInteger(v) || verse.trim() === "") throw new Error(`TVTMS: unreadable Hebrew verse "${cell}"`);
      out.push(`${book}.${chapter}.${v}`);
    }
  }
  return out;
}

export function parseTvtmsHebrew(text: string): TvtmsHebrew {
  const toEnglish = new Map<string, string[]>();
  const englishOnly = new Set<string>();
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => TABLE_HEADER.test(line));
  if (start < 0) throw new Error("TVTMS: the English/Hebrew MT table was not found");

  let rows = 0;
  for (const line of lines.slice(start + 1)) {
    const [english = "", hebrew = ""] = line.split("\t").map((cell) => cell.trim());
    if (english === "" || english.startsWith("'")) continue;
    // One row is starred ("*Psa.38:16") with no note saying why; the numbers are the same kind.
    const ref = /^\*?([1-3]?[A-Za-z]+)\.(\d+):(\d+)$/.exec(english);
    // The table ends where its first column stops being a reference.
    if (ref === null) break;
    const book = bookCode(ref[1] ?? "");
    if (book === null) throw new Error(`TVTMS: unknown book in "${english}"`);
    const eng = englishId(book, Number(ref[2]), Number(ref[3]));
    rows += 1;
    if (hebrew === "") {
      englishOnly.add(eng);
      continue;
    }
    for (const heb of parseHebrewCell(hebrew, book)) {
      const targets = toEnglish.get(heb) ?? [];
      if (!targets.includes(eng)) targets.push(eng);
      toEnglish.set(heb, targets);
    }
  }
  // A format change that empties the table would make every verse "identical"; fail instead.
  if (rows < 1000) throw new Error(`TVTMS: only ${rows} rows read from the English/Hebrew MT table`);
  return { toEnglish, englishOnly };
}

export function readTvtmsHebrew(file: string): TvtmsHebrew {
  return parseTvtmsHebrew(readFileSync(file, "utf8"));
}

/** The English verses a Hebrew verse may fall in: TVTMS's list, or the same number. */
export function englishFor(tvtms: TvtmsHebrew, hebrew: string): string[] {
  return tvtms.toEnglish.get(hebrew) ?? [hebrew];
}

/** `english<hebrew`, the key of one accepted divergence. */
export function divergenceKey(english: string, hebrew: string): string {
  return `${english}<${hebrew}`;
}

function span(
  book: BookCode,
  chapter: number,
  english: [number, number],
  hebrew: (verse: number) => number,
  reason: string,
): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let v = english[0]; v <= english[1]; v += 1) {
    out.push([divergenceKey(`${book}.${chapter}.${v}`, `${book}.${chapter}.${hebrew(v)}`), reason]);
  }
  return out;
}

const DECALOGUE =
  "The JPS divides the Ten Commandments by the upper accents, so 'murder' to 'false witness' is one Hebrew verse; TVTMS follows the WLC's lower accents, as English does";

/**
 * The 37 verses (12 Oct 2026) where TVTMS, following the Westminster Leningrad Codex, places a
 * Hebrew number elsewhere than eBible's English key, and the words were checked by hand against
 * the KJV verse by verse and found to be the English verse's own. Each is the JPS's Hebrew
 * edition numbering differently from the WLC, or eBible leaving a marker out; none moves words.
 * Anything TVTMS disputes that is not listed here is left out of the text and reported.
 */
export const ACCEPTED_DIVERGENCES: ReadonlyMap<string, string> = new Map([
  // JPS Exodus 20:13 holds four commandments; 20:14-23 are English 20:17-26.
  ...span("EXO", 20, [14, 16], () => 13, DECALOGUE),
  ...span("EXO", 20, [17, 26], (v) => v - 3, DECALOGUE),
  // The same in Deuteronomy: JPS 5:17 holds four; 5:18-30 are English 5:21-33.
  ...span("DEU", 5, [18, 20], () => 17, DECALOGUE),
  ...span("DEU", 5, [21, 33], (v) => v - 3, DECALOGUE),
  // TVTMS: the WLC lacks English 7:68 (horses and mules), so WLC 7:69-72 are English 7:70-73. The
  // JPS prints that verse and numbers the chapter as English does; JPS 7:69 is "their camels".
  ...span("NEH", 7, [69, 72], (v) => v, "The JPS prints Nehemiah 7:68 (horses and mules), which the WLC lacks"),
  // Psalm 70's title is JPS 70:1 and its verses 70:2-6, as for every titled psalm, but eBible's
  // file has no "(70-n)" markers here. Its English keys match the KJV's verses one for one.
  ...span("PSA", 70, [2, 5], (v) => v, "eBible's file omits the Hebrew verse markers in Psalm 70"),
]);

export interface UnmappedSegment {
  /** eBible's English key for the line. */
  key: string;
  /** The Hebrew number the words carry. */
  hebrew: string;
  /** Where TVTMS places that Hebrew verse instead. */
  tvtms: string[];
  text: string;
}

export interface HebrewMappingReport {
  lines: number;
  /** Stretches of text, one per Hebrew verse number (a line can hold several). */
  segments: number;
  /** Segments carrying a printed Hebrew number that differs from the English key. */
  renumbered: number;
  /** Psalm headings ("BOOK II") removed from the start of a verse. */
  headings: string[];
  accepted: Array<{ verse_id: string; hebrew: string; reason: string }>;
  unmapped: UnmappedSegment[];
  /** English verses some of whose words were left out: left out whole, never half-shown. */
  dropped: string[];
}

export interface MappedVerse {
  verse_id: string;
  text: string;
}

const MARKER = /\((\d+)-(\d+)\)/g;
const PSALM_BOOK_HEADING = /^BOOK (?:I|II|III|IV|V)\s+/;

/**
 * Split one verse line into its Hebrew-numbered stretches. Text before the first marker carries
 * the line's own number, as eBible writes it (1 Samuel 20:42, then "(21-1)" for the rest).
 */
export function hebrewSegments(verseId: string, text: string): Array<{ hebrew: string; text: string }> {
  const [book = "", chapter = "", verse = ""] = verseId.split(".");
  const out: Array<{ hebrew: string; text: string }> = [];
  let hebrew = `${book}.${chapter}.${verse}`;
  let from = 0;
  for (const match of text.matchAll(MARKER)) {
    const before = text.slice(from, match.index).trim();
    if (before !== "") out.push({ hebrew, text: before });
    hebrew = `${book}.${Number(match[1])}.${Number(match[2])}`;
    from = (match.index ?? 0) + match[0].length;
  }
  const rest = text.slice(from).trim();
  if (rest !== "") out.push({ hebrew, text: rest });
  return out;
}

/**
 * eBible's verse lines, each placed through TVTMS by the Hebrew numbers its words carry. The
 * markers and the five psalm-book headings are removed; the words are otherwise unaltered apart
 * from whitespace.
 */
export function mapHebrewNumbered(
  lines: ReadonlyArray<{ verse_id: string; text: string }>,
  tvtms: TvtmsHebrew,
  accepted: ReadonlyMap<string, string> = ACCEPTED_DIVERGENCES,
): { verses: MappedVerse[]; report: HebrewMappingReport } {
  const report: HebrewMappingReport = {
    lines: lines.length,
    segments: 0,
    renumbered: 0,
    headings: [],
    accepted: [],
    unmapped: [],
    dropped: [],
  };
  const verses: MappedVerse[] = [];
  for (const line of lines) {
    let text = line.text;
    // The 1917 printing divides the Psalter into five books, a heading over Psalms 1, 42, 73, 90
    // and 107. It is not the psalm's words, and Compare would set it against the BSB's verse 1.
    if (line.verse_id.startsWith("PSA.") && line.verse_id.endsWith(".1") && PSALM_BOOK_HEADING.test(text)) {
      report.headings.push(line.verse_id);
      text = text.replace(PSALM_BOOK_HEADING, "");
    }
    const kept: string[] = [];
    let lost = false;
    for (const segment of hebrewSegments(line.verse_id, text)) {
      report.segments += 1;
      if (segment.hebrew !== line.verse_id) report.renumbered += 1;
      const places = englishFor(tvtms, segment.hebrew);
      if (places.includes(line.verse_id)) {
        kept.push(segment.text);
        continue;
      }
      const reason = accepted.get(divergenceKey(line.verse_id, segment.hebrew));
      if (reason !== undefined) {
        report.accepted.push({ verse_id: line.verse_id, hebrew: segment.hebrew, reason });
        kept.push(segment.text);
        continue;
      }
      lost = true;
      report.unmapped.push({ key: line.verse_id, hebrew: segment.hebrew, tvtms: places, text: segment.text });
    }
    if (lost) {
      report.dropped.push(line.verse_id);
      continue;
    }
    if (kept.length > 0) verses.push({ verse_id: line.verse_id, text: kept.join(" ") });
  }
  return { verses, report };
}

/** An eBible VPL file in Hebrew order, mapped onto English verse ids. */
export function readHebrewNumberedVpl(
  file: string,
  code: string,
  tvtmsFile: string,
): { verses: MappedVerse[]; report: HebrewMappingReport } {
  return mapHebrewNumbered(parseVpl(file, code), readTvtmsHebrew(tvtmsFile));
}
