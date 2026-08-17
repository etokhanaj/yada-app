/**
 * `yada normalize` — raw sources into staging.db, versification resolved once.
 *
 * The build plan calls versification a known swamp and says to wade through it
 * here, exactly once. TVTMS supplies the mappings; this stage records which
 * chapters carry a superscription so the derive stage can place it at
 * TITLE_VERSE rather than losing it, which is what the genre gate found.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { CANONICAL_VERSIFICATION, parseVerseId } from "@yada/schema";

import { openStaging } from "./db.js";
import {
  parseMorphGnt,
  parseOshb,
  type Token,
  type VersificationReport,
} from "./parsers.js";
import { RAW } from "./paths.js";
import { SOURCES } from "./sources.js";

/**
 * Chapters whose verse 1 is preceded by canonical text, from TVTMS.
 *
 * TVTMS is a multi-section working document rather than a clean table, so this
 * reads the one thing currently needed — rows where the English tradition names
 * a Title against a numbered verse elsewhere — instead of pretending to parse
 * the whole mapping matrix. Extend it when the OT batch needs the rest.
 */
export function parseTvtmsTitles(): Set<string> {
  const file = path.join(RAW, "TVTMS.txt");
  const titles = new Set<string>();
  if (!existsSync(file)) return titles;

  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.includes(":Title")) continue;
    for (const match of line.matchAll(/\b([1-3]?[A-Za-z]{2,4})\.(\d{1,3}):Title/g)) {
      const book = match[1] ?? "";
      const chapter = match[2] ?? "";
      if (book.toLowerCase().startsWith("psa") || book.toLowerCase() === "ps") {
        titles.add(`PSA.${Number(chapter)}`);
      }
    }
  }
  return titles;
}

function loadTokens(): { tokens: Token[]; versification: VersificationReport } {
  const tokens: Token[] = [];
  const versification: VersificationReport = { titles: 0, renumbered: 0, crossChapter: [] };
  for (const def of SOURCES) {
    for (const file of def.files) {
      const full = path.join(RAW, file.file);
      if (!existsSync(full)) continue;
      if (def.key === "morphgnt") tokens.push(...parseMorphGnt(file.file));
      if (def.key === "oshb") {
        const parsed = parseOshb(file.file);
        tokens.push(...parsed.tokens);
        versification.titles += parsed.report.titles;
        versification.renumbered += parsed.report.renumbered;
        versification.crossChapter.push(...parsed.report.crossChapter);
      }
    }
  }
  return { tokens, versification };
}

export interface NormalizeReport {
  tokens: number;
  verses: number;
  books: string[];
  titledChapters: number;
  unresolved: string[];
  versification: VersificationReport;
}

export function normalize(): NormalizeReport {
  const db = openStaging();
  const { tokens, versification } = loadTokens();
  const titles = parseTvtmsTitles();
  const unresolved: string[] = [];

  db.exec("BEGIN");
  db.exec("DELETE FROM tokens; DELETE FROM verses;");

  const insertVerse = db.prepare(
    "INSERT OR REPLACE INTO verses (verse_id, book, chapter, verse, source_scheme, has_title) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertToken = db.prepare(
    `INSERT OR REPLACE INTO tokens
     (verse_id, position, surface, raw_surface, lemma, strongs, morph, morphemes, variant_marked)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const seenVerses = new Set<string>();
  for (const token of tokens) {
    const ref = parseVerseId(token.verse_id);
    if (ref === null) {
      unresolved.push(token.verse_id);
      continue;
    }
    if (!seenVerses.has(token.verse_id)) {
      seenVerses.add(token.verse_id);
      const hasTitle = titles.has(`${ref.book}.${ref.chapter}`) ? 1 : 0;
      insertVerse.run(
        token.verse_id,
        ref.book,
        ref.chapter,
        ref.verse,
        CANONICAL_VERSIFICATION,
        hasTitle,
      );
    }
    insertToken.run(
      token.verse_id,
      token.position,
      token.surface,
      token.raw_surface,
      token.lemma,
      token.strongs ?? null,
      token.morph,
      token.morphemes === undefined ? null : JSON.stringify(token.morphemes),
      token.variant_marked ? 1 : 0,
    );
  }
  db.exec("COMMIT");

  const books = db
    .prepare("SELECT DISTINCT book FROM verses ORDER BY book")
    .all()
    .map((r) => String(r["book"]));

  db.close();
  return {
    tokens: tokens.length,
    verses: seenVerses.size,
    books,
    titledChapters: titles.size,
    unresolved: [...new Set(unresolved)],
    versification: { ...versification, crossChapter: [...new Set(versification.crossChapter)] },
  };
}
