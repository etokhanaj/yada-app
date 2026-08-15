/**
 * Book codes, verse IDs, and human-input reference parsing.
 *
 * Verse ID convention (build plan §2): `BOOK.chapter.verse`, e.g. `JHN.1.1`.
 * The same string is used in the pipeline, in bundles, and in the app. Book
 * codes are the standard 3-character USFM codes.
 */

import { z } from "zod";

export type Testament = "OT" | "NT";

interface RawBook {
  readonly code: string;
  readonly name: string;
  readonly testament: Testament;
  readonly chapters: number;
  /** Extra human spellings. Full name and code are registered automatically. */
  readonly aliases: readonly string[];
}

const BOOK_TABLE = [
  { code: "GEN", name: "Genesis", testament: "OT", chapters: 50, aliases: ["gen", "ge", "gn"] },
  { code: "EXO", name: "Exodus", testament: "OT", chapters: 40, aliases: ["exod", "ex"] },
  { code: "LEV", name: "Leviticus", testament: "OT", chapters: 27, aliases: ["lv"] },
  { code: "NUM", name: "Numbers", testament: "OT", chapters: 36, aliases: ["nu", "nm"] },
  { code: "DEU", name: "Deuteronomy", testament: "OT", chapters: 34, aliases: ["deut", "dt"] },
  { code: "JOS", name: "Joshua", testament: "OT", chapters: 24, aliases: ["josh", "jsh"] },
  { code: "JDG", name: "Judges", testament: "OT", chapters: 21, aliases: ["judg", "jg"] },
  { code: "RUT", name: "Ruth", testament: "OT", chapters: 4, aliases: ["ru", "rth"] },
  { code: "1SA", name: "1 Samuel", testament: "OT", chapters: 31, aliases: ["1sam", "1sm", "1s"] },
  { code: "2SA", name: "2 Samuel", testament: "OT", chapters: 24, aliases: ["2sam", "2sm", "2s"] },
  { code: "1KI", name: "1 Kings", testament: "OT", chapters: 22, aliases: ["1kgs", "1kg", "1k"] },
  { code: "2KI", name: "2 Kings", testament: "OT", chapters: 25, aliases: ["2kgs", "2kg", "2k"] },
  { code: "1CH", name: "1 Chronicles", testament: "OT", chapters: 29, aliases: ["1chr", "1chron"] },
  { code: "2CH", name: "2 Chronicles", testament: "OT", chapters: 36, aliases: ["2chr", "2chron"] },
  { code: "EZR", name: "Ezra", testament: "OT", chapters: 10, aliases: [] },
  { code: "NEH", name: "Nehemiah", testament: "OT", chapters: 13, aliases: ["ne"] },
  { code: "EST", name: "Esther", testament: "OT", chapters: 10, aliases: ["esth"] },
  { code: "JOB", name: "Job", testament: "OT", chapters: 42, aliases: ["jb"] },
  { code: "PSA", name: "Psalms", testament: "OT", chapters: 150, aliases: ["ps", "psalm", "pss", "psalms"] },
  { code: "PRO", name: "Proverbs", testament: "OT", chapters: 31, aliases: ["prov", "prv", "pr"] },
  { code: "ECC", name: "Ecclesiastes", testament: "OT", chapters: 12, aliases: ["eccl", "qoheleth"] },
  {
    code: "SNG",
    name: "Song of Songs",
    testament: "OT",
    chapters: 8,
    aliases: ["song", "song of solomon", "songofsongs", "sos", "canticles"],
  },
  { code: "ISA", name: "Isaiah", testament: "OT", chapters: 66, aliases: ["is"] },
  { code: "JER", name: "Jeremiah", testament: "OT", chapters: 52, aliases: ["je", "jr"] },
  { code: "LAM", name: "Lamentations", testament: "OT", chapters: 5, aliases: ["la"] },
  { code: "EZK", name: "Ezekiel", testament: "OT", chapters: 48, aliases: ["ezek", "eze"] },
  { code: "DAN", name: "Daniel", testament: "OT", chapters: 12, aliases: ["dn"] },
  { code: "HOS", name: "Hosea", testament: "OT", chapters: 14, aliases: ["ho"] },
  { code: "JOL", name: "Joel", testament: "OT", chapters: 3, aliases: ["joel", "joe", "jl"] },
  { code: "AMO", name: "Amos", testament: "OT", chapters: 9, aliases: ["am"] },
  { code: "OBA", name: "Obadiah", testament: "OT", chapters: 1, aliases: ["obad", "ob"] },
  { code: "JON", name: "Jonah", testament: "OT", chapters: 4, aliases: ["jnh"] },
  { code: "MIC", name: "Micah", testament: "OT", chapters: 7, aliases: ["mc"] },
  { code: "NAM", name: "Nahum", testament: "OT", chapters: 3, aliases: ["nah", "na"] },
  { code: "HAB", name: "Habakkuk", testament: "OT", chapters: 3, aliases: ["hb"] },
  { code: "ZEP", name: "Zephaniah", testament: "OT", chapters: 3, aliases: ["zeph", "zph"] },
  { code: "HAG", name: "Haggai", testament: "OT", chapters: 2, aliases: ["hg"] },
  { code: "ZEC", name: "Zechariah", testament: "OT", chapters: 14, aliases: ["zech", "zch"] },
  { code: "MAL", name: "Malachi", testament: "OT", chapters: 4, aliases: ["ml"] },

  { code: "MAT", name: "Matthew", testament: "NT", chapters: 28, aliases: ["matt", "mt"] },
  { code: "MRK", name: "Mark", testament: "NT", chapters: 16, aliases: ["mark", "mk", "mar"] },
  { code: "LUK", name: "Luke", testament: "NT", chapters: 24, aliases: ["luke", "lk", "lu"] },
  { code: "JHN", name: "John", testament: "NT", chapters: 21, aliases: ["john", "jn", "joh"] },
  { code: "ACT", name: "Acts", testament: "NT", chapters: 28, aliases: ["acts", "ac"] },
  { code: "ROM", name: "Romans", testament: "NT", chapters: 16, aliases: ["ro", "rm"] },
  { code: "1CO", name: "1 Corinthians", testament: "NT", chapters: 16, aliases: ["1cor", "1c"] },
  { code: "2CO", name: "2 Corinthians", testament: "NT", chapters: 13, aliases: ["2cor", "2c"] },
  { code: "GAL", name: "Galatians", testament: "NT", chapters: 6, aliases: ["ga"] },
  { code: "EPH", name: "Ephesians", testament: "NT", chapters: 6, aliases: ["ep"] },
  { code: "PHP", name: "Philippians", testament: "NT", chapters: 4, aliases: ["phil", "pp"] },
  { code: "COL", name: "Colossians", testament: "NT", chapters: 4, aliases: ["cl"] },
  { code: "1TH", name: "1 Thessalonians", testament: "NT", chapters: 5, aliases: ["1thess", "1thes"] },
  { code: "2TH", name: "2 Thessalonians", testament: "NT", chapters: 3, aliases: ["2thess", "2thes"] },
  { code: "1TI", name: "1 Timothy", testament: "NT", chapters: 6, aliases: ["1tim", "1tm"] },
  { code: "2TI", name: "2 Timothy", testament: "NT", chapters: 4, aliases: ["2tim", "2tm"] },
  { code: "TIT", name: "Titus", testament: "NT", chapters: 3, aliases: ["ti"] },
  { code: "PHM", name: "Philemon", testament: "NT", chapters: 1, aliases: ["phlm", "philem", "pm"] },
  { code: "HEB", name: "Hebrews", testament: "NT", chapters: 13, aliases: ["hbr"] },
  { code: "JAS", name: "James", testament: "NT", chapters: 5, aliases: ["james", "jam", "jm"] },
  { code: "1PE", name: "1 Peter", testament: "NT", chapters: 5, aliases: ["1pet", "1pt", "1p"] },
  { code: "2PE", name: "2 Peter", testament: "NT", chapters: 3, aliases: ["2pet", "2pt", "2p"] },
  { code: "1JN", name: "1 John", testament: "NT", chapters: 5, aliases: ["1john", "1jo", "1j"] },
  { code: "2JN", name: "2 John", testament: "NT", chapters: 1, aliases: ["2john", "2jo", "2j"] },
  { code: "3JN", name: "3 John", testament: "NT", chapters: 1, aliases: ["3john", "3jo", "3j"] },
  { code: "JUD", name: "Jude", testament: "NT", chapters: 1, aliases: ["jude", "jd"] },
  { code: "REV", name: "Revelation", testament: "NT", chapters: 22, aliases: ["rev", "revelations", "rv", "apocalypse"] },
] as const satisfies readonly RawBook[];

export type BookCode = (typeof BOOK_TABLE)[number]["code"];

export interface BookMeta {
  readonly code: BookCode;
  /** Canonical order index, 0-65. */
  readonly order: number;
  readonly name: string;
  readonly testament: Testament;
  readonly chapters: number;
}

/** Canonical order, Genesis first. */
export const BOOK_ORDER: readonly BookCode[] = BOOK_TABLE.map((b) => b.code);

export const BOOK_CODES: Readonly<Record<BookCode, BookMeta>> = Object.freeze(
  Object.fromEntries(
    BOOK_TABLE.map((b, index) => [
      b.code,
      Object.freeze({
        code: b.code,
        order: index,
        name: b.name,
        testament: b.testament,
        chapters: b.chapters,
      }),
    ]),
  ) as Record<BookCode, BookMeta>,
);

export function isBookCode(value: unknown): value is BookCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(BOOK_CODES, value);
}

export function bookMeta(code: BookCode): BookMeta {
  return BOOK_CODES[code];
}

export const BookCodeSchema = z.enum(BOOK_ORDER as unknown as [BookCode, ...BookCode[]]);

// ---------------------------------------------------------------------------
// Verse IDs
// ---------------------------------------------------------------------------

export type VerseId = `${BookCode}.${number}.${number}`;

export interface VerseRef {
  book: BookCode;
  chapter: number;
  verse: number;
}

const VERSE_ID_PATTERN = /^([A-Z0-9]{3})\.(\d{1,3})\.(\d{1,3})$/;

/** Parses `JHN.1.1`. Returns null for anything else, never throws. */
export function parseVerseId(value: string): VerseRef | null {
  const match = VERSE_ID_PATTERN.exec(value);
  if (!match) return null;
  const [, rawBook, rawChapter, rawVerse] = match;
  if (rawBook === undefined || rawChapter === undefined || rawVerse === undefined) return null;
  if (!isBookCode(rawBook)) return null;
  const chapter = Number(rawChapter);
  const verse = Number(rawVerse);
  if (chapter < 1 || chapter > BOOK_CODES[rawBook].chapters) return null;
  if (verse < 1) return null;
  return { book: rawBook, chapter, verse };
}

export function formatVerseId(ref: VerseRef): VerseId;
export function formatVerseId(book: BookCode, chapter: number, verse: number): VerseId;
export function formatVerseId(
  refOrBook: VerseRef | BookCode,
  chapter?: number,
  verse?: number,
): VerseId {
  if (typeof refOrBook === "string") {
    return `${refOrBook}.${chapter as number}.${verse as number}`;
  }
  return `${refOrBook.book}.${refOrBook.chapter}.${refOrBook.verse}`;
}

export function isVerseId(value: unknown): value is VerseId {
  return typeof value === "string" && parseVerseId(value) !== null;
}

export const VerseIdSchema = z.custom<VerseId>((value) => isVerseId(value), {
  message: "Expected a verse id such as JHN.1.1",
});

/** Human-readable form for display and share text: `1 Corinthians 14:34`. */
export function formatDisplayRef(ref: VerseRef): string {
  return `${BOOK_CODES[ref.book].name} ${ref.chapter}:${ref.verse}`;
}

export function compareVerseRefs(a: VerseRef, b: VerseRef): number {
  const bookDelta = BOOK_CODES[a.book].order - BOOK_CODES[b.book].order;
  if (bookDelta !== 0) return bookDelta;
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  return a.verse - b.verse;
}

// ---------------------------------------------------------------------------
// Verse ranges (used by evidence refs, pericope spans, movement steps)
// ---------------------------------------------------------------------------

export interface VerseRange {
  book: BookCode;
  start: { chapter: number; verse: number };
  end: { chapter: number; verse: number };
}

/**
 * Accepts a single verse id or a range in three shorthands:
 *   `1CO.14.34`              single verse
 *   `1CO.14.34-35`           same chapter
 *   `1CO.14.26-14.40`        chapter.verse tail
 *   `1CO.14.34-1CO.14.35`    fully qualified
 * Returns null if the end precedes the start or the books disagree.
 */
export function parseVerseRef(value: string): VerseRange | null {
  if (typeof value !== "string") return null;
  const [rawStart, rawEnd, ...rest] = value.split("-");
  if (rawStart === undefined || rest.length > 0) return null;

  const start = parseVerseId(rawStart);
  if (!start) return null;

  if (rawEnd === undefined) {
    return {
      book: start.book,
      start: { chapter: start.chapter, verse: start.verse },
      end: { chapter: start.chapter, verse: start.verse },
    };
  }

  let end: VerseRef | null = null;
  if (/^\d{1,3}$/.test(rawEnd)) {
    end = { book: start.book, chapter: start.chapter, verse: Number(rawEnd) };
  } else if (/^\d{1,3}\.\d{1,3}$/.test(rawEnd)) {
    const [chapter, verse] = rawEnd.split(".");
    end = { book: start.book, chapter: Number(chapter), verse: Number(verse) };
  } else {
    const parsed = parseVerseId(rawEnd);
    if (parsed && parsed.book === start.book) end = parsed;
  }
  if (!end) return null;
  if (end.verse < 1 || end.chapter < 1 || end.chapter > BOOK_CODES[start.book].chapters) return null;
  if (compareVerseRefs(start, end) > 0) return null;

  return {
    book: start.book,
    start: { chapter: start.chapter, verse: start.verse },
    end: { chapter: end.chapter, verse: end.verse },
  };
}

export function isVerseRefString(value: unknown): value is string {
  return typeof value === "string" && parseVerseRef(value) !== null;
}

/** Pericope ids look like `1CO.14.26-14.40`: a fully explicit range. */
export function formatPericopeId(book: BookCode, start: VerseRef, end: VerseRef): string {
  return `${book}.${start.chapter}.${start.verse}-${end.chapter}.${end.verse}`;
}

export function isPericopeId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^[A-Z0-9]{3}\.\d{1,3}\.\d{1,3}-\d{1,3}\.\d{1,3}$/.test(value)) return false;
  return parseVerseRef(value) !== null;
}

export const PericopeIdSchema = z.custom<string>((value) => isPericopeId(value), {
  message: "Expected a pericope id such as 1CO.14.26-14.40",
});

/** Book of a verse id, pericope id, or range, without full parsing. */
export function bookOfRef(value: string): BookCode | null {
  const code = value.slice(0, 3);
  return isBookCode(code) ? code : null;
}

// ---------------------------------------------------------------------------
// Human input parsing
// ---------------------------------------------------------------------------

const LEADING_NUMBER_WORDS: Readonly<Record<string, string>> = Object.freeze({
  i: "1",
  ii: "2",
  iii: "3",
  first: "1",
  second: "2",
  third: "3",
  "1st": "1",
  "2nd": "2",
  "3rd": "3",
});

/**
 * Normalizes a book name the same way for the alias table and for user input:
 * lowercase, punctuation dropped, leading ordinal words and roman numerals
 * folded to digits, spaces removed. "1 Cor." / "I Corinthians" / "1co" all
 * collapse to comparable keys.
 */
function normalizeBookName(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return "";
  const first = tokens[0];
  if (first !== undefined && tokens.length > 1) {
    const mapped = LEADING_NUMBER_WORDS[first];
    if (mapped !== undefined) tokens[0] = mapped;
  }
  return tokens.join("");
}

const aliasMap = new Map<string, BookCode>();
const aliasConflicts: string[] = [];

for (const book of BOOK_TABLE) {
  const keys = new Set<string>([
    normalizeBookName(book.code),
    normalizeBookName(book.name),
    ...book.aliases.map(normalizeBookName),
  ]);
  for (const key of keys) {
    if (key.length === 0) continue;
    const existing = aliasMap.get(key);
    if (existing !== undefined && existing !== book.code) {
      aliasConflicts.push(`${key}: ${existing} vs ${book.code}`);
      continue;
    }
    aliasMap.set(key, book.code);
  }
}

/** Non-empty only if two books claim the same alias. Asserted empty in tests. */
export const BOOK_ALIAS_CONFLICTS: readonly string[] = Object.freeze(aliasConflicts);

export function lookupBook(input: string): BookCode | null {
  return aliasMap.get(normalizeBookName(input)) ?? null;
}

export interface Reference {
  book: BookCode;
  chapter: number;
  verse?: number;
}

const REFERENCE_PATTERN = /^\s*(.+?)\s*(\d{1,3})(?:\s*[:.\s]\s*(\d{1,3}))?\s*$/;

/**
 * Forgiving human input to a reference: "John 3:16", "john 3 16", "Jn 3:16",
 * "1 Cor 14:34", "1co 14 34", "Genesis 1", "Rev 13:18".
 *
 * Table-driven on the alias map above. Returns null rather than guessing:
 * an unknown book, an out-of-range chapter, or a zero chapter/verse all fail.
 * A bare book name resolves to its first chapter ("Genesis" -> Genesis 1), and
 * in single-chapter books a lone number is read as a verse ("Jude 5").
 */
export function parseReference(input: string): Reference | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const bareBook = lookupBook(trimmed);
  if (bareBook !== null) return { book: bareBook, chapter: 1 };

  const match = REFERENCE_PATTERN.exec(trimmed);
  if (!match) return null;
  const [, rawBook, rawChapter, rawVerse] = match;
  if (rawBook === undefined || rawChapter === undefined) return null;

  const book = lookupBook(rawBook);
  if (book === null) return null;

  const meta = BOOK_CODES[book];
  let chapter = Number(rawChapter);
  let verse = rawVerse === undefined ? undefined : Number(rawVerse);

  // "Jude 5" / "Obadiah 12": one-chapter books take the number as a verse.
  if (meta.chapters === 1 && verse === undefined && chapter > 1) {
    verse = chapter;
    chapter = 1;
  }

  if (chapter < 1 || chapter > meta.chapters) return null;
  if (verse !== undefined && verse < 1) return null;

  return verse === undefined ? { book, chapter } : { book, chapter, verse };
}
