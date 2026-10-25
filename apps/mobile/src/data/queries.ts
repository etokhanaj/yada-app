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
  BOOK_ORDER,
  type BookCode,
  decodeMorphemes,
  type BundleMorpheme,
  parseVerseId,
  verseOrd,
} from "@yada/schema";

import { originalLanguage, type OriginalLanguage } from "../lib/originalLanguage";
import { allowedEdits, nearestWord } from "../lib/search";
import { excerptAroundHit, glossMatches, glossStem, escapeLike, SNIPPET_CLOSE, SNIPPET_OPEN } from "../lib/searchQuery";

type Bind = string | number | null;

export interface Db {
  getAllAsync<T>(source: string, params: Bind[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: Bind[]): Promise<T | null>;
}

/** The versions the core bundle carries, in On your iPhone order. */
export type Translation = "BSB" | "WEB" | "KJV" | "LSV";
export const BUILT_IN: readonly Translation[] = ["BSB", "WEB", "KJV", "LSV"];

export function isTranslation(value: unknown): value is Translation {
  return value === "BSB" || value === "WEB" || value === "KJV" || value === "LSV";
}

/** Any version the reader can read: built in, or downloaded and attached ("YLT"). */
export type TranslationCode = string;

export type Script = "greek" | "hebrew";

// ---------------------------------------------------------------------------
// Downloaded translations
// ---------------------------------------------------------------------------

/**
 * Downloaded versions live in their own files, ATTACHed to the core
 * connection under a schema name (data/translations.ts), in the pipeline's
 * format (TRANSLATION_DDL in @yada/schema): one translation per file, so
 * `texts` is keyed by `ord` alone and the code is `meta.code`. Reads route by
 * code, so the reader, Compare and Search treat an installed version like a
 * built-in one (plan, App 2). Removing one stops routing to it at once; the
 * file itself is detached and deleted only at the next launch
 * (data/bundles.ts rule 1).
 */
const attached = new Map<TranslationCode, string>();

const SCHEMA = /^tr_[a-z0-9]+_v\d+$/;

export function routeTranslation(code: TranslationCode, schema: string): void {
  if (!SCHEMA.test(schema)) throw new Error(`Not a translation schema: ${schema}`);
  attached.set(code, schema);
}

export function unrouteTranslation(code: TranslationCode): void {
  attached.delete(code);
}

export function isDownloaded(code: TranslationCode): boolean {
  return attached.has(code);
}

/** What the manifest promised about a file, checked against the file itself at download. */
export interface TranslationExpectation {
  readonly verses: number;
  readonly missing: readonly string[];
}

/**
 * An attached file's `meta` and verse count, read before it is routed: a file
 * whose code does not match, whose verse count is not the one its own `meta`
 * (and, at download, the manifest) states, or which prints a verse the
 * manifest lists as `missing`, is never offered for reading. "Not in ASV" is
 * shown on the strength of `missing`, so the file must agree with it.
 */
export async function checkTranslationFile(
  db: Db,
  schema: string,
  code: TranslationCode,
  expected?: TranslationExpectation,
): Promise<{ ok: boolean; meta: Record<string, string>; verses: number }> {
  if (!SCHEMA.test(schema)) return { ok: false, meta: {}, verses: 0 };
  const rows = await db.getAllAsync<{ key: string; value: string }>(`SELECT key, value FROM ${schema}.meta`, []);
  const meta = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  // Every row, empty ones included: `meta.verses` counts what the source file numbers, and the
  // ASV and MSB number a few verses they leave blank (as BSB leaves Romans 16:24).
  const count = await db.getFirstAsync<{ n: number }>(`SELECT count(*) AS n FROM ${schema}.texts`, []);
  const verses = count?.n ?? 0;
  let ok = meta["code"] === code && verses > 0 && String(verses) === meta["verses"];
  if (ok && expected !== undefined) {
    const ords = expected.missing.flatMap((id) => {
      const ref = parseVerseId(id);
      return ref === null ? [] : [verseOrd(ref.book, ref.chapter, ref.verse)];
    });
    const printed =
      ords.length === 0
        ? 0
        : ((await db.getFirstAsync<{ n: number }>(`SELECT count(*) AS n FROM ${schema}.texts WHERE ord IN (${ords.map(() => "?").join(",")})`, ords))?.n ?? 0);
    ok = verses === expected.verses && printed === 0;
  }
  return { ok, meta, verses };
}

/** Built-in and routed versions: what reads can be asked for. */
export function readableTranslations(): TranslationCode[] {
  return [...BUILT_IN, ...attached.keys()];
}

/**
 * Where one version's rows are, as `alias`: core's shared `texts`, filtered by
 * code, or an attached file's own, which holds nothing else.
 */
function textsOf(translation: TranslationCode, alias: string): { schema: string; filter: string; params: Bind[] } {
  const schema = attached.get(translation);
  return schema === undefined
    ? { schema: "", filter: `${alias}.translation = ?`, params: [translation] }
    : { schema: `${schema}.`, filter: "1", params: [] };
}

/** Every texts table, core first, as one statement; an attached file's code is bound, not read from a column it lacks. */
function allTexts(where: string, params: Bind[]): { sql: string; params: Bind[] } {
  const parts = [
    { sql: `SELECT ord, translation, text FROM texts WHERE ${where}`, params },
    ...[...attached].map(([code, schema]) => ({ sql: `SELECT ord, ? AS translation, text FROM ${schema}.texts WHERE ${where}`, params: [code, ...params] })),
  ];
  return { sql: parts.map((p) => p.sql).join(" UNION ALL "), params: parts.flatMap((p) => p.params) };
}

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
  /** Last verse of a bridged row ("1–2"), set only by licensed text; bundled verses are never bridged. */
  readonly through?: number;
  readonly text: string;
}

/**
 * One chapter in one translation. Verse 0 never appears here (a psalm title is
 * Hebrew-only; English prints it inside verse 1), and empty rows are skipped:
 * BSB carries an empty Romans 16:24 rather than no row.
 */
export async function getChapter(db: Db, book: BookCode, chapter: number, translation: TranslationCode): Promise<VerseText[]> {
  const [lo, hi] = chapterBounds(book, chapter);
  const t = textsOf(translation, "t");
  const rows = await db.getAllAsync<{ ord: number; text: string }>(
    `SELECT ord, text FROM ${t.schema}texts t WHERE ${t.filter} AND ord BETWEEN ? AND ? AND text <> '' ORDER BY ord`,
    [...t.params, lo, hi],
  );
  return rows.map((r) => ({ ord: r.ord, verse: r.ord % 1000, text: r.text }));
}

/** One verse in every readable version, keyed by code. */
export type VerseTexts = Partial<Record<TranslationCode, string>>;

export async function getTexts(db: Db, ord: number): Promise<VerseTexts> {
  const q = allTexts("ord = ? AND text <> ''", [ord]);
  const rows = await db.getAllAsync<{ translation: TranslationCode; text: string }>(q.sql, q.params);
  return Object.fromEntries(rows.map((r) => [r.translation, r.text]));
}

export async function getTextsInRange(db: Db, lo: number, hi: number): Promise<Array<{ ord: number; texts: VerseTexts }>> {
  const q = allTexts("ord BETWEEN ? AND ? AND text <> ''", [lo, hi]);
  const rows = await db.getAllAsync<{ ord: number; translation: TranslationCode; text: string }>(`${q.sql} ORDER BY ord`, q.params);
  const byOrd = new Map<number, VerseTexts>();
  for (const r of rows) {
    const texts = byOrd.get(r.ord) ?? {};
    texts[r.translation] = r.text;
    byOrd.set(r.ord, texts);
  }
  return [...byOrd].map(([ord, texts]) => ({ ord, texts }));
}

export async function getTextsForOrds(db: Db, ords: readonly number[], translation: TranslationCode): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  // SQLite's default variable limit is generous, but chunking keeps one
  // pathological lexeme (καί occurs ~9,000 times) from ever hitting it.
  const t = textsOf(translation, "t");
  for (let i = 0; i < ords.length; i += 400) {
    const chunk = ords.slice(i, i + 400);
    const rows = await db.getAllAsync<{ ord: number; text: string }>(
      `SELECT ord, text FROM ${t.schema}texts t WHERE ${t.filter} AND ord IN (${chunk.map(() => "?").join(",")})`,
      [...t.params, ...chunk],
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

/** The language letters ("H", "A") of the tokens in ords lo..hi, for originalLanguage(). */
export async function getLanguageLetters(db: Db, lo: number, hi: number): Promise<string[]> {
  const rows = await db.getAllAsync<{ l: string }>("SELECT DISTINCT substr(morph, 1, 1) AS l FROM tokens WHERE ord BETWEEN ? AND ?", [lo, hi]);
  return rows.map((r) => r.l);
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
  /** From its occurrences' morphology: a few lexemes occur in both Hebrew and Aramaic. */
  readonly language: OriginalLanguage;
}

interface LexemeRow {
  occurrence_key: string;
  script: Script;
  lemma: string;
  translit: string;
  strongs: string | null;
  gloss: string | null;
  total: number;
  letters?: string | null;
}

/** The lexeme's language letters, read from its tokens through tokens_by_occurrence. */
const LETTERS = "(SELECT group_concat(DISTINCT substr(t.morph, 1, 1)) FROM tokens t WHERE t.occurrence_key = l.occurrence_key) AS letters";

/** Letters for the lexemes kept, only after the cut: a common word has thousands of tokens. */
async function withLetters(db: Db, rows: readonly LexemeRow[]): Promise<Lexeme[]> {
  if (rows.length === 0) return [];
  const found = await db.getAllAsync<{ occurrence_key: string; letters: string }>(
    `SELECT occurrence_key, group_concat(DISTINCT substr(morph, 1, 1)) AS letters FROM tokens
      WHERE occurrence_key IN (${rows.map(() => "?").join(", ")}) GROUP BY occurrence_key`,
    rows.map((r) => r.occurrence_key),
  );
  const letters = new Map(found.map((f) => [f.occurrence_key, f.letters]));
  return rows.map((r) => toLexeme({ ...r, letters: letters.get(r.occurrence_key) ?? null }));
}

const toLexeme = (r: LexemeRow): Lexeme => ({
  occurrenceKey: r.occurrence_key,
  script: r.script,
  lemma: r.lemma,
  translit: r.translit,
  strongs: r.strongs,
  gloss: r.gloss,
  total: r.total,
  language: originalLanguage(r.script, (r.letters ?? "").split(",")),
});

export async function getLexeme(db: Db, occurrenceKey: string): Promise<Lexeme | null> {
  const row = await db.getFirstAsync<LexemeRow>(`SELECT l.*, ${LETTERS} FROM lexemes l WHERE l.occurrence_key = ?`, [occurrenceKey]);
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
export async function searchPassages(
  db: Db,
  match: string,
  translation: TranslationCode,
  limit = 100,
  within: readonly [number, number] | null = null,
): Promise<PassageHit[]> {
  const t = textsOf(translation, "t");
  // SE-31: a book's chip lists that book's verses alone, so a book past the first hundred is still reached.
  const range = within === null ? "" : " AND t.ord BETWEEN ? AND ?";
  // An FTS5 table is matched through its hidden column, named after the table:
  // `f.texts_fts` works for core and an attached schema alike. A downloaded
  // file's index keys on `ord` (its rowid), so `t.rowid = f.rowid` holds there too.
  // highlight(), not snippet(): snippet() could end its window on the hit,
  // which the result row's two-line cap then cut off (ASV "proselyte" showed
  // Acts 6:5 without the word). SQLite still marks the hits, so the tokenizer
  // and diacritic folding are FTS5's own; excerptAroundHit only picks the window.
  const rows = await db.getAllAsync<{ ord: number; marked: string }>(
    `SELECT t.ord AS ord,
            highlight(f.texts_fts, 0, '${SNIPPET_OPEN}', '${SNIPPET_CLOSE}') AS marked
       FROM ${t.schema}texts_fts f
       JOIN ${t.schema}texts t ON t.rowid = f.rowid
      WHERE f.texts_fts MATCH ? AND ${t.filter}${range}
      ORDER BY t.ord
      LIMIT ?`,
    [match, ...t.params, ...(within ?? []), limit],
  );
  return rows.map((r) => ({ ord: r.ord, snippet: excerptAroundHit(r.marked) }));
}

export async function countPassages(db: Db, match: string, translation: TranslationCode): Promise<number> {
  const t = textsOf(translation, "t");
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT count(*) AS n FROM ${t.schema}texts_fts f JOIN ${t.schema}texts t ON t.rowid = f.rowid
      WHERE f.texts_fts MATCH ? AND ${t.filter}`,
    [match, ...t.params],
  );
  return row?.n ?? 0;
}

/**
 * SE-31: the books the matching verses fall in, in Bible order, each with its true count, from the same match as
 * searchPassages and countPassages, so the chips add up to the total above them.
 */
export async function countPassagesByBook(db: Db, match: string, translation: TranslationCode): Promise<Array<{ book: BookCode; count: number }>> {
  const t = textsOf(translation, "t");
  const rows = await db.getAllAsync<{ b: number; n: number }>(
    `SELECT t.ord / 1000000 AS b, count(*) AS n FROM ${t.schema}texts_fts f JOIN ${t.schema}texts t ON t.rowid = f.rowid
      WHERE f.texts_fts MATCH ? AND ${t.filter}
      GROUP BY b ORDER BY b`,
    [match, ...t.params],
  );
  return rows.flatMap((r) => {
    const book = BOOK_ORDER[r.b - 1];
    return book === undefined ? [] : [{ book, count: r.n }];
  });
}

/**
 * SE-32: the word in core's full-text index nearest `word` (lib/search.ts nearestWord), so "Did you mean" only ever
 * offers a word the Bible's text holds. fts5vocab reads the index's own terms; the table lives in `temp`, so a
 * read-only core is never written. Only words of a near length are read: an edit changes the length by one at most.
 */
export async function nearestTerm(db: Db, word: string): Promise<string | null> {
  const typed = word.trim().toLowerCase();
  if (typed.length < 3) return null;
  await db.getAllAsync("CREATE VIRTUAL TABLE IF NOT EXISTS temp.texts_vocab USING fts5vocab(main, texts_fts, row)", []);
  const spread = allowedEdits(typed);
  const rows = await db.getAllAsync<{ term: string; cnt: number }>(
    "SELECT term, cnt FROM temp.texts_vocab WHERE length(term) BETWEEN ? AND ?",
    [typed.length - spread, typed.length + spread],
  );
  return nearestWord(word, rows.map((r) => ({ term: r.term, count: r.cnt })));
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
  const picked = [...best.values()]
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.row.total - a.row.total)
    .slice(0, limit)
    .map((x) => x.row);
  return withLetters(db, picked);
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
  return withLetters(
    db,
    rows.filter((r) => r.gloss !== null && glossMatches(r.gloss, word)).slice(0, limit),
  );
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

/**
 * Each routed download as a sources row, read from its own `meta`: the
 * licence and attribution travel inside the file (rule 3), written there by
 * `yada package translation` from the pipeline's source entry.
 */
export async function getTranslationSources(db: Db): Promise<Array<SourceRow & { translation: { code: string; name: string } }>> {
  const out: Array<SourceRow & { translation: { code: string; name: string } }> = [];
  for (const [code, schema] of attached) {
    const rows = await db.getAllAsync<{ key: string; value: string }>(`SELECT key, value FROM ${schema}.meta`, []);
    const meta = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const name = meta["name"] ?? code;
    out.push({
      // Never shown for a download (its row is titled by name and code); unique, and distinct from core's datasets.
      dataset: `translation:${code}`,
      source: name,
      license: meta["license"] ?? "",
      attribution: meta["attribution"] ?? "",
      url: meta["source"] ?? "",
      encumbered: null,
      translation: { code, name },
    });
  }
  return out;
}

