/**
 * Readers for the open sources behind Understand without AI (docs/no-ai-understand.md, 12 Oct 2026),
 * ported from the reference prototypes in packages/pipeline/prototypes. Each reader takes the file's
 * text, so tests feed it small inline fixtures; `UnderstandSources` finds the files under
 * YADA_ROOT/content/raw.
 *
 * Rule 9: nothing here reads a licensed translation. The only Bible texts read are the BSB, WEB,
 * KJV and LSV from core (all public domain); Tyndale's notes are read from the study bundle as
 * published and keep their NLT words marked.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { pySplit, splitLines, stripChars } from "./text.js";

// ---------------------------------------------------------------------------
// Credits and licences
// ---------------------------------------------------------------------------

/**
 * Shown under each line. The CC BY-SA licences ask an adapted copy to say what changed, so each
 * credit names the change (build session review, 12 Oct 2026). Word for word as assemble.py CREDITS.
 */
export const CREDITS = {
  ust: "Simplified Text, adapted from unfoldingWord (alignment markup removed) · CC BY-SA 4.0",
  tn: "Translation Notes, adapted from unfoldingWord (translator guidance removed; readings set in a fixed sentence) · CC BY-SA 4.0",
  tw: "Translation Words, adapted from unfoldingWord (definition only) · CC BY-SA 4.0",
  tq: "Translation Questions, adapted from unfoldingWord (verse references removed, spacing tidied) · CC BY-SA 4.0",
  obs: "Open Bible Stories, adapted from unfoldingWord (images removed) · CC BY-SA 4.0",
  // The glossary changes words inside Tyndale's sentences ("Gentiles" -> "non-Jews"); CC BY-SA asks that to be said.
  tyndale: "Adapted from Tyndale Open Study Notes: references and some quotations removed; some terms in plain words (e.g. “Gentiles” → “non-Jews”) · CC BY-SA 4.0",
  bsb: "Berean Standard Bible footnotes · public domain",
} as const;

export type CreditKey = keyof typeof CREDITS;

/** The only translations Understand reads from core. All four are public domain (rule 9). */
export const PUBLIC_DOMAIN_TEXTS = ["BSB", "WEB", "KJV", "LSV"] as const;
export type PublicDomainText = (typeof PUBLIC_DOMAIN_TEXTS)[number];

export class UnderstandRefused extends Error {}

export interface UwSource {
  key: Exclude<CreditKey, "tyndale" | "bsb"> | "twl";
  name: string;
  /** Directory under content/raw holding LICENSE.md, and the pinned zip in sources-12oct.sha256 / uw.sha256. */
  dir: string;
  zip: string;
  /** "The original work by unfoldingWord is available from …", which each LICENSE.md asks a derivative to say. */
  original: string;
}

export const UW_SOURCES: readonly UwSource[] = [
  { key: "ust", name: "unfoldingWord Simplified Text", dir: "uw-ust/en_ust", zip: "uw-ust/en_ust.zip", original: "unfoldingword.org/ust" },
  { key: "tn", name: "unfoldingWord Translation Notes", dir: "uw-tn/en_tn", zip: "uw-tn/en_tn.zip", original: "unfoldingword.org/utn" },
  { key: "tq", name: "unfoldingWord Translation Questions", dir: "uw-tq/en_tq", zip: "uw-tq/en_tq.zip", original: "unfoldingword.org/utq" },
  { key: "tw", name: "unfoldingWord Translation Words", dir: "uw-tw/en_tw", zip: "uw-tw/en_tw.zip", original: "unfoldingword.org/utw" },
  { key: "twl", name: "unfoldingWord Translation Word Links", dir: "uw-twl/en_twl", zip: "uw-twl/en_twl.zip", original: "unfoldingword.org/utw" },
  { key: "obs", name: "unfoldingWord Open Bible Stories", dir: "uw-obs/en_obs", zip: "uw-obs/en_obs.zip", original: "https://openbiblestories.org" },
];

const CC_BY_SA = "Creative Commons Attribution-ShareAlike 4.0 International License";

/**
 * Rule 3: the licence is read from each package's own LICENSE.md, never a badge. Returns the notice
 * as published; refuses a file that no longer grants CC BY-SA 4.0.
 */
export function checkUwLicence(source: UwSource, text: string): string {
  const notice = text.replace(/^\uFEFF/, "").trim();
  if (!notice.includes(CC_BY_SA)) throw new UnderstandRefused(`${source.dir}/LICENSE.md no longer says ${CC_BY_SA}; read the new terms first`);
  return notice;
}

/** "sha256  path" lines, as content/raw/sources-12oct.sha256 and uw.sha256 pin each download. */
export function parsePins(text: string): Map<string, string> {
  const pins = new Map<string, string>();
  for (const line of text.split("\n")) {
    const m = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/.exec(line);
    if (m?.[1] !== undefined && m[2] !== undefined) pins.set(m[2], m[1]);
  }
  return pins;
}

// ---------------------------------------------------------------------------
// Shared small helpers
// ---------------------------------------------------------------------------

/** Tags, `&amp;` and the tables' `|` quote marks removed, whitespace collapsed (assemble.py `plain`). */
export function plain(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\|/g, "").replace(/\s+/g, " ").trim();
}

/** unfoldingWord markdown to text: links to their words, "(See: …)" and rc:// links dropped, bold removed. */
export function md(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\[\[rc:\/\/[^\]]*\]\]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s*\(See:?[^)]*\)/g, "")
    .replace(/\*\*/g, "");
}

/**
 * Rows of an unfoldingWord TSV after its header, split on tabs. None of the pinned files holds a
 * double quote (checked 12 Oct 2026), so Python's csv reader and a plain split read them the same.
 */
export function tsvRows(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines.slice(1).map((line) => line.split("\t"));
}

/** Names as the Berean tables and Open Bible Stories write them ("Psalm 23:1"), normalised like core's ("Psalms"). */
export function normaliseBookName(name: string): string {
  return name.replace(/Psalms/g, "Psalm").replace(/Song of Solomon/g, "Song of Songs").trim().toLowerCase();
}

export type BookNames = ReadonlyMap<string, string>;

export function bookCodeByName(names: BookNames): Map<string, string> {
  return new Map([...names].map(([code, name]) => [normaliseBookName(name), code]));
}

// ---------------------------------------------------------------------------
// unfoldingWord Simplified Text (USFM)
// ---------------------------------------------------------------------------

export type VerseKey = `${number}:${number}`;
export const vk = (chapter: number, verse: number): VerseKey => `${chapter}:${verse}`;
export function parseVk(key: VerseKey): [number, number] {
  const [c, v] = key.split(":");
  return [Number(c), Number(v)];
}

/**
 * Plain verse text from aligned USFM. Chapter and verse markers can sit mid-line in poetry
 * ("\q1 \v 2 …"), so the text is split on the markers themselves, not on lines. Headings and
 * titles outside verses are dropped; a bridged verse ("\v 1-2") stands for each verse it covers.
 *
 * The two prototypes tidy slightly differently, and each output is what John read: the verse layer
 * (assemble.py) joins alignment markers without a space; the passage summaries (passage_summary.py)
 * leave a space, close up brackets, opening quotes and `{ … }`, rejoin split possessives and drop
 * every \s heading and inline section range. `summary: true` is the latter.
 */
export function ustVerses(usfm: string, options: { summary?: boolean } = {}): Map<VerseKey, string> {
  const summary = options.summary ?? false;
  let src = usfm.replace(/\\zaln-[se][^\\]*?\\\*/g, summary ? " " : "");
  src = src.replace(summary ? /\\w ([^|\\]+)\|[^\\]*\\w\*/g : /\\w ([^|\\]*)\|[^\\]*\\w\*/g, "$1");
  if (summary) {
    // A speaker heading (Song of Songs: "\sp The woman thinks about the man she loves") runs over several
    // lines once its words are aligned; it is not verse text, so it goes up to the next paragraph or verse
    // marker (John, 12 Oct 2026).
    src = src.replace(/\\sp\b[\s\S]*?(?=\\(?:q\d?|v|p|m|c|nb|li\d?|b)\b)/g, " ");
    // passage_summary.py also drops every \s* heading and an inline section range ("\sr 2:4-25", Genesis).
    src = src.replace(/^\\(?:s\w*|ms\d?|mt\d?|mr|toc\d|h|id|ide|usfm|sts|rem|cl|r)\b.*$/gm, "");
    src = src.replace(/\\(?:sr|r|mr)\s[^\\\n]*/g, " ");
  } else {
    src = src.replace(/^\\(?:s\d?|ms\d?|mt\d?|mr|toc\d|h|id|ide|usfm|sts|rem|cl|r)\b.*$/gm, "");
  }
  src = src.replace(/\\f .*?\\f\*/gs, "");
  const out = new Map<VerseKey, string>();
  let chapter = 0;
  let verse: [number, number] | null = null;
  for (const tok of src.split(/(\\c \d+|\\v \d+(?:-\d+)?)/)) {
    const c = /^\\c (\d+)/.exec(tok);
    if (c !== null) {
      chapter = Number(c[1]);
      verse = null;
      continue;
    }
    const v = /^\\v (\d+)(?:-(\d+))?/.exec(tok);
    if (v !== null) {
      verse = [Number(v[1]), Number(v[2] ?? v[1])];
      continue;
    }
    if (chapter === 0 || verse === null) continue;
    let t = tok.replace(/\\[a-z0-9-]+\*?/g, " ").replace(/\\\*/g, " ");
    if (summary) {
      t = t.replace(/\s+([,.;:!?’”)])/g, "$1").replace(/([“‘(])\s+/g, "$1");
      t = t.replace(/\s+\}/g, "}").replace(/\{\s+/g, "{");
      t = t.replace(/\s+/g, " ").trim();
      // Alignment markup can split a possessive or contraction ("Jesse’ s son"): rejoin it.
      t = t.replace(/([\p{L}\p{N}_])\s*([’'])\s+(s|t|re|ll|ve|d|m)\b/gu, "$1$2$3");
      // And a number's thousands ("12, 000", Revelation 7:5), and a word run into an added word ("flaws{this way}").
      t = t.replace(/(\d),\s+(\d{3})\b/g, "$1,$2").replace(/([\p{L}\p{N}_])\{/gu, "$1 {");
    } else {
      t = t.replace(/\s+/g, " ").replace(/\s+([,.;:!?’”])/g, "$1").trim();
    }
    for (let n = verse[0]; n <= verse[1]; n += 1) {
      const key = vk(chapter, n);
      out.set(key, `${out.get(key) ?? ""} ${t}`.trim());
    }
  }
  return out;
}

const SP_VERB = /^(.*?)\s+(?:speak|think|say|talk|respond|repl|prais|describ|sing|call|ask|answer|tell|continu|express|long|admir|invit|warn|imagin)[\p{L}\p{N}_]*\b/u;

/**
 * Verse -> speaker from the UST's own speaker headings ("\sp The woman thinks about the man she loves").
 * The Song of Songs never names its speakers, so tN says the UST "places a header to identify the speaker";
 * Glyssen marks every line there "uncertain". A verse takes the speaker whose heading came before it starts
 * (John, 12 Oct 2026: love poetry names its speakers).
 */
export function ustSpeakers(usfm: string): Map<VerseKey, string> {
  const src = usfm.replace(/\\zaln-[se][^\\]*?\\\*/g, " ").replace(/\\w ([^|\\]+)\|[^\\]*\\w\*/g, "$1");
  const out = new Map<VerseKey, string>();
  let chapter = 0;
  let current: string | null = null;
  for (const tok of src.split(/(\\c \d+|\\v \d+(?:-\d+)?|\\sp\b[\s\S]*?(?=\\(?:q\d?|v|p|m|c|nb|li\d?|b)\b))/)) {
    const c = /^\\c (\d+)/.exec(tok);
    if (c !== null) {
      chapter = Number(c[1]);
      continue;
    }
    const v = /^\\v (\d+)(?:-(\d+))?/.exec(tok);
    if (v !== null && chapter !== 0 && current !== null) {
      for (let n = Number(v[1]); n <= Number(v[2] ?? v[1]); n += 1) out.set(vk(chapter, n), current);
      continue;
    }
    if (tok.startsWith("\\sp")) {
      const head = tok.slice(3).replace(/\\[a-z0-9-]+\*?/g, " ").replace(/\s+/g, " ").trim();
      const sm = SP_VERB.exec(head);
      const who = sm !== null ? (sm[1] ?? "") : pySplit(head).length <= 4 ? head : null;
      if (who) current = who;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Translation Notes
// ---------------------------------------------------------------------------

export interface TnRow {
  ref: string;
  id: string;
  support: string;
  quote: string;
  note: string;
}

export function tnRows(text: string): TnRow[] {
  return tsvRows(text).map((r) => ({ ref: r[0] ?? "", id: r[1] ?? "", support: r[3] ?? "", quote: r[4] ?? "", note: r[6] ?? "" }));
}

const BOOK_WORD =
  /\s+(?:[1-3]\s)?(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Isaiah|Jeremiah|Ezekiel|Daniel|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Hebrews|Revelation)$/;

/**
 * An outline item, tidied: links as plain text, no trailing book name ("Joseph’s death Genesis"), single
 * spaces. A book name a preposition needs stays ("Introduction and purpose for Proverbs", John, 12 Oct 2026).
 */
export function cleanTitle(t: string): string {
  let out = t.trim().replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  if (!/\b(?:for|of|in|to|from|about|on|the)\s+(?:[1-3]\s)?[A-Z][a-z]+$/.test(out)) out = out.replace(BOOK_WORD, "");
  return out.replace(/\s+/g, " ").trim();
}

/** A range as the outlines write it: "(1:1–18)", "(2–11)", "(21)", "([1:19–51](../01/19.md))". */
export interface OutlineSection {
  c1: number;
  v1: number;
  c2: number;
  v2: number;
  line: string;
}

/**
 * The book outline in the front:intro note, whole-chapter items ("Jesus meets with the disciples
 * (21)") and the text-variant list included. Rows are read as passage_summary.py reads them, by
 * `splitlines`, so its result is the prototype's.
 */
export function tnBookOutline(text: string): OutlineSection[] {
  const out: OutlineSection[] = [];
  for (const line of splitLines(text.replace(/^\uFEFF/, "")).slice(1)) {
    const cols = line.split("\t");
    if (cols.length < 7 || cols[0] !== "front:intro") continue;
    out.push(...referenceFirst(cols[6] ?? ""));
    for (const item of (cols[6] ?? "").split("\\n")) {
      // The reference can be a link, a half verse ("7:1–9a", "[7:9b](…)-[8:3](…)", Song of Songs) or a list
      // ("[12:31–50](…), [13:1–22](…)", Exodus): the item runs from the first to the last.
      const m = /^\s*(?:\d+\.|\*)\s+(.+?)\s*\(((?:b?\[?\d[\d:–\-ab]*\]?(?:\([^)]*\))?(?:,\s*|[–-])?)+)\)/.exec(item);
      if (m === null) continue;
      const parts = (m[2] ?? "").replace(/\]\([^)]*\)|\[/g, "").split(/,\s*/).filter((x) => x !== "");
      const ends: Array<[number, number, number, number]> = [];
      for (const part of [parts[0] ?? "", parts.at(-1) ?? ""]) {
        const r = /^b?(\d+)(?::(\d+))?[ab]?(?:[–-](\d+)(?::(\d+))?[ab]?)?/.exec(part);
        if (r === null) break;
        const c1 = Number(r[1]);
        const v1 = Number(r[2] ?? 1);
        let c2: number;
        let v2: number;
        if (r[4] !== undefined) [c2, v2] = [Number(r[3]), Number(r[4])];
        else if (r[3] !== undefined && r[2] !== undefined) [c2, v2] = [c1, Number(r[3])];
        else if (r[3] !== undefined) [c2, v2] = [Number(r[3]), 999];
        else [c2, v2] = [c1, r[2] === undefined ? 999 : v1];
        ends.push([c1, v1, c2, v2]);
      }
      const [first, last] = ends;
      if (ends.length === 2 && first !== undefined && last !== undefined) out.push({ c1: first[0], v1: first[1], c2: last[2], v2: last[3], line: cleanTitle(m[1] ?? "") });
    }
  }
  return out;
}

/**
 * Joel's and Malachi's outlines put the reference first, with no number or bullet: "2:12–17 Joel and Yahweh
 * call the people…", "[2:17](…)–[3:5](…) Yahweh is concerned…". Read only under the "Outline of" heading, so
 * prose that opens with a reference is never taken for an item (66-book run, 13 Oct 2026: every Joel and
 * Malachi summary was flagged "no headline" with these outlines unread).
 */
function referenceFirst(intro: string): OutlineSection[] {
  const out: OutlineSection[] = [];
  let inOutline = false;
  for (const raw of intro.split("\\n")) {
    if (/^#+\s/.test(raw)) {
      inOutline = /^#+\s*Outline\b/i.test(raw);
      continue;
    }
    if (!inOutline) continue;
    const line = raw.replace(/\]\([^)]*\)|\[/g, "");
    const m = /^\s*(\d+):(\d+)[ab]?(?:[–-](\d+)(?::(\d+))?[ab]?)?\s+(\S.*)$/.exec(line);
    if (m === null) continue;
    const c1 = Number(m[1]);
    const v1 = Number(m[2]);
    const [c2, v2] = m[4] !== undefined ? [Number(m[3]), Number(m[4])] : m[3] !== undefined ? [c1, Number(m[3])] : [c1, v1];
    out.push({ c1, v1, c2, v2, line: cleanTitle(m[5] ?? "") });
  }
  return out;
}

/** The numbered items of the front:intro outline as tN wrote them, in order, for outlines that name no verses. */
export function tnNumberedItems(text: string): string[] {
  const out: string[] = [];
  for (const line of splitLines(text.replace(/^\uFEFF/, "")).slice(1)) {
    const cols = line.split("\t");
    if (cols.length < 7 || cols[0] !== "front:intro") continue;
    let inOutline = false;
    for (const raw of (cols[6] ?? "").split("\\n")) {
      if (/^#+\s/.test(raw)) inOutline = /^#+\s*Outline\b/i.test(raw);
      const m = inOutline ? /^(\d+)\.\s+(.+?)\s*$/.exec(raw) : null;
      if (m !== null) out[Number(m[1]) - 1] = (m[2] ?? "").trim();
    }
  }
  return out;
}

/** A chapter-outline line: one chapter, verses v1 to v2 (999 when the section runs into the next chapter). */
export interface OutlineEvent {
  chapter: number;
  v1: number;
  v2: number;
  line: string;
}

export interface TnGuides {
  events: OutlineEvent[];
  /**
   * A chapter introduction's parts written as bare ranges ("Woe to Ariel (1–8)", "(vv. 2–19) …"), which
   * Isaiah, Jeremiah, Ezekiel, Kings and Chronicles use. Kept apart from `events`: summarise() picks its
   * sentences by the event key, so these give only a headline (headline exploration, 15 Oct 2026).
   */
  parts: OutlineSection[];
  /** Verses tagged writing-background or figs-events (11:2's later anointing): background, not what happens. */
  asides: Set<VerseKey>;
}

/**
 * Chapter introductions' outlines and the aside tags. Numbered items and "*" bullets both, since
 * Mark lists its passages as bullets (20 outline lines instead of 111 without them, 12 Oct 2026),
 * and single-verse ranges ("(4:33)"). A section that ends in a later chapter runs to the end of its
 * own, because an event carries one chapter.
 */
export function tnGuides(text: string): TnGuides {
  const events: OutlineEvent[] = [];
  const parts: OutlineSection[] = [];
  const asides = new Set<VerseKey>();
  for (const line of splitLines(text.replace(/^\uFEFF/, "")).slice(1)) {
    const cols = line.split("\t");
    if (cols.length < 7) continue;
    const ref = cols[0] ?? "";
    const m = /^(\d+):(\d+)/.exec(ref);
    if (m !== null && /writing-background|figs-events/.test(cols[3] ?? "")) asides.add(vk(Number(m[1]), Number(m[2])));
    if (!/^\d+:intro/.test(ref)) continue;
    for (const item of (cols[6] ?? "").split("\\n")) {
      const mm = /^\s*(?:\d+\.|\*)\s+(.+?)\s*\(\[(\d+):(\d+)(?:[–-](?:(\d+):)?(\d+))?\]/.exec(item);
      if (mm === null) {
        const part = barePart(item, Number(ref.split(":")[0]));
        if (part !== null) parts.push(part);
        // Exodus writes its outlines as verse ranges of the chapter ("* v. 1–6: Inner covering").
        const mv = /^\s*\*\s+v\.\s*(\d+)(?:\s*[–-]\s*(\d+))?:\s*(.+?)\s*$/.exec(item);
        if (mv !== null) events.push({ chapter: Number(ref.split(":")[0]), v1: Number(mv[1]), v2: Number(mv[2] ?? mv[1]), line: cleanTitle(mv[3] ?? "") });
        continue;
      }
      const c1 = Number(mm[2]);
      const v1 = Number(mm[3]);
      const c2 = mm[4] === undefined ? c1 : Number(mm[4]);
      const v2 = mm[5] === undefined ? v1 : Number(mm[5]);
      events.push({ chapter: c1, v1, v2: c2 === c1 ? v2 : 999, line: cleanTitle(mm[1] ?? "") });
    }
  }
  return { events, parts, asides };
}

/** "* Title (2–3)", "* Title (vv. 2–19)", "* (2–3) Title": a part of chapter `chapter`, or null. */
export function barePart(item: string, chapter: number): OutlineSection | null {
  const range = "\\((?:vv?\\.\\s*|verses?\\s*)?\\[?(?:(\\d+):)?(\\d+)[ab]?(?:\\s*[–-]\\s*(?:(\\d+):)?(\\d+)[ab]?)?\\]?(?:\\([^)]*\\))?\\)";
  const trail = new RegExp(`^\\s*(?:\\d+\\.|\\*|-)\\s+(.+?)\\s*${range}\\s*\\.?$`).exec(item);
  const lead = trail === null ? new RegExp(`^\\s*(?:\\d+\\.|\\*|-)\\s+${range}\\s*(.+?)\\s*$`).exec(item) : null;
  const m = trail ?? lead;
  if (m === null) return null;
  const [title, c1s, v1s, c2s, v2s] = trail !== null ? [m[1], m[2], m[3], m[4], m[5]] : [m[5], m[1], m[2], m[3], m[4]];
  const c1 = c1s === undefined ? chapter : Number(c1s);
  const v1 = Number(v1s);
  const c2 = c2s === undefined ? c1 : Number(c2s);
  const v2 = v2s === undefined ? v1 : Number(v2s);
  const line = cleanTitle((title ?? "").replace(/\]\([^)]*\)|\[|\]/g, "").trim().replace(/[.:]$/, ""));
  return line === "" ? null : { c1, v1, c2, v2, line };
}

// ---------------------------------------------------------------------------
// Translation Questions
// ---------------------------------------------------------------------------

export interface TqRow {
  ref: string;
  question: string;
  answer: string;
}

export function tqRows(text: string): TqRow[] {
  return tsvRows(text).map((r) => ({ ref: r[0] ?? "", question: r[5] ?? "", answer: r[6] ?? "" }));
}

export interface TqAnswer {
  chapter: number;
  verse: number;
  answer: string;
}

/**
 * Answers that state a key fact plainly, the job a summary sentence does. An answer that leans on
 * its question ("No.", "She told this…"), runs under 5 words or does not end a sentence is skipped.
 */
export function tqAnswers(text: string): TqAnswer[] {
  const out: TqAnswer[] = [];
  for (const line of splitLines(text.replace(/^\uFEFF/, "")).slice(1)) {
    const cols = line.split("\t");
    if (cols.length < 7) continue;
    const m = /^(\d+):(\d+)/.exec(cols[0] ?? "");
    // A trailing reference ("…to encourage them. 50:22-26") is the answer's citation, not part of what it says.
    const answer = (cols[6] ?? "")
      .trim()
      .replace(/\s*\(?\b\d+:\d+(?:[-–]\d+)?(?:,\s*\d+(?::\d+)?(?:[-–]\d+)?)*\)?\s*$/, "")
      .trim()
      .replace(/\s+([.,;:!?])/g, "$1");
    const leans = /^(Yes|No|He|She|They|It|This|That|These|Those|Because|To|So)\b/.test(answer);
    if (m !== null && !leans && pySplit(answer).length >= 5 && /[.!?]$/.test(answer)) {
      out.push({ chapter: Number(m[1]), verse: Number(m[2]), answer });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Translation Words and Word Links
// ---------------------------------------------------------------------------

export interface TwlRow {
  ref: string;
  link: string;
}

export function twlRows(text: string): TwlRow[] {
  return tsvRows(text).map((r) => ({ ref: r[0] ?? "", link: r[5] ?? "" }));
}

/** "rc://*\/tw/dict/bible/kt/church" -> ["kt", "church"], else null. */
export function twLinkPath(link: string): [string, string] | null {
  const m = /\/tw\/dict\/bible\/(\w+)\/([\w-]+)$/.exec(link);
  return m === null ? null : [m[1] ?? "", m[2] ?? ""];
}

export interface TwArticle {
  term: string;
  definition: string;
  kind: string;
}

/**
 * The whole Definition (or Facts) section, its bullets kept as lines; translation suggestions are never read.
 * Only the first paragraph was kept until 23 Oct 2026, which left out the line John 1:1 needs ("In the New
 * Testament, Jesus is called “the Word”…" is a bullet of "word of God").
 */
export function twArticle(text: string, kind: string): TwArticle | null {
  const t = md(text);
  const title = /^#\s*(.+)/.exec(t);
  if (title === null) return null;
  const section = /##\s*(?:Definition|Facts):?\s*\n([\s\S]*?)(?=\n##(?!#)|$)/.exec(t);
  const body = (section?.[1] ?? "")
    .split("\n")
    .map((line) =>
      line
        .replace(/^#+\s*/, "")
        .replace(/^\s{2,}[*-]\s+/, "    ◦ ")
        .replace(/^[*-]\s+/, "• ")
        .trimEnd(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { term: (title[1] ?? "").split(",")[0]?.trim() ?? "", definition: body, kind };
}

function escapeQuote(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The definition's sentences in order, without list markers. */
export function definitionSentences(definition: string): string[] {
  return definition
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[•◦]|\d+\.)\s+/, "").trim())
    .filter((line) => line !== "")
    .flatMap((line) => line.split(/(?<=[.!?][”"’]?)\s+(?=[“"A-Z])/u))
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/**
 * A sentence that reads alone: not one that leans on the one before ("Another term with the same meaning is
 * “Father”"), not a lead-in to a list ("…slightly different meanings:"), and long enough to say something
 * ('To “testify” is to give “testimony.”'). All three were picked on John 1 before this check (23 Oct 2026).
 */
function standsAlone(s: string): boolean {
  return !/:$/u.test(s) && !/^(?:Another|This|These|That|Those|It|Its|They|He|She|Also|Such)\b/u.test(s) && s.split(/\s+/u).length >= 8;
}

/**
 * The definition's sentence to show beside a verse: the first that stands alone and quotes words the verse
 * itself says, as written (case matters past the first letter: John 1:1's "the Word" is the title, "the word"
 * is any message, and 1:14 opens "The Word"); else the first that stands alone; else the first.
 * Every sentence is the article's own, so nothing is written for the verse (rule 4).
 */
export function leadSentence(definition: string, verseText: string): string {
  const sentences = definitionSentences(definition);
  for (const s of sentences) {
    if (!standsAlone(s)) continue;
    for (const m of s.matchAll(/“([^”]+)”/gu)) {
      const quote = (m[1] ?? "").replace(/[.,;:!?]+$/u, "").trim();
      if (quote === "" || quote.includes("[")) continue;
      const first = quote[0] ?? "";
      const head = first.toLowerCase() === first.toUpperCase() ? escapeQuote(first) : `[${first.toLowerCase()}${first.toUpperCase()}]`;
      if (new RegExp(`(?:^|[^\\p{L}])${head}${escapeQuote(quote.slice(1))}(?:$|[^\\p{L}])`, "u").test(verseText)) return s;
    }
  }
  return sentences.find(standsAlone) ?? sentences[0] ?? "";
}

// ---------------------------------------------------------------------------
// Open Bible Stories
// ---------------------------------------------------------------------------

export interface ObsSpan {
  book: string;
  c1: number;
  v1: number;
  c2: number;
  v2: number;
}

export interface ObsStory {
  no: number;
  title: string;
  /** Paragraphs of the story, images removed (no images in reading; their licence is unchecked). */
  frames: string[];
  spans: ObsSpan[];
}

/** One story file, spans read from its "_A Bible story from: …_" line. */
export function obsStory(no: number, text: string, byName: ReadonlyMap<string, string>): ObsStory {
  const title = (/^#\s*(.+)/.exec(text)?.[1] ?? "").trim();
  const frames = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .split("\n\n")
    .slice(1)
    .map((x) => x.trim())
    .filter((x) => x !== "" && !x.startsWith("_"));
  const ref = /_A Bible story from:\s*(.+?)_/.exec(text);
  const spans: ObsSpan[] = [];
  for (const part of (ref?.[1] ?? "").split(";")) {
    const m = /^\s*((?:[1-3] )?[A-Za-z ]+?)\s+(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?\s*$/.exec(part);
    const book = m === null ? undefined : byName.get(normaliseBookName(m[1] ?? ""));
    if (m === null || book === undefined) continue;
    const c1 = Number(m[2]);
    const v1 = Number(m[3] ?? 1);
    let c2: number;
    let v2: number;
    if (m[5] !== undefined) [c2, v2] = [Number(m[4]), Number(m[5])];
    else if (m[4] !== undefined && m[3] !== undefined) [c2, v2] = [c1, Number(m[4])];
    else if (m[4] !== undefined) [c2, v2] = [Number(m[4]), 999];
    else [c2, v2] = [c1, m[3] === undefined ? 999 : v1];
    spans.push({ book, c1, v1, c2, v2 });
  }
  return { no, title, frames, spans };
}

// ---------------------------------------------------------------------------
// Berean BSB translation tables
// ---------------------------------------------------------------------------

export interface TableWord {
  orig: string;
  strong: string;
  bsb: string;
  /** The BSB footnote on this word, tags removed (assemble.py `plain`). */
  foot: string;
  /** The same footnote as passage_summary.py reads it (cleanFootnote). */
  footRaw: string;
}

export interface TableHeading {
  chapter: number;
  verse: number;
  heading: string;
  /** The heading as passage_summary.py reads it: tags and `|` become spaces ("BOOK I Psalms 1–41 The Two Paths"). */
  summaryHeading: string;
  parallels: string;
}

/**
 * A BSB footnote as plain text. A quoted verse inside it keeps its verse number in a span ("<span
 * class=|fnv|>9</span>But they quickly reported…", Mark 16:8), which glues onto the next word ("9But") once
 * the markup goes: the number is dropped first (John, 12 Oct 2026).
 */
export function cleanFootnote(raw: string): string {
  return raw
    .replace(/<span class=\|fnv\|>\s*\d+\s*<\/span>/g, "")
    .replace(/<[^>]+>|\|/g, "")
    .replace(/(?:(?<=^)|(?<=[\s:“(]))\d+(?=[A-Z][a-z])/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A footnote shows as one plain sentence at most; the rest waits behind "Read the note" (Mark 16:8). */
export function footnoteFact(note: string): [string, string] {
  const t = note.trim();
  const m = /(?<=[a-z0-9][.!?])\s+(?=[A-Z])/.exec(t);
  return m === null ? [t, ""] : [t.slice(0, m.index), t.slice(m.index + m[0].length)];
}

export interface BookTables {
  /** Verse -> its words, in the file's order (which is the order the word-count fact lists verses in). */
  verses: Map<VerseKey, TableWord[]>;
  headings: TableHeading[];
  /** Each row's cross-reference links, by the verse it sits in: the BSB prints a section's parallels under its heading. */
  parallels: Array<{ chapter: number; verse: number; refs: string[] }>;
  /** The book's name as the tables write it ("Song of Solomon", "Psalm"), or "" when it has no rows. */
  name: string;
}

/**
 * One book's rows from the Berean tables (public domain per berean.bible/licensing): each original
 * word's BSB rendering and Strong's number, the BSB's section headings and its footnotes. Column 12
 * names the verse once, at its first word ("Psalm 23:1"); later rows inherit it.
 */
export function bsbTables(text: string, book: string, byName: ReadonlyMap<string, string>): BookTables {
  const verses = new Map<VerseKey, TableWord[]>();
  const headings: TableHeading[] = [];
  const parallels: BookTables["parallels"] = [];
  let name = "";
  let cur: VerseKey | null = null;
  let first = true;
  let start = 0;
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  while (start < body.length) {
    let end = body.indexOf("\n", start);
    if (end === -1) end = body.length;
    const line = body.slice(start, body[end - 1] === "\r" ? end - 1 : end);
    start = end + 1;
    if (first) {
      first = false;
      continue;
    }
    const r = line.split("\t");
    if (r.length < 23) continue;
    if (r[12] !== "") {
      const m = /^(.*) (\d+):(\d+)$/.exec(r[12] ?? "");
      cur = m !== null && byName.get(normaliseBookName(m[1] ?? "")) === book ? vk(Number(m[2]), Number(m[3])) : null;
      if (cur !== null && name === "") name = m?.[1] ?? "";
    }
    if (cur === null) continue;
    if (r[13] !== "") {
      const h = plain(r[13] ?? "");
      const [c, v] = parseVk(cur);
      const summaryHeading = (r[13] ?? "").replace(/<[^>]+>|\|/g, " ").replace(/\s+/g, " ").trim();
      if (h !== "") headings.push({ chapter: c, verse: v, heading: h, summaryHeading, parallels: stripChars(plain(r[14] ?? ""), "() ") });
    }
    if (r[14] !== "") {
      const [c, v] = parseVk(cur);
      parallels.push({ chapter: c, verse: v, refs: [...(r[14] ?? "").matchAll(/>([^<>]+?)<\/a>/g)].map((x) => x[1] ?? "") });
    }
    const words = verses.get(cur) ?? [];
    if (words.length === 0) verses.set(cur, words);
    words.push({
      orig: (r[6] ?? "").trim(),
      strong: r[11] || r[10] || "",
      bsb: (r[18] ?? "").trim(),
      foot: plain(r[21] ?? ""),
      footRaw: cleanFootnote(r[21] ?? ""),
    });
  }
  return { verses, headings, parallels, name };
}

// ---------------------------------------------------------------------------
// Finding the files
// ---------------------------------------------------------------------------

/** YADA_ROOT when set (a worktree has no content/), else the repo this file is in. */
export function yadaRoot(fallback: string): string {
  return process.env["YADA_ROOT"] ?? fallback;
}

export interface RawFiles {
  raw: string;
}

export function readIfExists(file: string): string | null {
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}

export function ustFile(raw: string, book: string): string | null {
  const dir = path.join(raw, "uw-ust/en_ust");
  if (!existsSync(dir)) return null;
  const name = readdirSync(dir).find((f) => f.endsWith(`-${book}.usfm`));
  return name === undefined ? null : path.join(dir, name);
}

export function obsStories(raw: string, byName: ReadonlyMap<string, string>): ObsStory[] {
  const dir = path.join(raw, "uw-obs/en_obs/content");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d+\.md$/.test(f))
    .sort()
    .map((f) => obsStory(Number(f.slice(0, -3)), readFileSync(path.join(dir, f), "utf8"), byName));
}
