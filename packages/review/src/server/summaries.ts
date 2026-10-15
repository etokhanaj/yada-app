/**
 * The "Passage summaries" queue over passage_reviews.json.
 *
 * The list comes from the pipeline (packages/pipeline/src/understand/flagged.ts), run once per server as a
 * child process because building every book's summaries takes minutes. Each summary's standing is read from
 * passage_reviews.json on every request, so a decision shows at once.
 *
 * John approves or rejects the text as built, or holds it as needing a pipeline fix with a note for the pipeline
 * session; nothing here edits it (rule 2). A decision rewrites the one
 * entry in passage_reviews.json, atomically and in the file's own layout, and appends one line to
 * decisions.jsonl. Skip writes nothing: it is not a decision.
 */

import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  FIX_NOTE_MAX,
  FIX_REASON,
  REJECTED_REASON,
  type PassageVerse,
  type SummariesResponse,
  type SummaryAction,
  type SummaryItem,
  type SummaryStatus,
} from "../shared/api.js";
import { decisionsPath, RefusedError } from "./actions.js";
import { FLAGGED_SUMMARIES_SCRIPT, PACKAGE_ROOT } from "./config.js";

/** One summary as flagged.ts lists it (its FlaggedSummary). */
export interface RawSummary {
  id: string;
  book: string;
  label: string;
  range: string;
  text: string;
  flags: string[];
  reviewable: boolean;
  verses: PassageVerse[];
}

export type SummaryLoader = () => Promise<RawSummary[]>;

export interface SummariesContext {
  passageReviewsPath: string;
  reviewDir: string;
  reviewer: string;
  summaries: SummarySource;
  now?: () => Date;
}

/** One line of decisions.jsonl for a passage summary. */
export interface SummaryDecisionRecord {
  at: string;
  kind: "passage_summary";
  passage: string;
  action: SummaryAction;
  decision: "approved" | "rejected" | "needs a fix";
  status: "approved" | "held";
  previous_status: "approved" | "held" | null;
  /** The entry this decision replaced, so a rejected hold's own reason is kept. */
  previous: Review | null;
  /** sha256 of the summary text John read. */
  text_sha256: string;
  /** The "Needs a fix" note. */
  note?: string;
  flags: string[];
  reviewer: string;
}

interface Review {
  status: "held" | "approved";
  reason?: string;
  /** The "Needs a fix" note. The pipeline's PassageReview ignores it, so it never reaches a bundle. */
  fix?: string;
  sha256?: string;
}

type Json = Record<string, unknown>;

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

type NotReady = Exclude<SummariesResponse, { state: "ready" }>;

/** Runs the pipeline's list once and keeps it; until it finishes, the queue reads as loading. */
export class SummarySource {
  private state: RawSummary[] | NotReady = { state: "loading" };
  private loading: Promise<void> | null = null;

  constructor(private readonly loader: SummaryLoader) {}

  /** The list, or why there is none yet. The first read starts the loader. */
  read(): RawSummary[] | NotReady {
    this.loading ??= this.loader().then(
      (items) => {
        this.state = items;
      },
      (error: unknown) => {
        this.state = { state: "error", error: (error as Error).message };
      },
    );
    return this.state;
  }

  /** Resolves once the loader has settled. */
  async settled(): Promise<void> {
    this.read();
    await this.loading;
  }
}

/** The real loader: flagged.ts under tsx, its JSON on stdout. */
export function pipelineLoader(script = FLAGGED_SUMMARIES_SCRIPT): SummaryLoader {
  return () =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx", script], { cwd: PACKAGE_ROOT, stdio: ["ignore", "pipe", "pipe"] });
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
      child.on("error", reject);
      // The child's own exit code, never one through a pipe (rule 7).
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`flagged.ts exited ${code}: ${Buffer.concat(err).toString("utf8").trim().slice(-2000)}`));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(out).toString("utf8")) as RawSummary[]);
        } catch (error) {
          reject(new Error(`flagged.ts printed no list: ${(error as Error).message}`));
        }
      });
    });
}

// ---------------------------------------------------------------------------
// passage_reviews.json
// ---------------------------------------------------------------------------

interface ReviewsFile {
  raw: string;
  data: Json;
  entries: Json;
}

function readReviews(file: string): ReviewsFile {
  const raw = readFileSync(file, "utf8");
  const data = JSON.parse(raw) as unknown;
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error(`${file} is not an object`);
  const entries = (data as Json)["entries"];
  if (typeof entries !== "object" || entries === null || Array.isArray(entries)) throw new Error(`${file} has no entries object`);
  return { raw, data: data as Json, entries: entries as Json };
}

function reviewOf(value: unknown): Review | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Json;
  if (v["status"] !== "held" && v["status"] !== "approved") return null;
  return {
    status: v["status"],
    ...(typeof v["reason"] === "string" ? { reason: v["reason"] } : {}),
    ...(typeof v["fix"] === "string" ? { fix: v["fix"] } : {}),
    ...(typeof v["sha256"] === "string" ? { sha256: v["sha256"] } : {}),
  };
}

/**
 * The file's own layout: two-space indent, one entry per line as `"ID": { "status": …, … }`, so a decision
 * changes one line of the diff.
 */
export function serializeReviews(data: Json, trailingNewline = true): string {
  const line = (value: Json): string =>
    `{ ${Object.entries(value)
      .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
      .join(", ")} }`;
  const top = Object.entries(data).map(([key, value]) => {
    if (key !== "entries") return `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`;
    const rows = Object.entries(value as Json).map(([id, entry]) => `    ${JSON.stringify(id)}: ${line(entry as Json)}`);
    return rows.length === 0 ? `  "entries": {}` : `  "entries": {\n${rows.join(",\n")}\n  }`;
  });
  return `{\n${top.join(",\n")}\n}${trailingNewline ? "\n" : ""}`;
}

/** Where a summary stands, as summaries.ts will read it. */
export function statusOf(review: Review | null, textSha: string): SummaryStatus {
  if (review === null) return "pending";
  if (review.status === "held" && review.reason === FIX_REASON) return review.sha256 === textSha ? "fix" : "fix_changed";
  if (review.status === "held") return "held";
  return review.sha256 === textSha ? "approved" : "changed";
}

function toItem(raw: RawSummary, entries: Json): SummaryItem {
  const textSha = sha256(raw.text);
  const review = reviewOf(entries[raw.id]);
  return {
    id: raw.id,
    label: raw.label,
    range: raw.range,
    text: raw.text,
    flags: raw.flags,
    status: statusOf(review, textSha),
    reason: review?.status === "held" ? (review.reason ?? null) : null,
    fix: review?.status === "held" ? (review.fix ?? null) : null,
    reviewable: raw.reviewable,
    text_sha256: textSha,
    verses: raw.verses,
  };
}

/** The queue. Pure read. */
export function buildSummaries(ctx: SummariesContext): SummariesResponse {
  const list = ctx.summaries.read();
  if (!Array.isArray(list)) return list;
  const { entries } = readReviews(ctx.passageReviewsPath);
  return { state: "ready", items: list.map((raw) => toItem(raw, entries)) };
}

const DECISION = { approve: "approved", reject: "rejected", fix: "needs a fix" } as const satisfies Record<
  SummaryAction,
  SummaryDecisionRecord["decision"]
>;

/** The note "Needs a fix" requires: what the pipeline session should change, 1 to FIX_NOTE_MAX characters. */
function fixNote(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") throw new RefusedError("Needs a fix takes a note saying what to fix.", 400);
  const note = value.trim();
  if (note.length > FIX_NOTE_MAX) throw new RefusedError(`The note is ${note.length} characters; at most ${FIX_NOTE_MAX}.`, 400);
  return note;
}

/**
 * One summary, one decision. The body may name only the text it read (`text_sha256`), and that must be the
 * text the pipeline builds now: an approval of any other text would show words John never read.
 */
export function decideSummary(ctx: SummariesContext, id: string, action: SummaryAction, body: Record<string, unknown>): SummaryItem {
  const extra = Object.keys(body).filter((key) => key !== "text_sha256" && !(action === "fix" && key === "note"));
  if (extra.length > 0) throw new RefusedError(`One summary per request; unexpected ${extra.join(", ")}.`, 400);
  const note = action === "fix" ? fixNote(body["note"]) : undefined;

  const list = ctx.summaries.read();
  if (!Array.isArray(list)) throw new RefusedError("The summaries are still being built. Try again in a minute.", 503);
  const raw = list.find((s) => s.id === id);
  if (raw === undefined) throw new RefusedError(`No flagged summary ${id}.`, 404);
  if (!raw.reviewable) throw new RefusedError(`${id} is built without passage_reviews.json, so a decision would change nothing.`, 422);

  const textSha = sha256(raw.text);
  const seen = body["text_sha256"];
  if (typeof seen !== "string") throw new RefusedError("The request does not say which text was read.", 400);
  if (seen !== textSha) throw new RefusedError(`${id} changed after it was loaded. Reload and read it again.`, 409);

  const file = readReviews(ctx.passageReviewsPath);
  // If the file does not round-trip byte for byte, a write would reformat it; refuse instead.
  if (serializeReviews(file.data, file.raw.endsWith("\n")) !== file.raw) {
    throw new RefusedError(`${ctx.passageReviewsPath} is not in its one-entry-per-line form; not rewriting it.`, 500);
  }
  const previous = reviewOf(file.entries[id]);
  const next: Review =
    action === "approve"
      ? { status: "approved", sha256: textSha }
      : action === "reject"
        ? { status: "held", reason: REJECTED_REASON }
        : { status: "held", reason: FIX_REASON, fix: note ?? "", sha256: textSha };
  if (
    previous?.status === next.status &&
    previous.sha256 === next.sha256 &&
    previous.reason === next.reason &&
    previous.fix === next.fix
  ) {
    throw new RefusedError(`${id} is already ${DECISION[action]}.`, 409);
  }
  file.entries[id] = next;

  const line: SummaryDecisionRecord = {
    at: (ctx.now?.() ?? new Date()).toISOString(),
    kind: "passage_summary",
    passage: id,
    action,
    decision: DECISION[action],
    status: next.status,
    previous_status: previous?.status ?? null,
    previous,
    text_sha256: textSha,
    ...(note === undefined ? {} : { note }),
    flags: raw.flags,
    reviewer: ctx.reviewer,
  };

  // As debates.ts: temp file then rename, with the log line in first, so the file never holds a decision the
  // log lacks (README, Durability).
  const target = ctx.passageReviewsPath;
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${randomBytes(6).toString("hex")}.tmp`);
  writeFileSync(temp, serializeReviews(file.data, file.raw.endsWith("\n")), "utf8");
  try {
    mkdirSync(ctx.reviewDir, { recursive: true });
    appendFileSync(decisionsPath(ctx.reviewDir), `${JSON.stringify(line)}\n`, "utf8");
    renameSync(temp, target);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
  return toItem(raw, file.entries);
}
