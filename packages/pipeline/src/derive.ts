/**
 * `yada derive <book>` — mechanical gloss derivation. No AI touches this stage.
 *
 * The seven hand-authored fixtures in golden/ are the oracle. What must match
 * exactly is the mechanical part: surfaces, Strong's numbers with their
 * homograph letters, and morpheme decomposition. Glosses and transliterations
 * are reported as agreement rates rather than asserted, because both are
 * conventions rather than facts — a lexicon gloss and a hand-written English
 * gloss will differ legitimately.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import { BOOK_CODES, isBookCode, type BookCode, type VerseEntry } from "@yada/schema";

import { openStaging } from "./db.js";
import type { TokenMorpheme } from "./parsers.js";
import { GOLDEN } from "./paths.js";
import { transliterate } from "./translit.js";

export interface DerivedWord {
  surface: string;
  translit: string;
  gloss?: string;
  strongs?: string;
  morph: string;
  morphemes?: TokenMorpheme[];
  variant_marked: boolean;
}

/**
 * From the book's testament. This was a hard-coded set of the four Hebrew books
 * ingested for the genre gate, which stopped being true when all 39 were: every
 * other OT book was transliterated as Greek, and generation requests for Exodus
 * would have told the model the script was Greek.
 */
export function scriptFor(book: string): "greek" | "hebrew" {
  return isBookCode(book) && BOOK_CODES[book].testament === "OT" ? "hebrew" : "greek";
}

export function deriveVerse(verseId: string): DerivedWord[] {
  const db = openStaging();
  try {
    return deriveVerseFrom(db, verseId);
  } finally {
    db.close();
  }
}

/** The same derivation against an already-open database (see openDatabase). */
export function deriveVerseFrom(db: DatabaseSync, verseId: string): DerivedWord[] {
  const rows = db
    .prepare("SELECT * FROM tokens WHERE verse_id = ? ORDER BY position")
    .all(verseId);

  const book = verseId.split(".")[0] ?? "";
  const script = scriptFor(book);

  return rows.map((row) => {
    const surface = String(row["surface"]);
    const morphemesJson = row["morphemes"];
    const morphemes =
      morphemesJson === null || morphemesJson === undefined
        ? undefined
        : (JSON.parse(String(morphemesJson)) as TokenMorpheme[]);
    const strongs = row["strongs"] === null ? undefined : String(row["strongs"]);
    return {
      surface,
      translit: transliterate(surface, script),
      ...(strongs === undefined ? {} : { strongs }),
      morph: String(row["morph"]),
      ...(morphemes === undefined ? {} : { morphemes }),
      variant_marked: Number(row["variant_marked"]) === 1,
    };
  });
}

export interface CoverageReport {
  book: BookCode | string;
  verses: number;
  tokens: number;
  withStrongs: number;
  withMorphemes: number;
  variantMarked: number;
}

export function coverage(book: string): CoverageReport {
  const db = openStaging();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS tokens,
              COUNT(DISTINCT verse_id) AS verses,
              SUM(CASE WHEN strongs IS NOT NULL THEN 1 ELSE 0 END) AS with_strongs,
              SUM(CASE WHEN morphemes IS NOT NULL THEN 1 ELSE 0 END) AS with_morphemes,
              SUM(variant_marked) AS variant_marked
       FROM tokens WHERE verse_id LIKE ?`,
    )
    .get(`${book}.%`);
  db.close();
  return {
    book,
    verses: Number(row?.["verses"] ?? 0),
    tokens: Number(row?.["tokens"] ?? 0),
    withStrongs: Number(row?.["with_strongs"] ?? 0),
    withMorphemes: Number(row?.["with_morphemes"] ?? 0),
    variantMarked: Number(row?.["variant_marked"] ?? 0),
  };
}

// ---------------------------------------------------------------------------
// The oracle
// ---------------------------------------------------------------------------

export interface OracleResult {
  fixture: string;
  verse_id: string;
  derivedWords: number;
  fixtureWords: number;
  surfaceMismatches: string[];
  strongsMismatches: string[];
  morphemeMismatches: string[];
  translitAgreement: number;
  ok: boolean;
}

function loadFixture(name: string): VerseEntry {
  return JSON.parse(readFileSync(path.join(GOLDEN, `${name}.json`), "utf8")) as VerseEntry;
}

/** Compare derived output against a hand-authored fixture. */
export function checkAgainstFixture(name: string): OracleResult {
  const fixture = loadFixture(name);
  const comparison = compareGloss(deriveVerse(fixture.verse_id), fixture.gloss);
  return { fixture: name, verse_id: fixture.verse_id, ...comparison };
}

/** The shape of a gloss word the comparison needs; WordGloss satisfies it. */
export interface ComparableWord {
  surface: string;
  translit: string;
  strongs?: string | undefined;
  morphemes?: ReadonlyArray<{ role: string }> | undefined;
}

export type GlossComparison = Omit<OracleResult, "fixture" | "verse_id">;

/**
 * The oracle's comparison, separated from fixture loading so that `yada
 * validate` holds every generated entry's `gloss[]` to the same bar as the
 * golden corpus. One implementation matters here: the Greek fixtures carried
 * Strong's numbers from recall precisely because nothing mechanical compared
 * them, and a second, looser comparison would reopen that gap for generated
 * entries.
 */
export function compareGloss(derived: readonly ComparableWord[], expected: readonly ComparableWord[]): GlossComparison {
  const surfaceMismatches: string[] = [];
  const strongsMismatches: string[] = [];
  const morphemeMismatches: string[] = [];
  let translitMatches = 0;

  const compared = Math.min(derived.length, expected.length);
  for (let i = 0; i < compared; i += 1) {
    const a = derived[i]!;
    const b = expected[i]!;
    if (a.surface.normalize("NFC") !== b.surface.normalize("NFC")) {
      surfaceMismatches.push(`#${i + 1} derived ${a.surface} != fixture ${b.surface}`);
    }
    if ((a.strongs ?? "") !== (b.strongs ?? "")) {
      strongsMismatches.push(`#${i + 1} derived ${a.strongs ?? "-"} != fixture ${b.strongs ?? "-"}`);
    }
    const derivedRoles = (a.morphemes ?? []).map((m) => m.role).join("+");
    const fixtureRoles = (b.morphemes ?? []).map((m) => m.role).join("+");
    if (derivedRoles !== fixtureRoles) {
      morphemeMismatches.push(`#${i + 1} derived [${derivedRoles}] != fixture [${fixtureRoles}]`);
    }
    if (a.translit === b.translit) translitMatches += 1;
  }

  return {
    derivedWords: derived.length,
    fixtureWords: expected.length,
    surfaceMismatches,
    strongsMismatches,
    morphemeMismatches,
    translitAgreement: compared === 0 ? 0 : translitMatches / compared,
    ok:
      derived.length === expected.length &&
      surfaceMismatches.length === 0 &&
      strongsMismatches.length === 0 &&
      morphemeMismatches.length === 0,
  };
}

export const ORACLE_FIXTURES = [
  "jhn.1.1",
  "1co.14.34",
  "rev.13.18",
  "gen.1.1",
  "lev.19.18",
  "isa.53.5",
  "psa.23.1",
] as const;
