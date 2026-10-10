/**
 * `yada generate --batch --confirm <BOOK>`, `yada batch status <id>`,
 * `yada batch collect <id>` and `yada batch recover <id>` — generation through
 * the Message Batches API.
 *
 * Every whole-Bible figure in docs/cost-model.md assumes the batch discount,
 * and milestone-0 "Fix before scaling" item 4 says to exercise it before
 * relying on it. This is that path. It sends exactly the requests
 * `generate --confirm` sends — same buildRequest body, same max_tokens, same
 * adaptive thinking — so a batched response is the same measurement at half
 * the price, and it lands in content/responses/ in the same shape so
 * `ingest-responses` stores it unchanged and flagged.
 *
 * The spend rules of budget.ts hold, with one difference forced by batching:
 * once a batch is submitted none of its requests can be stopped one at a
 * time, so the ceiling is checked against the whole batch's worst case before
 * anything is sent, and that worst case is reserved in usage.jsonl until the
 * measured cost replaces it on collect. Without the reservation, a second run
 * started while the batch is processing would see the money as unspent.
 */

import type { DatabaseSync } from "node:sqlite";

import type Anthropic from "@anthropic-ai/sdk";

import { assertWorstCaseWithinCeiling, priceBatchUsage, readUsage, recordUsage, type UsageRecord } from "./budget.js";
import { buildRequests, partId, type Pericope } from "./generate.js";
import { RESPONSES } from "./paths.js";
import { generationClient, maxTokensFor, writeResponseFile } from "./submit.js";

/** The Batches API's custom_id rule. */
const CUSTOM_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * `claude-opus-5` + `GEN.1.1-1.5` -> `claude-opus-5__GEN_1_1-1_5`. Pericope ids
 * contain dots, which custom_id forbids; the readable form is kept so a raw
 * results file can still be read by eye, and batch_requests maps it back.
 */
export function batchCustomId(model: string, requestId: string): string {
  const id = `${model}__${requestId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  if (!CUSTOM_ID.test(id)) throw new Error(`cannot make a batch custom_id from ${model} ${requestId}`);
  return id;
}

export interface PlannedRequest {
  customId: string;
  pericopeId: string;
  model: string;
  verses: number;
  /** A long pericope is split across requests (generate.ts chunkVerses); 1 of 1 otherwise. */
  part: number;
  parts: number;
  verseIds: readonly string[];
  inputTokens: number;
  maxTokens: number;
  /** Batch-discounted cost if every output token up to max_tokens is used. */
  worstCaseUsd: number;
  params: Anthropic.MessageCreateParamsNonStreaming;
}

export interface BatchPlan {
  requests: PlannedRequest[];
  /** Pericopes that build no request, with the reason, as dryRun reports them. */
  skipped: Array<{ pericopeId: string; reason: string }>;
  worstCaseUsd: number;
}

/**
 * Build and price every request. Tokens come from count_tokens, as in the
 * synchronous path: a character estimate undercounts Greek and Hebrew, which
 * is the wrong direction for a number that justifies a budget.
 */
async function planBatch(
  book: string,
  pericopes: readonly Pericope[],
  models: readonly string[],
  client: Anthropic,
): Promise<BatchPlan> {
  const requests: PlannedRequest[] = [];
  const skipped: BatchPlan["skipped"] = [];

  for (const model of models) {
    for (const pericope of pericopes) {
      const built = buildRequests(book, pericope);
      // Skipped rather than fatal, as in dryRun: JHN.7.53-8.11 has no tokens
      // because SBLGNT omits it, and that gap is a content decision, not a
      // reason to hold back the rest of the book.
      if (built.length === 0) {
        if (model === models[0]) skipped.push({ pericopeId: pericope.id, reason: "does not parse" });
        continue;
      }
      if (built.every((r) => r.verses.length === 0)) {
        if (model === models[0]) skipped.push({ pericopeId: pericope.id, reason: "no tokens in staging.db" });
        continue;
      }

      // Every part goes in the batch: sending only the first would leave the
      // rest of a long pericope with no entries and no error.
      for (const request of built) {
        const messages = [{ role: "user" as const, content: request.body }];
        const maxTokens = maxTokensFor(request.verses.length);
        const counted = await client.messages.countTokens({ model, messages });
        requests.push({
          customId: batchCustomId(model, request.custom_id),
          pericopeId: pericope.id,
          model,
          verses: request.verses.length,
          part: request.part,
          parts: request.parts,
          verseIds: request.verses,
          inputTokens: counted.input_tokens,
          maxTokens,
          worstCaseUsd: priceBatchUsage(model, counted.input_tokens, maxTokens),
          // Identical to the params generatePericope streams, so the batch
          // measures the same thing the synchronous sample measured.
          params: { model, max_tokens: maxTokens, messages, thinking: { type: "adaptive" } },
        });
      }
    }
  }

  return { requests, skipped, worstCaseUsd: requests.reduce((sum, r) => sum + r.worstCaseUsd, 0) };
}

export interface BatchOptions {
  /** Nothing is sent unless this is true. */
  confirm: boolean;
  /** Injected in tests so every path runs without a network or a key. */
  client?: Anthropic;
  now?: () => Date;
}

export interface SubmittedBatch {
  batchId: string;
  plan: BatchPlan;
}

/**
 * Plan, check the ceiling, then submit — in that order, so an oversized batch
 * stops whether or not --confirm was given. After create returns, the
 * reservation is written before anything else: the batch is now being paid
 * for, and a failure recording it locally must not hide that. A failure in
 * either write still attempts the other, then throws BatchNotRecorded.
 */
export async function submitBatch(
  db: DatabaseSync,
  book: string,
  pericopes: readonly Pericope[],
  models: readonly string[],
  options: BatchOptions,
): Promise<SubmittedBatch> {
  const client = options.client ?? generationClient();
  const plan = await planBatch(book, pericopes, models, client);
  if (plan.requests.length === 0) throw new Error(`refusing to submit: ${book} builds no requests`);

  assertWorstCaseWithinCeiling(plan.worstCaseUsd, `this batch of ${plan.requests.length} requests`);

  if (!options.confirm) {
    throw new Error(
      `refusing to submit the ${book} batch: --confirm not given. ` +
        `Would have sent ${plan.requests.length} requests, worst case $${plan.worstCaseUsd.toFixed(2)}.`,
    );
  }

  const batch = await client.messages.batches.create({
    requests: plan.requests.map((r) => ({ custom_id: r.customId, params: r.params })),
  });
  const at = (options.now ?? (() => new Date()))().toISOString();

  // From here the batch is being paid for, so no failure may skip the next
  // write. Code review, 10 Oct 2026: an unguarded loop that threw on one
  // reservation skipped the staging write too, leaving a paid batch that
  // knownBatch() refuses to collect. Every write is attempted, the failures
  // are reported together, and `yada batch recover` rebuilds the missing side.
  const failures: string[] = [];
  for (const r of plan.requests) {
    try {
      recordUsage(reservationFor(batch.id, at, r));
    } catch (error) {
      failures.push(`reservation for ${r.customId}: ${(error as Error).message}`);
    }
  }

  try {
    stageBatch(
      db,
      batch.id,
      { book, at, state: batch.processing_status, models, requests: plan.requests.length, projectedUsd: plan.worstCaseUsd },
      plan.requests,
    );
  } catch (error) {
    failures.push(`staging.db: ${(error as Error).message}`);
  }

  if (failures.length > 0) {
    throw new BatchNotRecorded(
      `batch ${batch.id} WAS SUBMITTED and is being paid for (worst case $${plan.worstCaseUsd.toFixed(2)}), ` +
        `but recording it locally failed:\n  ${failures.join("\n  ")}\n` +
        `Fix the cause, then run: yada batch recover ${batch.id}\n` +
        `A request missing from both usage.jsonl and staging.db cannot be rebuilt; reconcile it against the console.`,
    );
  }

  return { batchId: batch.id, plan };
}

/** A batch was submitted but usage.jsonl or staging.db did not fully record it. */
export class BatchNotRecorded extends Error {}

/** What staging.db keeps per request, and what recovery can rebuild. */
type StagedRequest = Omit<PlannedRequest, "params">;

function reservationFor(batchId: string, at: string, r: StagedRequest): UsageRecord {
  return {
    at,
    model: r.model,
    pericope_id: r.pericopeId,
    verses: r.verses,
    input_tokens: r.inputTokens,
    output_tokens: r.maxTokens,
    thinking_tokens: 0,
    cost_usd: r.worstCaseUsd,
    estimated: true,
    reservation: true,
    batch_id: batchId,
    custom_id: r.customId,
    stage: "generate",
    // Carried so recovery does not depend on chunkVerses splitting the same
    // way later: the chunk size is a planning figure and has changed once.
    part: r.part,
    parts: r.parts,
    verse_ids: [...r.verseIds],
  };
}

interface BatchRowValues {
  book: string;
  at: string;
  state: string;
  models: readonly string[];
  requests: number;
  projectedUsd: number;
}

/**
 * The request map collect needs, in one transaction. `batch` is null when the
 * batches row already exists and only request rows are missing.
 */
function stageBatch(
  db: DatabaseSync,
  batchId: string,
  batch: BatchRowValues | null,
  requests: readonly StagedRequest[],
): void {
  db.exec("BEGIN");
  try {
    if (batch !== null) {
      db.prepare(
        "INSERT INTO batches (batch_id, book, created_at, state, models, requests, projected_usd) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(
        batchId,
        batch.book,
        batch.at,
        batch.state,
        batch.models.join(","),
        batch.requests,
        batch.projectedUsd,
      );
    }
    const insert = db.prepare(
      `INSERT INTO batch_requests (batch_id, custom_id, pericope_id, model, verses, input_tokens, max_tokens, part, parts, verse_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const r of requests) {
      insert.run(
        batchId,
        r.customId,
        r.pericopeId,
        r.model,
        r.verses,
        r.inputTokens,
        r.maxTokens,
        r.part,
        r.parts,
        JSON.stringify(r.verseIds),
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export interface RecoverReport {
  batchId: string;
  /** Requests whose staging.db row was rebuilt from their usage.jsonl reservation. */
  restaged: string[];
  /** Requests whose missing reservation was rewritten from staging.db. */
  reserved: string[];
  /** True when the batches row itself had to be written. */
  batchRow: boolean;
}

/**
 * `yada batch recover <id>`: make a batch collectable after submitBatch threw
 * BatchNotRecorded. Offline and free; safe to re-run.
 *
 * Each side is rebuilt from the other. A reservation with no staging row gets
 * its row back from the fields the reservation carries; a staging row with no
 * ledger record gets its worst case reserved again, so the money stays
 * counted. A reservation written before it carried part and verse ids is
 * rebuilt from buildRequests, and only accepted when the rebuilt request has
 * the same custom_id and verse count, because a changed chunk size would
 * split the pericope differently from what was sent.
 */
export function recoverBatch(db: DatabaseSync, batchId: string, options: { now?: () => Date } = {}): RecoverReport {
  const ledger = readUsage().filter((r) => r.batch_id === batchId && r.custom_id !== undefined);
  const inLedger = new Set(ledger.map((r) => String(r.custom_id)));
  const reservations = new Map<string, UsageRecord>();
  for (const r of ledger) if (r.reservation === true) reservations.set(String(r.custom_id), r);

  const staged = new Map<string, StagedRequest>();
  for (const row of db.prepare("SELECT * FROM batch_requests WHERE batch_id = ?").all(batchId)) {
    const model = String(row["model"]);
    const inputTokens = Number(row["input_tokens"]);
    const maxTokens = Number(row["max_tokens"]);
    staged.set(String(row["custom_id"]), {
      customId: String(row["custom_id"]),
      pericopeId: String(row["pericope_id"]),
      model,
      verses: Number(row["verses"]),
      part: Number(row["part"]),
      parts: Number(row["parts"]),
      verseIds: row["verse_ids"] == null ? [] : (JSON.parse(String(row["verse_ids"])) as string[]),
      inputTokens,
      maxTokens,
      worstCaseUsd: priceBatchUsage(model, inputTokens, maxTokens),
    });
  }

  if (reservations.size === 0 && staged.size === 0) {
    throw new Error(
      `batch ${batchId} has no reservation in usage.jsonl and no rows in staging.db, ` +
        `so there is nothing to rebuild it from. Reconcile it against the console.`,
    );
  }

  // Built before anything is written, so a reservation that cannot be rebuilt
  // stops recovery with nothing half-done.
  const restage = [...reservations.entries()]
    .filter(([customId]) => !staged.has(customId))
    .map(([, r]) => requestFromReservation(r));
  const rereserve = [...staged.values()].filter((r) => !inLedger.has(r.customId));

  // The ledger first, as on submit: the money is spent whatever staging.db says.
  const at = (options.now ?? (() => new Date()))().toISOString();
  for (const r of rereserve) recordUsage(reservationFor(batchId, at, r));

  const all = [...staged.values(), ...restage];
  const hasBatchRow = db.prepare("SELECT 1 FROM batches WHERE batch_id = ?").get(batchId) !== undefined;
  const row: BatchRowValues | null = hasBatchRow
    ? null
    : {
        // Pericope ids start with the book code: JHN.11.1-11.44.
        book: String(all[0]?.pericopeId.split(".")[0]),
        at: [...reservations.values()][0]?.at ?? at,
        // Not a processing_status: the next `batch status` replaces it.
        state: "recovered",
        models: [...new Set(all.map((r) => r.model))],
        // Every request in the batch, not only the rebuilt ones.
        requests: all.length,
        projectedUsd: all.reduce((sum, r) => sum + r.worstCaseUsd, 0),
      };
  if (row !== null || restage.length > 0) stageBatch(db, batchId, row, restage);

  return {
    batchId,
    restaged: restage.map((r) => r.customId),
    reserved: rereserve.map((r) => r.customId),
    batchRow: row !== null,
  };
}

function requestFromReservation(r: UsageRecord): StagedRequest {
  const customId = String(r.custom_id);
  const base = {
    customId,
    pericopeId: r.pericope_id,
    model: r.model,
    verses: r.verses,
    inputTokens: r.input_tokens,
    maxTokens: r.output_tokens,
    worstCaseUsd: r.cost_usd,
  };
  if (r.part !== undefined && r.parts !== undefined && r.verse_ids !== undefined) {
    return { ...base, part: r.part, parts: r.parts, verseIds: r.verse_ids };
  }
  const book = String(r.pericope_id.split(".")[0]);
  const rebuilt = buildRequests(book, { id: r.pericope_id, label: "" }).find(
    (request) => batchCustomId(r.model, request.custom_id) === customId,
  );
  if (rebuilt === undefined || rebuilt.verses.length !== r.verses) {
    throw new Error(
      `cannot rebuild ${customId}: its reservation predates part and verse ids, and today's split of ` +
        `${r.pericope_id} does not reproduce a ${r.verses}-verse request with that id`,
    );
  }
  return { ...base, part: rebuilt.part, parts: rebuilt.parts, verseIds: rebuilt.verses };
}

export interface BatchStatus {
  batchId: string;
  book: string;
  processingStatus: Anthropic.Messages.MessageBatch["processing_status"];
  counts: Anthropic.Messages.MessageBatchRequestCounts;
  createdAt: string;
  endedAt: string | null;
}

interface BatchRow {
  book: string;
}

function knownBatch(db: DatabaseSync, batchId: string): BatchRow {
  const row = db.prepare("SELECT book FROM batches WHERE batch_id = ?").get(batchId);
  // Only batches this repo submitted have a request map; anything else has no
  // way back from custom_id to pericope and verses.
  if (row === undefined) {
    throw new Error(
      `batch ${batchId} is not in staging.db: it was not submitted from here, ` +
        `or its submission was not recorded (yada batch recover ${batchId})`,
    );
  }
  return { book: String(row["book"]) };
}

/** Poll once. Free: retrieving a batch is not billed. */
export async function batchStatus(
  db: DatabaseSync,
  batchId: string,
  options: { client?: Anthropic } = {},
): Promise<BatchStatus> {
  const { book } = knownBatch(db, batchId);
  const client = options.client ?? generationClient();
  const batch = await client.messages.batches.retrieve(batchId);
  // A collected batch keeps its state: "ended" from a later poll must not make
  // it look uncollected.
  db.prepare("UPDATE batches SET state = ? WHERE batch_id = ? AND state != 'collected'").run(
    batch.processing_status,
    batchId,
  );
  return {
    batchId,
    book,
    processingStatus: batch.processing_status,
    counts: batch.request_counts,
    createdAt: batch.created_at,
    endedAt: batch.ended_at,
  };
}

export interface CollectedRequest {
  customId: string;
  pericopeId: string;
  model: string;
  result: Anthropic.Messages.MessageBatchResult["type"];
  stopReason?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
  costUsd?: number;
  /** Why a non-succeeded result failed, as the API reported it. */
  error?: string;
}

export interface CollectReport {
  batchId: string;
  collected: CollectedRequest[];
  /** Already collected by an earlier run, so nothing was written again. */
  alreadyCollected: number;
  /** custom_ids in the results that this batch never submitted. */
  unknown: string[];
  /** Submitted requests with no result yet. Their reservations still stand. */
  missing: string[];
}

export class BatchNotEnded extends Error {}

/**
 * Write every result into the place the synchronous path writes. Order per
 * request matches generatePericope: usage first (the money is spent), then
 * the response file, before anything parses it.
 *
 * A non-succeeded result writes no response and no measurement, so its
 * reservation stays in the ledger at the worst case. That over-counts if the
 * request was not billed, which stops a later run early; under-counting would
 * let it overspend. Reconcile against the console invoice.
 */
export async function collectBatch(
  db: DatabaseSync,
  batchId: string,
  options: { client?: Anthropic; responsesDir?: string; now?: () => Date } = {},
): Promise<CollectReport> {
  knownBatch(db, batchId);
  const client = options.client ?? generationClient();
  const responsesDir = options.responsesDir ?? RESPONSES;
  const now = options.now ?? (() => new Date());

  const batch = await client.messages.batches.retrieve(batchId);
  if (batch.processing_status !== "ended") {
    throw new BatchNotEnded(
      `batch ${batchId} is ${batch.processing_status}; results are only complete once it has ended`,
    );
  }

  const lookup = db.prepare("SELECT * FROM batch_requests WHERE batch_id = ? AND custom_id = ?");
  const mark = db.prepare(
    "UPDATE batch_requests SET result = ?, collected_at = ? WHERE batch_id = ? AND custom_id = ?",
  );
  const report: CollectReport = { batchId, collected: [], alreadyCollected: 0, unknown: [], missing: [] };

  // Results arrive in any order; everything is keyed by custom_id.
  for await (const item of await client.messages.batches.results(batchId)) {
    const row = lookup.get(batchId, item.custom_id);
    if (row === undefined) {
      report.unknown.push(item.custom_id);
      continue;
    }
    if (row["collected_at"] !== null) {
      report.alreadyCollected += 1;
      continue;
    }
    const pericopeId = String(row["pericope_id"]);
    const model = String(row["model"]);
    const at = now().toISOString();

    if (item.result.type !== "succeeded") {
      report.collected.push({
        customId: item.custom_id,
        pericopeId,
        model,
        result: item.result.type,
        ...(item.result.type === "errored" ? { error: item.result.error.error.message } : {}),
      });
      mark.run(item.result.type, at, batchId, item.custom_id);
      continue;
    }

    const message = item.result.message;
    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const thinkingTokens = message.usage.output_tokens_details?.thinking_tokens ?? 0;
    const costUsd = priceBatchUsage(model, inputTokens, outputTokens);

    recordUsage({
      at,
      model,
      pericope_id: pericopeId,
      verses: Number(row["verses"]),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      thinking_tokens: thinkingTokens,
      cost_usd: costUsd,
      batch_id: batchId,
      custom_id: item.custom_id,
      stage: "generate",
    });
    const part = Number(row["part"] ?? 1);
    const parts = Number(row["parts"] ?? 1);
    // Named as the synchronous path names it, so ingest cannot tell the two apart.
    const key = {
      custom_id: partId(pericopeId, part, parts),
      pericope_id: pericopeId,
      part,
      parts,
      verses: row["verse_ids"] == null ? [] : (JSON.parse(String(row["verse_ids"])) as string[]),
    };
    writeResponseFile(responsesDir, key, model, message, { batch_id: batchId });
    mark.run("succeeded", at, batchId, item.custom_id);

    report.collected.push({
      customId: item.custom_id,
      pericopeId,
      model,
      result: "succeeded",
      stopReason: message.stop_reason,
      inputTokens,
      outputTokens,
      thinkingTokens,
      costUsd,
    });
  }

  // Marked collected only when every submitted request has a result, so a
  // results stream that ended early leaves the batch visibly unfinished.
  const missing = db
    .prepare("SELECT custom_id FROM batch_requests WHERE batch_id = ? AND collected_at IS NULL ORDER BY custom_id")
    .all(batchId)
    .map((r) => String(r["custom_id"]));
  report.missing = missing;
  db.prepare("UPDATE batches SET state = ? WHERE batch_id = ?").run(missing.length === 0 ? "collected" : "ended", batchId);
  return report;
}
