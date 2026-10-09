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

/** One flat evidence object as GENERATION_SCHEMA makes the model write it: every key, "" when absent. */
function flatEvidence(fields: Record<string, unknown>): Record<string, unknown> {
  return { type: "verse", ref: "", lemma: "", strongs: "", dataset: "", analysis_tradition: "", witnesses: [], note: "", ...fields };
}

/**
 * Model output for 1 Cor 14:26-40 in the composed shape GENERATION_SCHEMA asks
 * for: no ids beyond verse_id, no versions, no gloss, no review.
 */
export function composed1Co14() {
  return {
    pericope: {
      summary_one_sentence: "Paul orders the assembly's worship so that it builds the church up.",
      key_ideas: ["Order in worship"],
      discussion_questions: [],
      movement: [
        { range: "14.26-14.33", label: "Order in worship" },
        { range: "1CO.14.34-14.35", label: "Speaking in the assembly" },
      ],
      claims: [],
      related_passages: [{ ref: "1CO.11.5", relationship: "", note: "" }],
      no_significant_dispute: false,
    },
    verses: [
      {
        verse_id: "1CO.14.34",
        close_rendering: "Let the women be silent in the churches.",
        whats_happening: "Paul turns from prophecy to who speaks in the assembly.",
        key_words: [{ surface: "σιγάτωσαν", lemma: "σιγάω", gloss: "let them be silent", note: "", strongs: "G4601" }],
        translation_note: "",
        claims: [
          {
            id: "1CO.14.34.c1",
            claim: "The verb σιγάτωσαν is a present imperative.",
            category: "text",
            evidence_strength: "strong",
            confidence: "high",
            grounding: "source_data",
            evidence: [flatEvidence({ type: "lexical", ref: "1CO.14.34", lemma: "σιγάω", strongs: "G4601", dataset: "MorphGNT" })],
            positions: [],
            display_rank: 1,
          },
          {
            id: "1CO.14.34.c2",
            claim: "Whether verses 34-35 are original to the letter is disputed.",
            category: "debated",
            evidence_strength: "disputed",
            confidence: "medium",
            grounding: "source_data",
            evidence: [flatEvidence({ type: "apparatus", ref: "1CO.14.34-35", witnesses: ["D", "F", "G"], dataset: "SBLGNT" })],
            positions: [
              { label: "Original", case: "Every manuscript contains the verses.", evidence: [flatEvidence({ ref: "1CO.14.33" })] },
              { label: "Interpolation", case: "Western witnesses move them after verse 40.", evidence: [flatEvidence({ ref: "1CO.14.40" })] },
            ],
            display_rank: 1,
          },
          {
            // No `evidence` key at all: Opus omitted it on claims citing nothing.
            id: "1CO.14.34.c3",
            claim: "Corinthian worship gatherings met in households.",
            category: "context",
            evidence_strength: "supported",
            confidence: "medium",
            grounding: "model_knowledge",
            positions: [],
            display_rank: 2,
          },
        ],
        related_passages: [],
        no_significant_dispute: false,
      },
    ],
  };
}
