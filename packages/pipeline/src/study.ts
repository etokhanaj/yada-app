/**
 * `yada package study` — the study layer: Tyndale Open Study Notes and OpenBible.info
 * cross-references, one file per book (`study-jhn.vN.db`, DDL in @yada/schema study.ts), each
 * downloaded on demand like a translation. The whole Bible in one file was 14.2 MB, most of it
 * cross-references a reader of one book never opens.
 *
 * John's decision: these are shown verbatim with attribution and are not reviewed in Yada's
 * review tool, because they are never Yada's explanations. So nothing here is generated or
 * rewritten, and nothing here goes near staging.db: the files are read straight from content/raw,
 * as translations.ts does, so the notes cannot reach a prompt, the adversary or regression. That
 * matters twice over for Tyndale, whose excerpts quote the NLT (CLAUDE.md rule 9). No parse or
 * Strong's number is read from either source (rule 4).
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  BOOK_ORDER,
  STUDY_DDL,
  STUDY_FORMAT,
  StudyInfoSchema,
  XREFS_PER_VERSE,
  type BookCode,
  type NoteKind,
  type StudyInfo,
  bookOfOrd,
  compareXrefs,
  parseVerseId,
  studyBookFileName,
  studyBookName,
  unknownStudyTags,
  verseOrd,
} from "@yada/schema";

import { parseVpl } from "./english.js";
import { BUNDLES, freshDb, highestVersionOnDisk, sha256File } from "./package.js";
import { RAW } from "./paths.js";
import { SOURCES, type SourceDef } from "./sources.js";
import { REFERENCE_VPL, gzipTranslation } from "./translations.js";

/** Both sources list the 66 books in Yada's order, each with its own abbreviations. */
function bookTable(codes: readonly string[]): ReadonlyMap<string, BookCode> {
  if (codes.length !== BOOK_ORDER.length) throw new Error("a book table must list all 66 books");
  return new Map(codes.map((code, i) => [code, BOOK_ORDER[i] as BookCode]));
}

// Read from the files: every abbreviation either source uses, and no others.
const TOSN_BOOKS = bookTable(
  ("Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Pr Eccl Song Isa Jer " +
    "Lam Ezek Dan Hos Joel Amos Obad Jon Mic Nah Hab Zeph Hagg Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal " +
    "Eph Phil Col 1Thes 2Thes 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1Jn 2Jn 3Jn Jude Rev").split(" "),
);
const OSIS_BOOKS = bookTable(
  ("Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer " +
    "Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal " +
    "Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev").split(" "),
);

export class StudyRefused extends Error {}

export interface OrdRange {
  start: number;
  end: number;
}

function ord(books: ReadonlyMap<string, BookCode>, book: string, chapter: string, verse: string, raw: string): number {
  const code = books.get(book);
  if (code === undefined) throw new StudyRefused(`unknown book ${book} in ${raw}`);
  return verseOrd(code, Number(chapter), Number(verse));
}

function checked(range: OrdRange, raw: string): OrdRange {
  if (range.end < range.start) throw new StudyRefused(`${raw} ends before it starts`);
  return range;
}

/** Tyndale's `<refs>`: `Gen.1.1`, `Gen.1.1-3` or `Gen.1.1-2.3`. A range never crosses a book. */
export function tosnRange(raw: string): OrdRange {
  const match = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-(?:(\d+)\.)?(\d+))?$/.exec(raw);
  if (match === null) throw new StudyRefused(`unreadable Tyndale reference ${raw}`);
  const [, book = "", chapter = "", verse = "", endChapter, endVerse] = match;
  const start = ord(TOSN_BOOKS, book, chapter, verse, raw);
  const end = endVerse === undefined ? start : ord(TOSN_BOOKS, book, endChapter ?? chapter, endVerse, raw);
  return checked({ start, end }, raw);
}

/** OpenBible's OSIS references: `Gen.1.1`, or `Col.1.16-Col.1.17`, which may cross books. */
export function osisRange(raw: string): OrdRange {
  const one = (ref: string): number => {
    const match = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/.exec(ref);
    if (match === null) throw new StudyRefused(`unreadable OSIS reference ${raw}`);
    return ord(OSIS_BOOKS, match[1] ?? "", match[2] ?? "", match[3] ?? "", raw);
  };
  const [from = "", to, ...rest] = raw.split("-");
  if (rest.length > 0) throw new StudyRefused(`unreadable OSIS reference ${raw}`);
  const start = one(from);
  return checked({ start, end: to === undefined ? start : one(to) }, raw);
}

// ---------------------------------------------------------------------------
// Tyndale XML -> note fragment
// ---------------------------------------------------------------------------

/** Span classes from _classes.txt, mapped to the study bundle's tags. `null` keeps the text only. */
const SPAN_TAGS: Readonly<Record<string, string | null>> = {
  "sn-excerpt": "x",
  // Roman inside an italic excerpt; the excerpt tag already marks the words as quoted.
  "sn-excerpt-roman": null,
  "sn-excerpt-sc": "sc",
  "sn-excerpt-divine-name": "sc",
  "sn-ref": "b",
  "sn-ref-sc": "sc",
  "sn-sc": "sc",
  "sn-hebrew-chars": null,
  "intro-h2": "b",
  "intro-h2-sc": "sc",
  "intro-h2-era": "sc",
  ital: "i",
  "ital-bold": "i",
  bold: "b",
  "bold-sc": "b",
  "bold-era": "b",
  sc: "sc",
  "sc-ital": "sc",
  "divine-name": "sc",
  "divine-name-ital": "sc",
  era: "sc",
  greek: "i",
  hebrew: "i",
  aramaic: "i",
  latin: "i",
  sup: null,
  sub: null,
};

/** Paragraph classes that are headings: titles, subheads, and the "for further study" titles. */
const HEADING = /-(title|h1|h2)$|^intro-sidebar-h1$/;

/** One paragraph's inline XML as a fragment. Unknown markup is refused, never dropped silently. */
export function tosnInline(xml: string): string {
  const stack: Array<string | null> = [];
  // Two one-off forms in StudyNotes.xml: `<x2002/>`, an en space after Num 20:1's label, and an
  // empty `<span class="ital"/>`.
  const cleaned = xml.replace(/<x2002\/>/g, " ").replace(/<span class="[^"]+"\/>/g, "");
  return cleaned.replace(/<span class="([^"]+)">|<\/span>|<a [^>]*>|<\/a>|<[^>]*>/g, (tag, cls: string | undefined) => {
    if (cls !== undefined) {
      if (!(cls in SPAN_TAGS)) throw new StudyRefused(`unknown Tyndale span class ${cls}`);
      const mapped = SPAN_TAGS[cls] ?? null;
      stack.push(mapped);
      return mapped === null ? "" : `<${mapped}>`;
    }
    if (tag === "</span>") {
      if (stack.length === 0) throw new StudyRefused("unbalanced </span> in a Tyndale note");
      const mapped = stack.pop() ?? null;
      return mapped === null ? "" : `</${mapped}>`;
    }
    // A reference link: its text stays, the link goes.
    if (tag.startsWith("<a ") || tag === "</a>") return "";
    throw new StudyRefused(`unknown Tyndale markup ${tag}`);
  });
}

export function tosnBody(body: string): string {
  const paragraphs: string[] = [];
  let paragraphsSeen = 0;
  // Some paragraphs carry a typesetting attribute after the class (John 1:1-18's `ts="…"`).
  for (const match of body.matchAll(/<p class="([^"]+)"[^>]*>([\s\S]*?)<\/p>/g)) {
    paragraphsSeen += 1;
    const text = tosnInline(match[2] ?? "").replace(/\s+/g, " ").trim();
    if (text === "") continue;
    paragraphs.push(HEADING.test(match[1] ?? "") ? `<h>${text}</h>` : text);
  }
  if (paragraphsSeen !== (body.match(/<p[ >]/g) ?? []).length) throw new StudyRefused("a Tyndale paragraph was not read");
  const fragment = paragraphs.join("\n");
  const unknown = unknownStudyTags(fragment);
  if (unknown.length > 0) throw new StudyRefused(`note fragment carries tags ${unknown.join(", ")}`);
  return fragment;
}

export interface StudyNote {
  /** Tyndale's own item name, e.g. `Gen.1.1-2.3` or `AdamAndEve`. */
  name: string;
  kind: NoteKind;
  title: string | null;
  start: number;
  end: number;
  text: string;
}

/**
 * The kind comes from the file, not the item's `typename`: ThemeNotes.xml has one article ("The
 * Church") typed `Profile`, but it is a theme article, and the package's CONTENTS.txt counts 299
 * theme articles, which only holds if it is one.
 */
export const TOSN_KINDS: Readonly<Record<string, NoteKind>> = {
  "tosn-StudyNotes.xml": "note",
  "tosn-BookIntros.xml": "intro",
  "tosn-BookIntroSummaries.xml": "intro_summary",
  "tosn-Profiles.xml": "profile",
  "tosn-ThemeNotes.xml": "theme",
};

const decodeTitle = (title: string): string =>
  title.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();

export function parseTosn(xml: string, kind: NoteKind): StudyNote[] {
  const notes: StudyNote[] = [];
  for (const item of xml.matchAll(/<item name="([^"]*)"[^>]*>([\s\S]*?)<\/item>/g)) {
    const name = item[1] ?? "";
    const inner = item[2] ?? "";
    const refs = /<refs>([^<]*)<\/refs>/.exec(inner)?.[1];
    const body = /<body>([\s\S]*?)<\/body>/.exec(inner)?.[1];
    if (refs === undefined || body === undefined) throw new StudyRefused(`Tyndale item ${name} has no refs or body`);
    const title = /<title>([\s\S]*?)<\/title>/.exec(inner)?.[1];
    const range = tosnRange(refs.trim());
    const text = tosnBody(body);
    if (text === "") throw new StudyRefused(`Tyndale item ${name} has no text`);
    notes.push({ name, kind, title: title === undefined ? null : decodeTitle(title), ...range, text });
  }
  return notes;
}

// ---------------------------------------------------------------------------
// OpenBible cross-references
// ---------------------------------------------------------------------------

export interface CrossReference {
  from: number;
  toStart: number;
  toEnd: number;
  votes: number;
}

export interface XrefParse {
  /** The header's licence comment, e.g. `#www.openbible.info CC-BY 2026-10-05`. */
  notice: string;
  xrefs: CrossReference[];
  /** Rows readers voted below zero; left out. */
  downvoted: number;
}

export function parseOpenBible(text: string): XrefParse {
  const lines = text.split(/\r?\n/);
  const header = lines[0] ?? "";
  const notice = header.split("\t").find((cell) => cell.startsWith("#"));
  if (!header.startsWith("From Verse\tTo Verse\tVotes") || notice === undefined) {
    throw new StudyRefused("the cross-reference file has lost its header or its licence comment");
  }
  const xrefs: CrossReference[] = [];
  let downvoted = 0;
  for (const line of lines.slice(1)) {
    if (line.trim() === "") continue;
    const [from = "", to = "", votes = ""] = line.split("\t");
    if (!/^-?\d+$/.test(votes)) throw new StudyRefused(`unreadable vote count in: ${line}`);
    if (Number(votes) < 0) {
      downvoted += 1;
      continue;
    }
    const source = osisRange(from);
    if (source.end !== source.start) throw new StudyRefused(`a cross-reference from a range: ${line}`);
    const target = osisRange(to);
    xrefs.push({ from: source.start, toStart: target.start, toEnd: target.end, votes: Number(votes) });
  }
  return { notice: notice.slice(1).trim(), xrefs, downvoted };
}

// ---------------------------------------------------------------------------
// Packaging: one file per book
// ---------------------------------------------------------------------------

export interface StudyBookReport {
  info: StudyInfo;
  reused: boolean;
  notes: Record<NoteKind, number>;
}

export interface StudyReport {
  books: StudyBookReport[];
  /** Where the manifest entries were written; content/bundles/manifest.json is never touched. */
  fragment: string;
  bytes: number;
  gzipBytes: number;
  notes: Record<NoteKind, number>;
  /** Books with at least one verse note (kind `note`), in canonical order. */
  noteBooks: BookCode[];
  /** Cross-references read from the file, before the per-verse cut. */
  xrefsRead: number;
  /** Cross-references shipped: the XREFS_PER_VERSE best per verse. */
  xrefsKept: number;
  downvoted: number;
  /** References whose first or last verse is not in the English versification (KJV verse list). */
  outsideVersification: { notes: string[]; xrefs: number };
}

export interface PackageStudyOptions {
  rawDir?: string;
  outDir?: string;
  /** Only these books (tests); the fragment then lists only them. */
  books?: readonly BookCode[];
}

/**
 * The manifest entries, beside the files. Publishing them means merging this into manifest.json,
 * which John does: a manifest entry is what publish uploads and every phone then offers.
 */
export const STUDY_FRAGMENT = "study.manifest-fragment.json";

function sourceDef(key: string): SourceDef {
  const def = SOURCES.find((s) => s.key === key);
  const sha = def?.files[0]?.sha256;
  if (def === undefined || sha === undefined) throw new StudyRefused(`${key} has no source entry pinned by digest`);
  return def;
}

function read(rawDir: string, file: string): string {
  const full = path.join(rawDir, file);
  if (!existsSync(full)) throw new StudyRefused(`${file} is not in ${rawDir}; run \`yada ingest\``);
  return readFileSync(full, "utf8");
}

const emptyCounts = (): Record<NoteKind, number> => ({ note: 0, intro: 0, intro_summary: 0, profile: 0, theme: 0 });

/** The `perVerse` best-voted references from each verse, in the order Understand lists them. */
export function topXrefs(xrefs: readonly CrossReference[], perVerse: number = XREFS_PER_VERSE): CrossReference[] {
  const byVerse = new Map<number, CrossReference[]>();
  for (const x of xrefs) {
    const list = byVerse.get(x.from) ?? [];
    list.push(x);
    byVerse.set(x.from, list);
  }
  const ranked = (x: CrossReference) => ({ to_ord_start: x.toStart, to_ord_end: x.toEnd, votes: x.votes });
  return [...byVerse.keys()]
    .sort((a, b) => a - b)
    .flatMap((from) => (byVerse.get(from) ?? []).sort((a, b) => compareXrefs(ranked(a), ranked(b))).slice(0, perVerse));
}

function bookOf(ord: number): BookCode {
  const code = bookOfOrd(ord);
  if (code === undefined) throw new StudyRefused(`verse ord ${ord} is in no book`);
  return code;
}

export function packageStudy(options: PackageStudyOptions = {}): StudyReport {
  const rawDir = options.rawDir ?? RAW;
  const outDir = options.outDir ?? BUNDLES;
  const tosn = sourceDef("tosn");
  const openbible = sourceDef("openbible-xrefs");

  // The licence statement comes from the package, every time (CLAUDE.md rule 3).
  const tosnNotice = read(rawDir, "tosn-README.txt").replace(/\r\n/g, "\n").trim();
  const licenceIn = tosn.files[0]?.licenseIn?.mustContain ?? "";
  if (!tosnNotice.includes(licenceIn)) throw new StudyRefused("tosn-README.txt no longer states CC BY-SA 4.0");

  const notes: StudyNote[] = [];
  for (const [file, kind] of Object.entries(TOSN_KINDS)) notes.push(...parseTosn(read(rawDir, file), kind));
  const xrefFile = openbible.files[0]?.file ?? "";
  const parsed = parseOpenBible(read(rawDir, xrefFile));
  if (!parsed.notice.includes("CC-BY")) throw new StudyRefused(`${xrefFile} no longer states CC-BY`);

  const english = new Set<number>();
  const referencePath = path.join(rawDir, REFERENCE_VPL);
  if (existsSync(referencePath)) {
    for (const verse of parseVpl(referencePath, "KJV")) {
      const ref = parseVerseId(verse.verse_id);
      if (ref !== null) english.add(verseOrd(ref.book, ref.chapter, ref.verse));
    }
  }
  const outside = (start: number, end: number): boolean => english.size > 0 && (!english.has(start) || !english.has(end));

  // A note is filed under its first verse's book; one that ran into the next book would be cut
  // off from the verses it covers there. tosnRange already refuses that; this holds the split to it.
  for (const note of notes) {
    if (bookOf(note.start) !== bookOf(note.end)) throw new StudyRefused(`Tyndale item ${note.name} crosses books`);
  }
  // Canonical order, then the wider passage first, so a reader meets 1:1–2:3 before 1:1.
  notes.sort((a, b) => a.start - b.start || b.end - a.end || a.kind.localeCompare(b.kind));
  const kept = topXrefs(parsed.xrefs);

  mkdirSync(outDir, { recursive: true });
  const only = options.books === undefined ? null : new Set(options.books);
  const included = (code: BookCode): boolean => only === null || only.has(code);
  const sources: SourceRowInput[] = [
    { id: 1, def: tosn, notice: tosnNotice },
    { id: 2, def: openbible, notice: parsed.notice },
  ];
  const books: StudyBookReport[] = [];
  for (const code of BOOK_ORDER) {
    if (!included(code)) continue;
    const bookNotes = notes.filter((n) => bookOf(n.start) === code);
    const bookXrefs = kept.filter((x) => bookOf(x.from) === code);
    if (bookNotes.length === 0 && bookXrefs.length === 0) continue;
    books.push(writeBook(outDir, code, bookNotes, bookXrefs, sources));
  }

  const fragment = path.join(outDir, STUDY_FRAGMENT);
  writeFileSync(fragment, `${JSON.stringify({ study: books.map((b) => b.info) }, null, 2)}\n`);

  const counts = emptyCounts();
  for (const note of notes) if (included(bookOf(note.start))) counts[note.kind] += 1;
  const noteBooks = new Set(notes.filter((n) => n.kind === "note").map((n) => bookOf(n.start)));
  return {
    books,
    fragment,
    bytes: books.reduce((sum, b) => sum + b.info.bytes, 0),
    gzipBytes: books.reduce((sum, b) => sum + b.info.download_bytes, 0),
    notes: counts,
    noteBooks: BOOK_ORDER.filter((b) => noteBooks.has(b) && included(b)),
    xrefsRead: parsed.xrefs.length,
    xrefsKept: books.reduce((sum, b) => sum + b.info.xrefs, 0),
    downvoted: parsed.downvoted,
    outsideVersification: {
      notes: notes.filter((n) => outside(n.start, n.end)).map((n) => n.name),
      xrefs: kept.filter((x) => outside(x.from, x.from) || outside(x.toStart, x.toEnd)).length,
    },
  };
}

interface SourceRowInput {
  id: number;
  def: SourceDef;
  notice: string;
}

function writeBook(
  outDir: string,
  code: BookCode,
  notes: readonly StudyNote[],
  xrefs: readonly CrossReference[],
  sources: readonly SourceRowInput[],
): StudyBookReport {
  const name = studyBookName(code);
  const tmp = path.join(outDir, `${name}.building.db`);
  const out = freshDb(tmp, STUDY_DDL);
  out.exec("BEGIN");
  const meta = out.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  meta.run("format", String(STUDY_FORMAT));
  meta.run("book", code);
  meta.run("review", "none: third-party notes shown verbatim with attribution, never Yada's explanations");

  // Both rows in every file: each file is downloaded alone, so each carries the full notices.
  const insertSource = out.prepare(
    "INSERT INTO sources (id, key, name, license, license_notice, attribution, homepage, sha256, modifications) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const { id, def, notice } of sources) {
    insertSource.run(id, def.key, def.dataset, def.license, notice, def.attribution_text, def.homepage, def.files[0]?.sha256 ?? "", def.modifications);
  }
  const insertNote = out.prepare("INSERT INTO notes (ord_start, ord_end, kind, title, text, source) VALUES (?, ?, ?, ?, ?, 1)");
  for (const note of notes) insertNote.run(note.start, note.end, note.kind, note.title, note.text);
  const insertXref = out.prepare("INSERT INTO xrefs (from_ord, to_ord_start, to_ord_end, votes) VALUES (?, ?, ?, ?)");
  for (const x of xrefs) insertXref.run(x.from, x.toStart, x.toEnd, x.votes);
  out.exec("COMMIT");
  out.exec("VACUUM");
  out.close();

  // Same immutability rule as every bundle: unchanged bytes keep the file, changed bytes get a
  // version above anything on disk.
  const sha = sha256File(tmp);
  const highest = highestVersionOnDisk(name, outDir);
  const reused = highest > 0 && sha256File(path.join(outDir, studyBookFileName(code, highest))) === sha;
  const version = reused ? highest : highest + 1;
  const file = studyBookFileName(code, version);
  if (reused) rmSync(tmp);
  else renameSync(tmp, path.join(outDir, file));
  const full = path.join(outDir, file);

  const counts = emptyCounts();
  for (const note of notes) counts[note.kind] += 1;
  const info = StudyInfoSchema.parse({
    book: code,
    version,
    file,
    sha256: sha,
    bytes: statSync(full).size,
    // What publish uploads, Content-Encoding gzip, exactly as for translations.
    download_bytes: gzipTranslation(readFileSync(full)).length,
    format: STUDY_FORMAT,
    licenses: [...new Set(sources.map((s) => s.def.license))],
    notes: notes.length,
    xrefs: xrefs.length,
  });
  return { info, reused, notes: counts };
}
