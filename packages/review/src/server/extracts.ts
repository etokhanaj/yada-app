/**
 * The "Extracts" queue (build 6): book introductions and grammar terms, each a source's own sentences cut
 * by rule in packages/pipeline (understand/intro.ts, grammar.ts). John reads the text beside the paragraph
 * it came from and approves or rejects it; he writes nothing (rule 2).
 *
 * Like debates.ts: reads never write; a decision rewrites one item's `status` in its file, atomically and
 * in the file's own json.dump(indent=1) form, after appending one line to decisions.jsonl.
 */

import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { BOOK_CODES, isBookCode } from "@yada/schema";

import {
  POSITION_STATUSES,
  type ExtractGroup,
  type ExtractItem,
  type ExtractKind,
  type ExtractsResponse,
  type ExtractAction,
  type PositionStatus,
} from "../shared/api.js";
import { decisionsPath, RefusedError } from "./actions.js";

export interface ExtractsContext {
  /** packages/pipeline/prototypes/data, holding book_intros.json and grammar.json. */
  extractsDir: string;
  reviewDir: string;
  reviewer: string;
  now?: () => Date;
}

export interface ExtractDecisionRecord {
  at: string;
  kind: "extract";
  extract: ExtractKind;
  id: string;
  decision: "approved" | "rejected" | "undo";
  status: PositionStatus;
  previous_status: PositionStatus;
  reviewer: string;
  text_sha256: string;
}

type Json = Record<string, unknown>;

const FILES: Readonly<Record<ExtractKind, string>> = {
  book_intro: "book_intros.json",
  grammar: "grammar.json",
  // Written by scripts/sample-daily-review.mjs (build 7a, plan §0 step 1).
  devotional: "devotional_samples.json",
  daily_light: "daily_light_samples.json",
};
const TITLES: Readonly<Record<ExtractKind, string>> = {
  book_intro: "Book introductions",
  grammar: "Grammar terms",
  devotional: "Spurgeon, Morning and Evening (sample)",
  daily_light: "Daily Light references (sample)",
};
const LANGUAGE: Readonly<Record<string, string>> = { greek: "Greek", hebrew: "Hebrew", aramaic: "Aramaic" };

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function serialize(data: unknown, raw: string): string {
  return JSON.stringify(data, null, 1) + (raw.endsWith("\n") ? "\n" : "");
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function loadFile(ctx: ExtractsContext, kind: ExtractKind): { raw: string; data: Json; entries: Json[] } | null {
  const file = path.join(ctx.extractsDir, FILES[kind]);
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, "utf8");
  const data = JSON.parse(raw) as unknown;
  if (typeof data !== "object" || data === null || !Array.isArray((data as Json)["entries"])) throw new Error(`${file} has no entries list`);
  return { raw, data: data as Json, entries: (data as Json)["entries"] as Json[] };
}

function idOf(kind: ExtractKind, entry: Json): string {
  return kind === "book_intro" ? str(entry["book"]) : str(entry["key"]);
}

function toItem(kind: ExtractKind, entry: Json): ExtractItem {
  const status = entry["status"];
  if (!(POSITION_STATUSES as readonly unknown[]).includes(status)) throw new Error(`${FILES[kind]}: ${idOf(kind, entry)} has status ${JSON.stringify(status)}`);
  const id = idOf(kind, entry);
  const book = entry["book"];
  const title =
    kind === "book_intro"
      ? isBookCode(book)
        ? BOOK_CODES[book].name
        : id
      : kind === "devotional" || kind === "daily_light"
        ? str(entry["label"])
        : `${LANGUAGE[str(entry["language"])] ?? str(entry["language"])} · ${str(entry["label"])}`;
  const text = str(entry["text"]);
  const note = str(entry["note"]);
  return {
    kind,
    id,
    title,
    text,
    context: str(entry["paragraph"]),
    ref: str(entry["ref"]),
    note: note === "" ? null : note,
    status: status as PositionStatus,
    text_sha256: sha256(text),
  };
}

/** The queue. Pure read. */
export function buildExtracts(ctx: ExtractsContext): ExtractsResponse {
  const groups: ExtractGroup[] = [];
  for (const kind of Object.keys(FILES) as ExtractKind[]) {
    const loaded = loadFile(ctx, kind);
    const items = (loaded?.entries ?? []).map((e) => toItem(kind, e));
    groups.push({ kind, title: TITLES[kind], items, approved: items.filter((i) => i.status === "approved").length });
  }
  return { groups };
}

const NEXT_STATUS: Readonly<Record<ExtractAction, PositionStatus>> = { approve: "approved", reject: "rejected", undo: "draft" };
const LOGGED: Readonly<Record<ExtractAction, ExtractDecisionRecord["decision"]>> = { approve: "approved", reject: "rejected", undo: "undo" };

/** One item, one decision; the body names only the text it read. */
export function decideExtract(ctx: ExtractsContext, kind: ExtractKind, id: string, action: ExtractAction, body: Record<string, unknown>): ExtractItem {
  const extra = Object.keys(body).filter((key) => key !== "text_sha256");
  if (extra.length > 0) throw new RefusedError(`One item per request; unexpected ${extra.join(", ")}.`, 400);
  const loaded = loadFile(ctx, kind);
  if (loaded === null) throw new RefusedError(`No ${FILES[kind]} in ${ctx.extractsDir}.`, 404);
  const file = path.join(ctx.extractsDir, FILES[kind]);
  if (serialize(loaded.data, loaded.raw) !== loaded.raw) throw new RefusedError(`${file} is not in json.dump(indent=1) form; not rewriting it.`, 500);
  const entry = loaded.entries.find((e) => idOf(kind, e) === id);
  if (entry === undefined) throw new RefusedError(`No ${kind} ${id}.`, 404);
  const item = toItem(kind, entry);
  const seen = body["text_sha256"];
  if (typeof seen !== "string") throw new RefusedError("The request does not say which text was read.", 400);
  if (seen !== item.text_sha256) throw new RefusedError(`${id} changed after it was loaded. Reload and read it again.`, 409);
  const next = NEXT_STATUS[action];
  if (item.status === next) throw new RefusedError(`${id} is already ${next}.`, 409);

  entry["status"] = next;
  const line: ExtractDecisionRecord = {
    at: (ctx.now?.() ?? new Date()).toISOString(),
    kind: "extract",
    extract: kind,
    id,
    decision: LOGGED[action],
    status: next,
    previous_status: item.status,
    reviewer: ctx.reviewer,
    text_sha256: item.text_sha256,
  };
  // As debates.ts: temp file, log line, then rename, so the file never holds a decision the log lacks.
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${randomBytes(6).toString("hex")}.tmp`);
  writeFileSync(temp, serialize(loaded.data, loaded.raw), "utf8");
  try {
    mkdirSync(ctx.reviewDir, { recursive: true });
    appendFileSync(decisionsPath(ctx.reviewDir), `${JSON.stringify(line)}\n`, "utf8");
    renameSync(temp, file);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
  return { ...item, status: next };
}
