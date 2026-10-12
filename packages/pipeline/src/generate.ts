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
import { GENERATION_SCHEMA } from "./assemble.js";
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

// ---------------------------------------------------------------------------
// Long pericopes: request chunks
// ---------------------------------------------------------------------------

/** The models' output limit per response. A response that reaches it is truncated and refused at ingest. */
export const OUTPUT_TOKEN_CAP = 128_000;

/**
 * The worst per-verse output measured: Opus on GEN.1.1-1.5 under prompt 1.1,
 * 33,483 output tokens over 5 verses (docs/cost-model.md, "What was measured").
 * The other five measurements are lower: Sonnet Ps 23 6,254, Sonnet Gen 1
 * 6,242, Opus Ps 23 4,742, Sonnet 1 Cor 3,824, Opus 1 Cor 3,221; the pooled
 * rates are Opus 4,259 and Sonnet 4,902.
 *
 * The split was planned on 3,824 (Sonnet, 1 Cor) until the code review of
 * 10 Oct 2026, which showed 33 verses at Sonnet's pooled 4,902 is ~162k, past
 * the cap: the chunk is paid for, truncated, and refused at ingest. A rate from
 * the cheapest pericope is not a bound; the worst one is the nearest thing to
 * one the sample has. It is measured on 5 verses, so it carries a whole
 * pericope entry and a thinking floor in a small denominator, which makes it
 * high for longer chunks, the safe direction.
 */
export const WORST_MEASURED_OUTPUT_PER_VERSE = 6_697;

/**
 * Head-room over the worst measurement. Run-to-run variance is not small:
 * Ps 23 regenerated moved Opus +12% and Sonnet +56% (docs/cost-model.md), and
 * the sample has one draw per pericope. 20% covers the Opus spread with room;
 * it does not cover a +56% Sonnet swing on top of the worst Opus figure.
 */
export const PLANNING_MARGIN = 1.2;

/** Output tokens to plan for per verse: the worst measured figure with the margin. */
export const PLANNING_OUTPUT_PER_VERSE = Math.ceil(WORST_MEASURED_OUTPUT_PER_VERSE * PLANNING_MARGIN);

/** A pericope with more verses than this is split into several requests. */
export const MAX_VERSES_PER_REQUEST = Math.floor(OUTPUT_TOKEN_CAP / PLANNING_OUTPUT_PER_VERSE);

/**
 * Split a pericope's verses into request chunks, deterministically.
 *
 * milestone-0.md says only "split long pericopes"; the choices it leaves open
 * are made the simplest way that keeps every entry faithful:
 *
 *   - Fewest chunks, as equal as possible, earlier chunks one verse longer when
 *     the count does not divide. 31 verses become 11 + 10 + 10, not
 *     15 + 15 + 1: the split exists to keep each response clear of the cap,
 *     and an even split leaves the most head-room in every chunk.
 *   - Contiguous and in verse order, by count alone. Splitting at a movement
 *     or paragraph boundary would need a judgment the pipeline has no source
 *     for (the pericope boundaries themselves are editorial, see data/).
 *   - Every chunk carries the same context as the whole pericope would, so a
 *     verse is explained against the passage, not against its chunk.
 *   - The pericope keeps one id and one pericope entry; verse entries keep the
 *     pericope's id. Only the request is split, never the corpus.
 *
 * A pericope at or under the limit is one chunk, and its request is byte for
 * byte what it was before splitting existed.
 */
export function chunkVerses<T>(verses: readonly T[], max: number = MAX_VERSES_PER_REQUEST): T[][] {
  if (max < 1) throw new Error(`chunk size must be at least 1, got ${max}`);
  if (verses.length <= max) return [verses.slice()];
  const parts = Math.ceil(verses.length / max);
  const size = Math.floor(verses.length / parts);
  const longer = verses.length % parts;
  const chunks: T[][] = [];
  let at = 0;
  for (let part = 0; part < parts; part += 1) {
    const length = size + (part < longer ? 1 : 0);
    chunks.push(verses.slice(at, at + length));
    at += length;
  }
  return chunks;
}

/** `JHN.4.1-4.42` part 2 of 2 -> `JHN.4.1-4.42.part2of2`; an unsplit pericope keeps its id. */
export function partId(pericopeId: string, part: number, parts: number): string {
  return parts === 1 ? pericopeId : `${pericopeId}.part${part}of${parts}`;
}

export interface BuiltRequest {
  custom_id: string;
  pericope_id: string;
  label: string;
  /** The verses this request asks entries for: the whole pericope, or one chunk of it. */
  verses: string[];
  /** 1-based. */
  part: number;
  parts: number;
  /** The full prompt text that would be sent. */
  body: string;
  characters: number;
}

/** Every request a pericope needs: one, or one per chunk when it is too long for one response. */
export function buildRequests(book: string, pericope: Pericope): BuiltRequest[] {
  const first = buildRequest(book, pericope, 1);
  if (first === null) return [];
  const rest: BuiltRequest[] = [];
  for (let part = 2; part <= first.parts; part += 1) {
    const request = buildRequest(book, pericope, part);
    if (request !== null) rest.push(request);
  }
  return [first, ...rest];
}

/**
 * Build the request body for one pericope, or for one part of a long one:
 * prompt + chapter context + tokens.
 */
export function buildRequest(book: string, pericope: Pericope, part = 1): BuiltRequest | null {
  const range = parseVerseRef(pericope.id);
  if (range === null) return null;

  const promptPath = path.join(PROMPTS, "verse-pericope.v1.md");
  const prompt = readFileSync(promptPath, "utf8");
  const script = scriptFor(book);

  // Chapter context is carried once per request — the whole point of pericope
  // granularity. A pericope spanning chapters carries every chapter it touches:
  // this was the two end chapters only, which would have dropped a middle
  // chapter's verses from the request altogether once pericopes grew long
  // enough to span three.
  const chapters: number[] = [];
  for (let chapter = range.start.chapter; chapter <= range.end.chapter; chapter += 1) chapters.push(chapter);
  const contextLines: string[] = [];
  const inScope: string[] = [];

  for (const chapter of chapters) {
    for (const verse of chapterVerses(book, chapter)) {
      const position = verse.chapter * 1000 + verse.verse;
      const start = range.start.chapter * 1000 + range.start.verse;
      const end = range.end.chapter * 1000 + range.end.verse;
      const words = deriveVerse(verse.verse_id);
      if (words.length === 0) continue;

      const line = words
        .map((w) => `${w.surface}|${w.morph}|${w.strongs ?? "-"}|${w.gloss ?? "-"}`)
        .join(" ");
      contextLines.push(`${verse.verse_id}\t${line}`);
      if (position >= start && position <= end) inScope.push(verse.verse_id);
    }
  }

  const chunks = chunkVerses(inScope);
  const parts = chunks.length;
  if (part < 1 || part > parts) {
    throw new Error(`${pericope.id} has ${parts} request part(s); part ${part} does not exist`);
  }
  const verses = chunks[part - 1] ?? [];
  // Said in the request rather than the prompt file, so an unsplit request is
  // unchanged. Later parts leave the pericope object empty: part 1 writes it,
  // and paying for a second summary that ingest would discard buys nothing.
  const partLines =
    parts === 1
      ? []
      : [
          `Request part ${part} of ${parts}: this pericope is longer than one response can hold, so its verses are split across ${parts} requests. Emit verse entries only for the verses listed above.`,
          part === 1
            ? "Write the pericope object for the whole passage."
            : "Part 1 writes the pericope object. In this part give every pericope field an empty value (\"\", [] or false).",
        ];

  const body = [
    prompt,
    "",
    "## Output format",
    // Structured outputs refused this schema as too large a grammar (after
    // two rounds of simplification), so the contract travels in the prompt and
    // is enforced afterwards by assemble + Zod, which reject rather than repair.
    "Respond with one JSON object, and nothing else, matching this JSON Schema exactly. Use \"\" for an absent string and [] for an absent list.",
    "```json",
    JSON.stringify(GENERATION_SCHEMA),
    "```",
    "",
    `## Pericope`,
    `${pericope.id} — ${pericope.label}`,
    `Script: ${script}`,
    `Verses to emit entries for: ${verses.join(", ")}`,
    ...partLines,
    "",
    `## Aligned original with morphology (surface|morph|strongs|gloss)`,
    ...contextLines,
    "",
  ].join("\n");

  return {
    custom_id: partId(pericope.id, part, parts),
    pericope_id: pericope.id,
    label: pericope.label,
    verses,
    part,
    parts,
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
    const built = buildRequests(book, pericope);
    if (built.length === 0) {
      console.log(`  SKIP ${pericope.id} (does not parse)`);
      continue;
    }
    if (built.every((r) => r.verses.length === 0)) {
      console.log(`  SKIP ${pericope.id} (no tokens in staging.db)`);
      continue;
    }
    if (built.length > 1) {
      console.log(`  SPLIT ${pericope.id}: ${built.map((r) => r.verses.length).join(" + ")} verses (over ${MAX_VERSES_PER_REQUEST})`);
    }
    for (const request of built) {
      requests.push(request);
      writeFileSync(
        path.join(REQUESTS, `${request.custom_id}.json`),
        `${JSON.stringify({ custom_id: request.custom_id, body: request.body }, null, 2)}\n`,
      );
    }
  }

  const totalChars = requests.reduce((sum, r) => sum + r.characters, 0);
  const totalVerses = requests.reduce((sum, r) => sum + r.verses.length, 0);
  const split = requests.filter((r) => r.parts > 1 && r.part === 1).length;

  console.log(`\ngenerate --dry-run ${book}: NOTHING WAS SUBMITTED\n`);
  console.log(`  requests built:  ${requests.length} (one per pericope${split > 0 ? `; ${split} long pericope(s) split` : ""})`);
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
