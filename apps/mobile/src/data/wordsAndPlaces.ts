/**
 * Build 6's tables in a book's Understand file (pipeline: understand/bundleExtras.ts): `word_links`
 * (MM-03) and `places` / `verse_places` (MS-01). A file built before them has none of the three; every
 * read here then returns nothing, and the screens show what they showed before.
 */

import type { BookCode } from "@yada/schema";

import { type PlaceRow, type Span, type WordLinks, parseLinks, parsePlaceSpans } from "../lib/wordsAndPlaces";
import { type Db } from "./queries";
import { openUnderstandDb } from "./understand";

const tablesOf = new WeakMap<Db, Promise<Set<string>>>();

async function tables(db: Db): Promise<Set<string>> {
  let t = tablesOf.get(db);
  if (t === undefined) {
    t = db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'", []).then((rows) => new Set(rows.map((r) => r.name)));
    tablesOf.set(db, t);
  }
  return t;
}

async function withTable<T>(book: BookCode, table: string, empty: T, read: (db: Db) => Promise<T>): Promise<T> {
  const db = await openUnderstandDb(book);
  if (db === null || !(await tables(db)).has(table)) return empty;
  return read(db);
}

export function loadWordLinks(book: BookCode, ord: number): Promise<WordLinks | null> {
  return withTable(book, "word_links", null, async (db) => {
    const row = await db.getFirstAsync<{ bsb: string; links: string }>("SELECT bsb, links FROM word_links WHERE ord = ?", [ord]);
    return row === null ? null : { bsb: row.bsb, links: parseLinks(row.links) };
  });
}

export interface VersePlace {
  readonly place: string;
  readonly spans: Span[];
}

export function loadVersePlaces(book: BookCode, ord: number): Promise<VersePlace[]> {
  return withTable(book, "verse_places", [], async (db) =>
    (await db.getAllAsync<{ place: string; spans: string }>("SELECT place, spans FROM verse_places WHERE ord = ?", [ord])).map((r) => ({ place: r.place, spans: parsePlaceSpans(r.spans) })),
  );
}

/** The places named in a passage, in the order they first appear. */
export function loadPlacesInRange(book: BookCode, lo: number, hi: number): Promise<PlaceRow[]> {
  return withTable(book, "places", [], (db) =>
    db.getAllAsync<PlaceRow>(
      `SELECT p.id, p.name, p.kind, p.modern, p.lon, p.lat, p.score FROM places p JOIN verse_places v ON v.place = p.id
       WHERE v.ord BETWEEN ? AND ? GROUP BY p.id ORDER BY min(v.ord)`,
      [lo, hi],
    ),
  );
}

export interface PlaceInBook {
  readonly place: PlaceRow;
  /** The book's verses that name it, in order. */
  readonly ords: number[];
}

export function loadPlace(book: BookCode, id: string): Promise<PlaceInBook | null> {
  return withTable(book, "places", null, async (db) => {
    const place = await db.getFirstAsync<PlaceRow>("SELECT id, name, kind, modern, lon, lat, score FROM places WHERE id = ?", [id]);
    if (place === null) return null;
    const ords = (await db.getAllAsync<{ ord: number }>("SELECT ord FROM verse_places WHERE place = ? ORDER BY ord", [id])).map((r) => r.ord);
    return { place, ords };
  });
}
