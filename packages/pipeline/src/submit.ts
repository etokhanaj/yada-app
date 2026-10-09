/**
 * `yada generate --confirm <BOOK>` — the only code in this repo that spends money.
 *
 * Everything risky is delegated to budget.ts and checked before the request is
 * sent, not after. This module's own job is to make the *measurement* honest:
 * Milestone 0 exists to replace two guesses (3.0 characters per token, 1,500
 * output tokens per verse) with numbers, so anything it reports has to be what
 * the API actually charged rather than what this code predicted.
 */

import { writeFileSync } from "node:fs";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";

import {
  assertWithinCeiling,
  priceUsage,
  recordUsage,
  requireApiKey,
  type UsageRecord,
} from "./budget.js";
import { buildRequest, type Pericope } from "./generate.js";
import { RESPONSES } from "./paths.js";

/** Models the sample is generated with. Both, so the cost/quality trade is observable. */
export const MILESTONE_0_MODELS = ["claude-opus-5", "claude-sonnet-5"] as const;

/**
 * Upper bound on output for one pericope, and therefore the number the budget
 * check prices. Generous on purpose: the ceiling must be enforced against the
 * worst case, because the real length is exactly what is unknown here.
 */
export function maxTokensFor(verses: number): number {
  // The first Milestone 0 run used 2,500/verse + 8,000 and three of six
  // responses hit the cap: adaptive thinking alone spent 9-21k tokens, and one
  // Sonnet run spent the entire budget thinking and wrote nothing.
  // Prompt 1.1 then measured 4.7-6.7k output tokens per verse, so a 15-verse
  // pericope outgrew 4,000/verse. Capped at the models' 128k output limit.
  return Math.min(verses * 7000 + 24000, 128_000);
}

export interface GenerationResult {
  pericopeId: string;
  model: string;
  verses: string[];
  inputTokens: number;
  outputTokens: number;
  /** A subset of outputTokens, not an addition to them. */
  thinkingTokens: number;
  costUsd: number;
  stopReason: string | null;
  /** Raw response text, written to disk before any parsing is attempted. */
  text: string;
  elapsedMs: number;
}

export interface SubmitOptions {
  /** Nothing is sent unless this is true. */
  confirm: boolean;
  /** Injected in tests so the gate can be exercised without a network. */
  client?: Anthropic;
  now?: () => number;
  /**
   * Where the raw response is written. Defaults to content/responses/, which
   * `ingest-responses` stores from — so a live regression run must write
   * elsewhere, or its output would enter the corpus as if it were generation.
   */
  responsesDir?: string;
  stage?: UsageRecord["stage"];
}

/**
 * Submit one pericope to one model.
 *
 * Ordering matters and is not incidental:
 *   count tokens -> check the ceiling -> send -> record usage -> return.
 * The usage record is written before this function returns so that a crash
 * mid-run cannot lose the record of money already spent.
 */
export async function generatePericope(
  book: string,
  pericope: Pericope,
  model: string,
  options: SubmitOptions,
): Promise<GenerationResult> {
  const request = buildRequest(book, pericope);
  if (request === null) throw new Error(`${pericope.id} does not parse`);
  if (request.verses.length === 0) throw new Error(`${pericope.id} has no tokens in staging.db`);

  const client = options.client ??
    // The SDK's default 10-minute timeout cut Opus off twice on 1 Cor 14:26-40
    // (15 verses at ~6k output tokens each). A long pericope needs longer.
    new Anthropic({ apiKey: requireApiKey(), timeout: 30 * 60 * 1000 });
  const messages = [{ role: "user" as const, content: request.body }];
  const maxTokens = maxTokensFor(request.verses.length);

  // The only accurate input count for Claude. Character-based estimates
  // undercount Greek and Hebrew badly, which is the direction that matters
  // when the estimate is being used to justify a budget.
  const counted = await client.messages.countTokens({ model, messages });
  const inputTokens = counted.input_tokens;

  assertWithinCeiling(model, inputTokens, maxTokens);

  if (!options.confirm) {
    throw new Error(
      `refusing to submit ${pericope.id}: --confirm not given. ` +
        `Would have sent ${inputTokens} input tokens to ${model}.`,
    );
  }

  const startedAt = (options.now ?? Date.now)();
  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    messages,
    // Adaptive, not budget_tokens: the latter is rejected with a 400 on these
    // models. Thinking is billed inside output_tokens, so it lands on the 95%
    // of the bill that decides whether the corpus fits its ceiling.
    thinking: { type: "adaptive" },
  });
  let message: Awaited<ReturnType<typeof stream.finalMessage>>;
  try {
    message = await stream.finalMessage();
  } catch (error) {
    // A stream that dies mid-response may already have been billed, and no usage
    // comes back to record. Log the worst case so the ceiling still holds; an
    // overestimate stops a run early, an omission lets it overspend.
    recordUsage({
      at: new Date().toISOString(),
      model,
      pericope_id: pericope.id,
      verses: request.verses.length,
      input_tokens: inputTokens,
      output_tokens: maxTokens,
      thinking_tokens: 0,
      cost_usd: priceUsage(model, inputTokens, maxTokens),
      estimated: true,
    });
    throw error;
  }
  const elapsedMs = (options.now ?? Date.now)() - startedAt;

  const outputTokens = message.usage.output_tokens;
  const thinkingTokens = message.usage.output_tokens_details?.thinking_tokens ?? 0;
  const costUsd = priceUsage(model, inputTokens, outputTokens);

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Written before parsing, so a malformed response is still evidence rather
  // than something that vanishes when a parse throws.
  writeFileSync(
    path.join(options.responsesDir ?? RESPONSES, `${pericope.id}.${model}.json`),
    `${JSON.stringify(
      { pericope_id: pericope.id, model, stop_reason: message.stop_reason, usage: message.usage, text },
      null,
      2,
    )}\n`,
  );

  const record: UsageRecord = {
    at: new Date().toISOString(),
    model,
    pericope_id: pericope.id,
    verses: request.verses.length,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    thinking_tokens: thinkingTokens,
    cost_usd: costUsd,
    stage: options.stage ?? "generate",
  };
  recordUsage(record);

  return {
    pericopeId: pericope.id,
    model,
    verses: request.verses,
    inputTokens,
    outputTokens,
    thinkingTokens,
    costUsd,
    stopReason: message.stop_reason,
    text,
    elapsedMs,
  };
}
