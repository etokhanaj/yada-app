/**
 * `yada word-links [BOOK ...]`: the MM-03 dry run. Joins the Berean tables to core's tokens for every
 * book (or those named) and prints what would be linked and what is skipped (rule 4), writing nothing.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { BOOK_ORDER } from "@yada/schema";

import { highestVersionOnDisk } from "../package.js";
import { understandPaths, type UnderstandPaths } from "./package.js";
import { bookCodeByName, normaliseBookName, type PublicDomainText } from "./sources.js";
import { addCounts, emptyCounts, fileLines, linkVerse, tableIndex, tableVerses, type CoreToken, type LinkCounts, type TableVerse, type VerseLinks } from "./wordLinks.js";

export interface BookWordLinks {
  /** ord -> the verse's BSB text and its links. */
  verses: Map<number, { bsb: string; result: VerseLinks }>;
  counts: LinkCounts;
}

/**
 * The tables' verses. With `keep`, only those verses are parsed and nothing is cached (a book's build);
 * without, every verse, read once per process (the all-books dry run).
 */
let tablesCache: { file: string; verses: TableVerse[] } | null = null;

export function readTableVerses(paths: UnderstandPaths, keep?: (ref: string) => boolean): TableVerse[] {
  const file = path.join(paths.raw, "bsb-tables/bsb_tables.tsv");
  if (keep === undefined && tablesCache?.file === file) return tablesCache.verses;
  if (!existsSync(file)) throw new Error("bsb-tables/bsb_tables.tsv is missing");
  if (keep !== undefined) return tableVerses(fileLines(file), keep);
  tablesCache = { file, verses: tableVerses(fileLines(file)) };
  return tablesCache.verses;
}

/** One book's links, from core (tokens and the BSB, as stored) and the tables. */
export function bookWordLinks(book: string, core: DatabaseSync, tables: Map<string, TableVerse>): BookWordLinks {
  const verses = new Map<number, { bsb: string; result: VerseLinks }>();
  const counts = emptyCounts();
  const tokens = new Map<number, CoreToken[]>();
  for (const r of core.prepare("SELECT t.ord, t.position, t.surface, t.strongs FROM tokens t JOIN verses v ON v.ord = t.ord WHERE v.book = ? ORDER BY t.ord, t.position").all(book)) {
    const list = tokens.get(Number(r["ord"])) ?? [];
    if (list.length === 0) tokens.set(Number(r["ord"]), list);
    list.push({ position: Number(r["position"]), surface: String(r["surface"]), strongs: r["strongs"] == null ? null : String(r["strongs"]) });
  }
  for (const r of bsbVerses(core, book)) {
    const list = tokens.get(r.ord);
    if (list === undefined) continue;
    const { ord, text: bsb } = r;
    const result = linkVerse(list, bsb, tables.get(`${book} ${r.chapter}:${r.verse}`));
    addCounts(counts, result);
    verses.set(ord, { bsb, result });
  }
  return { verses, counts };
}

/**
 * A book's BSB verses from core, the only text build 6 reads. Queried by name in the form every
 * Understand read takes (rule 9; ai-boundary.test.ts): a public-domain translation, never another.
 */
export function bsbVerses(core: DatabaseSync, book: string): Array<{ ord: number; chapter: number; verse: number; text: string }> {
  const names: readonly PublicDomainText[] = ["BSB"];
  const placeholders = names.map(() => "?").join(", ");
  return core
    .prepare(`SELECT t.ord, v.chapter, v.verse, t.text FROM texts t JOIN verses v ON v.ord = t.ord WHERE v.book = ? AND t.translation IN (${placeholders}) ORDER BY t.ord`)
    .all(book, ...names)
    .map((r) => ({ ord: Number(r["ord"]), chapter: Number(r["chapter"]), verse: Number(r["verse"]), text: String(r["text"]) }));
}

export function openCore(paths: UnderstandPaths): DatabaseSync {
  const v = highestVersionOnDisk("core", paths.bundles);
  if (v === 0) throw new Error("core bundle is missing");
  return new DatabaseSync(path.join(paths.bundles, `core.v${v}.db`), { readOnly: true });
}

/** The tables' verses keyed "JHN 1:1"; with `book`, that book's only. */
export function coreTableIndex(core: DatabaseSync, paths: UnderstandPaths, book?: string): Map<string, TableVerse> {
  const names = new Map(core.prepare("SELECT code, name FROM books").all().map((r) => [String(r["code"]), String(r["name"])]));
  const byName = bookCodeByName(names);
  const keep = book === undefined ? undefined : (ref: string) => byName.get(normaliseBookName(/^(.*) \d+:\d+$/.exec(ref)?.[1] ?? "")) === book;
  return tableIndex(readTableVerses(paths, keep), byName, normaliseBookName);
}

const pct = (n: number, d: number): string => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`;

export function wordLinksCommand(books: readonly string[]): number {
  const paths = understandPaths();
  const core = openCore(paths);
  const tables = coreTableIndex(core, paths);
  const wanted = books.length > 0 ? books.map((b) => b.toUpperCase()) : [...BOOK_ORDER];
  const total = emptyCounts();
  console.log("book  tokens   linked          no English  folded  supplied  skipped         verses  with a skip");
  for (const book of wanted) {
    const { counts } = bookWordLinks(book, core, tables);
    if (counts.tokens === 0) continue;
    for (const k of Object.keys(total) as Array<keyof LinkCounts>) total[k] += counts[k];
    console.log(
      `${book.padEnd(5)} ${String(counts.tokens).padStart(6)}  ${String(counts.linked).padStart(6)} ${pct(counts.linked, counts.tokens).padStart(6)}  ${String(counts.none).padStart(10)}  ${String(counts.folded).padStart(6)}  ${String(counts.supplied).padStart(8)}  ${String(counts.skipped).padStart(6)} ${pct(counts.skipped, counts.tokens).padStart(6)}  ${String(counts.verses).padStart(6)}  ${String(counts.versesWithSkip).padStart(6)} ${pct(counts.versesWithSkip, counts.verses).padStart(6)}`,
    );
  }
  core.close();
  console.log(
    `\nall   ${total.tokens} tokens: ${total.linked} linked (${pct(total.linked, total.tokens)}), ${total.none} no English ("-"), ${total.folded} folded (". . ."), ${total.supplied} supplied only, ${total.skipped} skipped (${pct(total.skipped, total.tokens)}); ${total.versesWithSkip} of ${total.verses} verses have a skip (${pct(total.versesWithSkip, total.verses)}). Dry run: nothing written.`,
  );
  return 0;
}
