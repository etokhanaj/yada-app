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
import { MODEL_RATES } from "./generate.js";

export const USAGE_LOG = path.join(CONTENT, "usage.jsonl");

/** Hard ceiling for one Milestone 0 session, in USD. Expected spend is $3–6. */
export const CEILING_USD = 25;

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
}

export function priceUsage(model: string, inputTokens: number, outputTokens: number): number {
  const rate = MODEL_RATES[model as keyof typeof MODEL_RATES];
  if (rate === undefined) throw new Error(`no published rate for ${model}`);
  // No batch discount: this sample is submitted synchronously. Applying one
  // here would understate what was actually charged.
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
}

export function spentSoFar(): number {
  if (!existsSync(USAGE_LOG)) return 0;
  let total = 0;
  for (const line of readFileSync(USAGE_LOG, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    total += (JSON.parse(line) as UsageRecord).cost_usd;
  }
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
  const worstCase = priceUsage(model, inputTokens, maxOutputTokens);
  const spent = spentSoFar();
  if (spent + worstCase > CEILING_USD) {
    throw new BudgetExceeded(
      `refusing to submit: $${spent.toFixed(2)} already spent, this request could cost ` +
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
