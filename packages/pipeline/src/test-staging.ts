/**
 * Temp staging databases for tests. Not a test file itself (vitest only
 * collects *.test.ts), so it is typechecked with the rest of src.
 *
 * content/ is gitignored and absent in CI, so a test that needs source data
 * either builds the few rows it needs here or skips — and a skipped test proves
 * nothing about a gate. Every stage built on a database handle is therefore
 * tested against one of these.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import { parseVerseId, type VerseEntry } from "@yada/schema";

import { openDatabase } from "./db.js";
import { GOLDEN } from "./paths.js";

export interface TempStaging {
  db: DatabaseSync;
  dir: string;
  cleanup: () => void;
}

export function tempStaging(prefix = "yada-staging-"): TempStaging {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  const db = openDatabase(path.join(dir, "staging.db"));
  return {
    db,
    dir,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export interface SeedWord {
  surface: string;
  lemma: string;
  strongs?: string;
  morph?: string;
  morphemes?: Array<{ surface: string; role: "prefix" | "stem" | "suffix"; strongs?: string }>;
}

/** One verse: its verses row, its tokens, and a BSB text so refs resolve. */
export function seedVerse(db: DatabaseSync, verseId: string, words: readonly SeedWord[], text = "text"): void {
  const ref = parseVerseId(verseId);
  if (ref === null) throw new Error(`bad verse id ${verseId}`);
  db.prepare(
    "INSERT OR REPLACE INTO verses (verse_id, book, chapter, verse, source_scheme, has_title) VALUES (?, ?, ?, ?, 'english', 0)",
  ).run(verseId, ref.book, ref.chapter, ref.verse);
  db.prepare("INSERT OR REPLACE INTO texts (translation, verse_id, text) VALUES ('BSB', ?, ?)").run(verseId, text);
  words.forEach((word, index) => {
    db.prepare(
      `INSERT OR REPLACE INTO tokens (verse_id, position, surface, raw_surface, lemma, strongs, morph, morphemes, variant_marked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ).run(
      verseId,
      index + 1,
      word.surface,
      word.surface,
      word.lemma,
      word.strongs ?? null,
      word.morph ?? "X",
      word.morphemes === undefined ? null : JSON.stringify(word.morphemes),
    );
  });
}

export function loadGolden(name: string): VerseEntry {
  return JSON.parse(readFileSync(path.join(GOLDEN, `${name}.json`), "utf8")) as VerseEntry;
}

/**
 * Staging rows that make golden/1co.14.34.json valid against the 0C contract:
 * the verse's own tokens with the lemmas its lexical evidence cites, ἀνήρ in
 * v. 35 for the "wives" position, and a text row for every verse it cites.
 */
export function seed1Co1434(db: DatabaseSync): VerseEntry {
  const entry = loadGolden("1co.14.34");
  const lemmas: Record<string, string> = { σιγάτωσαν: "σιγάω", γυναῖκες: "γυνή" };
  seedVerse(
    db,
    entry.verse_id,
    entry.gloss.map((word) => ({
      surface: word.surface,
      lemma: lemmas[word.surface] ?? word.surface,
      ...(word.strongs === undefined ? {} : { strongs: word.strongs }),
    })),
  );
  seedVerse(db, "1CO.14.35", [{ surface: "ἄνδρας", lemma: "ἀνήρ", strongs: "G0435" }]);
  for (let verse = 26; verse <= 40; verse += 1) {
    if (verse === 34 || verse === 35) continue;
    seedVerse(db, `1CO.14.${verse}`, [{ surface: "καὶ", lemma: "καί", strongs: "G2532" }]);
  }
  seedVerse(db, "1CO.11.5", [{ surface: "γυνὴ", lemma: "γυνή", strongs: "G1135" }]);
  seedVerse(db, "1TI.2.11", [{ surface: "γυνὴ", lemma: "γυνή", strongs: "G1135" }]);
  seedVerse(db, "1TI.2.12", [{ surface: "γυναικὶ", lemma: "γυνή", strongs: "G1135" }]);
  return entry;
}
