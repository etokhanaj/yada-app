/**
 * The build-6 tables an Understand bundle gains (MM-03 word links, MS-01 places), written by one call
 * from packageUnderstandBook so they stay apart from the verse and passage layers.
 *
 * Old apps read only meta 'format' and 'book' to accept a file, then `verses` and `passages`: new tables
 * are ignored by them, so UNDERSTAND_FORMAT stays 1.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import { BOOK_ORDER } from "@yada/schema";

import { sha256File } from "../package.js";
import { understandPaths, type UnderstandPaths } from "./package.js";
import { OPENBIBLE_CREDIT, PLACES_DDL, checkOpenBibleLicence, openBiblePlaces, versePlaces, type OpenBiblePlaces, type PlaceSkip } from "./places.js";
import { parsePins, readIfExists } from "./sources.js";
import { WORD_LINKS_DDL, encodeLinks } from "./wordLinks.js";
import { bookWordLinks, bsbVerses, coreTableIndex, openCore } from "./wordLinksReport.js";

const PINS = "maps-15oct.sha256";

export const OPENBIBLE_FILES = ["openbible/license.txt", "openbible/readme.md", "openbible/data/ancient.jsonl", "openbible/data/modern.jsonl"] as const;

let placesCache: { raw: string; data: OpenBiblePlaces; notice: string; pin: string | null } | null = null;

/** OpenBible's places, with its licence read and every file checked against content/raw/maps-15oct.sha256. */
export function loadOpenBible(paths: UnderstandPaths, verifyPins = true): { data: OpenBiblePlaces; notice: string; pin: string | null } {
  if (placesCache?.raw === paths.raw) return placesCache;
  const pins = parsePins(readIfExists(path.join(paths.raw, PINS)) ?? "");
  if (verifyPins) {
    for (const f of OPENBIBLE_FILES) {
      const file = path.join(paths.raw, f);
      if (!existsSync(file) || sha256File(file) !== pins.get(f)) throw new Error(`${f} does not match its pin in ${PINS}`);
    }
  }
  const read = (f: string) => readFileSync(path.join(paths.raw, f), "utf8");
  const notice = checkOpenBibleLicence(read("openbible/license.txt"), read("openbible/readme.md"));
  const data = openBiblePlaces(read("openbible/data/ancient.jsonl"), read("openbible/data/modern.jsonl"));
  placesCache = { raw: paths.raw, data, notice, pin: pins.get("openbible/bgd-7eb18a5.tar.gz") ?? null };
  return placesCache;
}

export interface ExtrasReport {
  links: ReturnType<typeof bookWordLinks>["counts"];
  places: number;
  versesWithPlaces: number;
  namesMarked: number;
}

/** Creates and fills word_links, places and verse_places, and credits OpenBible in `sources`. */
export function writeBundleExtras(db: DatabaseSync, book: string, options: { paths?: UnderstandPaths; verifyPins?: boolean } = {}): ExtrasReport {
  const paths = options.paths ?? understandPaths();
  db.exec(WORD_LINKS_DDL);
  db.exec(PLACES_DDL);
  const core = openCore(paths);
  try {
    const { verses, counts } = bookWordLinks(book, core, coreTableIndex(core, paths, book));
    const link = db.prepare("INSERT INTO word_links (ord, bsb, links) VALUES (?, ?, ?)");
    for (const [ord, v] of verses) if (v.result.links.length > 0) link.run(ord, v.bsb, encodeLinks(v.result.links));

    const { data, notice, pin } = loadOpenBible(paths, options.verifyPins ?? true);
    const ordOf = new Map(
      core.prepare("SELECT ord, chapter, verse FROM verses WHERE book = ?").all(book).map((r) => [`${Number(r["chapter"])}:${Number(r["verse"])}`, Number(r["ord"])]),
    );
    const bsb = new Map(bsbVerses(core, book).map((r) => [r.ord, r.text]));
    const index = versePlaces(data.places, book, (c, v) => ordOf.get(`${c}:${v}`) ?? null, (o) => bsb.get(o) ?? "");
    const used = new Set([...index.values()].flatMap((l) => l.map((p) => p.place)));
    const place = db.prepare("INSERT INTO places (id, name, kind, modern, lon, lat, score) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const p of data.places) if (used.has(p.id)) place.run(p.id, p.name, p.kind, p.modern, p.lon, p.lat, p.score);
    const vp = db.prepare("INSERT INTO verse_places (ord, place, spans) VALUES (?, ?, ?)");
    let namesMarked = 0;
    for (const [ord, list] of [...index].sort((a, b) => a[0] - b[0])) {
      for (const p of list) {
        vp.run(ord, p.place, JSON.stringify(p.spans));
        if (p.spans.length > 0) namesMarked++;
      }
    }
    db.prepare("INSERT INTO sources (key, name, license, license_notice, credit, original, sha256) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      "openbible",
      "OpenBible.info Bible Geocoding Data",
      "CC-BY-4.0",
      notice,
      OPENBIBLE_CREDIT,
      "The original data is available from https://github.com/openbibleinfo/Bible-Geocoding-Data",
      pin,
    );
    return { links: counts, places: used.size, versesWithPlaces: index.size, namesMarked };
  } finally {
    core.close();
  }
}

/** `yada places [BOOK ...]`: the MS-01 dry run. What would be written, and every place left out and why. */
export function placesCommand(books: readonly string[]): number {
  const paths = understandPaths();
  const { data } = loadOpenBible(paths);
  const core = openCore(paths);
  console.log(`OpenBible.info: ${data.places.length} places kept (score ${500}+, one point, CC BY coordinates).`);
  for (const [why, n] of Object.entries(data.skipped) as Array<[PlaceSkip, number]>) console.log(`  left out, ${why}: ${n}`);
  let verses = 0;
  let listed = 0;
  let marked = 0;
  for (const book of books.length > 0 ? books.map((b) => b.toUpperCase()) : BOOK_ORDER) {
    const ordOf = new Map(core.prepare("SELECT ord, chapter, verse FROM verses WHERE book = ?").all(book).map((r) => [`${Number(r["chapter"])}:${Number(r["verse"])}`, Number(r["ord"])]));
    const bsb = new Map(bsbVerses(core, book).map((r) => [r.ord, r.text]));
    const index = versePlaces(data.places, book, (c, v) => ordOf.get(`${c}:${v}`) ?? null, (o) => bsb.get(o) ?? "");
    const rows = [...index.values()].flat();
    verses += index.size;
    listed += rows.length;
    marked += rows.filter((r) => r.spans.length > 0).length;
  }
  core.close();
  console.log(`verses with a place: ${verses}; place mentions: ${listed}, of which the BSB names ${marked} where a tap can find it (${listed - marked} listed only). Dry run: nothing written.`);
  return 0;
}
