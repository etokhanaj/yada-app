/**
 * Review decisions, and their durable record (build plan §2).
 *
 * staging.db is working data and is not committed. A decision that lived only
 * there would be lost with the file, so every decision is appended to
 * `review/decisions.jsonl` — committed — inside the same transaction that
 * writes `review_state`. If the append fails, the database write is rolled
 * back: a decision is never in the database without being in the log.
 */

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { formatFinding, hasErrors, validateVerseEntry } from "@yada/schema";

import {
  APPROVAL_MIN_RATING,
  isReviewQueue,
  type Decision,
  type ReviewQueue,
  type ReviewState,
} from "../shared/api.js";
import type { Db } from "./db.js";
import { canonicalOrder, loadEntry, parsePayload, payloadDigest, type StoredEntry } from "./queues.js";

export const DECISIONS_FILE = "decisions.jsonl";
export const REVIEW_STATE_FILE = "review_state.jsonl";

export function decisionsPath(dir: string): string {
  return path.join(dir, DECISIONS_FILE);
}

/** A decision the rules refuse. The message is shown to the reviewer verbatim. */
export class RefusedError extends Error {
  override readonly name = "RefusedError";
  readonly httpStatus: number;

  constructor(message: string, httpStatus = 422) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

export interface DecisionContext {
  db: Db;
  /** Directory holding decisions.jsonl. */
  reviewDir: string;
  reviewer: string;
  /** Recorded on decisions taken from the random-sample queue. */
  sampleSeed: string;
  now?: () => Date;
}

/** One line of decisions.jsonl. */
export interface DecisionRecord {
  at: string;
  verse_id: string;
  decision: Decision;
  status: string;
  previous_status: string;
  rating: number | null;
  reason: string | null;
  reviewer: string;
  queue: ReviewQueue | null;
  sample_seed: string | null;
  prompt_version: string;
  schema_version: string;
}

export type DecisionInput = Record<string, unknown>;

function parseRating(value: unknown, required: boolean): number | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new RefusedError("Approval needs a rating from 1 to 5.");
    return null;
  }
  const rating = typeof value === "string" ? Number(value) : value;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new RefusedError(`A rating is a whole number from 1 to 5, not ${JSON.stringify(value)}.`);
  }
  return rating;
}

function parseReason(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new RefusedError("A reason must be text.", 400);
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseQueue(value: unknown): ReviewQueue | null {
  if (value === undefined || value === null) return null;
  if (!isReviewQueue(value)) throw new RefusedError(`Unknown queue ${JSON.stringify(value)}.`, 400);
  return value;
}

/**
 * The text a decision is about must be the text the reviewer read. Without
 * this, an entry regenerated while it sat open on screen was approved on the
 * strength of the previous version — a review of words nobody had read.
 */
function requireSameText(stored: StoredEntry, seen: unknown, required: boolean): void {
  if (seen === undefined || seen === null) {
    if (!required) return;
    throw new RefusedError("Approval refused: the request does not say which version of the entry was read.", 400);
  }
  if (seen !== payloadDigest(stored.payload)) {
    throw new RefusedError(
      `${stored.verse_id} changed after it was opened. Reload it and review the current text.`,
      409,
    );
  }
}

function requireEntry(db: Db, verseId: string): StoredEntry {
  const stored = loadEntry(db, verseId);
  if (stored === null) throw new RefusedError(`No entry for ${verseId} in staging.db.`, 404);
  return stored;
}

/**
 * Approve: status becomes `human_reviewed`. Refused unless the request names
 * the payload on screen, below the PRD 0C bar, when the payload no longer parses, when the quality contract reports errors, and
 * for an entry an expert has already reviewed (approving would downgrade it).
 */
export function approve(ctx: DecisionContext, verseId: string, input: DecisionInput): ReviewState {
  const stored = requireEntry(ctx.db, verseId);
  requireSameText(stored, input["payload_sha256"], true);
  const rating = parseRating(input["rating"], true) as number;
  const reason = parseReason(input["reason"]);
  const queue = parseQueue(input["queue"]);

  if (rating < APPROVAL_MIN_RATING) {
    throw new RefusedError(
      `Approval refused: rated ${rating}. The 0C bar is ${APPROVAL_MIN_RATING} or better. ` +
        "If this entry falls short, reject it with a reason, so the reason can feed prompt revision.",
    );
  }
  if (stored.state.status === "expert_reviewed") {
    throw new RefusedError(
      `Approval refused: ${verseId} is already expert_reviewed, and approving would downgrade it to human_reviewed.`,
      409,
    );
  }
  const parsed = parsePayload(stored.payload);
  if (parsed.entry === null) {
    throw new RefusedError(
      `Approval refused: the stored payload does not parse as a VerseEntry (${parsed.issues.join("; ")}).`,
    );
  }
  const findings = validateVerseEntry(parsed.entry);
  if (hasErrors(findings)) {
    throw new RefusedError(
      `Approval refused: the entry fails the quality contract. ${findings
        .filter((f) => f.level === "error")
        .map(formatFinding)
        .join("; ")}`,
    );
  }

  return record(ctx, stored, { decision: "approved", status: "human_reviewed", rating, reason, queue });
}

/**
 * Reject: status stays (or becomes) `flagged`, decision `rejected`. A reason is
 * required — rejection reasons are the input to prompt revision. A rating is
 * optional.
 */
export function reject(ctx: DecisionContext, verseId: string, input: DecisionInput): ReviewState {
  const stored = requireEntry(ctx.db, verseId);
  requireSameText(stored, input["payload_sha256"], false);
  const reason = parseReason(input["reason"]);
  if (reason === null) {
    throw new RefusedError(
      "Rejection needs a reason. Say what is wrong: rejection reasons feed prompt revision.",
    );
  }
  const rating = parseRating(input["rating"], false);
  const queue = parseQueue(input["queue"]);
  return record(ctx, stored, { decision: "rejected", status: "flagged", rating, reason, queue });
}

interface Pending {
  decision: Decision;
  status: string;
  rating: number | null;
  reason: string | null;
  queue: ReviewQueue | null;
}

function record(ctx: DecisionContext, stored: StoredEntry, pending: Pending): ReviewState {
  const at = (ctx.now?.() ?? new Date()).toISOString();
  const line: DecisionRecord = {
    at,
    verse_id: stored.verse_id,
    decision: pending.decision,
    status: pending.status,
    previous_status: stored.state.status,
    rating: pending.rating,
    reason: pending.reason,
    reviewer: ctx.reviewer,
    queue: pending.queue,
    sample_seed: pending.queue === "random_sample" ? ctx.sampleSeed : null,
    prompt_version: stored.prompt_version,
    schema_version: stored.schema_version,
  };

  mkdirSync(ctx.reviewDir, { recursive: true });
  ctx.db.exec("BEGIN IMMEDIATE");
  try {
    ctx.db
      .prepare(
        `INSERT INTO review_state (verse_id, status, rating, reason, decision, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (verse_id) DO UPDATE SET
           status = excluded.status,
           rating = excluded.rating,
           reason = excluded.reason,
           decision = excluded.decision,
           updated_at = excluded.updated_at`,
      )
      .run(stored.verse_id, pending.status, pending.rating, pending.reason, pending.decision, at);
    appendFileSync(decisionsPath(ctx.reviewDir), `${JSON.stringify(line)}\n`, "utf8");
    ctx.db.exec("COMMIT");
  } catch (error) {
    try {
      ctx.db.exec("ROLLBACK");
    } catch {
      // Already rolled back by SQLite; the original error is the one to report.
    }
    throw error;
  }

  return requireEntry(ctx.db, stored.verse_id).state;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const PREFERRED_COLUMNS = ["verse_id", "status", "decision", "rating", "reason", "updated_at"];

/**
 * Regenerates `review_state.jsonl` from the database: one line per row, in
 * canonical verse order, keys in a fixed order, so a re-export of unchanged
 * state is byte-identical and diffs show only what changed.
 */
export function exportReviewState(db: Db, dir: string): { file: string; rows: number } {
  const rows = db.prepare("SELECT * FROM review_state").all();
  rows.sort((a, b) => canonicalOrder(String(a["verse_id"]), String(b["verse_id"])));

  const lines = rows.map((row) => {
    const out: Record<string, unknown> = {};
    const extras = Object.keys(row)
      .filter((key) => !PREFERRED_COLUMNS.includes(key))
      .sort();
    // Every preferred column is always written, so the file keeps its shape
    // when an older database gains the decision column.
    for (const key of [...PREFERRED_COLUMNS, ...extras]) {
      const value = row[key];
      out[key] = typeof value === "bigint" ? Number(value) : (value ?? null);
    }
    return JSON.stringify(out);
  });

  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, REVIEW_STATE_FILE);
  writeFileSync(file, lines.length === 0 ? "" : `${lines.join("\n")}\n`, "utf8");
  return { file, rows: lines.length };
}
