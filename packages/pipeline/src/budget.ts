/**
 * The spend gate. Everything that can cost money goes through this file.
 *
 * PRD §11.10 sets a £1–2k ceiling for the whole corpus and the build plan says
 * nothing scales until Milestone 0 produces a measured per-verse number. The
 * risk this guards against is not the sample — it is a loop that keeps paying
 * for a mistake, so the ceiling is checked *before* each request rather than
 * reported after the run.
 *
 * Three rules, in order of how much damage breaking them does:
 *
 *   1. Submission requires an explicit `--confirm`. The default is dry-run.
 *   2. A request that would cross the ceiling stops the run. It is never
 *      trimmed to fit, because a silently truncated sample still gets written
 *      up as if it were the whole thing.
 *   3. Every request's real usage is appended to content/usage.jsonl before the
 *      next one is sent, so a crash cannot lose the record of money spent.
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { CONTENT } from "./paths.js";
import { BATCH_DISCOUNT, MODEL_RATES } from "./generate.js";

export const USAGE_LOG = path.join(CONTENT, "usage.jsonl");

/**
 * Lifetime ceiling in USD across every recorded request, not per run:
 * spentSoFar sums all of usage.jsonl. John's whole AI budget is about $150;
 * he approved $100 of it for generation (Milestone 0 + John's Gospel) on
 * 9 Oct 2026. Raise it only with his explicit approval for a named step.
 * Raised to $120 on 12 Oct 2026 for the John Opus batch, then back to $100 the same day: John chose an
 * Understand built without AI (docs/no-ai-understand.md), so that batch does not run.
 */
export const CEILING_USD = 100;

export interface UsageRecord {
  at: string;
  model: string;
  pericope_id: string;
  verses: number;
  input_tokens: number;
  output_tokens: number;
  /** Billed as output tokens, and reported separately because they are easy to forget. */
  thinking_tokens: number;
  cost_usd: number;
  /**
   * Which stage spent it. Optional so that records written before the
   * adversary and live regression existed still parse; every stage draws on
   * the same ceiling, so spentSoFar sums all of them regardless.
   */
  stage?: "generate" | "adversary" | "regress-live";
  /** True when the request failed and the cost is the worst case, not a measurement. */
  estimated?: boolean;
  /**
   * Set on every record a Message Batch writes. A batch is paid for after it
   * is submitted, so submission writes a worst-case reservation per request
   * and collection writes the measured cost against the same key. spentSoFar
   * counts one record per key, preferring the measurement.
   */
  batch_id?: string;
  custom_id?: string;
  /** A worst-case hold for a batch request whose result has not been collected. */
  reservation?: boolean;
  /**
   * Which part of a split pericope a batch reservation is for, and its verses:
   * enough for `yada batch recover` to rebuild the request map from the ledger
   * alone if staging.db never recorded it (code review, 10 Oct 2026). Optional
   * because reservations written before 10 Oct 2026 lack them.
   */
  part?: number;
  parts?: number;
  verse_ids?: string[];
}

export function priceUsage(model: string, inputTokens: number, outputTokens: number): number {
  const rate = MODEL_RATES[model as keyof typeof MODEL_RATES];
  if (rate === undefined) throw new Error(`no published rate for ${model}`);
  // No batch discount: synchronous requests are charged the full rate, and
  // applying one here would understate what was actually charged.
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
}

/** The same price through the Message Batches API, which halves input and output. */
export function priceBatchUsage(model: string, inputTokens: number, outputTokens: number): number {
  return priceUsage(model, inputTokens, outputTokens) * BATCH_DISCOUNT;
}

/** Every record in usage.jsonl, in the order written. */
export function readUsage(): UsageRecord[] {
  if (!existsSync(USAGE_LOG)) return [];
  return readFileSync(USAGE_LOG, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as UsageRecord);
}

export function spentSoFar(): number {
  let total = 0;
  // Batch records are keyed so that a reservation stops counting once its
  // measurement lands, and so that a collect re-run after a crash (usage
  // written, collected_at not yet) cannot count the same request twice.
  const batched = new Map<string, UsageRecord>();
  for (const record of readUsage()) {
    if (record.batch_id === undefined || record.custom_id === undefined) {
      total += record.cost_usd;
      continue;
    }
    const key = `${record.batch_id}/${record.custom_id}`;
    const held = batched.get(key);
    if (held === undefined || (held.reservation === true && record.reservation !== true)) batched.set(key, record);
  }
  for (const record of batched.values()) total += record.cost_usd;
  return total;
}

export function recordUsage(record: UsageRecord): void {
  appendFileSync(USAGE_LOG, `${JSON.stringify(record)}\n`);
}

export class BudgetExceeded extends Error {}

/**
 * Refuse a request whose worst case would cross the ceiling.
 *
 * The estimate must be an upper bound, not a guess: it is checked before the
 * request is sent, when the real output length is still unknown. `max_tokens`
 * is that bound.
 */
export function assertWithinCeiling(model: string, inputTokens: number, maxOutputTokens: number): void {
  assertWorstCaseWithinCeiling(priceUsage(model, inputTokens, maxOutputTokens), "this request");
}

/**
 * The same refusal for a worst case already priced, such as a whole batch.
 * A batch is checked as one sum rather than request by request, because once
 * it is submitted none of its requests can be stopped individually.
 */
export function assertWorstCaseWithinCeiling(worstCase: number, what: string): void {
  const spent = spentSoFar();
  if (spent + worstCase > CEILING_USD) {
    throw new BudgetExceeded(
      `refusing to submit: $${spent.toFixed(2)} already spent, ${what} could cost ` +
        `$${worstCase.toFixed(2)}, ceiling is $${CEILING_USD}. ` +
        `Raise CEILING_USD deliberately or reduce the run — do not trim the sample to fit.`,
    );
  }
}

export class MissingApiKey extends Error {}

/**
 * The key is read from the environment and never written anywhere. It is not a
 * parameter, not a config field, and not logged, so there is no path by which
 * it reaches a file that could be committed.
 */
export function requireApiKey(): string {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (key === undefined || key.trim() === "") {
    throw new MissingApiKey(
      "ANTHROPIC_API_KEY is not set. Export it in the shell for this run only; " +
        "do not add it to a file in the repo.",
    );
  }
  return key;
}
