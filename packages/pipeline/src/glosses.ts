/**
 * Contextual English glosses for the interlinear, from STEPBible TAGNT (Greek)
 * and TAHOT (Hebrew), aligned onto MorphGNT and OSHB tokens.
 *
 * PRD §7 calls these "sourced lexical gloss data" and requires the provenance to
 * be exposed: a gloss shown under a Greek word is STEPBible's, not Yada's. They
 * are therefore stored with their source, and nothing here writes a gloss the
 * data does not contain.
 *
 * Alignment is by surface form within a verse, not by word number. The two
 * projects count words differently (TAHOT divides at metheg, the tagged texts
 * amalgamate several editions), so a positional join would attach glosses to
 * the wrong words while reporting perfect coverage. Surface matching can only
 * fail by leaving a word unglossed, which is visible and counted.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { BOOK_CODES, isBookCode, normalizeGreek, normalizeHebrew } from "@yada/schema";

// One normalisation for alignment and for in-app search; see @yada/schema/search.
export { normalizeGreek, normalizeHebrew };

import type { Token } from "./parsers.js";
import { RAW } from "./paths.js";

export type GlossSource = "TAGNT" | "TAHOT" | "TBESG" | "TBESH";

interface TaggedWord {
  norm: string;
  gloss: string;
  /** Per-morpheme glosses, when the source separates them (TAHOT). */
  parts: string[];
}

/** How far ahead a token may look for its partner before giving up. */
const LOOKAHEAD = 4;

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * `[The] book` -> `book`: square brackets mark words the English needs but the
 * original does not have, which a word-for-word gloss must not show.
 * `<obj.>` -> `obj.`: angle brackets mark something present in the Hebrew that
 * a translation omits — present, so kept.
 */
export function cleanGloss(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[<>]/g, "")
    .replace(/[.,;:!?·]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * TAHOT ends a word that closes a paragraph with the paragraph mark as its own
 * backslash-separated piece (`אֶחָֽד\׃\ \פ`). normalizeHebrew keeps Hebrew
 * letters, so the פ or ס stayed on the word and it never matched OSHB: 3,103
 * verse-final words had no gloss in core v5, Genesis 1:5's among them. Only a
 * trailing mark goes; the few rows where a maqaf or paseq joins a second word
 * (`\־לָעֹ֔מֶר`) keep their letters.
 */
export function tahotSurface(raw: string): string {
  return raw.replace(/(?:\\\s*)+[ספ]$/u, "");
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const REF = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)(?:\([^)]*\))?#(\d+)=(\S+)/;

function verseKey(abbrev: string, chapter: string, verse: string): string | null {
  // STEPBible abbreviations upper-case to USFM codes (Jhn -> JHN, Sng -> SNG).
  const code = abbrev.toUpperCase();
  if (!isBookCode(code)) return null;
  return `${code}.${Number(chapter)}.${Number(verse)}`;
}

function loadTagnt(files: string[]): Map<string, TaggedWord[]> {
  const byVerse = new Map<string, TaggedWord[]>();
  const seen = new Set<string>();
  for (const file of files) {
    const full = path.join(RAW, file);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, "utf8").split("\n")) {
      const cols = line.split("\t");
      const match = REF.exec(cols[0] ?? "");
      if (match === null) continue;
      // SBLGNT is what MorphGNT annotates, so only words the SBL edition carries
      // are candidates. Without this, Textus Receptus additions would be offered
      // as partners for SBLGNT words.
      if (!(cols[5] ?? "").split("+").includes("SBL")) continue;
      if (seen.has(cols[0] ?? "")) continue;
      seen.add(cols[0] ?? "");
      const key = verseKey(match[1] ?? "", match[2] ?? "", match[3] ?? "");
      if (key === null) continue;
      const greek = (cols[1] ?? "").split(" (")[0] ?? "";
      const gloss = cleanGloss(cols[2] ?? "");
      const list = byVerse.get(key) ?? [];
      list.push({ norm: normalizeGreek(greek), gloss, parts: [] });
      byVerse.set(key, list);
    }
  }
  return byVerse;
}

function loadTahot(files: string[]): Map<string, TaggedWord[]> {
  const byVerse = new Map<string, TaggedWord[]>();
  const seen = new Set<string>();
  for (const file of files) {
    const full = path.join(RAW, file);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, "utf8").split("\n")) {
      const cols = line.split("\t");
      const match = REF.exec(cols[0] ?? "");
      if (match === null) continue;
      if (seen.has(cols[0] ?? "")) continue;
      seen.add(cols[0] ?? "");
      const key = verseKey(match[1] ?? "", match[2] ?? "", match[3] ?? "");
      if (key === null) continue;
      const hebrew = tahotSurface(cols[1] ?? "");
      const english = cols[3] ?? "";
      const parts = english.split("/").map(cleanGloss);
      const list = byVerse.get(key) ?? [];
      list.push({
        norm: normalizeHebrew(hebrew),
        gloss: parts.filter((p) => p.length > 0).join(" "),
        parts,
      });
      byVerse.set(key, list);
    }
  }
  return byVerse;
}

/** Brief lexical gloss by Strong's number, the fallback for unaligned Greek. */
function loadTbesgGlosses(): Map<string, string> {
  const map = new Map<string, string>();
  const full = path.join(RAW, "TBESG.txt");
  if (!existsSync(full)) return map;
  for (const line of readFileSync(full, "utf8").split("\n")) {
    const cols = line.split("\t");
    const strongs = (cols[0] ?? "").trim();
    const gloss = (cols[6] ?? "").trim();
    if (/^G\d{4,5}[a-zA-Z]?$/.test(strongs) && gloss.length > 0 && !map.has(strongs)) {
      map.set(strongs, gloss.split("/")[0] ?? gloss);
    }
  }
  return map;
}

/**
 * Brief Hebrew and Aramaic gloss by Strong's number, the fallback for unaligned Old Testament words: ketiv forms,
 * whose TAHOT row is the qere, and the rest (build 8: 1,816 words left after the paragraph-mark fix). Column 6,
 * the gloss "created by Tyndale scholars" (TBESH's header); never column 7, the Abridged BDB, which needs
 * Online Bible's permission.
 */
function loadTbeshGlosses(): Map<string, string> {
  const full = path.join(RAW, "TBESH.txt");
  return existsSync(full) ? tbeshGlosses(readFileSync(full, "utf8")) : new Map();
}

/** TBESH's text as Strong's -> gloss: the first row for a number wins, as in TBESG. */
export function tbeshGlosses(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split("\n")) {
    const cols = line.split("\t");
    const strongs = (cols[0] ?? "").trim();
    const gloss = (cols[6] ?? "").trim();
    if (/^H\d{4,5}[a-zA-Z]?$/.test(strongs) && gloss.length > 0 && !map.has(strongs)) {
      map.set(strongs, gloss.split("/")[0] ?? gloss);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Alignment
// ---------------------------------------------------------------------------

export interface GlossCoverage {
  tokens: number;
  bySource: Record<GlossSource, number>;
  unglossed: number;
  /** Books whose aligned coverage is below 90%, worst first. */
  weakBooks: Array<{ book: string; coverage: number }>;
}

export function attachGlosses(tokens: Token[]): GlossCoverage {
  const tagnt = loadTagnt(["TAGNT-Mat-Jhn.txt", "TAGNT-Act-Rev.txt"]);
  const tahot = loadTahot(["TAHOT-Gen-Deu.txt", "TAHOT-Jos-Est.txt", "TAHOT-Job-Sng.txt", "TAHOT-Isa-Mal.txt"]);
  const tbesg = loadTbesgGlosses();
  const tbesh = loadTbeshGlosses();

  const coverage: GlossCoverage = {
    tokens: tokens.length,
    bySource: { TAGNT: 0, TAHOT: 0, TBESG: 0, TBESH: 0 },
    unglossed: 0,
    weakBooks: [],
  };
  const perBook = new Map<string, { tokens: number; aligned: number }>();

  // Tokens arrive grouped by verse in source order; keep that order.
  const byVerse = new Map<string, Token[]>();
  for (const token of tokens) {
    const list = byVerse.get(token.verse_id) ?? [];
    list.push(token);
    byVerse.set(token.verse_id, list);
  }

  for (const [verseId, verseTokens] of byVerse) {
    const book = verseId.split(".")[0] ?? "";
    const nt = isBookCode(book) && BOOK_CODES[book].testament === "NT";
    const candidates = (nt ? tagnt : tahot).get(verseId) ?? [];
    const stats = perBook.get(book) ?? { tokens: 0, aligned: 0 };

    let cursor = 0;
    for (const token of verseTokens) {
      stats.tokens += 1;
      const norm = nt ? normalizeGreek(token.surface) : normalizeHebrew(token.surface);
      let matched = false;
      for (let k = cursor; k < Math.min(candidates.length, cursor + LOOKAHEAD); k += 1) {
        const candidate = candidates[k];
        if (candidate === undefined || candidate.norm !== norm || norm.length === 0) continue;
        if (candidate.gloss.length > 0) {
          token.gloss = candidate.gloss;
          token.gloss_source = nt ? "TAGNT" : "TAHOT";
          coverage.bySource[token.gloss_source] += 1;
          stats.aligned += 1;
          matched = true;
          // Morpheme glosses only when both sides split the word identically.
          if (token.morphemes !== undefined && candidate.parts.length === token.morphemes.length) {
            token.morphemes.forEach((m, i) => {
              const part = candidate.parts[i];
              if (part !== undefined && part.length > 0) m.gloss = part;
            });
          }
        }
        cursor = k + 1;
        break;
      }

      if (!matched && token.strongs !== undefined) {
        const source = nt ? "TBESG" : "TBESH";
        const lexical = (nt ? tbesg : tbesh).get(token.strongs);
        if (lexical !== undefined) {
          token.gloss = lexical;
          token.gloss_source = source;
          coverage.bySource[source] += 1;
          matched = true;
        }
      }
      if (!matched) coverage.unglossed += 1;
    }
    perBook.set(book, stats);
  }

  coverage.weakBooks = [...perBook]
    .map(([book, s]) => ({ book, coverage: s.tokens === 0 ? 1 : s.aligned / s.tokens }))
    .filter((b) => b.coverage < 0.9)
    .sort((a, b) => a.coverage - b.coverage);
  return coverage;
}
