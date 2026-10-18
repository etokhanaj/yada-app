/**
 * `yada understand <BOOK>`: one book's Understand without AI (docs/no-ai-understand.md), the verse
 * layers and the passage summaries, written to content/bundles/understand-<book>.vN.db with every
 * source's licence and "adapted" credit. Nothing is published: R2 is John's step, run when he says.
 *
 * Inputs, all read straight from YADA_ROOT/content (never staging.db, never a prompt):
 * - raw/uw-ust, uw-tn, uw-tq, uw-tw, uw-twl, uw-obs (unfoldingWord, CC BY-SA 4.0, LICENSE.md re-read);
 * - raw/bsb-tables/bsb_tables.tsv (Berean, public domain per berean.bible/licensing);
 * - bundles/core.vN.db (BSB, WEB, KJV, LSV only), speakers.vN.db (Glyssen), study-<book>.vN.db
 *   (Tyndale, CC BY-SA 4.0) and <book>.vN.db for the book's own pericopes.
 *
 * Rule 9: no licensed translation is read here. Core's texts are queried by name, the four public-
 * domain ones only, and Tyndale's NLT words stay marked as Study notes mark them.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { BOOK_ORDER, isBookCode, UNDERSTAND_FORMAT, UnderstandInfoSchema, understandFileName, type UnderstandInfo } from "@yada/schema";

import { REPO_ROOT } from "../paths.js";
import { gzipTranslation } from "../translations.js";
import { freshDb, highestVersionOnDisk, sha256File } from "../package.js";
import { STOP_SHARE, overStop, type Debate, type PassageReview, type Kinds, type Letters, type PassageBookData, type PassageResult, type Pericope, type PlainWords, type Prophets } from "./passage.js";
import { passageReport, summariseBook, type PassageReport } from "./summaries.js";
import {
  CREDITS,
  PUBLIC_DOMAIN_TEXTS,
  UW_SOURCES,
  UnderstandRefused,
  bookCodeByName,
  bsbTables,
  checkUwLicence,
  obsStories,
  parsePins,
  readIfExists,
  tnBookOutline,
  tnNumberedItems,
  cleanTitle,
  tnGuides,
  tnRows,
  tqAnswers,
  tqRows,
  twArticle,
  twLinkPath,
  twlRows,
  ustFile,
  ustSpeakers,
  ustVerses,
  vk,
  type BookTables,
  type PublicDomainText,
  type TwArticle,
  type OutlineSection,
  type VerseKey,
} from "./sources.js";
import { introFor, introMeta, readIntros, readTyndale, type IntroResult } from "./intro.js";
import { splitLines } from "./text.js";
import { writeBundleExtras, type ExtrasReport } from "./bundleExtras.js";
import { LEAKS, assemble, beginnerText, derive, isMissing, type Assembled, type BookData, type StudyNote } from "./verse.js";
import { MHC_DIR, mhcSections } from "./matthewHenry.js";


export const UNDERSTAND_DDL = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE sources (
  key            TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  license        TEXT NOT NULL,
  license_notice TEXT NOT NULL,
  credit         TEXT NOT NULL,
  original       TEXT,
  sha256         TEXT
);
CREATE TABLE verses (
  ord       INTEGER PRIMARY KEY,
  verse_id  TEXT NOT NULL UNIQUE,
  missing   INTEGER NOT NULL CHECK (missing IN (0, 1)),
  section   TEXT,
  layers    TEXT NOT NULL
);
CREATE TABLE passages (
  passage_id      TEXT PRIMARY KEY,
  label           TEXT NOT NULL,
  start_ord       INTEGER NOT NULL,
  end_ord         INTEGER NOT NULL,
  headline        TEXT NOT NULL,
  headline_kind   TEXT NOT NULL CHECK (headline_kind IN ('What happens', 'Part of', 'Genealogy', 'Topic', 'What John sees')),
  mode            TEXT NOT NULL,
  headline_source TEXT,
  headline_status TEXT,
  summary         TEXT NOT NULL,
  sentences       TEXT NOT NULL,
  credit          TEXT NOT NULL,
  speakers        TEXT NOT NULL,
  facts           TEXT NOT NULL,
  psalm_lead      TEXT NOT NULL,
  psalm_about     TEXT NOT NULL,
  debates         TEXT NOT NULL,
  awaiting        TEXT NOT NULL,
  purpose         TEXT,
  around          TEXT,
  also_told_in    TEXT NOT NULL,
  themes          TEXT NOT NULL,
  settings        TEXT NOT NULL,
  flags           TEXT NOT NULL,
  flagged         INTEGER NOT NULL CHECK (flagged IN (0, 1)),
  sample          INTEGER NOT NULL CHECK (sample IN (0, 1))
);
CREATE INDEX passages_by_range ON passages (start_ord, end_ord);
`;

/**
 * The tables John approves once (major debates, the prophets' plain names and settings). Tracked in git
 * beside the prototype, which reads the same files, so one edit changes both.
 */
export const UNDERSTAND_DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../prototypes/data");

export function readDebates(dir = UNDERSTAND_DATA): Debate[] {
  const parsed: unknown = JSON.parse(readFileSync(path.join(dir, "debates.json"), "utf8"));
  const entries = (parsed as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) throw new UnderstandRefused("debates.json has no entries list");
  return entries as Debate[];
}

export function readProphets(dir = UNDERSTAND_DATA): Prophets {
  const parsed = JSON.parse(readFileSync(path.join(dir, "prophets.json"), "utf8")) as Partial<Prophets>;
  if (typeof parsed.status !== "string" || parsed.plain_names === undefined || !Array.isArray(parsed.settings)) {
    throw new UnderstandRefused("prophets.json needs status, plain_names and settings");
  }
  return { status: parsed.status, plain_names: parsed.plain_names, settings: parsed.settings };
}

/** passage_reviews.json: John's holds and approvals of single passage summaries; only an approved table counts. */
export function readPassageReviews(dir = UNDERSTAND_DATA): ReadonlyMap<string, PassageReview> {
  const parsed = JSON.parse(readFileSync(path.join(dir, "passage_reviews.json"), "utf8")) as { status?: string; entries?: Record<string, PassageReview> };
  if (parsed.status !== "approved" || parsed.entries === undefined) return new Map();
  return new Map(Object.entries(parsed.entries));
}

/**
 * outline_ranges.json: the verses John matched to an outline that names none (Habakkuk). Each line must be
 * tN's item word for word: an edited tN refuses the build rather than show a line it no longer has.
 */
export function outlineRanges(book: string, tnText: string, dir = UNDERSTAND_DATA): OutlineSection[] {
  const parsed = JSON.parse(readFileSync(path.join(dir, "outline_ranges.json"), "utf8")) as {
    status?: string;
    entries?: Array<{ book: string; item: number; from: [number, number]; to: [number, number]; line: string }>;
  };
  if (parsed.status !== "approved" || !Array.isArray(parsed.entries)) return [];
  const items = tnNumberedItems(tnText);
  return parsed.entries
    .filter((e) => e.book === book)
    .map((e) => {
      if (items[e.item - 1] !== e.line) throw new UnderstandRefused(`outline_ranges.json: ${book} item ${e.item} is no longer "${e.line}" in tN`);
      return { c1: e.from[0], v1: e.from[1], c2: e.to[0], v2: e.to[1], line: cleanTitle(e.line) };
    });
}

/** kinds.json, letters.json and plain_words.json: John's tables for the modes by kind of writing. */
function readTable<T extends { status: string }>(dir: string, file: string, keys: readonly string[]): T {
  const parsed = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Record<string, unknown>;
  if (typeof parsed["status"] !== "string" || keys.some((k) => parsed[k] === undefined)) throw new UnderstandRefused(`${file} needs status, ${keys.join(", ")}`);
  return parsed as unknown as T;
}

export const readKinds = (dir = UNDERSTAND_DATA): Kinds => readTable<Kinds>(dir, "kinds.json", ["modes", "settings", "purposes", "voices"]);
export const readLetters = (dir = UNDERSTAND_DATA): Letters => readTable<Letters>(dir, "letters.json", ["letters"]);
export const readPlainWords = (dir = UNDERSTAND_DATA): PlainWords => readTable<PlainWords>(dir, "plain_words.json", ["ust_substitutions", "plain_words"]);


export interface UnderstandPaths {
  /** YADA_ROOT/content. */
  content: string;
  raw: string;
  bundles: string;
}

export function understandPaths(root = process.env["YADA_ROOT"] ?? REPO_ROOT): UnderstandPaths {
  const content = path.join(root, "content");
  return { content, raw: path.join(content, "raw"), bundles: path.join(content, "bundles") };
}

function latest(bundles: string, name: string): string | null {
  const v = highestVersionOnDisk(name, bundles);
  return v === 0 ? null : path.join(bundles, `${name}.v${v}.db`);
}

function need(file: string | null, what: string): string {
  if (file === null || !existsSync(file)) throw new UnderstandRefused(`${what} is missing`);
  return file;
}

// ---------------------------------------------------------------------------
// Loading a book
// ---------------------------------------------------------------------------

export interface LoadedBook {
  verses: BookData;
  passages: PassageBookData;
  /** Verses core has for the book, verse 0 (a psalm title, printed inside verse 1) left out. */
  verseList: Array<[number, number]>;
  sources: SourceRow[];
  /** The book introduction cut from Tyndale's opening paragraph or tN's front:intro (intro.ts), or why there is none. */
  intro: IntroResult;
  close: () => void;
}

export interface SourceRow {
  key: string;
  name: string;
  license: string;
  license_notice: string;
  credit: string;
  original: string | null;
  sha256: string | null;
}

/** The uW and Berean sources' licences and pins, read from their own files every build (rule 3). */
function sourceRows(paths: UnderstandPaths, verifyPins: boolean): SourceRow[] {
  const pins = new Map([
    ...parsePins(readIfExists(path.join(paths.raw, "uw.sha256")) ?? ""),
    ...parsePins(readIfExists(path.join(paths.raw, "sources-12oct.sha256")) ?? ""),
  ]);
  const rows: SourceRow[] = [];
  for (const s of UW_SOURCES) {
    const licence = readIfExists(path.join(paths.raw, s.dir, "LICENSE.md"));
    if (licence === null) throw new UnderstandRefused(`${s.dir}/LICENSE.md is missing`);
    const pin = pins.get(s.zip) ?? null;
    if (verifyPins) {
      const zip = path.join(paths.raw, s.zip);
      if (pin === null || !existsSync(zip) || sha256File(zip) !== pin) throw new UnderstandRefused(`${s.zip} does not match its pin`);
    }
    // Word Links carry no text of their own; Key words credit Translation Words.
    const credit = s.key === "twl" ? CREDITS.tw : CREDITS[s.key];
    rows.push({ key: s.key, name: s.name, license: "CC-BY-SA-4.0", license_notice: checkUwLicence(s, licence), credit, original: `The original work by unfoldingWord is available from ${s.original}`, sha256: pin });
  }
  const tablesPin = pins.get("bsb-tables/bsb_tables.tsv") ?? null;
  if (verifyPins && (tablesPin === null || sha256File(path.join(paths.raw, "bsb-tables/bsb_tables.tsv")) !== tablesPin)) {
    throw new UnderstandRefused("bsb-tables/bsb_tables.tsv does not match its pin");
  }
  rows.push({
    key: "bsb",
    name: "Berean Standard Bible translation tables",
    license: "public-domain",
    // The file has no notice of its own (docs/no-ai-understand.md: to be confirmed with the Berean team).
    license_notice: "berean.bible/licensing: “licensing is not required for any use”",
    credit: CREDITS.bsb,
    original: null,
    sha256: tablesPin,
  });
  return rows;
}

export function loadBook(book: string, options: { paths?: UnderstandPaths; verifyPins?: boolean; dataDir?: string } = {}): LoadedBook {
  const paths = options.paths ?? understandPaths();
  const raw = paths.raw;
  const sources = sourceRows(paths, options.verifyPins ?? true);

  const core = new DatabaseSync(need(latest(paths.bundles, "core"), "core bundle"), { readOnly: true });
  const names = new Map(core.prepare("SELECT code, name FROM books").all().map((r) => [String(r["code"]), String(r["name"])]));
  const name = names.get(book);
  if (name === undefined) {
    core.close();
    throw new UnderstandRefused(`core has no book ${book}`);
  }
  const ordRef = new Map<number, [number, number]>();
  const ordOf = new Map<VerseKey, number>();
  for (const r of core.prepare("SELECT ord, chapter, verse FROM verses WHERE book = ? ORDER BY ord").all(book)) {
    const cv: [number, number] = [Number(r["chapter"]), Number(r["verse"])];
    ordRef.set(Number(r["ord"]), cv);
    ordOf.set(vk(...cv), Number(r["ord"]));
  }
  // Rule 9: the four public-domain texts, by name, and nothing else.
  const texts = new Map<string, string>();
  const placeholders = PUBLIC_DOMAIN_TEXTS.map(() => "?").join(", ");
  for (const r of core
    .prepare(`SELECT t.translation, t.ord, t.text FROM texts t JOIN verses v ON v.ord = t.ord WHERE v.book = ? AND t.translation IN (${placeholders})`)
    .all(book, ...PUBLIC_DOMAIN_TEXTS)) {
    texts.set(`${String(r["translation"])}|${Number(r["ord"])}`, String(r["text"]));
  }
  // Original-language tokens and how often each word is used per book, for the comparison fact.
  const tokens = new Map<number, Array<{ key: string; lemma: string; morph: string; surface: string }>>();
  for (const r of core
    .prepare("SELECT t.ord, t.occurrence_key, t.lemma, t.morph, t.surface FROM tokens t JOIN verses v ON v.ord = t.ord WHERE v.book = ? ORDER BY t.ord, t.position")
    .all(book)) {
    const list = tokens.get(Number(r["ord"])) ?? [];
    if (list.length === 0) tokens.set(Number(r["ord"]), list);
    list.push({ key: String(r["occurrence_key"]), lemma: String(r["lemma"]), morph: String(r["morph"] ?? ""), surface: String(r["surface"]) });
  }
  // Each word's verses in this book, by ord, for the word-count fact's "and here" list.
  const keyRefs = new Map<string, string[]>();
  for (const [o, list] of [...tokens].sort((a, b) => a[0] - b[0])) {
    const cv = ordRef.get(o);
    if (cv === undefined) continue;
    for (const t of list) {
      const refs = keyRefs.get(t.key) ?? [];
      if (refs.length === 0) keyRefs.set(t.key, refs);
      refs.push(vk(...cv));
    }
  }
  const occurrences = new Map<string, Array<{ book: string; count: number }>>();
  for (const r of core
    .prepare(
      `SELECT occurrence_key, book, count FROM occurrences WHERE occurrence_key IN
         (SELECT DISTINCT t.occurrence_key FROM tokens t JOIN verses v ON v.ord = t.ord WHERE v.book = ?)
       ORDER BY occurrence_key, count DESC, book`,
    )
    .all(book)) {
    const list = occurrences.get(String(r["occurrence_key"])) ?? [];
    if (list.length === 0) occurrences.set(String(r["occurrence_key"]), list);
    list.push({ book: String(r["book"]), count: Number(r["count"]) });
  }
  core.close();
  // JPS 1917 (public domain, Old Testament only; docs/research/jps-1917-licence.md) is its own optional
  // download, keyed by core ord. Without it nothing about JPS shows and nothing else changes.
  const jpsPath = latest(paths.bundles, "translation-jps");
  if (jpsPath !== null && statSync(jpsPath).size > 0) {
    const jps = new DatabaseSync(jpsPath, { readOnly: true });
    const ords = [...ordRef.keys()];
    for (const r of jps.prepare("SELECT ord, text FROM texts WHERE ord BETWEEN ? AND ?").all(Math.min(...ords), Math.max(...ords))) {
      texts.set(`JPS|${Number(r["ord"])}`, String(r["text"]));
    }
    jps.close();
  }
  const text = (ord: number, translation: PublicDomainText | "JPS" = "BSB"): string => texts.get(`${translation}|${ord}`) ?? "";

  const byName = bookCodeByName(names);
  const tablesText = readIfExists(path.join(raw, "bsb-tables/bsb_tables.tsv"));
  if (tablesText === null) throw new UnderstandRefused("bsb-tables/bsb_tables.tsv is missing");
  const tables: BookTables = bsbTables(tablesText, book, byName);

  const ust = ustFile(raw, book);
  const ustText = ust === null ? "" : readFileSync(ust, "utf8");
  const tnText = readIfExists(path.join(raw, `uw-tn/en_tn/tn_${book}.tsv`)) ?? "";
  const tqText = readIfExists(path.join(raw, `uw-tq/en_tq/tq_${book}.tsv`)) ?? "";
  const twlText = readIfExists(path.join(raw, `uw-twl/en_twl/twl_${book}.tsv`)) ?? "";
  const twCache = new Map<string, TwArticle | null>();
  const tw = (link: string): TwArticle | null => {
    const p = twLinkPath(link);
    if (p === null) return null;
    const file = path.join(raw, "uw-tw/en_tw/bible", p[0], `${p[1]}.md`);
    if (!twCache.has(file)) {
      const t = readIfExists(file);
      twCache.set(file, t === null ? null : twArticle(t, p[0]));
    }
    return twCache.get(file) ?? null;
  };

  const speakersPath = latest(paths.bundles, "speakers");
  const spk = speakersPath === null ? null : new DatabaseSync(speakersPath, { readOnly: true });
  const speechRowsQuery = spk?.prepare(
    "SELECT c.name, c.kind, s.quote_position FROM verse_speakers s JOIN characters c ON c.id = s.character WHERE s.ord = ? AND s.standing = 'speaks' ORDER BY s.line",
  );
  const verseSpeakers = spk?.prepare(
    "SELECT c.name FROM verse_speakers s JOIN characters c ON c.id = s.character WHERE s.ord = ? AND s.standing = 'speaks' AND c.kind IN ('character', 'multiple') ORDER BY s.line",
  );
  const rangeSpeakers = spk?.prepare(
    "SELECT s.ord, c.name, s.quote_position FROM verse_speakers s JOIN characters c ON c.id = s.character WHERE s.ord BETWEEN ? AND ? AND s.standing = 'speaks' ORDER BY s.ord, s.line",
  );
  const parallelPassages = spk?.prepare("SELECT DISTINCT parallel_passage FROM verse_speakers WHERE ord BETWEEN ? AND ? AND parallel_passage <> ''");
  const speakerOrds = new Set(
    (spk?.prepare("SELECT DISTINCT ord FROM verse_speakers WHERE standing = 'speaks'").all() ?? []).map((r) => Number(r["ord"])),
  );

  const studyPath = latest(paths.bundles, `study-${book.toLowerCase()}`);
  const study = studyPath === null ? null : new DatabaseSync(studyPath, { readOnly: true });
  const covering = study?.prepare(
    "SELECT ord_start, ord_end, text FROM notes WHERE kind = 'note' AND ord_start <= ? AND ord_end >= ? ORDER BY ord_end - ord_start, ord_start DESC",
  );
  const insideRange = study?.prepare("SELECT text FROM notes WHERE kind = 'note' AND ord_start >= ? AND ord_end <= ? ORDER BY ord_start, ord_end, id");

  const pericopesPath = latest(paths.bundles, book.toLowerCase());
  let pericopes: Pericope[] = [];
  if (pericopesPath !== null) {
    const db = new DatabaseSync(pericopesPath, { readOnly: true });
    pericopes = db
      .prepare("SELECT pericope_id, label, start_ord, end_ord FROM pericopes ORDER BY start_ord")
      .all()
      .map((r) => ({ id: String(r["pericope_id"]), label: String(r["label"]), startOrd: Number(r["start_ord"]), endOrd: Number(r["end_ord"]) }));
    db.close();
  }

  const debates = readDebates();
  const lastChapter = Math.max(...[...ordRef.values()].map(([c]) => c));
  const verses: BookData = {
    book,
    name,
    ust: ustVerses(ustText),
    tn: tnRows(tnText),
    tq: tqRows(tqText),
    twl: twlRows(twlText),
    tw,
    tables,
    ord: (c, v) => ordOf.get(vk(c, v)) ?? null,
    text,
    speakers: (ord) => (verseSpeakers?.all(ord) ?? []).map((r) => String(r["name"])),
    speechRows: (ord) =>
      (speechRowsQuery?.all(ord) ?? []).map((r) => ({ name: String(r["name"]), kind: String(r["kind"]), quotePosition: r["quote_position"] == null ? null : String(r["quote_position"]) })),
    keyRefs: (key) => keyRefs.get(key) ?? [],
    studyNotes: (ord): StudyNote[] =>
      (covering?.all(ord, ord) ?? []).map((r) => ({ ordStart: Number(r["ord_start"]), ordEnd: Number(r["ord_end"]), text: String(r["text"]) })),
    lastChapter,
    chapters: [...new Set([...ordRef.values()].map(([c]) => c))].sort((a, b) => a - b),
    pericopes: pericopes.flatMap((p) => {
      const start = ordRef.get(p.startOrd);
      const end = ordRef.get(p.endOrd);
      return start === undefined || end === undefined ? [] : [{ label: p.label, start, end }];
    }),
    verseList: [...ordRef.values()].filter(([, v]) => v > 0),
    debates,
    tokens: (ord) => tokens.get(ord) ?? [],
    occurrences: (key) => occurrences.get(key) ?? [],
  };
  const guides = tnGuides(tnText);
  // passage_summary.py reads the tables' rows for a book by core's name, with only Psalms -> Psalm: the
  // tables' "Song of Solomon" never matches core's "Song of Songs", so its summaries go chapter by chapter
  // with no BSB headings or footnotes (SNG 8/8 as John read it). Kept so the summaries are the ones he
  // approved; the verse layer reads the Song's headings, as assemble.py does.
  const summaryTables = tables.name === name.replace(/Psalms/g, "Psalm");
  const bsb = new Map<VerseKey, string>();
  for (const [o, cv] of ordRef) {
    const t = texts.get(`BSB|${o}`);
    if (t !== undefined) bsb.set(vk(...cv), t);
  }
  const passages: PassageBookData = {
    book,
    name,
    ordRef,
    bsb,
    ust: ustVerses(ustText, { summary: true }),
    tq: tqAnswers(tqText),
    events: guides.events,
    henry: existsSync(path.join(paths.raw, MHC_DIR)) ? mhcSections(book) : [],
    parts: guides.parts,
    reviews: readPassageReviews(),
    asides: guides.asides,
    outline: [...tnBookOutline(tnText), ...outlineRanges(book, tnText)],
    headings: summaryTables ? tables.headings.map((h) => ({ chapter: h.chapter, verse: h.verse, heading: h.summaryHeading })) : [],
    footnotes: [...(summaryTables ? tables.verses : [])].flatMap(([k, ws]) => {
      const [c, v] = k.split(":").map(Number) as [number, number];
      return ws.filter((w) => w.footRaw !== "" && /manuscript/.test(w.footRaw)).map((w) => ({ chapter: c, verse: v, text: w.footRaw }));
    }),
    pericopes,
    speaking: (a, b) =>
      (rangeSpeakers?.all(a, b) ?? []).map((r) => ({ ord: Number(r["ord"]), name: String(r["name"]), quotePosition: r["quote_position"] == null ? null : String(r["quote_position"]) })),
    tnNotes: splitLines(tnText.replace(/^\uFEFF/, ""))
      .slice(1)
      .map((line) => line.split("\t"))
      .map((r) => ({ ref: r[0] ?? "", support: r[3] ?? "", note: r[6] ?? "" })),
    speakerOrds,
    tyndaleInside: (a, b) => (insideRange?.all(a, b) ?? []).map((r) => String(r["text"])),
    stories: obsStories(raw, byName),
    bookNames: names,
    parallels: summaryTables ? tables.parallels : [],
    glyssenParallels: (a, b) => (parallelPassages?.all(a, b) ?? []).map((r) => String(r["parallel_passage"])),
    ustSpeakers: ustSpeakers(ustText),
    kinds: readKinds(),
    letters: readLetters(),
    plainWords: readPlainWords(),
    debates,
    prophets: readProphets(),
  };
  if (study !== null && studyPath !== null) {
    const row = study.prepare("SELECT name, license, license_notice FROM sources WHERE key = 'tosn'").get();
    if (row !== undefined) {
      sources.push({ key: "tyndale", name: String(row["name"]), license: String(row["license"]), license_notice: String(row["license_notice"]), credit: CREDITS.tyndale, original: null, sha256: null });
    }
  }
  return {
    verses,
    passages,
    verseList: [...ordRef.values()].filter(([, v]) => v > 0),
    sources,
    intro: isBookCode(book)
      ? introFor(book, readTyndale(raw, options.verifyPins ?? true).get(book), tnText === "" ? null : tnText, readIntros(options.dataDir ?? UNDERSTAND_DATA).entries.find((e) => e.book === book))
      : { intro: null, reason: `unknown book ${book}` },
    close: () => {
      spk?.close();
      study?.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Building and writing
// ---------------------------------------------------------------------------

export interface VerseReport {
  verses: number;
  missing: number;
  plain: number;
  readersDiffer: number;
  facts: number;
  keyWords: number;
  overBudget: number;
  leaks: string[];
  /** Beginner or Explained lines carrying "(NLT)": must be 0 (rule 9). */
  nltInBeginner: string[];
}

export interface UnderstandReport {
  book: string;
  file: string;
  version: number;
  sha256: string;
  bytes: number;
  reused: boolean;
  verses: VerseReport;
  passages: PassageReport;
  results: PassageResult[];
  extras: ExtrasReport;
}

export function assembleBook(loaded: LoadedBook): Assembled[] {
  const derived = derive(loaded.verses);
  return loaded.verseList.map(([c, v]) => assemble(loaded.verses, derived, c, v));
}

export function verseReport(layers: readonly Assembled[]): VerseReport {
  const live = layers.filter((r) => !isMissing(r)).flatMap((r) => (isMissing(r) ? [] : [r]));
  const explainedText = (r: (typeof live)[number]): string => r.deeper.explained.map((e) => e.text).join(" ");
  return {
    verses: layers.length,
    missing: layers.length - live.length,
    plain: live.filter((r) => r.beginner.plain !== null).length,
    readersDiffer: live.filter((r) => r.beginner.readers_differ.length > 0).length,
    facts: live.filter((r) => r.facts.length > 0).length,
    keyWords: live.filter((r) => r.deeper.key_words.length > 0).length,
    overBudget: live.filter((r) => (beginnerText(r).match(/\S+/g) ?? []).length > 150).length,
    leaks: live.filter((r) => LEAKS.test(`${beginnerText(r)} ${explainedText(r)}`)).map((r) => r.verse),
    nltInBeginner: live.filter((r) => `${beginnerText(r)} ${explainedText(r)}`.includes("(NLT)")).map((r) => r.verse),
  };
}

/**
 * Built into a temporary file first; unchanged bytes keep the previous version, changed bytes get a
 * version above anything on disk, as every bundle does (package.ts), so a file name never changes meaning.
 */
export function packageUnderstandBook(
  book: string,
  options: { paths?: UnderstandPaths; outDir?: string; verifyPins?: boolean; dataDir?: string } = {},
): UnderstandReport {
  const paths = options.paths ?? understandPaths();
  const outDir = options.outDir ?? paths.bundles;
  const loaded = loadBook(book, { paths, ...(options.verifyPins === undefined ? {} : { verifyPins: options.verifyPins }), ...(options.dataDir === undefined ? {} : { dataDir: options.dataDir }) });
  let layers: Assembled[];
  let results: PassageResult[];
  try {
    layers = assembleBook(loaded);
    results = summariseBook(loaded.passages);
  } finally {
    loaded.close();
  }
  const report = passageReport(loaded.passages, results);

  mkdirSync(outDir, { recursive: true });
  const name = `understand-${book.toLowerCase()}`;
  const tmp = path.join(outDir, `${name}.building.db`);
  const db = freshDb(tmp, UNDERSTAND_DDL);
  db.exec("BEGIN");
  const meta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  meta.run("format", String(UNDERSTAND_FORMAT));
  meta.run("book", book);
  meta.run("review", "none: published sources adapted by rule and data facts in fixed templates; summaries gated, flagged ones for John");
  meta.run("summary_sample_seed", `yada-summary-sample-${book}`);
  meta.run("flagged_share", (report.flagged.length / Math.max(1, report.summaries)).toFixed(3));
  // The counts too: a rounded share of 0.150 hides 0.1504, which is over the stop (review, 12 Oct 2026).
  meta.run("summaries", String(report.summaries));
  meta.run("flagged", String(report.flagged.length));
  // Build 6 item G. A new key: apps before build 6 read only 'format' and 'book', so the format stays.
  const intro = introMeta(loaded.intro, book, readIntros(options.dataDir ?? UNDERSTAND_DATA).entries);
  if (intro !== null) meta.run("book_intro", JSON.stringify(intro));
  const src = db.prepare("INSERT INTO sources (key, name, license, license_notice, credit, original, sha256) VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (const s of loaded.sources) src.run(s.key, s.name, s.license, s.license_notice, s.credit, s.original, s.sha256);
  const verse = db.prepare("INSERT INTO verses (ord, verse_id, missing, section, layers) VALUES (?, ?, ?, ?, ?)");
  for (const r of layers) {
    const [, c, v] = r.verse.split(".");
    const ord = loaded.verses.ord(Number(c), Number(v));
    if (ord === null) continue;
    verse.run(ord, r.verse, isMissing(r) ? 1 : 0, isMissing(r) ? null : r.where.section, JSON.stringify(r));
  }
  const passage = db.prepare(
    `INSERT INTO passages (passage_id, label, start_ord, end_ord, headline, headline_kind, mode, headline_source, headline_status, summary, sentences, credit,
       speakers, facts, psalm_lead, psalm_about, debates, awaiting, purpose, around, also_told_in, themes, settings, flags, flagged, sample)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const p of results) {
    passage.run(
      p.id, p.label, p.startOrd, p.endOrd, p.headline, p.headlineKind, p.mode, p.headlineSource, p.headlineStatus, p.text,
      JSON.stringify(p.sentences), p.credit, JSON.stringify(p.speakers), JSON.stringify(p.facts),
      JSON.stringify(p.lead), JSON.stringify(p.about), JSON.stringify(p.debates), JSON.stringify(p.awaiting),
      p.purpose === null ? null : JSON.stringify(p.purpose), p.around === null ? null : JSON.stringify(p.around),
      JSON.stringify(p.alsoToldIn), JSON.stringify(p.themes), JSON.stringify(p.settings), JSON.stringify(p.flags),
      p.flags.length > 0 ? 1 : 0, p.sample ? 1 : 0,
    );
  }
  // Build 6 (MM-03 word links, MS-01 places): their own tables, written apart (bundleExtras.ts).
  const extras = writeBundleExtras(db, book, { paths, ...(options.verifyPins === undefined ? {} : { verifyPins: options.verifyPins }) });
  db.exec("COMMIT");
  db.exec("VACUUM");
  db.close();

  const sha = sha256File(tmp);
  const highest = highestVersionOnDisk(name, outDir);
  const reused = highest > 0 && sha256File(path.join(outDir, understandFileName(book, highest))) === sha;
  const version = reused ? highest : highest + 1;
  const file = understandFileName(book, version);
  if (reused) rmSync(tmp);
  else renameSync(tmp, path.join(outDir, file));
  return { book, file, version, sha256: sha, bytes: statSync(path.join(outDir, file)).size, reused, verses: verseReport(layers), passages: report, results, extras };
}


/**
 * The manifest's `understand` list: the highest version of each book's bundle in `dir`, with the
 * gzipped size publish uploads and Downloads shows (DN-05). Bundles are immutable, so the newest file
 * is the one a phone should have; older versions stay on disk unlisted. A book over the 15% flag stop
 * is left out: `yada understand` still writes its file for the report, but it must not ship (66-book
 * run, 12 Oct 2026: Joel, Habakkuk and Malachi wrote files with every summary flagged).
 */
/**
 * Whether a bundle's book is over the flag stop (passage.ts overStop), read from the file itself. A file that does not say
 * (no counts, no share) counts as stopped: only a book shown to pass ships.
 */
export function stopped(db: DatabaseSync): boolean {
  const meta = new Map((db.prepare("SELECT key, value FROM meta").all() as Array<{ key: string; value: string }>).map((r) => [r.key, r.value]));
  const flagged = meta.get("flagged");
  const summaries = meta.get("summaries");
  if (flagged !== undefined && summaries !== undefined) return overStop(Number(flagged), Number(summaries));
  // The 54 books built before the counts were stored carry only the share: the 15% rule alone, as they shipped.
  return !(Number(meta.get("flagged_share") ?? Number.NaN) <= STOP_SHARE);
}

export function understandManifestEntries(dir: string, skipped: string[] = []): UnderstandInfo[] {
  const books = new Set(readdirSync(dir).flatMap((f) => /^understand-([a-z0-9]{3})\.v\d+\.db$/.exec(f)?.[1]?.toUpperCase() ?? []));
  const out: UnderstandInfo[] = [];
  for (const book of BOOK_ORDER) {
    if (!books.has(book)) continue;
    const version = highestVersionOnDisk(`understand-${book.toLowerCase()}`, dir);
    const file = understandFileName(book, version);
    const full = path.join(dir, file);
    const bytes = readFileSync(full);
    const db = new DatabaseSync(full, { readOnly: true });
    const count = (table: string) => Number((db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n);
    if (stopped(db)) {
      db.close();
      skipped.push(book);
      continue;
    }
    const info = { book, version, file, sha256: sha256File(full), bytes: bytes.length, download_bytes: gzipTranslation(bytes).length, format: UNDERSTAND_FORMAT, verses: count("verses"), passages: count("passages") };
    db.close();
    out.push(UnderstandInfoSchema.parse(info));
  }
  return out;
}
