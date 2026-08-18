/**
 * Source parsers. Mechanical only — nothing here interprets anything.
 *
 * Both sources are read into one `Token` shape so the derive stage does not
 * care which language it is working in, apart from where the schema genuinely
 * differs (Hebrew carries morphemes; Greek does not).
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { BOOK_ORDER, canonicalStrongs, type BookCode } from "@yada/schema";

import { matchGreekLemma, type MatchRoute } from "./lexicon.js";
import { RAW } from "./paths.js";

export interface TokenMorpheme {
  surface: string;
  role: "prefix" | "stem" | "suffix";
  lemma_ref?: string;
  strongs?: string;
  morph?: string;
}

export interface Token {
  verse_id: string;
  position: number;
  /** Display form: separators and apparatus markers removed. */
  surface: string;
  /** Exactly as the source writes it. */
  raw_surface: string;
  lemma: string;
  strongs?: string;
  morph: string;
  morphemes?: TokenMorpheme[];
  /** The source marks a textual variant at this word. */
  variant_marked: boolean;
}

/**
 * SBLGNT prints apparatus sigla inside the running text. They are editorial
 * marks, not part of the text, and must never reach a display surface — this
 * was a 0A finding.
 */
const APPARATUS_MARKERS = /[⸀-⸍⟦⟧〚〛]/gu;

export function stripApparatus(text: string): { clean: string; marked: boolean } {
  const marked = APPARATUS_MARKERS.test(text);
  APPARATUS_MARKERS.lastIndex = 0;
  return { clean: text.replace(APPARATUS_MARKERS, ""), marked };
}

/** Trailing punctuation MorphGNT carries on the surface form. */
const GREEK_PUNCT = /[.,;·:!?]+$/u;

// ---------------------------------------------------------------------------
// MorphGNT
// ---------------------------------------------------------------------------

/** MorphGNT numbers the NT 01-27; our canonical order puts Matthew at 39. */
function greekBook(bookNumber: number): BookCode {
  const code = BOOK_ORDER[38 + bookNumber];
  if (code === undefined) throw new Error(`unknown MorphGNT book number ${bookNumber}`);
  return code;
}

export interface GreekLexiconCoverage {
  /** How many tokens were resolved by each route. */
  routes: Map<MatchRoute, number>;
  /** Lemma forms TBESG has no entry for under any route. */
  unmatched: Set<string>;
}

export function parseMorphGnt(file: string): Token[] {
  return parseMorphGntWithCoverage(file).tokens;
}

export function parseMorphGntWithCoverage(file: string): {
  tokens: Token[];
  coverage: GreekLexiconCoverage;
} {
  const text = readFileSync(path.join(RAW, file), "utf8");
  const tokens: Token[] = [];
  const routes = new Map<MatchRoute, number>();
  const unmatched = new Set<string>();
  let currentVerse = "";
  let position = 0;

  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue;
    // Columns: BCV, POS, parsing, text, word, normalized, lemma.
    //
    // `text` (index 3) is what the edition prints — capitalisation, punctuation
    // and apparatus sigla intact. `normalized` (index 5) is lowercased and
    // stripped for matching. They differ at every sentence start, so taking the
    // normalized column for display silently lowercases the corpus; the oracle
    // caught exactly that in 1 Cor 14:34 (`Αἱ` printed, `αἱ` normalized).
    const parts = line.split(" ").filter((p) => p.length > 0);
    const [bcv, , parsing, rawText, , , lemma] = parts;
    if (bcv === undefined || parsing === undefined || rawText === undefined || lemma === undefined) {
      continue;
    }
    const pos = parts[1] ?? "";

    const book = greekBook(Number(bcv.slice(0, 2)));
    const chapter = Number(bcv.slice(2, 4));
    const verse = Number(bcv.slice(4, 6));
    const verseId = `${book}.${chapter}.${verse}`;
    if (verseId !== currentVerse) {
      currentVerse = verseId;
      position = 0;
    }
    position += 1;

    const { clean, marked } = stripApparatus(rawText);
    // MorphGNT has no Strong's column; the number comes from TBESG by lemma.
    const match = matchGreekLemma(lemma);
    const strongs = match?.strongs;
    if (match !== undefined) routes.set(match.route, (routes.get(match.route) ?? 0) + 1);
    else unmatched.add(lemma);
    tokens.push({
      verse_id: verseId,
      position,
      surface: clean.replace(GREEK_PUNCT, ""),
      raw_surface: rawText,
      lemma,
      ...(strongs === undefined ? {} : { strongs }),
      morph: `${pos} ${parsing}`,
      variant_marked: marked,
    });
  }
  return { tokens, coverage: { routes, unmatched } };
}

// ---------------------------------------------------------------------------
// OSHB (OSIS XML)
// ---------------------------------------------------------------------------

const OSIS_TO_CODE: Readonly<Record<string, BookCode>> = {
  Gen: "GEN", Exod: "EXO", Lev: "LEV", Num: "NUM", Deut: "DEU",
  Josh: "JOS", Judg: "JDG", Ruth: "RUT", "1Sam": "1SA", "2Sam": "2SA",
  "1Kgs": "1KI", "2Kgs": "2KI", "1Chr": "1CH", "2Chr": "2CH", Ezra: "EZR",
  Neh: "NEH", Esth: "EST", Job: "JOB", Ps: "PSA", Prov: "PRO",
  Eccl: "ECC", Song: "SNG", Isa: "ISA", Jer: "JER", Lam: "LAM",
  Ezek: "EZK", Dan: "DAN", Hos: "HOS", Joel: "JOL", Amos: "AMO",
  Obad: "OBA", Jonah: "JON", Mic: "MIC", Nah: "NAM", Hab: "HAB",
  Zeph: "ZEP", Hag: "HAG", Zech: "ZEC", Mal: "MAL",
};

/**
 * `7462 b` -> `H7462b`; `3808` -> `H3808`; `430` -> `H0430`; `b`, `l`, `c` ->
 * no Strong's (those are prefix particles, which carry no lexeme of their own).
 */
export function toStrongs(lemmaRef: string): string | undefined {
  if (!/^\d/.test(lemmaRef.trim())) return undefined;
  return canonicalStrongs(lemmaRef, "H");
}

/**
 * Split one OSHB word into morphemes.
 *
 * Surface and morph always have the same number of parts. Lemma parts align
 * with the non-suffix morph parts only, because a pronominal suffix carries no
 * lemma of its own: `עַמֶּ/ךָ` is lemma `5971 a` against morph `HNcmsc/Sp2ms`.
 */
export function splitMorphemes(
  rawSurface: string,
  lemma: string,
  morph: string,
): TokenMorpheme[] | undefined {
  const surfaces = rawSurface.split("/");
  const morphBody = morph.replace(/^[HA]/, "");
  const morphs = morphBody.split("/");
  if (surfaces.length <= 1 || surfaces.length !== morphs.length) return undefined;

  const lemmaParts = lemma.split("/");
  const morphemes: TokenMorpheme[] = [];
  let lemmaIndex = 0;
  let stemSeen = false;

  for (const [index, surface] of surfaces.entries()) {
    const partMorph = morphs[index] ?? "";
    const isSuffix = partMorph.startsWith("Sp");
    const lemmaRef = isSuffix ? undefined : lemmaParts[lemmaIndex++];
    const strongs = lemmaRef === undefined ? undefined : toStrongs(lemmaRef);
    const isStem = !isSuffix && strongs !== undefined;
    if (isStem) stemSeen = true;

    morphemes.push({
      surface,
      role: isSuffix ? "suffix" : isStem ? "stem" : stemSeen ? "suffix" : "prefix",
      ...(lemmaRef === undefined ? {} : { lemma_ref: lemmaRef }),
      ...(strongs === undefined ? {} : { strongs }),
      ...(partMorph === "" ? {} : { morph: partMorph }),
    });
  }
  return morphemes;
}

const VERSE_RE = /<verse osisID="([^"]+)"[^>]*>([\s\S]*?)<\/verse>/g;
const WORD_RE = /<w\s+([^>]*)>([\s\S]*?)<\/w>/g;
const ATTR_RE = /(\w+)="([^"]*)"/g;

/**
 * OSHB marks the English verse number for the text that follows it with an
 * inline note, e.g. `<note>KJV:Ps.23.1</note>`. Every occurrence is a point
 * where Hebrew and English numbering diverge.
 */
const KJV_NOTE_RE = /<note>KJV:([A-Za-z0-9]+)\.(\d+)\.(\d+)<\/note>/g;

interface KjvNote {
  index: number;
  length: number;
  chapter: number;
  verse: number;
  sameChapter: boolean;
}

function kjvNotes(body: string, chapter: number, osisBook: string): KjvNote[] {
  const notes: KjvNote[] = [];
  for (const match of body.matchAll(KJV_NOTE_RE)) {
    notes.push({
      index: match.index,
      length: match[0].length,
      chapter: Number(match[2]),
      verse: Number(match[3]),
      sameChapter: match[1] === osisBook && Number(match[2]) === chapter,
    });
  }
  return notes;
}

interface OshbVerse {
  book: BookCode;
  osisBook: string;
  chapter: number;
  verse: number;
  body: string;
}

export interface VersificationReport {
  /** Verses emitted at verse 0 — superscriptions. */
  titles: number;
  /** Verses whose English number differs from the Hebrew number on the element. */
  renumbered: number;
  /** Verses moved into a different chapter than the one they are filed under. */
  crossChapter: string[];
}

/**
 * Renumber one chapter from Hebrew into English versification.
 *
 * The Hebrew tradition and English numbering diverge in two distinct ways, and
 * handling only the first silently mis-numbers the second:
 *
 *   Ps 23 — the title sits *inside* Hebrew verse 1 alongside English verse 1's
 *           text. The verse must be **split**: title to verse 0, rest to 1.
 *   Ps 3  — the title *is* Hebrew verse 1, and every later verse shifts by one.
 *           Nothing is split; the whole chapter is **renumbered**.
 *
 * Both fall out of one rule: a KJV note gives the English number for the text
 * after it. Track a running English number, let notes reset it, and advance it
 * across verse elements that carry no note.
 *
 * PRD canon is English (`CANONICAL_VERSIFICATION`), so English is what the verse
 * ids carry; the Hebrew numbering is recoverable from the source and is not
 * duplicated here.
 */
function renumberChapter(
  verses: OshbVerse[],
  tokens: Token[],
  report: VersificationReport,
): void {
  const notesByVerse = verses.map((v) => kjvNotes(v.body, v.chapter, v.osisBook));
  const firstNote = notesByVerse.flat()[0];

  // A superscription is only indicated when the chapter's *first* note names
  // verse 1 of this same chapter. Genesis 32 is the counterexample that forces
  // the qualifier: its first note is `KJV:Gen.31.55`, and a later one does name
  // Gen.32.1 — but the text ahead of it is the last verse of chapter 31, not a
  // title. Narrative books have no superscriptions, and a looser test invents
  // one for them.
  const hasTitle = firstNote !== undefined && firstNote.sameChapter && firstNote.verse === 1;

  let english: { chapter: number; verse: number } | null = null;

  for (const [index, verse] of verses.entries()) {
    const notes = notesByVerse[index] ?? [];

    // Text before the first note is the title when the chapter has one, and
    // otherwise sits at its own Hebrew number.
    let target: { chapter: number; verse: number } =
      english ?? { chapter: verse.chapter, verse: hasTitle ? 0 : verse.verse };
    let cursor = 0;

    for (const note of notes) {
      emit(verse, verse.body.slice(cursor, note.index), target, tokens, report);
      cursor = note.index + note.length;
      // Notes carry a full reference, so a shift across a chapter boundary is
      // followed rather than stranded: Hebrew Gen 32:1 is English Gen 31:55.
      target = { chapter: note.chapter, verse: note.verse };
      english = target;
    }
    emit(verse, verse.body.slice(cursor), target, tokens, report);

    // The next verse element continues the English sequence.
    english = english === null ? null : { chapter: target.chapter, verse: target.verse + 1 };
  }
}

function emit(
  verse: OshbVerse,
  segment: string,
  target: { chapter: number; verse: number },
  tokens: Token[],
  report: VersificationReport,
): void {
  if (segment.trim().length === 0) return;
  const before = tokens.length;
  collectWords(segment, `${verse.book}.${target.chapter}.${target.verse}`, tokens);
  if (tokens.length === before) return;

  if (target.chapter !== verse.chapter) {
    report.crossChapter.push(`${verse.book}.${verse.chapter}.${verse.verse} -> ${target.chapter}.${target.verse}`);
  } else if (target.verse === 0) report.titles += 1;
  else if (target.verse !== verse.verse) report.renumbered += 1;
}

export function parseOshb(file: string): { tokens: Token[]; report: VersificationReport } {
  const xml = readFileSync(path.join(RAW, file), "utf8");
  const tokens: Token[] = [];
  const report: VersificationReport = { titles: 0, renumbered: 0, crossChapter: [] };

  // Chapter-scoped, because renumbering carries across verse elements.
  let chapterVerses: OshbVerse[] = [];
  let currentChapter = -1;

  const flush = (): void => {
    if (chapterVerses.length > 0) renumberChapter(chapterVerses, tokens, report);
    chapterVerses = [];
  };

  for (const verseMatch of xml.matchAll(VERSE_RE)) {
    const osisId = verseMatch[1] ?? "";
    const [osisBook, chapter, verse] = osisId.split(".");
    const book = OSIS_TO_CODE[osisBook ?? ""];
    if (book === undefined) continue;
    const chapterNumber = Number(chapter);
    if (chapterNumber !== currentChapter) {
      flush();
      currentChapter = chapterNumber;
    }
    chapterVerses.push({
      book,
      osisBook: osisBook ?? "",
      chapter: chapterNumber,
      verse: Number(verse),
      body: verseMatch[2] ?? "",
    });
  }
  flush();

  return { tokens, report };
}

function collectWords(body: string, verseId: string, tokens: Token[]): void {
  let position = 0;
  for (const wordMatch of body.matchAll(WORD_RE)) {
    const attrText = wordMatch[1] ?? "";
    const rawSurface = (wordMatch[2] ?? "").trim();
    if (rawSurface.length === 0) continue;
    const attrs: Record<string, string> = {};
    for (const attr of attrText.matchAll(ATTR_RE)) attrs[attr[1] ?? ""] = attr[2] ?? "";

    const lemma = attrs["lemma"] ?? "";
    const morph = attrs["morph"] ?? "";
    position += 1;

    const morphemes = splitMorphemes(rawSurface, lemma, morph);
    const stem = morphemes?.find((m) => m.role === "stem");
    const strongs = stem?.strongs ?? toStrongs(lemma);

    tokens.push({
      verse_id: verseId,
      position,
      surface: rawSurface.replace(/\//g, ""),
      raw_surface: rawSurface,
      lemma,
      ...(strongs === undefined ? {} : { strongs }),
      morph,
      ...(morphemes === undefined ? {} : { morphemes }),
      variant_marked: false,
    });
  }
}
