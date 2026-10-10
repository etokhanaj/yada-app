/**
 * Every read the app makes against the bundles, as plain functions over a
 * minimal database interface.
 *
 * The interface is the two expo-sqlite methods the app uses, so the same SQL
 * runs against the real core bundle under vitest (via node:sqlite) and on the
 * phone. Table and column names come from packages/schema/src/bundle.ts.
 */

import {
  BOOK_CODES,
  type BookCode,
  decodeMorphemes,
  type BundleMorpheme,
  verseOrd,
} from "@yada/schema";

import { glossMatches, glossStem, escapeLike, SNIPPET_CLOSE, SNIPPET_OPEN } from "../lib/searchQuery";
import type { EntryRow, PericopeRow } from "../lib/pericopes";

type Bind = string | number | null;

export interface Db {
  getAllAsync<T>(source: string, params: Bind[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: Bind[]): Promise<T | null>;
}

export type Translation = "BSB" | "WEB" | "KJV";
export type Script = "greek" | "hebrew";

export function scriptOf(book: BookCode): Script {
  return BOOK_CODES[book].testament === "NT" ? "greek" : "hebrew";
}

/** First and last possible ord of a chapter; verse 0 (a psalm title) excluded. */
export function chapterBounds(book: BookCode, chapter: number): [number, number] {
  return [verseOrd(book, chapter, 1), verseOrd(book, chapter, 999)];
}

export function bookBounds(book: BookCode): [number, number] {
  return [verseOrd(book, 1, 0), verseOrd(book, BOOK_CODES[book].chapters, 999)];
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export interface VerseText {
  readonly ord: number;
  readonly verse: number;
  readonly text: string;
}

/**
 * One chapter in one translation. Verse 0 never appears here (a psalm title is
 * Hebrew-only; English prints it inside verse 1), and empty rows are skipped:
 * BSB carries an empty Romans 16:24 rather than no row.
 */
export async function getChapter(db: Db, book: BookCode, chapter: number, translation: Translation): Promise<VerseText[]> {
  const [lo, hi] = chapterBounds(book, chapter);
  const rows = await db.getAllAsync<{ ord: number; text: string }>(
    "SELECT ord, text FROM texts WHERE translation = ? AND ord BETWEEN ? AND ? AND text <> '' ORDER BY ord",
    [translation, lo, hi],
  );
  return rows.map((r) => ({ ord: r.ord, verse: r.ord % 1000, text: r.text }));
}

export async function getTexts(db: Db, ord: number): Promise<Partial<Record<Translation, string>>> {
  const rows = await db.getAllAsync<{ translation: Translation; text: string }>(
    "SELECT translation, text FROM texts WHERE ord = ? AND text <> ''",
    [ord],
  );
  return Object.fromEntries(rows.map((r) => [r.translation, r.text]));
}

export async function getTextsInRange(
  db: Db,
  lo: number,
  hi: number,
): Promise<Array<{ ord: number; texts: Partial<Record<Translation, string>> }>> {
  const rows = await db.getAllAsync<{ ord: number; translation: Translation; text: string }>(
    "SELECT ord, translation, text FROM texts WHERE ord BETWEEN ? AND ? AND text <> '' ORDER BY ord",
    [lo, hi],
  );
  const byOrd = new Map<number, Partial<Record<Translation, string>>>();
  for (const r of rows) {
    const texts = byOrd.get(r.ord) ?? {};
    texts[r.translation] = r.text;
    byOrd.set(r.ord, texts);
  }
  return [...byOrd].map(([ord, texts]) => ({ ord, texts }));
}

export async function getTextsForOrds(db: Db, ords: readonly number[], translation: Translation): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  // SQLite's default variable limit is generous, but chunking keeps one
  // pathological lexeme (καί occurs ~9,000 times) from ever hitting it.
  for (let i = 0; i < ords.length; i += 400) {
    const chunk = ords.slice(i, i + 400);
    const rows = await db.getAllAsync<{ ord: number; text: string }>(
      `SELECT ord, text FROM texts WHERE translation = ? AND ord IN (${chunk.map(() => "?").join(",")})`,
      [translation, ...chunk],
    );
    for (const r of rows) out.set(r.ord, r.text);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Interlinear
// ---------------------------------------------------------------------------

export interface Token {
  readonly ord: number;
  readonly position: number;
  readonly surface: string;
  readonly translit: string;
  readonly gloss: string | null;
  readonly glossSource: string | null;
  readonly lemma: string;
  readonly strongs: string | null;
  readonly morph: string;
  readonly morphemes: BundleMorpheme[] | undefined;
  readonly variantMarked: boolean;
  readonly occurrenceKey: string;
}

interface TokenRow {
  ord: number;
  position: number;
  surface: string;
  translit: string;
  gloss: string | null;
  gloss_source: string | null;
  lemma: string;
  strongs: string | null;
  morph: string;
  morphemes: string | null;
  variant_marked: number;
  occurrence_key: string;
}

function toToken(r: TokenRow): Token {
  return {
    ord: r.ord,
    position: r.position,
    surface: r.surface,
    translit: r.translit,
    gloss: r.gloss,
    glossSource: r.gloss_source,
    lemma: r.lemma,
    strongs: r.strongs,
    morph: r.morph,
    morphemes: decodeMorphemes(r.morphemes),
    variantMarked: r.variant_marked !== 0,
    occurrenceKey: r.occurrence_key,
  };
}

export interface VerseTokens {
  /** A psalm's Hebrew title (verse 0), shown with verse 1 because English prints it there. */
  readonly title: Token[];
  readonly words: Token[];
}

export async function getTokens(db: Db, ord: number): Promise<VerseTokens> {
  const verse = ord % 1000;
  const lo = verse === 1 ? ord - 1 : ord;
  const rows = await db.getAllAsync<TokenRow>(
    "SELECT * FROM tokens WHERE ord BETWEEN ? AND ? ORDER BY ord, position",
    [lo, ord],
  );
  const tokens = rows.map(toToken);
  return { title: tokens.filter((t) => t.ord !== ord), words: tokens.filter((t) => t.ord === ord) };
}

export async function getToken(db: Db, ord: number, position: number): Promise<Token | null> {
  const row = await db.getFirstAsync<TokenRow>("SELECT * FROM tokens WHERE ord = ? AND position = ?", [ord, position]);
  return row === null ? null : toToken(row);
}

export interface Lexeme {
  readonly occurrenceKey: string;
  readonly script: Script;
  readonly lemma: string;
  readonly translit: string;
  readonly strongs: string | null;
  /** The commonest contextual gloss across every occurrence (pipeline package.ts). */
  readonly gloss: string | null;
  readonly total: number;
}

interface LexemeRow {
  occurrence_key: string;
  script: Script;
  lemma: string;
  translit: string;
  strongs: string | null;
  gloss: string | null;
  total: number;
}

const toLexeme = (r: LexemeRow): Lexeme => ({
  occurrenceKey: r.occurrence_key,
  script: r.script,
  lemma: r.lemma,
  translit: r.translit,
  strongs: r.strongs,
  gloss: r.gloss,
  total: r.total,
});

export async function getLexeme(db: Db, occurrenceKey: string): Promise<Lexeme | null> {
  const row = await db.getFirstAsync<LexemeRow>("SELECT * FROM lexemes WHERE occurrence_key = ?", [occurrenceKey]);
  return row === null ? null : toLexeme(row);
}

export async function countInBook(db: Db, book: BookCode, occurrenceKey: string): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT count FROM occurrences WHERE book = ? AND occurrence_key = ?",
    [book, occurrenceKey],
  );
  return row?.count ?? 0;
}

/** How often a lexeme occurs in each book, in canonical order (canvas S-04). */
export async function countsByBook(db: Db, occurrenceKey: string): Promise<Array<{ book: BookCode; count: number }>> {
  const rows = await db.getAllAsync<{ book: BookCode; count: number }>(
    "SELECT o.book, o.count FROM occurrences o JOIN books b ON b.code = o.book WHERE o.occurrence_key = ? ORDER BY b.ord",
    [occurrenceKey],
  );
  return rows;
}

/** In how many verses a lexeme occurs: "330 times in 318 verses". */
export async function countVerses(db: Db, occurrenceKey: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(DISTINCT ord) AS n FROM tokens WHERE occurrence_key = ?", [
    occurrenceKey,
  ]);
  return row?.n ?? 0;
}

export interface Occurrence {
  readonly ord: number;
  /** The forms of the word in this verse, in order. */
  readonly surfaces: string[];
}

/** Every verse where a lexeme occurs, in canonical order; within one book when given. */
export async function getOccurrences(db: Db, occurrenceKey: string, book: BookCode | null, limit = 600): Promise<Occurrence[]> {
  const [lo, hi] = book === null ? [0, Number.MAX_SAFE_INTEGER] : bookBounds(book);
  const rows = await db.getAllAsync<{ ord: number; surface: string }>(
    "SELECT ord, surface FROM tokens WHERE occurrence_key = ? AND ord BETWEEN ? AND ? ORDER BY ord, position",
    [occurrenceKey, lo, hi],
  );
  const byOrd = new Map<number, string[]>();
  for (const r of rows) {
    if (!byOrd.has(r.ord) && byOrd.size >= limit) break;
    const list = byOrd.get(r.ord) ?? [];
    list.push(r.surface);
    byOrd.set(r.ord, list);
  }
  return [...byOrd].map(([ord, surfaces]) => ({ ord, surfaces }));
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface PassageHit {
  readonly ord: number;
  /** Marked with SNIPPET_OPEN / SNIPPET_CLOSE around each hit. */
  readonly snippet: string;
}

/**
 * Full-text search in the reader's translation. `match` must come from
 * buildFtsQuery, which quotes every user term. Canonical order rather than
 * bm25 rank: a reader scanning results expects Genesis before Revelation, the
 * way a concordance lists them.
 */
export async function searchPassages(db: Db, match: string, translation: Translation, limit = 100): Promise<PassageHit[]> {
  return db.getAllAsync<PassageHit>(
    `SELECT t.ord AS ord,
            snippet(texts_fts, 0, '${SNIPPET_OPEN}', '${SNIPPET_CLOSE}', '…', 20) AS snippet
       FROM texts_fts
       JOIN texts t ON t.rowid = texts_fts.rowid
      WHERE texts_fts MATCH ? AND t.translation = ?
      ORDER BY t.ord
      LIMIT ?`,
    [match, translation, limit],
  );
}

export async function countPassages(db: Db, match: string, translation: Translation): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT count(*) AS n FROM texts_fts JOIN texts t ON t.rowid = texts_fts.rowid
      WHERE texts_fts MATCH ? AND t.translation = ?`,
    [match, translation],
  );
  return row?.n ?? 0;
}

/**
 * Greek or Hebrew input, already normalised with the schema's own functions
 * (the same ones the pipeline used to write word_forms). Exact forms first,
 * then forms that begin with what was typed.
 */
export async function searchWordsByForm(db: Db, key: string, limit = 30): Promise<Lexeme[]> {
  const rows = await db.getAllAsync<LexemeRow & { search_key: string }>(
    `SELECT l.*, w.search_key AS search_key
       FROM word_forms w JOIN lexemes l ON l.occurrence_key = w.occurrence_key
      WHERE w.search_key >= ? AND w.search_key < ?
      LIMIT 400`,
    [key, `${key}￿`],
  );
  const best = new Map<string, { row: LexemeRow; exact: boolean }>();
  for (const r of rows) {
    const exact = r.search_key === key;
    const seen = best.get(r.occurrence_key);
    if (seen === undefined || (exact && !seen.exact)) best.set(r.occurrence_key, { row: r, exact });
  }
  return [...best.values()]
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.row.total - a.row.total)
    .slice(0, limit)
    .map((x) => toLexeme(x.row));
}

/**
 * English input against lexeme glosses, by whole word with regular
 * inflections: "love" finds ἀγαπάω ("loving") and אָהַב, not "glove".
 * Ordered by how often the word occurs.
 */
export async function searchWordsByGloss(db: Db, word: string, limit = 30): Promise<Lexeme[]> {
  const rows = await db.getAllAsync<LexemeRow>(
    "SELECT * FROM lexemes WHERE lower(gloss) LIKE ? ESCAPE '\\' ORDER BY total DESC LIMIT 400",
    [`%${escapeLike(glossStem(word))}%`],
  );
  return rows
    .filter((r) => r.gloss !== null && glossMatches(r.gloss, word))
    .slice(0, limit)
    .map(toLexeme);
}

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

export interface SourceRow {
  readonly dataset: string;
  readonly source: string;
  readonly license: string;
  readonly attribution: string;
  readonly url: string;
  readonly encumbered: string | null;
}

export async function getSources(db: Db): Promise<SourceRow[]> {
  return db.getAllAsync<SourceRow>("SELECT * FROM sources ORDER BY source", []);
}

// ---------------------------------------------------------------------------
// Understand bundles
// ---------------------------------------------------------------------------

export async function getEntryRow(db: Db, verseId: string): Promise<EntryRow | null> {
  return db.getFirstAsync<EntryRow>("SELECT * FROM entries WHERE verse_id = ?", [verseId]);
}

export async function getEntriesInRange(db: Db, lo: number, hi: number): Promise<EntryRow[]> {
  return db.getAllAsync<EntryRow>("SELECT * FROM entries WHERE ord BETWEEN ? AND ? ORDER BY ord", [lo, hi]);
}

export async function getPericopes(db: Db): Promise<PericopeRow[]> {
  return db.getAllAsync<PericopeRow>("SELECT * FROM pericopes ORDER BY start_ord, end_ord", []);
}

/** Which verses in a chapter have an Understand entry, so the reader can mark nothing and still know. */
export async function entryOrdsInRange(db: Db, lo: number, hi: number): Promise<Set<number>> {
  const rows = await db.getAllAsync<{ ord: number }>("SELECT ord FROM entries WHERE ord BETWEEN ? AND ?", [lo, hi]);
  return new Set(rows.map((r) => r.ord));
}
