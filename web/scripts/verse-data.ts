/**
 * Pulls every scripture fact the website shows out of the shipping bundles, through the
 * app's own decoders, so the page states nothing the data does not contain (CLAUDE.md
 * rule 4). Output: web/data/site-data.json, which the HTML is written from.
 *
 *   pnpm exec tsx web/scripts/verse-data.ts [path/to/content/bundles]
 *
 * Bundle files come from content/bundles/manifest.json (the release set).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { displayGloss } from "../../apps/mobile/src/lib/glosses";
import { morphLine } from "../../packages/schema/src/morph";

const root = process.argv[2] ?? join(import.meta.dirname, "../../content/bundles");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as {
  bundles: { name: string; file: string; review_gate: string }[];
};
const fileOf = (name: string): string => {
  const bundle = manifest.bundles.find((b) => b.name === name);
  if (bundle === undefined) throw new Error(`manifest has no ${name} bundle`);
  if (bundle.review_gate !== "reviewed") throw new Error(`${name} bundle is ${bundle.review_gate}`);
  // The bundles moved up a level on 13 Oct (content/bundles/<file>); read either layout.
  const flat = join(root, bundle.file);
  return existsSync(flat) ? flat : join(root, "bundles", bundle.file);
};

const core = new DatabaseSync(fileOf("core"), { readOnly: true });

interface TokenRow {
  position: number;
  surface: string;
  translit: string;
  gloss: string | null;
  gloss_source: string | null;
  morph: string;
  morphemes: string | null;
  strongs: string | null;
  occurrence_key: string;
  lemma: string;
  lemma_translit: string;
  usually: string | null;
  total: number;
  book: string;
}

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function words(verseId: string) {
  const rows = core
    .prepare(
      `SELECT t.position, t.surface, t.translit, t.gloss, t.gloss_source, t.morph, t.morphemes, t.strongs, t.occurrence_key,
              l.lemma, l.translit AS lemma_translit, l.gloss AS usually, l.total, v.book
         FROM tokens t JOIN verses v ON v.ord = t.ord JOIN lexemes l ON l.occurrence_key = t.occurrence_key
        WHERE v.verse_id = ? ORDER BY t.position`,
    )
    .all(verseId) as unknown as TokenRow[];
  if (rows.length === 0) throw new Error(`no tokens for ${verseId}`);
  return rows.map((r) => {
    const inBook = core
      .prepare("SELECT count FROM occurrences WHERE book = ? AND occurrence_key = ?")
      .get(r.book, r.occurrence_key) as { count: number };
    return {
      surface: r.surface,
      translit: r.translit,
      gloss: r.gloss === null ? null : displayGloss(r.gloss),
      form: capitalise(morphLine(r.morph)),
      lemma: r.lemma,
      usually: r.usually === null ? null : displayGloss(r.usually),
      inBook: inBook.count,
      total: r.total,
    };
  });
}

function texts(verseId: string): Record<string, string> {
  const rows = core
    .prepare("SELECT x.translation, x.text FROM texts x JOIN verses v ON v.ord = x.ord WHERE v.verse_id = ?")
    .all(verseId) as unknown as { translation: string; text: string }[];
  return Object.fromEntries(rows.map((r) => [r.translation, r.text]));
}



/**
 * "Readers differ" for one verse, read from its understand bundle exactly as the app shows it:
 * each reading is the source's own wording (unfoldingWord's Translation Notes), never reworded
 * (memory: debates verbatim).
 */
function readersDiffer(book: string, verseId: string) {
  const db = new DatabaseSync(join(root, `understand-${book}.v1.db`), { readOnly: true });
  const row = db.prepare("SELECT layers FROM verses WHERE verse_id = ?").get(verseId) as { layers: string } | undefined;
  db.close();
  if (row === undefined) throw new Error(`no understand layers for ${verseId}`);
  const layers = JSON.parse(row.layers) as {
    beginner: { readers_differ: { about: string; options: string[]; credit: string }[] };
  };
  return layers.beginner.readers_differ.map((r) => ({ about: r.about, options: r.options, credit: r.credit }));
}


/** John 1:1's plain words, verbatim from understand-jhn.v1.db (credited in the footer). */
function plainWords() {
  const db = new DatabaseSync(join(root, "understand-jhn.v1.db"), { readOnly: true });
  const row = db.prepare("SELECT layers FROM verses WHERE verse_id = ?").get("JHN.1.1") as { layers: string } | undefined;
  db.close();
  if (row === undefined) throw new Error("no understand layers for JHN.1.1");
  return { plain: (JSON.parse(row.layers) as { beginner: { plain: { text: string } } }).beginner.plain.text };
}

const data = {
  source: { core: fileOf("core").split("/").pop() },
  john: { verseId: "JHN.1.1", words: words("JHN.1.1"), texts: texts("JHN.1.1") },
  hero: { john: texts("JHN.1.1").BSB, ...plainWords() },
  differ: { verseId: "1CO.14.34", bsb: texts("1CO.14.34").BSB, readings: readersDiffer("1co", "1CO.14.34") },
};

core.close();
const out = join(import.meta.dirname, "../data/site-data.json");
writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`);
console.log(`wrote ${out}`);
