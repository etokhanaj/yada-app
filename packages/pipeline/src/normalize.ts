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
import { loadTexts, type TextReport } from "./english.js";
import { attachGlosses, type GlossCoverage } from "./glosses.js";
import {
  parseMorphGntWithCoverage,
  parseOshb,
  type GreekLexiconCoverage,
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

function loadTokens(): {
  tokens: Token[];
  versification: VersificationReport;
  lexicon: GreekLexiconCoverage;
} {
  const tokens: Token[] = [];
  const versification: VersificationReport = { titles: 0, renumbered: 0, crossChapter: [] };
  const lexicon: GreekLexiconCoverage = { routes: new Map(), unmatched: new Set() };
  for (const def of SOURCES) {
    for (const file of def.files) {
      const full = path.join(RAW, file.file);
      if (!existsSync(full)) continue;
      if (def.key === "morphgnt") {
        const parsed = parseMorphGntWithCoverage(file.file);
        tokens.push(...parsed.tokens);
        for (const [route, count] of parsed.coverage.routes) {
          lexicon.routes.set(route, (lexicon.routes.get(route) ?? 0) + count);
        }
        for (const lemma of parsed.coverage.unmatched) lexicon.unmatched.add(lemma);
      }
      if (def.key === "oshb") {
        const parsed = parseOshb(file.file);
        tokens.push(...parsed.tokens);
        versification.titles += parsed.report.titles;
        versification.renumbered += parsed.report.renumbered;
        versification.crossChapter.push(...parsed.report.crossChapter);
      }
    }
  }
  return { tokens, versification, lexicon };
}

export interface NormalizeReport {
  tokens: number;
  verses: number;
  books: string[];
  titledChapters: number;
  unresolved: string[];
  versification: VersificationReport;
  lexicon: GreekLexiconCoverage;
  glosses: GlossCoverage;
  texts: TextReport;
  /** English verses with no interlinear, and interlinear verses with no English. */
  textOnly: number;
  originalOnly: string[];
}

/** Keys that occur more than once, each reported once per repeat. */
export function duplicateKeys<T>(items: readonly T[], keyOf: (item: T) => string): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
  }
  return duplicates;
}

export function normalize(): NormalizeReport {
  const db = openStaging();
  const { tokens, versification, lexicon } = loadTokens();

  // Refuse duplicate keys rather than let INSERT OR REPLACE resolve them: a
  // replaced row is a lost word, and nothing downstream could notice.
  const duplicates = duplicateKeys(tokens, (token) => `${token.verse_id}#${token.position}`);
  if (duplicates.length > 0) {
    throw new Error(
      `${duplicates.length} duplicate token keys would overwrite words, e.g. ${duplicates.slice(0, 5).join(", ")}`,
    );
  }
  const glosses = attachGlosses(tokens);
  const { texts, report: textReport } = loadTexts();
  // The same rule for texts: a second line for one verse would replace the
  // first, and half a verse would ship as if it were the whole.
  const duplicateTexts = duplicateKeys(texts, (text) => `${text.translation} ${text.verse_id}`);
  if (duplicateTexts.length > 0) {
    throw new Error(
      `${duplicateTexts.length} duplicate verse texts would overwrite each other, e.g. ${duplicateTexts.slice(0, 5).join(", ")}`,
    );
  }
  const titles = parseTvtmsTitles();
  const unresolved: string[] = [];

  db.exec("BEGIN");
  db.exec("DELETE FROM tokens; DELETE FROM verses; DELETE FROM texts;");

  const insertVerse = db.prepare(
    "INSERT OR REPLACE INTO verses (verse_id, book, chapter, verse, source_scheme, has_title) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertToken = db.prepare(
    `INSERT OR REPLACE INTO tokens
     (verse_id, position, surface, raw_surface, lemma, strongs, morph, morphemes, variant_marked, gloss, gloss_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertText = db.prepare(
    "INSERT OR REPLACE INTO texts (translation, verse_id, text) VALUES (?, ?, ?)",
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
      token.gloss ?? null,
      token.gloss_source ?? null,
    );
  }

  const englishVerses = new Set<string>();
  for (const text of texts) {
    insertText.run(text.translation, text.verse_id, text.text);
    if (text.translation === "BSB") englishVerses.add(text.verse_id);
  }
  db.exec("COMMIT");

  const textOnly = [...englishVerses].filter((id) => !seenVerses.has(id)).length;
  const originalOnly = [...seenVerses].filter((id) => !englishVerses.has(id) && !id.endsWith(".0"));

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
    lexicon,
    glosses,
    texts: textReport,
    textOnly,
    originalOnly,
  };
}
