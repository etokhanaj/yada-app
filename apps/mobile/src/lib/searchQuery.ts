/**
 * Turning what a reader types into safe queries.
 *
 * FTS5 has its own query language: a bare `-`, `"`, `*`, `:`, `(`, `NEAR`,
 * `AND`, `OR` or `NOT` in user input is syntax, and an unbalanced quote is an
 * error that throws. So every term is quoted as an FTS5 string (doubling any
 * embedded quote), and the only syntax Yada adds is a prefix star on the last
 * term so results appear while someone is still typing.
 */

import { BOOK_CODES, BOOK_ORDER, detectScript, normalizeGreek, normalizeHebrew, parseReference, type QueryScript, type Reference } from "@yada/schema";

export function quoteFtsTerm(term: string): string {
  return `"${term.replace(/"/g, '""')}"`;
}

/** Terms are split on whitespace and FTS5-quoted; null when nothing searchable remains. */
export function buildFtsQuery(input: string, options: { prefixLast?: boolean } = {}): string | null {
  const terms = input
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((t) => t.length > 0);
  if (terms.length === 0) return null;
  const quoted = terms.map(quoteFtsTerm);
  const last = terms[terms.length - 1] ?? "";
  // A prefix on a one- or two-letter term matches half the Bible and tells
  // the reader nothing; wait for a third letter.
  if (options.prefixLast === true && last.length >= 3) quoted[quoted.length - 1] = `${quoted[quoted.length - 1]}*`;
  return quoted.join(" ");
}

/** Escape a value for LIKE with `ESCAPE '\'`. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * The inflections a gloss might use for an English search word. "love" has to
 * find ἀγαπάω, whose commonest gloss is "loving". Deliberately small: regular
 * suffixes only, no stemming library, nothing that guesses at irregulars.
 */
export function englishVariants(word: string): string[] {
  const w = word.toLowerCase();
  const variants = new Set<string>([w, `${w}s`, `${w}es`, `${w}ed`, `${w}ing`, `${w}er`, `${w}ers`]);
  if (w.endsWith("e")) {
    const stem = w.slice(0, -1);
    variants.add(`${w}d`).add(`${stem}ing`).add(`${w}r`).add(`${w}rs`);
  }
  if (w.endsWith("y") && w.length > 2) {
    const stem = w.slice(0, -1);
    variants.add(`${stem}ies`).add(`${stem}ied`);
  }
  if (w.endsWith("s") && w.length > 3) variants.add(w.slice(0, -1));
  return [...variants];
}

/** The shortest LIKE fragment every variant contains, for the coarse SQL pass. */
export function glossStem(word: string): string {
  const w = word.toLowerCase();
  if ((w.endsWith("e") || w.endsWith("y")) && w.length > 2) return w.slice(0, -1);
  if (w.endsWith("s") && w.length > 3) return w.slice(0, -1);
  return w;
}

/** Does a gloss contain the word (or a regular inflection of it) as a whole word? */
export function glossMatches(gloss: string, word: string): boolean {
  const variants = new Set(englishVariants(word));
  return gloss
    .toLowerCase()
    .split(/[^\p{L}']+/u)
    .some((part) => variants.has(part));
}

export interface SearchPlan {
  readonly text: string;
  readonly script: QueryScript;
  /** A reference the input parses to, when it does and looks like one. */
  readonly reference: Reference | null;
  /** FTS5 MATCH string for passage search; null when the input is not English text. */
  readonly fts: string | null;
  /** Normalised key for word_forms, for Greek and Hebrew input. */
  readonly wordKey: string | null;
  /** English word for gloss search, when the input is a single word. */
  readonly glossWord: string | null;
}

/**
 * One field, three kinds of search. A reference wins only when the input looks
 * like one — it has a digit, or is exactly a book name — so "love" never turns
 * into a book and "is" (an Isaiah alias) does not hijack a word search unless
 * it carries a chapter.
 */
export function planSearch(input: string): SearchPlan {
  const text = input.trim();
  const script = detectScript(text);
  let reference: Reference | null = null;
  if (script === "latin" && /\d/.test(text)) reference = parseReference(text);
  else if (script === "latin" && isFullBookName(text)) reference = parseReference(text);

  if (script === "greek") {
    const key = normalizeGreek(text);
    return { text, script, reference: null, fts: null, wordKey: key === "" ? null : key, glossWord: null };
  }
  if (script === "hebrew") {
    const key = normalizeHebrew(text);
    return { text, script, reference: null, fts: null, wordKey: key === "" ? null : key, glossWord: null };
  }
  const words = text.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  const single = words.length === 1 ? (words[0] ?? "").replace(/[^\p{L}']/gu, "") : "";
  return {
    text,
    script,
    reference,
    fts: reference !== null ? null : buildFtsQuery(text, { prefixLast: false }),
    wordKey: null,
    glossWord: reference === null && single.length >= 2 ? single.toLowerCase() : null,
  };
}

const FULL_NAMES = new Set(BOOK_ORDER.map((code) => BOOK_CODES[code].name.toLowerCase()));

function isFullBookName(text: string): boolean {
  return FULL_NAMES.has(text.toLowerCase().replace(/\s+/g, " "));
}

/**
 * snippet() marks hits with control characters that cannot occur in Bible
 * text, so splitting on them is unambiguous whatever the verse contains.
 */
export const SNIPPET_OPEN = "\u0002";
export const SNIPPET_CLOSE = "\u0003";

export function splitSnippet(snippet: string): Array<{ text: string; hit: boolean }> {
  const parts: Array<{ text: string; hit: boolean }> = [];
  let rest = snippet;
  while (rest.length > 0) {
    const open = rest.indexOf(SNIPPET_OPEN);
    if (open < 0) {
      parts.push({ text: rest, hit: false });
      break;
    }
    if (open > 0) parts.push({ text: rest.slice(0, open), hit: false });
    const close = rest.indexOf(SNIPPET_CLOSE, open + 1);
    const end = close < 0 ? rest.length : close;
    parts.push({ text: rest.slice(open + 1, end), hit: true });
    rest = close < 0 ? "" : rest.slice(close + 1);
  }
  return parts.filter((p) => p.text.length > 0);
}
