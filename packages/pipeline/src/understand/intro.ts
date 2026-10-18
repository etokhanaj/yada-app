/**
 * Book introductions (build 6, item G): one paragraph at the start of each book. Since John's review of
 * 15 Oct 2026 (decision 22) it is the opening paragraph of Tyndale Open Study Notes' book introduction
 * (the intro-overview), and the unfoldingWord Translation Notes' front:intro section "What is/are …
 * about?" only where Tyndale gives nothing usable. Nothing is written: whole sentences, in order, cut by
 * rule, with the list-announcing last sentence dropped (HEB: "There are three primary explanations…").
 *
 * The cut's other rules each come from a rejection (decision 24): a sentence with no full stop ends it
 * (ECC "(1:3) Ecclesiastes…"); it never ends on a sentence the next one continues (ZEP stopped on
 * "Hezekiah had been a godly ruler, but…"); it starts at this book, not another (2CH opened on 1
 * Chronicles); and from Tyndale, questions and quotations are skipped, since Tyndale quotes the NLT
 * (rule 9) and a question is not an introduction (ZEP, GAL).
 *
 * Rule 2: an extracted paragraph is `flagged` until John approves it in the review tool's Extracts queue
 * (book_intros.json beside debates.json). Rule 4: a book with no such section, or whose first sentence is
 * already over budget, gets nothing (Genesis has no section in the pinned tN).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { BOOK_CODES, BOOK_ORDER, type BookCode } from "@yada/schema";

import { sha256File } from "../package.js";
import { TOSN_SHA256 } from "../sources.js";
import { parseTosn } from "../study.js";
import { readZip } from "../zip.js";
import { md, parsePins, readIfExists, tsvRows, UnderstandRefused } from "./sources.js";

export const INTRO_WORDS = 60;

/** CC BY-SA 4.0 asks an adapted copy to say what changed; the unfoldingWord® mark is dropped (LICENSE.md). */
export const INTRO_CREDIT = "Translation Notes, adapted from unfoldingWord (book introduction, first paragraph shortened) · CC BY-SA 4.0";
/** tosn-README.txt's own wording for an adapted copy, with what changed. */
export const TYNDALE_INTRO_CREDIT =
  "Adapted from Tyndale Open Study Notes (book introduction, opening paragraph shortened). The original work by Tyndale House Publishers is available for free at http://www.tyndaleopenresources.com · CC BY-SA 4.0";

export type IntroSource = "tyndale" | "tn";

export interface BookIntro {
  text: string;
  words: number;
  /** The whole first paragraph as md() leaves it, for John to check the cut against. */
  paragraph: string;
  source: IntroSource;
}

export type IntroResult = { intro: BookIntro; reason: null } | { intro: null; reason: string };

const SECTION = /^### What (?:is|are) (?!the meaning)[^\n]*?(?: about|book of Psalms)\?\s*\n+(.*?)(?=\n\n|\n#|$)/ims;
/** A sentence addressed to the translator, or naming the ULT/UST, ends the paragraph (docs/no-ai-understand.md). */
const STOP = /\btranslat|\bULT\b|\bUST\b|\byour?\b/i;
/** A last sentence that only announces what follows ("There are three primary explanations for why…"). */
const ANNOUNCES_LIST = /^There (?:are|is) (?:two|three|four|five|six|several|many|a number of)\b|:$/;

const wordCount = (s: string): number => s.split(/\s+/).filter((w) => w !== "").length;

/** The front:intro note of a tN book file, with its `\n` escapes as line breaks. */
export function tnFrontIntro(tnText: string): string | null {
  const row = tsvRows(tnText).find((r) => r[0] === "front:intro");
  return row === undefined ? null : (row[6] ?? "").replace(/\\n/g, "\n");
}

/** Sentences end at . ! ? or a closing quote, before a capital or an opening quote. */
const splitSentences = (paragraph: string): string[] => paragraph.split(/(?<=[.!?”])\s+(?=[A-Z“])/);
/** A turn: the sentence before it only sets it up, so the cut never stops between them (ZEP, 15 Oct 2026). */
const CONTINUES = /^(?:But|However|Yet|Nevertheless)\b/;
/** Under this, a cut is a fragment, not an introduction (Tyndale's ZEP: "Zephaniah’s words send a chill through the soul."). */
export const INTRO_MIN_WORDS = 15;
const ENDS = /[.!?][”’)]?$/;
/** Two sentences run together where the source left out the full stop after a reference: "(1:3) Ecclesiastes is…". */
const RUN_ON = /\(\d+:\d+[^)]*\)\s+[A-Z]/;
/** Book names as an introduction writes them: "1 Chronicles", "First John", "the first letter of John". */
const ORDINAL = ["First", "Second", "Third"];
function names(book: BookCode): RegExp[] {
  const name = BOOK_CODES[book].name;
  const m = /^([1-3]) (.+)$/.exec(name);
  if (m === null) return [new RegExp(`\\b${name}\\b`)];
  const n = Number(m[1]);
  const rest = m[2] ?? "";
  const ord = ORDINAL[n - 1] ?? "";
  return [new RegExp(`\\b${n} ${rest}\\b`), new RegExp(`\\b${ord} ${rest}\\b`), new RegExp(`\\b${ord.toLowerCase()} (?:letter|book) of ${rest}\\b`, "i")];
}
/** A numbered sibling this sentence names: 2 John's "The first letter of John…", 2 Chronicles' "1 Chronicles". */
function namesOtherBook(sentence: string, book: BookCode): boolean {
  const stem = BOOK_CODES[book].name.replace(/^[1-3] /, "");
  return BOOK_ORDER.some((b) => b !== book && /^[1-3] /.test(BOOK_CODES[b].name) && BOOK_CODES[b].name.replace(/^[1-3] /, "") === stem && names(b).some((r) => r.test(sentence)));
}

/**
 * Whole sentences, in order, up to INTRO_WORDS. `skipAside` drops questions and quotations, for Tyndale:
 * leading ones are passed over, a later one ends the cut.
 */
export function cut(paragraph: string, book: BookCode, skipAside: boolean): { text: string; words: number } | { text: null; reason: string } {
  const sentences = splitSentences(paragraph);
  const aside = (s: string): boolean => skipAside && (/\?[”’]?$/.test(s) || /[“”]/.test(s));
  const first = cutFrom(sentences, 0, book, aside, skipAside);
  // Zephaniah's opening is two quotations, an 8-word line and a question before the one sentence that says
  // what the book is about (build 8, 15 Oct 2026): when the hook leaves nothing whole, try after its last aside.
  const last = sentences.reduce((at, s, i) => (aside(s) ? i : at), -1);
  if (first.text !== null || last < 0) return first;
  const after = cutFrom(sentences, last + 1, book, aside, skipAside);
  return after.text !== null ? after : first;
}

function cutFrom(
  sentences: string[],
  start: number,
  book: BookCode,
  aside: (s: string) => boolean,
  skipAside: boolean,
): { text: string; words: number } | { text: null; reason: string } {
  let i = start;
  while (i < sentences.length && (aside(sentences[i] ?? "") || namesOtherBook(sentences[i] ?? "", book))) i += 1;
  const keep: string[] = [];
  let words = 0;
  for (; i < sentences.length; i += 1) {
    const s = sentences[i] ?? "";
    if (STOP.test(s) || aside(s) || namesOtherBook(s, book) || RUN_ON.test(s)) break;
    const w = wordCount(s);
    if (words + w > INTRO_WORDS) break;
    keep.push(s);
    words += w;
    // A sentence with no full stop runs into the next one as the source prints it: nothing after it is whole.
    if (!ENDS.test(s)) break;
  }
  const next = (): string => sentences[sentences.indexOf(keep.at(-1) ?? "") + 1] ?? "";
  while (keep.length > 0 && (ANNOUNCES_LIST.test(keep.at(-1) ?? "") || !ENDS.test(keep.at(-1) ?? "") || CONTINUES.test(next()))) {
    words -= wordCount(keep.pop() ?? "");
  }
  // Tyndale only: its openings lead with a hook, and what is left after it can be a fragment. tN's first
  // paragraph is a plain description, and a short one is still whole.
  if (skipAside && keep.length > 0 && words < INTRO_MIN_WORDS) return { text: null, reason: `only ${words} words` };
  if (keep.length === 0) {
    const first = sentences[start] ?? "";
    return { text: null, reason: STOP.test(first) ? "first sentence speaks to the translator" : `first sentence is ${wordCount(first)} words` };
  }
  return { text: keep.join(" "), words };
}

export function bookIntro(tnText: string, book: BookCode = "HEB"): IntroResult {
  const note = tnFrontIntro(tnText);
  if (note === null) return { intro: null, reason: "no front:intro note" };
  const m = SECTION.exec(note);
  if (m === null) return { intro: null, reason: "no “What is … about?” section" };
  // md() leaves "( )" where a "(See: …)" sat inside brackets; ULT's {added words} lose their braces.
  const paragraph = md(m[1] ?? "")
    .replace(/\s+\(\s*\)/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const c = cut(paragraph, book, false);
  return c.text === null ? { intro: null, reason: c.reason } : { intro: { text: c.text, words: c.words, paragraph, source: "tn" }, reason: null };
}

/** Each book's Tyndale opening paragraph (intro-overview, the first non-heading one), tags removed. */
export function tyndaleOverviews(xml: string): Map<BookCode, string> {
  const out = new Map<BookCode, string>();
  for (const note of parseTosn(xml, "intro")) {
    const book = BOOK_ORDER[Math.floor(note.start / 1_000_000) - 1];
    const first = note.text.split("\n").find((p) => !p.startsWith("<h>"));
    if (book === undefined || first === undefined || out.has(book)) continue;
    out.set(book, first.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
  }
  return out;
}

export function tyndaleIntro(overview: string, book: BookCode): IntroResult {
  const c = cut(overview, book, true);
  return c.text === null ? { intro: null, reason: `Tyndale: ${c.reason}` } : { intro: { text: c.text, words: c.words, paragraph: overview, source: "tyndale" }, reason: null };
}

/**
 * Tyndale first; tN where Tyndale gives nothing usable (decision 22). A tN text John approved stays: the
 * move to Tyndale is for the books he rejected, and 43 approved introductions are already live.
 */
export function introFor(book: BookCode, overview: string | undefined, tnText: string | null, entry?: IntroEntry): IntroResult {
  const fromTn = tnText === null ? ({ intro: null, reason: "no tN file" } as const) : bookIntro(tnText, book);
  if (fromTn.intro !== null && entry?.status === "approved" && entry.text === fromTn.intro.text) return fromTn;
  const fromTyndale = overview === undefined ? null : tyndaleIntro(overview, book);
  if (fromTyndale !== null && fromTyndale.intro !== null) return fromTyndale;
  if (fromTn.intro !== null) return fromTn;
  return { intro: null, reason: [fromTyndale?.reason ?? "no Tyndale introduction", `tN: ${fromTn.reason}`].join("; ") };
}

// ---------------------------------------------------------------------------
// Review state (rule 2)
// ---------------------------------------------------------------------------

export type ExtractStatus = "draft" | "approved" | "rejected";

export interface IntroEntry {
  book: string;
  text: string;
  /** Where the text came from, for John; never shown in the app. */
  ref: string;
  paragraph: string;
  /** Why it may read weakly (WEAK_INTROS), for John only. */
  note?: string;
  status: ExtractStatus;
  /** Texts John rejected for this book: one never comes back as a draft, whichever source gives it again. */
  rejected?: string[];
}

export interface IntroFile {
  _why: string;
  entries: IntroEntry[];
}

export const INTROS_FILE = "book_intros.json";

export const INTROS_WHY =
  "Build 6 item G (15 Oct 2026): each book's introduction is the opening paragraph of Tyndale Open Study Notes' book introduction, or " +
  "where that gives nothing usable the first paragraph of tN's front:intro “What is … about?” section, cut by rule " +
  "(packages/pipeline/src/understand/intro.ts) and never edited. 'status' is 'draft' until John approves it in the review " +
  "tool's Extracts queue; only 'approved' text shows in the app (rule 2). Re-running `yada intros --write` keeps a status only while the " +
  "text is unchanged, and 'rejected' lists texts John rejected, which never return as drafts. 'paragraph' is the whole paragraph the cut " +
  "came from, for checking.";

export function readIntros(dir: string): IntroFile {
  const parsed = JSON.parse(readFileSync(path.join(dir, INTROS_FILE), "utf8")) as Partial<IntroFile>;
  if (!Array.isArray(parsed.entries)) throw new UnderstandRefused(`${INTROS_FILE} has no entries list`);
  return { _why: parsed._why ?? INTROS_WHY, entries: parsed.entries };
}

/** The meta value an Understand bundle carries: `flagged` unless John approved this exact text; nothing once he rejects it. */
export interface IntroMeta {
  text: string;
  source: IntroSource;
  credit: string;
  status: "approved" | "flagged";
}

export function introMeta(result: IntroResult, book: string, entries: readonly IntroEntry[]): IntroMeta | null {
  if (result.intro === null) return null;
  const entry = entries.find((e) => e.book === book);
  // A rejected text never ships, not even flagged: the decision is John's, and only he makes it (rule 2).
  const same = entry !== undefined && entry.text === result.intro.text;
  if (entry !== undefined && (same ? entry.status === "rejected" : (entry.rejected ?? []).includes(result.intro.text))) return null;
  const approved = entry !== undefined && entry.status === "approved" && entry.text === result.intro.text;
  const credit = result.intro.source === "tyndale" ? TYNDALE_INTRO_CREDIT : INTRO_CREDIT;
  return { text: result.intro.text, source: result.intro.source, credit, status: approved ? "approved" : "flagged" };
}

/**
 * Notes shown to John beside a text that passes the rule but reads weakly as an opening. Never edits (rule 2).
 * The four tN notes of 15 Oct 2026 (1CO, ROM, 2KI, ECC) went with the move to Tyndale (decision 22).
 */
export const WEAK_INTROS: Readonly<Record<string, string>> = {};

/** The review file after a fresh extraction: a decision survives only while its text is unchanged, and a rejected text stays rejected. */
export function mergeIntros(previous: readonly IntroEntry[], results: ReadonlyArray<{ book: string; result: IntroResult }>): IntroEntry[] {
  return results.flatMap(({ book, result }) => {
    if (result.intro === null) return [];
    const old = previous.find((e) => e.book === book);
    const rejected = [...new Set([...(old?.rejected ?? []), ...(old?.status === "rejected" ? [old.text] : [])])].filter((r) => r !== "");
    const text = result.intro.text;
    // John's latest decision on this exact text wins, an undo-then-approve included; the rejected list only
    // decides a text that is new to this entry (review, 15 Oct 2026).
    const status: ExtractStatus = old !== undefined && old.text === text ? old.status : rejected.includes(text) ? "rejected" : "draft";
    const note = WEAK_INTROS[book];
    const ref = result.intro.source === "tyndale" ? `tosn-BookIntros.xml ${book} intro-overview` : `en_tn/tn_${book}.tsv front:intro`;
    return [{ book, text, ref, paragraph: result.intro.paragraph, ...(note === undefined ? {} : { note }), status, ...(rejected.length === 0 ? {} : { rejected }) }];
  });
}

const tnFile = (raw: string, book: string): string => path.join(raw, `uw-tn/en_tn/tn_${book}.tsv`);

/** The Tyndale zip as downloaded (every tosn-*.zip in content/raw is that same file), pinned in sources.ts. */
export const TOSN_ZIP = "tosn-BookIntros.xml.zip";
const TOSN_LICENCE = "Creative Commons Attribution-ShareAlike 4.0 International License";

const tyndaleCache = new Map<string, Map<BookCode, string>>();

/**
 * Tyndale's opening paragraphs, read from the pinned zip and never the extracted XML beside it, which no
 * pin covers (the grammars' lesson, 5a26cd7), with its licence re-read from the zip's README (rule 3).
 * `required`: a missing zip refuses rather than quietly falling back to tN texts John rejected (review,
 * 15 Oct 2026); only the summary listing, which has no use for introductions, passes false.
 */
export function readTyndale(raw: string, required = true): Map<BookCode, string> {
  const cached = tyndaleCache.get(raw);
  if (cached !== undefined) return cached;
  const file = path.join(raw, TOSN_ZIP);
  if (!existsSync(file)) {
    if (required) throw new UnderstandRefused(`${TOSN_ZIP} is missing from ${raw}`);
    return new Map();
  }
  if (sha256File(file) !== TOSN_SHA256) throw new UnderstandRefused(`${TOSN_ZIP} does not match the Tyndale pin in sources.ts`);
  const members = readZip(readFileSync(file));
  const readme = members.get("Tyndale Open Study Notes/_README.txt")?.toString("utf8") ?? "";
  if (!readme.includes(TOSN_LICENCE)) throw new UnderstandRefused(`the Tyndale README no longer states ${TOSN_LICENCE}`);
  const xml = members.get("Tyndale Open Study Notes/BookIntros.xml");
  if (xml === undefined) throw new UnderstandRefused(`${TOSN_ZIP} has no BookIntros.xml`);
  const overviews = tyndaleOverviews(xml.toString("utf8"));
  tyndaleCache.set(raw, overviews);
  return overviews;
}

/** Every book in canon order, read from YADA_ROOT/content/raw (Tyndale's intros and the pinned en_tn). */
export function extractIntros(raw: string, entries: readonly IntroEntry[] = [], tyndale: (raw: string) => Map<BookCode, string> = readTyndale): Array<{ book: string; result: IntroResult }> {
  const overviews = tyndale(raw);
  return BOOK_ORDER.map((book) => ({ book, result: introFor(book, overviews.get(book), readIfExists(tnFile(raw, book)), entries.find((e) => e.book === book)) }));
}

const TN_ZIP = "uw-tn/en_tn.zip";

/** en_tn.zip against its pin, read from uw.sha256 and sources-12oct.sha256 as loadBook reads them. */
export function checkTnPin(raw: string): void {
  const pins = new Map([...parsePins(readIfExists(path.join(raw, "uw.sha256")) ?? ""), ...parsePins(readIfExists(path.join(raw, "sources-12oct.sha256")) ?? "")]);
  const pin = pins.get(TN_ZIP);
  const zip = path.join(raw, TN_ZIP);
  if (pin === undefined || !existsSync(zip) || sha256File(zip) !== pin) throw new UnderstandRefused(`${TN_ZIP} is missing or does not match its pin in sources-12oct.sha256`);
}

/**
 * `yada intros [--write]`: every book's introduction cut from tN (build 6 item G), as a dry-run report.
 * `--write` refreshes book_intros.json for the review tool, keeping a decision only where the text is
 * unchanged. Bundles pick the text up on their next `yada understand`.
 *
 * Refuses, exit 1, with tN unpinned or any book's file missing, and refuses to write fewer entries than
 * the committed file holds: a wrong YADA_ROOT once read as 66 books with "no tN file" and would have
 * written [] over every decision John made, exit 0 (code review, 15 Oct 2026).
 */
export function introsCommand(args: readonly string[], raw: string, dataDir: string, tyndale: (raw: string) => Map<BookCode, string> = readTyndale): number {
  try {
    checkTnPin(raw);
    tyndale(raw);
  } catch (error) {
    if (error instanceof UnderstandRefused) {
      console.error(`intros: REFUSED, nothing written. ${error.message}`);
      return 1;
    }
    throw error;
  }
  const missing = BOOK_ORDER.filter((book) => !existsSync(tnFile(raw, book)));
  if (missing.length > 0) {
    console.error(`intros: REFUSED, nothing written. No tN file for ${missing.join(", ")} under ${path.join(raw, "uw-tn/en_tn")}`);
    return 1;
  }
  const committed = existsSync(path.join(dataDir, INTROS_FILE)) ? readIntros(dataDir).entries : [];
  const results = extractIntros(raw, committed, tyndale);
  let shown = 0;
  for (const { book, result } of results) {
    if (result.intro === null) {
      console.log(`  ${book.padEnd(4)} none: ${result.reason}`);
      continue;
    }
    shown += 1;
    const weak = WEAK_INTROS[book];
    console.log(`  ${book.padEnd(4)} ${String(result.intro.words).padStart(2)}w ${result.intro.text}${weak === undefined ? "" : `  [weak: ${weak}]`}`);
  }
  console.log(`intros: ${shown} of ${results.length} books`);
  if (args.includes("--write")) {
    const entries = mergeIntros(committed, results);
    if (entries.length < committed.length) {
      console.error(`intros: REFUSED, nothing written. ${entries.length} entries would replace the ${committed.length} in ${INTROS_FILE}`);
      return 1;
    }
    writeIntros(dataDir, entries);
    console.log(`wrote ${entries.length} entries to ${path.join(dataDir, INTROS_FILE)} (${entries.filter((e) => e.status === "approved").length} approved)`);
  }
  return 0;
}

/** json.dump(indent=1, ensure_ascii=False), the review tool's own form, so a decision rewrites one line. */
export function writeIntros(dir: string, entries: readonly IntroEntry[]): void {
  writeFileSync(path.join(dir, INTROS_FILE), `${JSON.stringify({ _why: INTROS_WHY, entries }, null, 1)}\n`, "utf8");
}
