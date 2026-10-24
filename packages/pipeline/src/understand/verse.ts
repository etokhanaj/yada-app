/**
 * The verse layers of Understand without AI: a port of assemble.py's `assemble()` (v3, 12 Oct 2026).
 * Every line is a published source adapted only by rule and credited, or a data fact in a fixed
 * template sentence (TEMPLATES). Nothing is generated (rules 2 and 4).
 */

import { CREDITS, leadSentence, md, plain, vk, type BookTables, type TnRow, type TqRow, type TwArticle, type TwlRow, type VerseKey } from "./sources.js";
import type { Debate } from "./passage.js";
import { escapeRegExp, fill, opcodes, pySplit, rstripChars, stripChars, unique } from "./text.js";

// ---------------------------------------------------------------------------
// Reviewed tables (John reviews each line once)
// ---------------------------------------------------------------------------

export const FRAME: Readonly<Record<string, string>> = {
  JHN: "John’s account of Jesus’ life, written so that readers would believe in him",
  "1CO": "Paul’s letter to the church in Corinth, answering their questions and problems",
};

/** Plain words for terms a beginner meets in notes, meaning kept; then the BSB footnotes' abbreviations. */
const GLOSSARY: ReadonlyArray<[RegExp, string]> = [
  [/\bthe synoptic Gospels\b/g, "Matthew, Mark and Luke"],
  [/\bsynoptic Gospels\b/g, "Matthew, Mark and Luke"],
  [/\bthe Pastoral Letters\b/g, "Paul’s letters to Timothy and Titus"],
  [/\bthe Sanhedrin\b/g, "the Jewish high council"],
  [/\bGentiles\b/g, "non-Jews"],
  [/\bthe torah\b/g, "the law of Moses"],
  [/\bthe logos\b/g, "the Word"],
  [/\bprologue\b/g, "opening"],
  [/\bquintessential\b/g, "very"],
  // TR is the Textus Receptus, Greek editions printed 1516–1633, not manuscripts (audit, 12 Oct 2026); NA
  // and NE are modern critical editions.
  [/\bNE, BYZ, and TR include\b/g, "One modern edition, later manuscripts and Greek editions printed in the 1500s and 1600s include"],
  [/\bBYZ and TR include\b/g, "Later manuscripts and Greek editions printed in the 1500s and 1600s include"],
  [/\bTR includes\b/g, "Greek editions printed in the 1500s and 1600s include"],
  [/\bBYZ and TR\b/g, "Later manuscripts and Greek editions printed in the 1500s and 1600s"],
  [/\bBYZ\b/g, "Later manuscripts"],
  [/\bTR\b/g, "Greek editions printed in the 1500s and 1600s"],
  [/\bLXX\b/g, "the Greek Old Testament"],
  [/\bMT\b/g, "the Hebrew text"],
  [/\bDSS\b/g, "the Dead Sea Scrolls"],
  [/\bNA\b/g, "A modern critical edition"],
];

/** Every fact sentence the app can show; data fills the braces. John reviews each once. */
export const TEMPLATES = {
  differ: "Translations differ: “{bsb}” (BSB) · {others}.",
  word: "“{bsb}” translates a word used {n} times in {book}{where}.",
  cited: "Quotes {ref}.",
  speakers: "Speaking: {names}.",
  // A word fact with its own comparison, never a raw count with nothing to compare (John, 12 Oct 2026).
  // Draft, John approves.
  jps: "A Jewish translation, the JPS 1917, reads: “{jps}”",
  intro2: "Some readers believe {a}; others believe {b}.",
  most: "{book} uses the word for “{bsb}” more than any other book: {n} of its {total} uses in the Bible.",
  // Readers differ, in fixed shapes the reader can follow: the phrase is named by the BSB's own words,
  // through the translation tables, so no translator framing survives. Three wordings, so a page of
  // readings doesn't repeat one shape (John, 12 Oct 2026: approve two or three variants once).
  read2: ["Some read “{about}” as {a}. Others read it as {b}.", "“{about}” can mean {a}, or {b}.", "Readers take “{about}” two ways: {a}; or {b}."],
  read3: [
    "Some read “{about}” as {a}. Others read it as {b}. Still others, as {c}.",
    "“{about}” can mean {a}, {b}, or {c}.",
    "Readers take “{about}” three ways: {a}; {b}; or {c}.",
  ],
} as const;

/** Readings in the half view; the full view shows every one (John, 12 Oct 2026). */
export const HALF_READINGS = 3;

/** House style: about 150 words before any tap. */
export const WORD_BUDGET = 150;
/** Words per reading on the first screen; past it, "Read the full note". */
export const READING_CAP = 18;

export function gloss(text: string): string {
  return GLOSSARY.reduce((t, [pattern, plainWords]) => t.replace(pattern, plainWords), text);
}

export function sentences(par: string): string[] {
  return par.split(/(?<=[.!?”])\s+(?=[A-Z“(])/).filter((x) => x !== "");
}

export function wordCount(text: string): number {
  return (text.match(/\S+/g) ?? []).length;
}

const DANGLING = /^(It|This|These|That|There|They|He|She|His|Her|Its|Their|Such|Here|Then|Also|However)\b/;
const REFWORD = String.raw`(?:[1-3]\s)?[A-Z][a-z]+`;

export const STOP = new Set(
  "a an the and or but of to in on for with is was be are were that this it he she they him his her their them who whom which as at by from not no so if then also let your".split(" "),
);
export const MODAL = new Set(["has", "have", "had", "is", "are", "was", "were", "shall", "should", "will", "would", "may", "might", "must", "can", "could", "do", "does", "did", "be"]);
const stopOrModal = (w: string): boolean => STOP.has(w) || MODAL.has(w);

/** A word's comparison key: lower case, "n't" dropped, letters only. */
export function key(word: string): string {
  return word.toLowerCase().replace(/’/g, "'").replace(/n't$/, "").replace(/[^a-z]/g, "");
}

/** Contractions written out, so "don't" lines up with "do not" in another translation. */
export function expand(text: string): string {
  return text.replace(/([\p{L}\p{N}_]+)n[’']t\b/gu, (_, stem: string) => `${stem === "won" ? "will" : stem === "sha" ? "shall" : stem} not`);
}

/** Accents and points removed, letters only: how a note's Greek or Hebrew quote meets the tables' words. */
export function bare(word: string): string {
  return word.normalize("NFD").replace(/[^\p{L}\p{N}_]/gu, "").toLowerCase();
}

/** Words addressed to a translator. Any sentence or reading that has one is dropped (docs/no-ai-understand.md). */
const TRANSLATOR =
  /(your language|Alternate translation|If it would be helpful|If possible,|you could|you may|you should|In your translation|\bULT\b|\bUST\b|translate this|translated as|translators?\b)/i;

/** Support-reference tags whose notes are about grammar or translation, never meaning. */
const SKIP_TAGS = [
  "figs-imperative3p", "figs-activepassive", "figs-abstractnouns", "writing-pronouns", "grammar-", "figs-possession",
  "figs-ellipsis", "figs-infostructure", "figs-nominaladj", "figs-genericnoun", "figs-quotations", "writing-quotations",
  "figs-gendernotations", "figs-exclusive", "figs-doublet", "translate-unknown", "figs-123person", "figs-rquestion",
];

const MS = /manuscript|\bBYZ\b|\bTR\b|\bNA\b|\bECM\b|\bSBL\b/;

// ---------------------------------------------------------------------------
// The data a book's verses are assembled from
// ---------------------------------------------------------------------------

export interface StudyNote {
  ordStart: number;
  ordEnd: number;
  text: string;
}

export interface BookData {
  book: string;
  /** Core's name for the book ("1 Corinthians"). */
  name: string;
  ust: ReadonlyMap<VerseKey, string>;
  tn: readonly TnRow[];
  tq: readonly TqRow[];
  twl: readonly TwlRow[];
  tw: (link: string) => TwArticle | null;
  tables: BookTables;
  /** Core's verse ord, or null when core has no such verse. */
  ord: (chapter: number, verse: number) => number | null;
  /** A public-domain text of a verse by ord, "" when absent. */
  /**
   * A public-domain text of a verse by ord, "" when absent. JPS 1917 comes from its own optional bundle
   * (translation-jps.vN.db); without it, "" and nothing about JPS shows.
   */
  text: (ord: number, translation?: "BSB" | "WEB" | "KJV" | "LSV" | "JPS") => string;
  /** Glyssen names that speak in a verse (`speaks` rows of a character or group), in line order. */
  speakers: (ord: number) => string[];
  /** Every `speaks` row of a verse, any kind, in line order, with Glyssen's quote position. */
  speechRows: (ord: number) => Array<{ name: string; kind: string; quotePosition: string | null }>;
  /** Verses an occurrence key's word occurs in within the book ("14:28"), by ord. */
  keyRefs: (key: string) => string[];
  /** Tyndale verse notes covering an ord, tightest first, then the later start. */
  studyNotes: (ord: number) => StudyNote[];
  /** The book's last chapter in core, for the last BSB section's end. */
  lastChapter: number;
  /** Chapters, for a book with no BSB headings. */
  chapters: readonly number[];
  /** Major debates (prototypes/data/debates.json). */
  debates: readonly Debate[];
  /** The book bundle's own passages (`<book>.vN.db` pericopes), as the guide cuts them. */
  pericopes: ReadonlyArray<{ label: string; start: [number, number]; end: [number, number] }>;
  /** Core's verses for the book, verse 0 (a psalm title) left out, in order. */
  verseList: ReadonlyArray<[number, number]>;
  /** Core's original-language tokens in a verse, by position. */
  tokens: (ord: number) => ReadonlyArray<{ key: string; lemma: string; morph: string; surface: string }>;
  /** Per book, how often an occurrence key's word is used, most first. */
  occurrences: (key: string) => ReadonlyArray<{ book: string; count: number }>;
}

export interface Section {
  title: string;
  start: [number, number];
  end: [number, number];
  parallels: string;
}

const le = (a: readonly [number, number], b: readonly [number, number]): boolean => a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);

/** BSB sections, heading to heading; a book without headings is one section per chapter. */
export function sections(data: BookData): Section[] {
  let hs = data.tables.headings.map((h) => ({ c: h.chapter, v: h.verse, title: h.heading, parallels: h.parallels }));
  if (hs.length === 0) hs = data.chapters.map((c) => ({ c, v: 1, title: `${data.name} ${c}`, parallels: "" }));
  return hs.map((h, i) => {
    const next = hs[i + 1];
    const [nc, nv] = next === undefined ? [data.lastChapter, 999] : [next.c, next.v];
    return { title: h.title, start: [h.c, h.v], end: nv > 1 ? [nc, nv - 1] : [nc - 1, 999], parallels: h.parallels };
  });
}

/** Facts derived once per book from the tables. */
export interface Derived {
  /** Manuscript footnotes by the verses they are about. */
  msNotes: Map<VerseKey, string[]>;
  sections: Section[];
  /** The passages a verse's "where" names (passagesForWhere). */
  passages: Section[];
}

/**
 * The passage that contains a verse, as the passage guide cuts it (John, 12 Oct 2026, option A): the book
 * bundle's own passages where it has at least one per chapter, else the BSB sections, a section under 3
 * verses joining the next and the last joining the one before (never in Psalms), the rule passage_summary.py
 * uses. One section system everywhere.
 */
export function passagesForWhere(data: BookData, secs: readonly Section[]): Section[] {
  if (data.pericopes.length >= data.lastChapter) return data.pericopes.map((p) => ({ title: p.label, start: p.start, end: p.end, parallels: "" }));
  const count = (s: Section): number => data.verseList.filter((cv) => le(s.start, cv) && le(cv, s.end)).length;
  const out: Section[] = [];
  for (const s of secs) {
    const prev = out.at(-1);
    if (prev !== undefined && data.book !== "PSA" && count(prev) < 3) out[out.length - 1] = { ...prev, end: s.end };
    else out.push({ ...s });
  }
  const last = out.at(-1);
  if (out.length > 1 && last !== undefined && data.book !== "PSA" && count(last) < 3) {
    out.pop();
    const prev = out.at(-1) as Section;
    out[out.length - 1] = { ...prev, end: last.end };
  }
  return out;
}

/**
 * The verses a manuscript footnote is about. The BSB hangs it on a neighbouring verse: John
 * 7:53–8:11's note sits on 7:52, 1 Cor 14:34–35's on 14:35, the 5:4 note on 5:3. The note itself
 * names the verses.
 */
export function msTargets(tables: BookTables, chapter: number, verse: number, note: string): Set<VerseKey> {
  const out = new Set<VerseKey>([vk(chapter, verse)]);
  const keys = [...tables.verses.keys()].map((k) => k.split(":").map(Number) as [number, number]);
  for (const m of note.matchAll(/(\d+):(\d+) through (?:[1-3]?\s?[A-Z][a-z]+ )?(\d+):(\d+)/g)) {
    const from: [number, number] = [Number(m[1]), Number(m[2])];
    const to: [number, number] = [Number(m[3]), Number(m[4])];
    for (const k of keys) if (le(from, k) && le(k, to)) out.add(vk(k[0], k[1]));
  }
  for (const m of note.matchAll(/verses (\d+)[–-](\d+)/g)) {
    for (let n = Number(m[1]); n <= Number(m[2]); n += 1) out.add(vk(chapter, n));
  }
  for (const m of note.matchAll(/(?<!after )verse (\d+)\b/g)) out.add(vk(chapter, Number(m[1])));
  // "end the Gospel of Mark after verse 8": the verses after it.
  for (const m of note.matchAll(/after verse (\d+)/g)) {
    for (const k of keys) if (k[0] === chapter && k[1] > Number(m[1])) out.add(vk(k[0], k[1]));
  }
  return out;
}

export function derive(data: BookData): Derived {
  const msNotes = new Map<VerseKey, string[]>();
  const add = (k: VerseKey, note: string): void => {
    const list = msNotes.get(k) ?? [];
    if (list.length === 0) msNotes.set(k, list);
    if (!list.includes(note)) list.push(note);
  };
  for (const [k, words] of data.tables.verses) {
    const [c, v] = k.split(":").map(Number) as [number, number];
    for (const w of words) {
      if (w.foot !== "" && MS.test(w.foot) && !w.foot.startsWith("Or ") && !w.foot.startsWith("Literally")) {
        for (const t of msTargets(data.tables, c, v, w.foot)) add(t, w.foot);
      }
    }
  }
  // A verse the BSB omits has no row of its own: its note hangs on the verse before and names it
  // ("BYZ and TR include 4 …"), and "include 21But …" is verse 21's number glued to its first word.
  for (const [k, words] of data.tables.verses) {
    const [c, v] = k.split(":").map(Number) as [number, number];
    for (const w of words) {
      if (!/\bincludes?\b/.test(w.foot) || !MS.test(w.foot)) continue;
      for (const m of w.foot.matchAll(/(?<![\d:])(\d+)(?=[A-Z“‘])/g)) {
        if (Number(m[1]) !== v) add(vk(c, Number(m[1])), w.foot);
      }
    }
  }
  const secs = sections(data);
  return { msNotes, sections: secs, passages: passagesForWhere(data, secs) };
}

// ---------------------------------------------------------------------------
// Per-verse layers
// ---------------------------------------------------------------------------

export interface PlainLine {
  text: string;
  /** Words the UST adds for meaning, marked {…} in the source and shown grey. */
  added: string[];
  /** A verse in [ ] is one the UST marks as missing from older manuscripts. */
  bracketed: boolean;
  credit: string;
}

export function plainLine(data: BookData, c: number, v: number): PlainLine | null {
  const t = data.ust.get(vk(c, v));
  if (t === undefined || t === "") return null;
  return {
    text: stripChars(t, "[] "),
    added: [...t.matchAll(/\{([^}]*)\}/g)].map((m) => m[1] ?? ""),
    bracketed: t.startsWith("[") && t.trimEnd().endsWith("]"),
    credit: CREDITS.ust,
  };
}

const tnRowsFor = (data: BookData, c: number, v: number): TnRow[] => data.tn.filter((r) => r.ref === `${c}:${v}`);

/** The BSB words that translate the Greek or Hebrew phrase a note is about ("αἱ γυναῖκες" -> "Women"). */
export function bsbWordsFor(data: BookData, c: number, v: number, quote: string): string | null {
  const want = new Set(quote.split("&").flatMap((part) => pySplit(part).map(bare)).filter((q) => q !== ""));
  const got = unique(
    (data.tables.verses.get(vk(c, v)) ?? [])
      .filter((w) => want.has(bare(stripChars(w.orig, "«»{}[]()⧼⧽〈〉‹›*"))))
      .map((w) => w.bsb.replace(/[[\]{}]/g, "").trim())
      .filter((g) => g !== "" && g !== "-" && g !== "vvv" && !pySplit(g).every((x) => stopOrModal(key(x)))),
  );
  return got.length > 0 && got.reduce((n, g) => n + pySplit(g).length, 0) <= 4 ? got.join(" … ") : null;
}

/** A reading cut at its first sentence and READING_CAP words; true when something was cut. */
export function capped(reading: string): [string, boolean] {
  const first = reading.split(/(?<=[.!?])\s+/)[0] ?? "";
  const ws = pySplit(first);
  if (ws.length <= READING_CAP) return [rstripChars(first, "."), first !== reading];
  let cut = ws.slice(0, READING_CAP).join(" ");
  if (cut.slice(Math.floor(cut.length / 2)).includes(",")) cut = cut.slice(0, cut.lastIndexOf(","));
  return [`${rstripChars(cut, ",;: ")}…`, true];
}

export interface ReadersDiffer {
  about: string;
  options: string[];
  sentence: string;
  full_note: boolean;
  source: "tn";
  id: string;
  credit: string;
}

/** The JPS 1917 verse on a disputed verse. It leads the readings. */
export interface DebateNote {
  about: null;
  sentence: string;
  options: [];
  full_note: false;
  source: "jps";
  credit: string;
}

/** An approved debate position: a source's sentence, unchanged, credited to that source alone. */
export interface PositionReading {
  about: null;
  sentence: string;
  options: [];
  full_note: false;
  source: "position";
  credit: string;
  /** Who holds it, only when the position names them. */
  held_by?: string;
}

/** Two readings a tN chapter introduction sets out, in the fixed "intro2" sentence (Revelation 20). */
export interface IntroReading {
  about: null;
  sentence: string;
  options: string[];
  full_note: true;
  source: "tn";
  id: string;
  credit: string;
}

/**
 * A chapter introduction that sets out two readings in tN's own words ("Some scholars believe that this
 * refers to a future period of time, while others believe that it refers to Jesus reigning now from heaven",
 * Revelation 20), for a "tn-readings" debate verse without readings of its own.
 */
export function introReadings(data: BookData, c: number): IntroReading[] {
  const row = data.tn.find((r) => r.ref === `${c}:intro`);
  if (row === undefined) return [];
  const m = /Some (?:scholars|interpreters|people) (?:believe|think) (?:that )?([^,.;]+), while others (?:believe|think) (?:that )?([^.;]+)\./.exec(md(row.note));
  if (m === null) return [];
  const a = m[1] ?? "";
  const b = m[2] ?? "";
  return [{ about: null, sentence: fill(TEMPLATES.intro2, { a: a.trim(), b: b.trim() }), options: [a, b], full_note: true, source: "tn", id: row.id, credit: CREDITS.tn }];
}

/** Notes that set out "(1) … (2) …", set in one fixed sentence (TEMPLATES read2/read3). */
export function readersDiffer(data: BookData, c: number, v: number): ReadersDiffer[] {
  const out: ReadersDiffer[] = [];
  for (const r of tnRowsFor(data, c, v)) {
    const t = md(r.note).split("\n")[0] ?? "";
    const m = /^(.*?)(?:could|may|might) (?:refer to|mean|indicate|be|describe|have)[^:]*:\s*(\(1\).*)$/.exec(t);
    if (m === null) continue;
    const opts = (m[2] ?? "")
      .split(/\(\d\)\s*/)
      .filter((o) => o.trim() !== "")
      .map((o) => stripChars(o.replace(/\s*(?:Alternate translation|For this interpretation)[^|]*$/, ""), " ;."))
      .map((o) => stripChars(o.replace(/\s*In support of this view[^.]*\.?/g, ""), " ;."))
      .filter((o) => o !== "" && !TRANSLATOR.test(o))
      .map((o) => stripChars(o.replace(/\s*\(See:?[^)]*\)/g, ""), " ;."))
      // Translators' figure-of-speech labels ("in which case “above” is a euphemism for God") explain the
      // Greek to a translator, not the meaning to a reader (John, 12 Oct 2026): that clause is cut.
      .map((o) =>
        o.replace(/,?\s*(?:in which case|so that)\b[^;.]*\b(?:euphemism|doublet|idiom|metonym\w*|synecdoche|hendiadys|merism|litotes|genitive)\b[^;.]*/g, ""),
      )
      .map((o) => stripChars(o.replace(/;?\s*many languages\b[^;.]*/g, ""), " ;.,"))
      // tN's "(1) … or (2) …" leaves a trailing "or" on the first reading, which the template's own "or"
      // doubled ("hovering” or; or “and a wind", Genesis 1:2).
      .map((o) => stripChars(o.replace(/[,;]?\s+or$/, ""), " ;.,"));
    const lead = (m[1] ?? "").trim().split(/(?<=[.!?”])\s+/).at(-1) ?? "";
    let about = rstripChars(lead.replace(/^(?:Here,?\s*|just as in [^,]+,\s*|and throughout [^,]+,\s*)+/, ""), ",");
    about = about.replace(/\s+(?:that|which|It|it)$/, "");
    if (["it", "this", "that", "they", "these", ""].includes(about.toLowerCase()) || TRANSLATOR.test(about)) about = "What this means";
    if (opts.length < 2) continue;
    // The phrase by the note's own short name when the verse uses every content word of it ("women",
    // "so" in John 3:16); otherwise the BSB's own words for the quoted Greek or Hebrew; otherwise "this".
    const verseText = data.text(data.ord(c, v) ?? 0).toLowerCase();
    const aboutWords = pySplit(about);
    const content = aboutWords.map(key).filter((w) => !stopOrModal(w));
    const single = aboutWords.length === 1 && new RegExp(`\\b${escapeRegExp(about.toLowerCase())}\\b`).test(verseText);
    const own =
      (aboutWords.length <= 4 && content.length > 0 && content.every((w) => new RegExp(`\\b${escapeRegExp(w)}`).test(verseText))) || single
        ? about
        : null;
    const phrase = own ?? bsbWordsFor(data, c, v, r.quote) ?? "this";
    const short = opts.slice(0, 3).map(capped);
    const lc = (s: string): string =>
      s !== "" && !/^[A-Z][a-z]+ [A-Z]|^(God|Jesus|Paul|Israel|Lord|Christ)\b/.test(s) ? (s[0] ?? "").toLowerCase() + s.slice(1) : s;
    const vals = short.map(([s]) => lc(s));
    // The wording turns with the verse and with each reading in it, so neighbours differ and a rerun repeats.
    const wording = (v + out.length) % 3;
    const filled =
      vals.length === 3
        ? fill(TEMPLATES.read3[wording] ?? "", { about: phrase, a: vals[0] ?? "", b: vals[1] ?? "", c: vals[2] ?? "" })
        : fill(TEMPLATES.read2[wording] ?? "", { about: phrase, a: vals[0] ?? "", b: vals[1] ?? "" });
    const sentence = filled.replace("“this”", "this");
    // Capitalised, the letter after an opening quote mark included ("“Life” can mean…").
    const capital = sentence.startsWith("“") ? `“${(sentence[1] ?? "").toUpperCase()}${sentence.slice(2)}` : (sentence[0] ?? "").toUpperCase() + sentence.slice(1);
    out.push({
      about: phrase,
      options: opts,
      sentence: capital,
      full_note: short.some(([, cut]) => cut) || opts.length > 3,
      source: "tn",
      id: r.id,
      credit: CREDITS.tn,
    });
  }
  return out;
}

export interface Explained {
  text: string;
  id: string;
}

/** Figure-of-speech and implied-information notes, every sentence addressed to a translator removed. */
export function explained(data: BookData, c: number, v: number): Explained[] {
  const out: Explained[] = [];
  for (const r of tnRowsFor(data, c, v)) {
    const tag = r.support.split("/").at(-1) ?? "";
    if (SKIP_TAGS.some((s) => tag.startsWith(s)) || /\(1\)/.test(r.note)) continue;
    let kept = sentences(md(r.note).split("\n")[0] ?? "").filter((s) => !TRANSLATOR.test(s));
    while (kept.length > 1 && DANGLING.test(kept[0] ?? "") && !/^(Here|This |These )/.test(kept[0] ?? "")) kept = kept.slice(1);
    const t = kept.join(" ").trim();
    if (wordCount(t) >= 8) out.push({ text: t, id: r.id });
  }
  return out;
}

export interface BsbNote {
  kind: "or" | "literally" | "cited" | "manuscripts" | "other";
  on: string;
  text: string;
}

/** The BSB translators' own footnotes on the verse: "Or …" renderings, "Literally …", manuscripts, citations. */
export function bsbNotes(data: BookData, c: number, v: number): BsbNote[] {
  return (data.tables.verses.get(vk(c, v)) ?? [])
    .filter((w) => w.foot !== "")
    .map((w) => ({
      kind: w.foot.startsWith("Or ") ? "or" : w.foot.startsWith("Literally") ? "literally" : w.foot.startsWith("Cited") ? "cited" : MS.test(w.foot) ? "manuscripts" : "other",
      on: w.bsb,
      text: gloss(w.foot),
    }));
}

/** A verse's key word: the article, and the one sentence of it that fits this verse (leadSentence). */
export interface KeyWord extends TwArticle {
  lead: string;
}

export function keyWords(data: BookData, c: number, v: number): KeyWord[] {
  const out: KeyWord[] = [];
  const seen = new Set<string>();
  const verseText = data.text(data.ord(c, v) ?? 0);
  for (const r of data.twl) {
    if (r.ref !== `${c}:${v}`) continue;
    const a = data.tw(r.link);
    if (a !== null && !seen.has(a.term) && a.definition !== "") {
      seen.add(a.term);
      out.push({ ...a, lead: leadSentence(a.definition, verseText) });
    }
  }
  return out;
}

export interface CheckQuestion {
  q: string;
  a: string;
}

export function checkQuestions(data: BookData, c: number, v: number): CheckQuestion[] {
  return data.tq.filter((r) => r.ref === `${c}:${v}` && r.question !== "" && r.answer !== "").map((r) => ({ q: r.question, a: r.answer }));
}

// ---------------------------------------------------------------------------
// Data facts
// ---------------------------------------------------------------------------

/**
 * Where the BSB and the WEB, KJV or LSV word the verse differently, one or two words a side.
 * Anything that spills into neighbouring words is dropped ("churches" -> "assemblies", never
 * "assemblies for it has"; build session review, 12 Oct 2026).
 */
export function differsPairs(data: BookData, ord: number): Array<[string, Array<[string, string]>]> {
  const base = pySplit(expand(data.text(ord)));
  const found = new Map<string, Array<[string, string]>>();
  const cut = (ws: string[]): string[] => {
    const i = ws.findIndex((w) => /[,;:.]$/.test(w));
    return i === -1 ? ws : ws.slice(0, i + 1);
  };
  const trimEnds = (ws: string[]): string[] => {
    let out = ws;
    while (out.length > 0 && stopOrModal(key(out[0] ?? ""))) out = out.slice(1);
    while (out.length > 0 && stopOrModal(key(out.at(-1) ?? ""))) out = out.slice(0, -1);
    return out;
  };
  const trim = (ws: string[]): string => ws.map((w) => stripChars(w, ",.;:“”‘’")).join(" ").trim();
  for (const tr of ["WEB", "KJV", "LSV"] as const) {
    // The LSV marks Hebrew poetry's line pairs with "||"; it is layout, not a word (Job 8:6 showed "|| Surely").
    const other = pySplit(expand(data.text(ord, tr)).replace(/\|\|/g, " "));
    for (const [op, a1, a2, b1, b2] of opcodes(base.map(key), other.map(key))) {
      if (op !== "replace") continue;
      const f = trimEnds(cut(base.slice(a1, a2)));
      const t = trimEnds(cut(other.slice(b1, b2)));
      const fc = new Set(f.map(key).filter((w) => !STOP.has(w)));
      const tc = new Set(t.map(key).filter((w) => !STOP.has(w)));
      if (f.length === 0 || t.length === 0 || fc.size === 0 || tc.size === 0 || f.length > 2 || t.length > 2 || [...fc].every((w) => MODAL.has(w))) continue;
      const similar = [...fc].every((x) => [...tc].some((y) => x.slice(0, 4) === y.slice(0, 4) || (x.slice(0, 3) === y.slice(0, 3) && Math.abs(x.length - y.length) <= 3)));
      if (similar) continue;
      const k = trim(f);
      const list = found.get(k) ?? [];
      if (list.length === 0) found.set(k, list);
      list.push([trim(t), tr]);
    }
  }
  const longest = (k: string): number => Math.max(...pySplit(k).map((w) => w.length));
  const ranked: Array<[string, Array<[string, string]>]> = [...found].sort((x, y) => y[1].length - x[1].length || longest(y[0]) - longest(x[0]));
  return ranked;
}

export function differs(data: BookData, ord: number): string[] {
  return differsPairs(data, ord)
    .slice(0, 2)
    .map(([bsb, vs]) => fill(TEMPLATES.differ, { bsb, others: vs.map(([t, tr]) => `“${t}” (${tr})`).join(" · ") }));
}

/**
 * Where JPS 1917 and the BSB word a verse differently: the differing phrases with one word of context, up
 * to six words a side, in verse order ("the virgin will be with child" / "the young woman shall conceive").
 * Phrases that differ only in function words or spelling are skipped.
 */
export function jpsContrast(data: BookData, ord: number, most = 2): Array<[string, string]> {
  const a = pySplit(data.text(ord));
  const b = pySplit(data.text(ord, "JPS"));
  if (b.length === 0) return [];
  const ctx = (ws: string[], i: number, j: number): string =>
    ws
      .slice(Math.max(0, i - 1), Math.min(j, i + 5))
      .map((w) => stripChars(w, ",.;:“”‘’!?"))
      .join(" ");
  const out: Array<[string, string, number]> = [];
  for (const [op, a1, a2, b1, b2] of opcodes(a.map(key), b.map(key))) {
    if (op !== "replace") continue;
    const fc = new Set(a.slice(a1, a2).map(key).filter((w) => !stopOrModal(w)));
    const tc = new Set(b.slice(b1, b2).map(key).filter((w) => !stopOrModal(w)));
    if (fc.size === 0 || tc.size === 0 || [...fc].some((x) => tc.has(x)) || [...fc].every((x) => [...tc].some((y) => x.slice(0, 4) === y.slice(0, 4)))) continue;
    out.push([ctx(a, a1, a2), ctx(b, b1, b2), new Set([...fc, ...tc]).size]);
  }
  const position = (phrase: string): number => {
    const first = pySplit(phrase)[0];
    return first !== undefined && a.includes(first) ? a.indexOf(first) : 0;
  };
  return out
    .sort((x, y) => y[2] - x[2])
    .slice(0, most)
    .sort((x, y) => position(x[0]) - position(y[0]))
    .map(([x, y]) => [x, y]);
}

/**
 * A rare word the verse shares with nearby verses (at most 5 uses in the book, at least 2 in this
 * chapter), named by the BSB's own rendering in this verse via the tables, never a lexicon gloss.
 */
/**
 * The verse's verbs, nouns and adjectives, never a name: Greek names are capitalised; Hebrew marks them Np
 * ("HNp", "HC/Np"; Isaiah 1:1's Isaiah and Judah, audit 12 Oct 2026) and a people's name Ng ("Chaldeans").
 * Hebrew and Aramaic codes start with a language letter and join prefixes and suffixes with "/", so the
 * word's part of speech is its first noun, verb or adjective part.
 */
export function contentTokens(data: BookData, ord: number): Array<{ key: string; surface: string }> {
  const out: Array<{ key: string; surface: string }> = [];
  for (const t of data.tokens(ord)) {
    const morph = t.morph;
    let pos = morph;
    if ((morph[0] === "H" || morph[0] === "A") && morph[1] !== "-") {
      const parts = [morph.slice(1).split("/")[0] ?? "", ...morph.split("/").slice(1)];
      pos = parts.find((p) => p[0] === "V" || p[0] === "N" || p[0] === "A") ?? "";
    }
    if (pos.startsWith("Np") || pos.startsWith("Ng") || /^\p{Lu}/u.test(t.surface)) continue;
    if (/^(?:V|N|A)/.test(pos)) out.push({ key: t.key, surface: t.surface });
  }
  return out;
}

/**
 * A rare word the verse shares with nearby verses (at most 5 uses in the book, at least 2 in this chapter),
 * named by the BSB's own rendering here. Counted from core's occurrences, the same base as the comparison
 * fact and the app's word card, so one word never shows two numbers (audit, 12 Oct 2026).
 */
export function wordFact(data: BookData, c: number, v: number): string | null {
  const ord = data.ord(c, v);
  if (ord === null) return null;
  let best: { n: number; rendering: string; refs: string[]; same: string[] } | null = null;
  for (const t of contentTokens(data, ord)) {
    const n = data.occurrences(t.key).find((r) => r.book === data.book)?.count ?? 0;
    if (n > 5 || n < 2) continue;
    const refs = unique(data.keyRefs(t.key));
    const same = refs.filter((r) => r.split(":")[0] === String(c));
    if (same.length < 2) continue;
    const words = bsbWordsFor(data, c, v, t.surface);
    if (words === null || STOP.has(key(words))) continue;
    const rendering = (words.split(" … ")[0] ?? "").replace(/^(?:the|a|an)\s+/i, "");
    if (best === null || n < best.n) best = { n, rendering, refs, same };
  }
  if (best === null) return null;
  const others = best.refs.filter((r) => r !== `${c}:${v}`);
  const where = best.same.length === best.refs.length ? `, all in this chapter: ${others.join(", ")} and here` : `: ${others.join(", ")} and here`;
  return fill(TEMPLATES.word, { bsb: (best.rendering[0] ?? "").toUpperCase() + best.rendering.slice(1), n: best.n, book: data.name, where });
}

/** The phrase a note is about overlaps the phrase a reading is about (content words, any case). */
export function covered(phrase: string, readings: ReadonlyArray<{ about: string | null }>): boolean {
  const keys = (t: string): Set<string> => new Set((t.match(/[\p{L}\p{N}_’']+/gu) ?? []).map(key).filter((w) => !stopOrModal(w)));
  const want = keys(phrase);
  return want.size > 0 && readings.some((d) => [...keys(d.about ?? "")].some((w) => want.has(w)));
}

export function speakersFact(data: BookData, ord: number): string | null {
  const names = unique(data.speakers(ord));
  return names.length > 0 ? fill(TEMPLATES.speakers, { names: names.join(" · ") }) : null;
}

// ---------------------------------------------------------------------------
// Tyndale, under Study notes
// ---------------------------------------------------------------------------

export interface StudyNoteLayer {
  range: [number, number];
  text: string;
  named_refs: string[];
  credit: string;
}

/**
 * The Tyndale note that covers the verse most tightly: its first sentences, references removed.
 * A note that opens on an NLT lemma is skipped for the next-tightest, since the lemma explains the
 * NLT's wording, not the reader's. NLT words inside a note stay marked "(NLT)" as Study notes show
 * them, unless the BSB verse says the same words (rule 9; docs/no-ai-understand.md).
 */
export function tyndale(data: BookData, ord: number, verseText: string): StudyNoteLayer | null {
  const vt = verseText.toLowerCase();
  for (const note of data.studyNotes(ord)) {
    const body = (note.text.trim().replace(/^<b>[^<]*<\/b>\s*/, "").split(" • ")[0] ?? "").split("\n")[0] ?? "";
    if (body.startsWith("<x>")) continue;
    const raw = body.replace(/<x>([^<]+)<\/x>/g, (_, lemma: string) => (vt.includes(stripChars(lemma.toLowerCase(), " .,:;")) ? lemma : `“${lemma}” (NLT)`));
    const out: string[] = [];
    for (const [i, s] of sentences(plain(raw)).entries()) {
      if (DANGLING.test(s) && !(i === 0 && /^(This|These) [a-z]+/.test(s))) break;
      const kept = s.replace(/\s*\((?:see|cp\.|compare|also)?[^()]*\d+:\d+[^()]*\)/g, "");
      out.push(gloss(kept.replace(/\s+([,.;:])/g, "$1")));
    }
    if (out.length > 0) {
      const refs = [...plain(note.text).matchAll(new RegExp(`(${REFWORD} \\d+:\\d+(?:[-–]\\d+)?|\\b\\d+:\\d+(?:[-–]\\d+)?)`, "g"))].map((m) => m[1] ?? "");
      return { range: [note.ordStart, note.ordEnd], text: out.slice(0, 2).join(" "), named_refs: refs.slice(0, 6), credit: CREDITS.tyndale };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Whose words (John's UX test, 12 Oct 2026)
// ---------------------------------------------------------------------------

/**
 * A plain line read bare makes Bildad's wrong claims, the Teacher's "everything is meaningless", God's
 * laws and John's visions sound like Yada stating facts. One line above it says whose words they are,
 * from the speaker data the summaries use (Glyssen), or from the kind of book.
 */
const LETTER_AUTHOR: Readonly<Record<string, string>> = {
  ...Object.fromEntries(["ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM"].map((b) => [b, "Paul"])),
  HEB: "The writer",
  JAS: "James",
  "1PE": "Peter",
  "2PE": "Peter",
  "1JN": "John",
  "2JN": "John",
  "3JN": "John",
  JUD: "Jude",
};

/** Glyssen's name as a reader says it: bracketed notes dropped, inverted forms turned round ("angels in white, two"). */
export function displayName(name: string): string {
  const n = name.replace(/\s*\([^)]*\)/g, "").trim();
  const m = /^(.+?),\s*(one|two|three|some|many|all|several|other)$/.exec(n);
  return m === null ? n : `${m[2]} ${m[1]}`;
}

export function voice(data: BookData, c: number, v: number, ord: number): string | null {
  const bk = data.book;
  if (bk === "REV" && le([1, 9], [c, v])) return "In John’s vision:";
  if (bk === "ECC") return "The Teacher says:";
  // In the Old Testament, Glyssen's Jesus, Christ or Messiah speakers are one tradition's reading (Isaiah test).
  const rows = data.speechRows(ord).filter((r) => !(OT_BOOKS.has(bk) && /\b(?:Jesus|Christ|Messiah)\b/.test(r.name)));
  // A frame only where the data says the speech is the whole verse (Glyssen's quote_position "EntireVerse")
  // and the UST line carries no quotation marks of its own: a quoted line already says who speaks, and
  // narration in a speech verse is never the speaker's ("Lydia says: “So we accepted her invitation…”", Acts
  // 16:15, audit 12 Oct 2026). A group ID ("priests/Levites", kind multiple) is never split: no frame.
  if (rows.length > 0 && !rows.some((r) => r.kind === "multiple" || r.name.includes("/"))) {
    const names = unique(rows.map((r) => displayName(r.name)));
    if (names.length === 1 && rows.every((r) => r.quotePosition === "EntireVerse") && !(data.ust.get(vk(c, v)) ?? "").includes("“")) {
      const only = names[0] ?? "";
      const who = ["God", "Yahweh", "LORD", "Lord"].includes(only) ? "God" : only;
      const last = pySplit(who).at(-1) ?? "";
      const plural = /[a-z]s$/.test(last) && /^\p{Ll}/u.test(last);
      return `${(who[0] ?? "").toUpperCase()}${who.slice(1)} ${plural ? "say" : "says"}:`;
    }
  }
  const author = LETTER_AUTHOR[bk];
  return author === undefined ? null : `${author} tells them:`;
}

const OT_BOOKS: ReadonlySet<string> = new Set([
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB",
  "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP",
  "HAG", "ZEC", "MAL",
]);

/** Sides and axes match whatever their spacing or case, as the review tool compares them. */
const sideKey = (side: string): string => side.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * A framing side (John, 15 Oct 2026): "context", or one that lists the views ("lists both readings"), frames the
 * question without holding a view. It shows inside a passage that shows, but never makes one show.
 */
export const isFramingSide = (side: string): boolean => {
  const key = sideKey(side);
  return key === "context" || key.startsWith("lists");
};

/**
 * A stray tilde between numbers in a source ("680~644 BC", Ezekiel 38) reads as an en dash. Display only: the
 * stored sentence, and the sha256 John approved it by, stay verbatim.
 */
export const displaySentence = (text: string): string => text.replace(/(\d)~(?=\d)/g, "$1\u2013");

/**
 * A debate entry's approved positions (John, 12 Oct 2026): each a source's own sentence, unchanged, approved
 * or rejected one by one. John writes nothing and is never a credit. Two approved sentences are not two
 * positions (John, 15 Oct 2026: 1 Corinthians 11:2–16 had two on one side): the entry counts only when one
 * axis (the question a position answers; untagged positions share one) holds two or more distinct sides that
 * are not framing, and then every tagged one shows. Hosea 1:2 asks two questions, real or allegory and what
 * Gomer was, so two answers to different questions are not two positions either. An approved position with no
 * side counts toward no side and does not show; a machine `side_suggested` or `axis_suggested` counts for nothing.
 */
export function approvedPositions(deb: Debate | undefined): Array<{ text: string; source: string; held_by?: string | null }> {
  const ok = (deb?.positions ?? []).filter((p) => p.status === "approved" && typeof p.side === "string" && p.side.trim() !== "");
  const axes = new Map<string, Set<string>>();
  for (const p of ok) {
    const side = p.side ?? "";
    if (isFramingSide(side)) continue;
    const axis = sideKey(p.axis ?? "");
    axes.set(axis, (axes.get(axis) ?? new Set<string>()).add(sideKey(side)));
  }
  const shows = [...axes.values()].some((sides) => sides.size >= 2);
  return shows ? ok.map((p) => ({ text: displaySentence(p.text), source: p.source ?? "", ...(p.held_by ? { held_by: p.held_by } : {}) })) : [];
}

/**
 * The verse's word that this book uses more than any other book does, named by its BSB rendering here:
 * verbs, nouns and adjectives only (a name like "Jesus" in John says nothing about the verse), at least 10
 * uses, a clear top across 3 or more books, the largest share winning.
 */
export function compareFact(data: BookData, c: number, v: number): string | null {
  const ord = data.ord(c, v);
  if (ord === null) return null;
  let best: { share: number; surface: string; n: number; total: number } | null = null;
  for (const t of contentTokens(data, ord)) {
    const rows = data.occurrences(t.key);
    const [top, second] = rows;
    if (rows.length < 3 || top === undefined || top.book !== data.book || top.count < 10 || top.count === second?.count) continue;
    const total = rows.reduce((n, r) => n + r.count, 0);
    const share = top.count / total;
    if (best === null || share > best.share) best = { share, surface: t.surface, n: top.count, total };
  }
  if (best === null) return null;
  const rendering = bsbWordsFor(data, c, v, best.surface);
  if (rendering === null) return null;
  // One rendering, without its article ("the law … Law" in Romans 3:21 -> "law").
  const word = (rendering.split(" … ")[0] ?? "").replace(/^(?:the|a|an)\s+/i, "");
  return fill(TEMPLATES.most, { book: data.name, bsb: word, n: best.n, total: best.total });
}

/** The major debate (prototypes/data/debates.json) whose range covers the verse, if any. */
export function debateFor(data: BookData, c: number, v: number): Debate | undefined {
  return data.debates.find((d) => d.book === data.book && le(d.from, [c, v]) && le([c, v], d.to));
}

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

export interface MissingVerse {
  verse: string;
  missing: true;
  manuscripts: string[];
  plain: PlainLine | null;
}

export interface VerseLayers {
  verse: string;
  where: { frame: string | null; section: string | null; range: [[number, number], [number, number]] | null };
  beginner: {
    /** Where readers differ, the readings come first and the plain line is one of them (John, 12 Oct 2026). */
    order: ["readers_differ", "plain"] | ["plain", "readers_differ"];
    voice: string | null;
    plain: (PlainLine & { one_reading: boolean; label: "One way to read it" | "In plain words" }) | null;
    translators: BsbNote[];
    readers_differ: Array<ReadersDiffer | DebateNote | IntroReading | PositionReading>;
    manuscripts: string[];
    debate: { kind: string | null } | null;
    readers_half: number;
    readers_more: number;
    readers_lead: "Readers differ" | "Readers explain this in more than one way" | null;
  };
  facts: string[];
  alongside: string[];
  deeper: { explained: Explained[]; key_words: KeyWord[]; study_note: StudyNoteLayer | null; check: CheckQuestion[] };
}

export type Assembled = VerseLayers | MissingVerse;

export const isMissing = (r: Assembled): r is MissingVerse => "missing" in r;

export function assemble(data: BookData, derived: Derived, c: number, v: number): Assembled {
  const bk = data.book;
  const ord = data.ord(c, v);
  const vt = ord === null ? "" : data.text(ord);
  const notes = bsbNotes(data, c, v);
  let rd: Array<ReadersDiffer | DebateNote | IntroReading | PositionReading> = readersDiffer(data, c, v);
  let pw = plainLine(data, c, v);
  // "21But" in a BSB note is verse 21's number glued to its first word: shown apart.
  const ms = unique((derived.msNotes.get(vk(c, v)) ?? []).map((t) => gloss(t).replace(/(?<![\d:])(\d+)(?=[A-Z“‘])/g, "($1) ")));
  // A verse the BSB leaves out (John 5:4): the note, and what older and later manuscripts say.
  if (ord === null || vt === "") return { verse: `${bk}.${c}.${v}`, missing: true, manuscripts: ms, plain: pw };
  const sec = derived.passages.find((s) => le(s.start, [c, v]) && le([c, v], s.end));
  const cited = notes.filter((n) => n.kind === "cited").map((n) => fill(TEMPLATES.cited, { ref: rstripChars(n.text.replace(/^Cited from\s*/, ""), ".") }));
  const deb = debateFor(data, c, v);
  const approved = approvedPositions(deb);
  const kind = deb?.kind;
  if (deb !== undefined) {
    // What a disputed verse shows depends on its kind (John, 12 Oct 2026; docs/research/debates-sort-2026-10-12.md):
    // "data": only the JPS 1917 verse (Old Testament) or the manuscript fact; "tn-readings": tN's readings, from
    // the verse notes or a chapter introduction that sets out two; "positions" and "held": nothing until John
    // approves. tN readings on the other kinds are about other words (Genesis 1:2's Spirit or wind) and mislead.
    rd = kind === "tn-readings" ? (rd.length > 0 ? rd : introReadings(data, c)) : [];
    if (kind === "data") {
      // The whole JPS verse, not a chosen phrase: no rule can tell which difference is the disputed one (Psalm
      // 22:16 has three), and the BSB verse is on screen, so the reader compares the two themselves.
      const jt = data.text(ord, "JPS");
      // BSB against JPS directly (audit, 12 Oct 2026): the WEB, KJV and LSV differences say nothing about JPS.
      if (jt !== "" && jpsContrast(data, ord, 99).length > 0) {
        rd = [{ about: null, sentence: fill(TEMPLATES.jps, { jps: jt.trim() }), options: [], full_note: false, source: "jps", credit: "JPS 1917, public domain" }];
      }
    }
  }
  if (approved.length > 0) {
    // Approved positions lead, each its source's sentence unchanged and credited to that source only.
    const positions: PositionReading[] = approved.map((p) => ({
      about: null,
      sentence: p.text,
      options: [],
      full_note: false,
      source: "position",
      credit: p.source,
      ...(p.held_by ? { held_by: p.held_by } : {}),
    }));
    rd = [...positions, ...rd];
  }
  // A "data" entry disputes meaning (Isaiah 7:14): the BSB verse and the JPS verse side by side are the whole
  // answer, and the UST's one reading would side with one of them, so no plain line (decided 12 Oct 2026).
  if (kind === "data" && rd[0]?.source === "jps") pw = null;
  if (deb !== undefined && rd.length === 0 && !(kind === "data" && ms.length > 0)) {
    // A "data" entry whose data is a manuscript fact (Mark 16:9–20, John 7:53–8:11) disputes whether the
    // verses belong, not what they mean, so its plain line stays. Otherwise, with nothing approved and nothing
    // from the data for this kind, the UST's one reading would take a side: no plain line either (every
    // "positions" and "held" verse). The report lists the verse.
    pw = null;
  }
  // Readings lead only on a disputed verse (a debates.json entry); elsewhere the plain line leads and the
  // readings follow (John's verse-sheet spec, 12 Oct 2026, narrowing "any verse with readings").
  const disputed = deb !== undefined && rd.length > 0;
  const said = voice(data, c, v, ord);
  // "Speaking: Bildad" repeats the voice line above the plain words, so it shows only without one.
  const facts = [compareFact(data, c, v), ...differs(data, ord), wordFact(data, c, v), said === null ? speakersFact(data, ord) : null, ...cited].filter(
    (f): f is string => f !== null && f !== "",
  );
  const ty = tyndale(data, ord, vt);
  const own = escapeRegExp(pySplit(data.name).at(-1)?.slice(0, 3) ?? "");
  return {
    verse: `${bk}.${c}.${v}`,
    where: { frame: FRAME[bk] ?? null, section: sec?.title ?? null, range: sec === undefined ? null : [sec.start, sec.end] },
    beginner: {
      order: disputed ? ["readers_differ", "plain"] : ["plain", "readers_differ"],
      voice: said,
      plain:
        pw === null
          ? null
          : { ...pw, one_reading: rd.length > 0 || notes.some((n) => n.kind === "or"), label: disputed ? "One way to read it" : "In plain words" },
      // One phrase is explained once, in the highest slot (audit, 12 Oct 2026): a BSB "Or …" note on the
      // phrase a reading already covers (John 3:16's "only begotten") is left out.
      translators: notes.filter((n) => (n.kind === "or" || n.kind === "literally") && !covered(n.on, rd)).slice(0, 2),
      // Approved source sentences can run past 18 words, so all of them are kept; the half view shows the
      // count and the full view each sentence in full (John, 12 Oct 2026).
      readers_differ: approved.length > 0 ? rd : rd.slice(0, 2),
      manuscripts: ms,
      // The debate's question is for John's list only and never shown, so it stays out of the verse layer.
      debate: deb === undefined ? null : { kind: deb.kind ?? null },
      // The slot is always Readers differ; where John marked the readings as sitting together, the lead-in says
      // so (John, 12 Oct 2026: Psalm 2:7, Isaiah 14:12–15). The quotes themselves are never touched.
      // The half view shows at most three readings, in the file's order, with the full count in its lead-in;
      // the full view shows every one (John, 12 Oct 2026). readers_more is the quiet remainder.
      readers_half: HALF_READINGS,
      readers_more: Math.max(0, (approved.length > 0 ? rd.length : Math.min(rd.length, 2)) - HALF_READINGS),
      readers_lead: rd.length === 0 ? null : deb?.relation === "together" ? "Readers explain this in more than one way" : "Readers differ",
    },
    facts: facts.slice(0, 3),
    // References the note names, never this verse or its own chapter.
    alongside: (ty?.named_refs ?? [])
      .filter((x) => !new RegExp(`^(?:\\d+:\\d+|${own}\\w* ${c}:)`).test(x) && !x.startsWith(`${c}:`))
      .slice(0, 3),
    deeper: { explained: explained(data, c, v).slice(0, 2), key_words: keyWords(data, c, v).slice(0, 4), study_note: ty, check: checkQuestions(data, c, v) },
  };
}

/** Everything a beginner sees before a tap. */
export function beginnerText(r: VerseLayers): string {
  const b = r.beginner;
  const parts = [b.plain?.text ?? "", ...b.translators.map((n) => n.text), ...b.manuscripts, ...b.readers_differ.map((d) => d.sentence)];
  return [...parts, ...r.facts].join(" ");
}

/** {…} in the plain line is the UST's own mark for added words, so it is not a leak. */
export const LEAKS = /(your language|Alternate translation|\brc:\/\/|\bULT\b|\]\(|\*\*|\\n|figs-|<[a-z/]|\(See:)/;
