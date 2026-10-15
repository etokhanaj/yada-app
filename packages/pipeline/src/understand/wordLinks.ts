/**
 * MM-03: which words of the BSB verse translate a tapped Greek or Hebrew word.
 *
 * The Berean translation tables (bsb_tables.tsv) give every original word its English phrase, rows in
 * BSB order, with Greek Sort or Heb Sort giving the original order. Core's tokens are TAGNT/OSHB words
 * keyed by (ord, position). The two are joined by order AND normalised surface, never by gloss or
 * guess (rule 4; qa-next-release.md MM-03): where either side is not certain, the token gets nothing
 * and is counted.
 *
 * Spans index the BSB verse exactly as core stores it (UTF-16 offsets, as the app slices strings).
 */

import { closeSync, openSync, readSync } from "node:fs";
import { StringDecoder } from "node:string_decoder";

/** One original-language word's row in the tables, in the order the file lists it (BSB order). */
export interface TableWordRow {
  /** Greek Sort or Heb Sort: the word's place in the original. */
  readonly sort: number;
  readonly orig: string;
  /** Str Grk or Str Heb, digits as written ("1722"), "" when the row has none. */
  readonly strong: string;
  /** The BSB column as written: "[the] beginning", "-", ". . .". */
  readonly english: string;
}

export interface TableVerse {
  /** "John 1:1", as the tables name it on the verse's first row. */
  readonly ref: string;
  readonly language: "Greek" | "Hebrew";
  /** In BSB order. */
  readonly rows: TableWordRow[];
}

/**
 * Every verse in the tables. Rows are grouped by the "Verse" column (a running number), not by
 * VerseId: VerseId is written only on a verse's first BSB row, and a reordered verse's first row in
 * BSB order is not always its first word.
 */
export function tableVerses(text: string | Iterable<string>, keep: (ref: string) => boolean = () => true): TableVerse[] {
  const out: TableVerse[] = [];
  let cur: { key: string; verse: TableVerse; skip: boolean } | null = null;
  // Line by line, and a build of one book keeps only that book's verses: the file is 85 MB, and the
  // Understand build ran golden.test.ts out of heap holding it whole (15 Oct 2026); see fileLines.
  let header = true;
  for (const raw of typeof text === "string" ? textLines(text) : text) {
    if (header) {
      header = false;
      continue;
    }
    const r = raw.split("\t");
    if (r.length < 23) continue;
    const key = r[3] ?? "";
    if (cur === null || cur.key !== key) {
      const language = r[4] === "Hebrew" ? "Hebrew" : "Greek";
      cur = { key, verse: { ref: "", language, rows: [] }, skip: false };
      out.push(cur.verse);
    }
    if ((r[12] ?? "") !== "" && cur.verse.ref === "") {
      (cur.verse as { ref: string }).ref = r[12] ?? "";
      cur.skip = !keep(cur.verse.ref);
    }
    if (cur.skip) continue;
    const orig = (r[5] ?? "").trim();
    // Rows with no original word fill the file's numbering (end of John 1:1); they translate nothing.
    if (orig === "") continue;
    const sort = Number(cur.verse.language === "Hebrew" ? r[0] : r[1]);
    if (!Number.isFinite(sort)) continue;
    const strong = ((cur.verse.language === "Hebrew" ? r[10] : r[11]) ?? "").trim();
    cur.verse.rows.push({ sort, orig, strong, english: (r[18] ?? "").trim() });
  }
  return out.filter((v) => v.ref !== "" && keep(v.ref));
}

/** Rows split on \n alone, as bsbTables splits them: a footnote may hold U+2028, which is not a row break. */
export function* textLines(text: string): Generator<string> {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let start = 0;
  while (start < body.length) {
    let end = body.indexOf("\n", start);
    if (end === -1) end = body.length;
    yield body.slice(start, body[end - 1] === "\r" ? end - 1 : end);
    start = end + 1;
  }
}

/** A file's rows, read 4 MB at a time, so the 85 MB tables never sit in memory as one string. */
export function* fileLines(file: string): Generator<string> {
  const fd = openSync(file, "r");
  const decoder = new StringDecoder("utf8");
  const buf = Buffer.alloc(4 << 20);
  let rest = "";
  let first = true;
  try {
    for (;;) {
      const n = readSync(fd, buf, 0, buf.length, null);
      let chunk = rest + (n === 0 ? decoder.end() : decoder.write(buf.subarray(0, n)));
      if (first && chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1);
      first = false;
      const lines = chunk.split("\n");
      rest = lines.pop() ?? "";
      for (const l of lines) yield l.endsWith("\r") ? l.slice(0, -1) : l;
      if (n === 0) {
        if (rest !== "") yield rest.endsWith("\r") ? rest.slice(0, -1) : rest;
        break;
      }
    }
  } finally {
    closeSync(fd);
  }
}

/**
 * A word as letters only: marks (accents, breathings, vowel points, cantillation) and punctuation
 * (sof pasuq, maqaf, elision marks) dropped, case folded, final sigma made medial. TAGNT/OSHB and the
 * tables' Nestle/WLC differ in exactly these (λόγος / Λόγος, הָאָֽרֶץ / הָאָֽרֶץ׃).
 */
export function normaliseWord(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}]/gu, "")
    .toLowerCase()
    .replace(/ς/g, "σ");
}

/**
 * Pairs (table index, token index) that every longest common subsequence contains. A repeated word
 * that could pair either way (an extra ὁ in one edition) is left out, so nothing is matched by guess.
 *
 * A match (i, j) lies on some LCS when prefix[i][j] + 1 + suffix[i+1][j+1] equals the LCS length, and
 * it is then that LCS's (prefix[i][j] + 1)th pair. Every LCS has exactly one pair at each rank, so a
 * match is in all of them exactly when it is the only optimal match at its rank. Intersecting the
 * leftmost and rightmost alignments, as this did before, kept guesses: both can agree on a pair that
 * a third LCS avoids ([c,a,c,c,a,a] against [b,c] paired 3:1; code review, 15 Oct 2026).
 */
export function certainPairs(a: readonly string[], b: readonly string[]): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  const match = (i: number, j: number): boolean => a[i] !== "" && a[i] === b[j];
  // prefix[i][j] = LCS of a[..i), b[..j); suffix[i][j] = LCS of a[i..], b[j..].
  const prefix: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const suffix: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      prefix[i]![j] = match(i - 1, j - 1) ? prefix[i - 1]![j - 1]! + 1 : Math.max(prefix[i - 1]![j]!, prefix[i]![j - 1]!);
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      suffix[i]![j] = match(i, j) ? suffix[i + 1]![j + 1]! + 1 : Math.max(suffix[i + 1]![j]!, suffix[i]![j + 1]!);
    }
  }
  const total = suffix[0]![0]!;
  const byRank = new Map<number, Array<[number, number]>>();
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (!match(i, j) || prefix[i]![j]! + 1 + suffix[i + 1]![j + 1]! !== total) continue;
      const rank = prefix[i]![j]! + 1;
      const list = byRank.get(rank);
      if (list === undefined) byRank.set(rank, [[i, j]]);
      else list.push([i, j]);
    }
  }
  return [...byRank.entries()]
    .sort((x, y) => x[0] - y[0])
    .flatMap(([, list]) => (list.length === 1 ? list : []));
}

/** "G0746", "H1254a", "746" -> "746": the number alone, as both files can be compared. */
export function strongNumber(s: string | null | undefined): string {
  const m = /(\d+)/.exec(s ?? "");
  return m === null ? "" : String(Number(m[1]));
}

/**
 * Between two certain pairs (or a verse's ends), a gap of the same length on both sides whose words
 * carry the same Strong's numbers one for one is the same words spelt by another edition: ἐστι and
 * ἐστιν, ἀλλά and ἀλλ’, συγχρῶνται and συνχρῶνται (John 4:9). Paired only then; a gap where any
 * number differs (ἐκλεκτὸς for υἱὸς, John 1:34) stays unpaired.
 */
export function strongGapPairs(pairs: ReadonlyArray<[number, number]>, a: readonly string[], b: readonly string[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const anchors: Array<[number, number]> = [[-1, -1], ...pairs, [a.length, b.length]];
  for (let k = 0; k + 1 < anchors.length; k++) {
    const [i0, j0] = anchors[k]!;
    const [i1, j1] = anchors[k + 1]!;
    const n = i1 - i0 - 1;
    if (n <= 0 || n !== j1 - j0 - 1) continue;
    const gap = Array.from({ length: n }, (_, d): [number, number] => [i0 + 1 + d, j0 + 1 + d]);
    if (gap.every(([i, j]) => a[i] !== "" && a[i] === b[j])) out.push(...gap);
  }
  return out;
}

/** What a phrase in the BSB column means for linking. */
export type PhraseKind = "words" | "none" | "folded";

/**
 * "-": the word has no English of its own (τὸν in John 1:1). ". . ." and "vvv": its English is folded
 * into another row's phrase (οὐκ in "He did not know", John 2:9), and the file does not say which row.
 * All three link to nothing (rule 4).
 */
export function phraseKind(english: string): PhraseKind {
  const t = english.trim();
  if (t === "" || t === "-") return "none";
  if (/^\.(\s*\.)+$/.test(t) || t === "vvv") return "folded";
  return "words";
}

interface PhraseWord {
  readonly word: string;
  /** Inside [ ]: the BSB supplies it, so it is not the original word's partner and is not underlined. */
  readonly supplied: boolean;
}

/** "[the] beginning" -> the, beginning (supplied first). Braces ({will} crush) are the verb's own tense words. */
export function phraseWords(english: string): PhraseWord[] {
  const out: PhraseWord[] = [];
  let depth = 0;
  for (const raw of english.split(/(\[|\])|\s+/u)) {
    if (raw === undefined || raw === "") continue;
    if (raw === "[") depth++;
    else if (raw === "]") depth = Math.max(0, depth - 1);
    else {
      const word = raw.replace(/[{}]/g, "").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      if (word !== "") out.push({ word, supplied: depth > 0 });
    }
  }
  return out;
}

const fold = (s: string): string => s.toLowerCase().replace(/[’']/g, "'").replace(/[‐‑–—]/g, "-");
const isWordChar = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}]/u.test(c);

/**
 * Finds the words at `from`, skipping only what is not a letter or digit between them (spaces, quotes,
 * punctuation). Returns each word's [start, end) or null when the text there is anything else.
 */
function matchAt(text: string, from: number, words: readonly PhraseWord[]): { spans: Array<[number, number, boolean]>; end: number } | null {
  let pos = from;
  const spans: Array<[number, number, boolean]> = [];
  for (const w of words) {
    while (pos < text.length && !isWordChar(text[pos])) pos++;
    const end = pos + w.word.length;
    if (fold(text.slice(pos, end)) !== fold(w.word)) return null;
    if (isWordChar(text[end])) return null;
    spans.push([pos, end, w.supplied]);
    pos = end;
  }
  return { spans, end: pos };
}

export type TokenOutcome = "linked" | "none" | "folded" | "supplied" | "skipped";

export interface WordLink {
  /** core tokens.position */
  readonly position: number;
  /** [start, end) offsets in the BSB verse text; contiguous words merged. */
  readonly spans: Array<[number, number]>;
}

export interface VerseLinks {
  readonly links: WordLink[];
  /** Every token's outcome, by position. */
  readonly outcomes: Map<number, TokenOutcome>;
}

export interface CoreToken {
  readonly position: number;
  readonly surface: string;
  /** core tokens.strongs ("G1722", "H1254a"); null when core has none. */
  readonly strongs: string | null;
}

/**
 * One verse: core's tokens and BSB text, and the table's rows for it. A token is linked only when its
 * table row is a certain pair AND that row's phrase was found in the BSB text in sequence. The text is
 * walked in BSB order from the start; once a phrase is not where the order puts it, every later row is
 * uncertain too, and is skipped rather than searched for.
 */
export function linkVerse(tokens: readonly CoreToken[], bsb: string, table: TableVerse | undefined): VerseLinks {
  const outcomes = new Map<number, TokenOutcome>(tokens.map((t) => [t.position, "skipped"]));
  if (table === undefined || bsb === "") return { links: [], outcomes };

  // Original order of the table's rows, to pair with core's token order.
  const byOrig = table.rows.map((row, bsbIndex) => ({ row, bsbIndex })).sort((x, y) => x.row.sort - y.row.sort);
  const surfaces = certainPairs(
    byOrig.map((x) => normaliseWord(x.row.orig)),
    tokens.map((t) => normaliseWord(t.surface)),
  );
  const pairs = [
    ...surfaces,
    ...strongGapPairs(
      surfaces,
      byOrig.map((x) => strongNumber(x.row.strong)),
      tokens.map((t) => strongNumber(t.strongs)),
    ),
  ];
  const tokenOfRow = new Map<number, CoreToken>();
  for (const [i, j] of pairs) {
    const bsbIndex = byOrig[i]?.bsbIndex;
    const token = tokens[j];
    if (bsbIndex !== undefined && token !== undefined) tokenOfRow.set(bsbIndex, token);
  }

  const links: WordLink[] = [];
  let cursor = 0;
  let lost = false;
  table.rows.forEach((row, bsbIndex) => {
    const token = tokenOfRow.get(bsbIndex);
    const kind = phraseKind(row.english);
    let found: ReturnType<typeof matchAt> = null;
    if (kind === "words" && !lost) {
      found = matchAt(bsb, cursor, phraseWords(row.english));
      if (found === null) lost = true;
      else cursor = found.end;
    }
    if (token === undefined) return;
    if (kind !== "words") {
      outcomes.set(token.position, kind);
      return;
    }
    if (found === null) return;
    const own = found.spans.filter(([, , supplied]) => !supplied);
    if (own.length === 0) {
      outcomes.set(token.position, "supplied");
      return;
    }
    // Contiguous own words ("came into being") are one underline; a supplied word between them splits it.
    const merged: Array<[number, number]> = [];
    let run: [number, number] | null = null;
    for (const [s, e, supplied] of found.spans) {
      if (supplied) run = null;
      else if (run === null) merged.push((run = [s, e]));
      else run[1] = e;
    }
    links.push({ position: token.position, spans: merged });
    outcomes.set(token.position, "linked");
  });
  links.sort((a, b) => a.position - b.position);
  return { links, outcomes };
}

export interface LinkCounts {
  tokens: number;
  linked: number;
  /** "-": no English of its own. */
  none: number;
  /** ". . .": folded into another row's phrase. */
  folded: number;
  /** Only [supplied] words. */
  supplied: number;
  /** Not certain: no link emitted (rule 4). */
  skipped: number;
  verses: number;
  versesWithSkip: number;
}

export const emptyCounts = (): LinkCounts => ({ tokens: 0, linked: 0, none: 0, folded: 0, supplied: 0, skipped: 0, verses: 0, versesWithSkip: 0 });

export function addCounts(into: LinkCounts, verse: VerseLinks): void {
  into.verses++;
  let skip = false;
  for (const o of verse.outcomes.values()) {
    into.tokens++;
    into[o]++;
    if (o === "skipped") skip = true;
  }
  if (skip) into.versesWithSkip++;
}

/** The stored form: [[position, start, end], ...], one entry per span. */
export function encodeLinks(links: readonly WordLink[]): string {
  return JSON.stringify(links.flatMap((l) => l.spans.map(([s, e]) => [l.position, s, e])));
}

/**
 * The tables' verses by core's book code and "c:v". The tables name books as the BSB prints them
 * ("Psalm 23:1", "Song of Solomon 1:1"); `byName` is sources.ts bookCodeByName over core's names.
 */
export function tableIndex(verses: readonly TableVerse[], byName: ReadonlyMap<string, string>, normalise: (name: string) => string): Map<string, TableVerse> {
  const out = new Map<string, TableVerse>();
  for (const v of verses) {
    const m = /^(.*) (\d+):(\d+)$/.exec(v.ref);
    if (m === null) continue;
    const code = byName.get(normalise(m[1] ?? ""));
    if (code === undefined) continue;
    out.set(`${code} ${Number(m[2])}:${Number(m[3])}`, v);
  }
  return out;
}

export const WORD_LINKS_DDL = `
CREATE TABLE word_links (
  ord   INTEGER PRIMARY KEY,
  bsb   TEXT NOT NULL,
  links TEXT NOT NULL
);
`;
