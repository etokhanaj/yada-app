/**
 * `yada generate --dry-run <BOOK>` — build and price the requests, submit nothing.
 *
 * PRD §11.10 sets a £1-2k ceiling and the build plan says Milestone 0 produces
 * the real per-verse number and nothing scales before it exists. This stage
 * turns that number from an estimate in a document into a measurement, and
 * stops one step short of spending anything.
 *
 * Request granularity is the pericope, not the verse (build plan §3): one
 * request carries the chapter context once and emits the pericope entry plus
 * all of its verse entries. Per-verse requests would ship each chapter's
 * context once per verse and bust the ceiling on their own.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parseVerseRef } from "@yada/schema";

import { openStaging } from "./db.js";
import { deriveVerse, scriptFor } from "./derive.js";
import { PIPELINE_DATA, PROMPTS, REQUESTS } from "./paths.js";

/**
 * Published rates, US dollars per million tokens, from the Claude API model
 * table cached 2026-06-24. Verify before quoting: rates move.
 *
 * Sonnet 5 ran an introductory $2/$10 through 2026-08-31 and is now at its
 * standard rate. Anything priced before that date at the intro rate understates
 * Sonnet by a third.
 */
export const MODEL_RATES = {
  "claude-opus-5": { input: 5.0, output: 25.0, note: "" },
  "claude-sonnet-5": {
    input: 3.0,
    output: 15.0,
    note: "standard rate; the $2/$10 introductory price ended 2026-08-31",
  },
  "claude-haiku-4-5": { input: 1.0, output: 5.0, note: "200K context, not 1M" },
} as const;

/** Message Batches API: 50% off input and output. */
export const BATCH_DISCOUNT = 0.5;

export interface Pericope {
  id: string;
  label: string;
}

export function loadPericopes(book: string): Pericope[] {
  const file = path.join(PIPELINE_DATA, `${book.toLowerCase()}-pericopes.json`);
  const data = JSON.parse(readFileSync(file, "utf8")) as { pericopes: Pericope[] };
  return data.pericopes;
}

interface ChapterVerse {
  verse_id: string;
  chapter: number;
  verse: number;
}

function chapterVerses(book: string, chapter: number): ChapterVerse[] {
  const db = openStaging();
  const rows = db
    .prepare("SELECT verse_id, chapter, verse FROM verses WHERE book = ? AND chapter = ? ORDER BY verse")
    .all(book, chapter);
  db.close();
  return rows.map((r) => ({
    verse_id: String(r["verse_id"]),
    chapter: Number(r["chapter"]),
    verse: Number(r["verse"]),
  }));
}

export interface BuiltRequest {
  custom_id: string;
  pericope_id: string;
  label: string;
  verses: string[];
  /** The full prompt text that would be sent. */
  body: string;
  characters: number;
}

/** Build the request body for one pericope: prompt + chapter context + tokens. */
export function buildRequest(book: string, pericope: Pericope): BuiltRequest | null {
  const range = parseVerseRef(pericope.id);
  if (range === null) return null;

  const promptPath = path.join(PROMPTS, "verse-pericope.v1.md");
  const prompt = readFileSync(promptPath, "utf8");
  const script = scriptFor(book);

  // Chapter context is carried once per request — the whole point of pericope
  // granularity. A pericope spanning a chapter boundary carries both.
  const chapters = new Set<number>([range.start.chapter, range.end.chapter]);
  const contextLines: string[] = [];
  const inScope: string[] = [];

  for (const chapter of [...chapters].sort((a, b) => a - b)) {
    for (const verse of chapterVerses(book, chapter)) {
      const position = verse.chapter * 1000 + verse.verse;
      const start = range.start.chapter * 1000 + range.start.verse;
      const end = range.end.chapter * 1000 + range.end.verse;
      const words = deriveVerse(verse.verse_id);
      if (words.length === 0) continue;

      const line = words
        .map((w) => `${w.surface}|${w.morph}|${w.strongs ?? "-"}`)
        .join(" ");
      contextLines.push(`${verse.verse_id}\t${line}`);
      if (position >= start && position <= end) inScope.push(verse.verse_id);
    }
  }

  const body = [
    prompt,
    "",
    `## Pericope`,
    `${pericope.id} — ${pericope.label}`,
    `Script: ${script}`,
    `Verses to emit entries for: ${inScope.join(", ")}`,
    "",
    `## Aligned original with morphology (surface|morph|strongs)`,
    ...contextLines,
    "",
  ].join("\n");

  return {
    custom_id: pericope.id,
    pericope_id: pericope.id,
    label: pericope.label,
    verses: inScope,
    body,
    characters: body.length,
  };
}

export interface CostLine {
  model: string;
  inputUsd: number;
  outputUsd: number;
  totalUsd: number;
  note: string;
}

/**
 * Price a run. Output tokens are an assumption, not a measurement — nothing has
 * been generated yet — so the figure is stated as an assumption rather than
 * buried in the arithmetic.
 */
export function priceRun(inputTokens: number, outputTokens: number): CostLine[] {
  return Object.entries(MODEL_RATES).map(([model, rate]) => {
    const inputUsd = (inputTokens / 1_000_000) * rate.input * BATCH_DISCOUNT;
    const outputUsd = (outputTokens / 1_000_000) * rate.output * BATCH_DISCOUNT;
    return {
      model,
      inputUsd,
      outputUsd,
      totalUsd: inputUsd + outputUsd,
      note: rate.note,
    };
  });
}

const USD_PER_GBP = 1.27;

export function dryRun(book: string): void {
  const pericopes = loadPericopes(book);
  const requests: BuiltRequest[] = [];

  for (const pericope of pericopes) {
    const request = buildRequest(book, pericope);
    if (request === null) {
      console.log(`  SKIP ${pericope.id} (does not parse)`);
      continue;
    }
    if (request.verses.length === 0) {
      console.log(`  SKIP ${pericope.id} (no tokens in staging.db)`);
      continue;
    }
    requests.push(request);
    writeFileSync(
      path.join(REQUESTS, `${pericope.id}.json`),
      `${JSON.stringify({ custom_id: request.custom_id, body: request.body }, null, 2)}\n`,
    );
  }

  const totalChars = requests.reduce((sum, r) => sum + r.characters, 0);
  const totalVerses = requests.reduce((sum, r) => sum + r.verses.length, 0);

  console.log(`\ngenerate --dry-run ${book}: NOTHING WAS SUBMITTED\n`);
  console.log(`  requests built:  ${requests.length} (one per pericope)`);
  console.log(`  verses covered:  ${totalVerses}`);
  console.log(`  characters:      ${totalChars.toLocaleString()}`);
  console.log(`  written to:      content/requests/`);

  console.log(`\n  TOKEN COUNT NOT MEASURED.`);
  console.log(`  The only accurate count for Claude is POST /v1/messages/count_tokens,`);
  console.log(`  which needs credentials. tiktoken is OpenAI's tokeniser and undercounts`);
  console.log(`  Claude by ~15-20% on English and considerably more on Greek and Hebrew,`);
  console.log(`  so an offline estimate here would be wrong in the direction that matters.`);
  console.log(`  Run count_tokens on content/requests/ before trusting any figure below.`);

  // A deliberately crude placeholder so the arithmetic is visible and its
  // assumption is impossible to miss. Replace with a measured count.
  const ASSUMED_CHARS_PER_TOKEN = 3.0;
  const ASSUMED_OUTPUT_TOKENS_PER_VERSE = 1500;
  const inputTokens = Math.round(totalChars / ASSUMED_CHARS_PER_TOKEN);
  const outputTokens = totalVerses * ASSUMED_OUTPUT_TOKENS_PER_VERSE;

  console.log(`\n  Illustrative only, on two stated assumptions:`);
  console.log(`    ${ASSUMED_CHARS_PER_TOKEN} characters per token (UNVERIFIED)`);
  console.log(`    ${ASSUMED_OUTPUT_TOKENS_PER_VERSE} output tokens per verse entry (UNVERIFIED)`);
  console.log(`    -> ~${inputTokens.toLocaleString()} input, ~${outputTokens.toLocaleString()} output\n`);

  console.log(`  Model                 input$    output$     total$     total£`);
  for (const line of priceRun(inputTokens, outputTokens)) {
    const gbp = line.totalUsd / USD_PER_GBP;
    console.log(
      `  ${line.model.padEnd(20)} ${line.inputUsd.toFixed(2).padStart(8)} ` +
        `${line.outputUsd.toFixed(2).padStart(10)} ${line.totalUsd.toFixed(2).padStart(10)} ` +
        `${gbp.toFixed(2).padStart(10)}${line.note === "" ? "" : `   (${line.note})`}`,
    );
  }
  console.log(`\n  Batch discount applied: ${BATCH_DISCOUNT * 100}% off input and output.`);
  console.log(`  Adversarial pass roughly doubles input and adds smaller output.`);
}
