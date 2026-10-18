/**
 * The dictionary Search browses and finds (DI-03, DI-04, PD-04) and the guide titles it finds (IA-06), from
 * data/dictionary.generated.ts: unfoldingWord's Translation Words and the guides' passage titles, as every book's
 * Understand bundle holds them. Nothing here writes a word; it only groups, orders and matches.
 */

import { type BookCode, ordToParts } from "@yada/schema";

import { DICTIONARY, type DictionaryKind, type DictionaryRow, GUIDES } from "../data/dictionary.generated";

/** The credit Key words already carries (components/UnderstandPages.tsx): the same source, said the same way. */
export const DICTIONARY_CREDIT = "Translation Words, adapted from unfoldingWord (definition only) · CC BY‑SA 4.0";

/** DI-04's three groups, in its order: Translation Words' own folders (kt, names, other). */
export const DICTIONARY_GROUPS: readonly { readonly kind: DictionaryKind; readonly title: string }[] = [
  { kind: "kt", title: "Key words" },
  { kind: "names", title: "People and places" },
  { kind: "other", title: "Other words" },
];

export interface DictionaryUse {
  readonly book: BookCode;
  /** The first verse in the book that names the term. */
  readonly ord: number;
  readonly verses: number;
}

export interface DictionaryEntry {
  readonly term: string;
  readonly kind: DictionaryKind;
  readonly definition: string;
  readonly uses: readonly DictionaryUse[];
  /** Verses across the Bible that name it. */
  readonly verses: number;
}

export function entryOf([term, kind, definition, flat]: DictionaryRow): DictionaryEntry {
  const uses: DictionaryUse[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const ord = flat[i] ?? 0;
    uses.push({ book: ordToParts(ord).book, ord, verses: flat[i + 1] ?? 0 });
  }
  return { term, kind, definition, uses, verses: uses.reduce((sum, u) => sum + u.verses, 0) };
}

export function dictionaryEntry(term: string, rows: readonly DictionaryRow[] = DICTIONARY): DictionaryEntry | null {
  const row = rows.find((r) => r[0] === term);
  return row === undefined ? null : entryOf(row);
}

/** DI-04: each group's terms, A to Z as the rows already are. */
export function groupDictionary(rows: readonly DictionaryRow[] = DICTIONARY): Array<{ kind: DictionaryKind; title: string; terms: string[] }> {
  return DICTIONARY_GROUPS.map((g) => ({ ...g, terms: rows.filter((r) => r[1] === g.kind).map((r) => r[0]) }));
}

/** The first sentence, as Key words shows a term's (DI-01). */
export function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s+/u)[0] ?? text;
}

const fold = (text: string) => text.toLowerCase().replace(/[’‘]/gu, "'").replace(/\s+/gu, " ").trim();
const wordsOf = (text: string) => fold(text).split(/[^\p{L}']+/u).filter((w) => w.length > 0);

/** The query and its plain singular: "Pharisees" has to find TW's "Pharisee" (PD-04). Regular endings only. */
function forms(q: string): Set<string> {
  const out = new Set([q]);
  if (q.endsWith("ies") && q.length > 4) out.add(`${q.slice(0, -3)}y`);
  if (q.endsWith("es") && q.length > 3) out.add(q.slice(0, -2));
  if (q.endsWith("s") && q.length > 3) out.add(q.slice(0, -1));
  return out;
}

/** English words only: a reference, a number, Greek or Hebrew has its own groups. */
function searchable(query: string): string | null {
  const q = fold(query);
  if (q.length < 3 || /\d/u.test(q) || !/^[\p{Script=Latin}\s'-]+$/u.test(q)) return null;
  return q;
}

/**
 * DI-03, PD-04: the terms a query names, before the verses. The term itself first, then terms that begin with what
 * was typed (so "pharis" finds it while typing), then terms with it as one of their words ("spirit" in "Holy Spirit").
 */
export function findTerms(query: string, rows: readonly DictionaryRow[] = DICTIONARY, limit = 3): DictionaryEntry[] {
  const q = searchable(query);
  if (q === null) return [];
  const want = forms(q);
  const scored: Array<{ row: DictionaryRow; score: number }> = [];
  for (const row of rows) {
    const term = fold(row[0]);
    const score = want.has(term) ? 0 : term.startsWith(q) ? 1 : wordsOf(term).some((w) => want.has(w)) ? 2 : -1;
    if (score >= 0) scored.push({ row, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.row[0].length - b.row[0].length)
    .slice(0, limit)
    .map((s) => entryOf(s.row));
}

export interface GuideHit {
  readonly title: string;
  /** The passage id the guide opens on: "JHN.1.1-1.18". */
  readonly ref: string;
}

/**
 * IA-06: a passage title finds its guide. The title whole first, then titles that begin with the query, then titles
 * holding it from a word's start; four letters at least, so "the" does not list half the Bible's passages.
 */
export function findGuides(query: string, guides: readonly (readonly [string, string])[] = GUIDES, limit = 5): GuideHit[] {
  const q = searchable(query);
  if (q === null || q.length < 4) return [];
  const scored: Array<{ hit: GuideHit; score: number; at: number }> = [];
  guides.forEach(([title, ref], at) => {
    const t = fold(title);
    const i = t.indexOf(q);
    if (i < 0) return;
    const fromWordStart = i === 0 || !/\p{L}/u.test(t[i - 1] ?? "");
    if (!fromWordStart) return;
    scored.push({ hit: { title, ref }, score: t === q ? 0 : i === 0 ? 1 : 2, at });
  });
  // Ties keep Bible order: the generated list is in canonical order.
  return scored
    .sort((a, b) => a.score - b.score || a.at - b.at)
    .slice(0, limit)
    .map((s) => s.hit);
}
