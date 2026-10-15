/**
 * The "Debate positions" queue over debates.json.
 *
 * Each position is a source's own sentence. John approves or rejects each one,
 * and tags each approved one with the side it holds, and where a passage asks two
 * questions, the axis (question) it answers. The app shows a passage's positions
 * once approved ones on one axis hold two distinct sides, framing sides aside
 * (John, 15 Oct 2026). Reads never write. A decision rewrites the one position's
 * `status`, `side` or `axis`
 * in debates.json, atomically and in the file's own formatting, and appends
 * one line to decisions.jsonl. The sentence's text is never written.
 */

import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { BOOK_CODES, isBookCode, type BookCode } from "@yada/schema";

import {
  isFramingSide,
  POSITION_STATUSES,
  POSITIONS_TO_SHOW,
  SIDE_MAX_LENGTH,
  type DebatePassage,
  type DebatePosition,
  type DebatesResponse,
  type PassageVerse,
  type PositionAction,
  type PositionStatus,
} from "../shared/api.js";
import { decisionsPath, RefusedError } from "./actions.js";

/** JHN 6:53–58 ships first, so it is reviewed first; the rest follow in canonical order. */
export const FIRST_PASSAGE_ID = "JHN.6.53-6.58";

export interface DebatesContext {
  debatesPath: string;
  coreDbPath: string;
  reviewDir: string;
  reviewer: string;
  now?: () => Date;
}

/** One line of decisions.jsonl for a debate position. */
export interface PositionDecisionRecord {
  at: string;
  kind: "debate_position";
  passage: { book: string; from: [number, number]; to: [number, number] };
  position: number;
  source: string;
  decision: "approved" | "rejected" | "undo" | "side" | "axis";
  /** The request that made it: "accept-suggestion" logs as decision "side", "accept-axis" as "axis". */
  action: PositionAction;
  status: PositionStatus;
  previous_status: PositionStatus;
  side: string | null;
  previous_side: string | null;
  axis: string | null;
  previous_axis: string | null;
  reviewer: string;
  /** Server-side only: where the sentence was taken from. Never sent to the client. */
  ref: string | null;
}

type Json = Record<string, unknown>;
type ChapterVerse = [number, number];

interface RawPosition {
  text: string;
  source: string;
  ref: string | null;
  held_by: string | null;
  check: boolean;
  status: PositionStatus;
  side: string | null;
  side_suggested: string | null;
  axis: string | null;
  axis_suggested: string | null;
}

interface RawPassage {
  id: string;
  book: BookCode;
  from: ChapterVerse;
  to: ChapterVerse;
  /** The entry object inside the parsed file, mutated in place on a decision. */
  entry: Json;
  positions: RawPosition[];
}

interface LoadedFile {
  data: Json;
  passages: RawPassage[];
}

function chapterVerse(value: unknown, label: string): ChapterVerse {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every((n) => typeof n === "number" && Number.isInteger(n) && n > 0)
  ) {
    throw new Error(`debates.json: ${label} must be [chapter, verse], got ${JSON.stringify(value)}`);
  }
  return [value[0] as number, value[1] as number];
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function passageId(book: string, from: ChapterVerse, to: ChapterVerse): string {
  return `${book}.${from[0]}.${from[1]}-${to[0]}.${to[1]}`;
}

export function displayRange(book: BookCode, from: ChapterVerse, to: ChapterVerse): string {
  // "Psalm 2:7", as formatDisplayRef writes a single psalm verse.
  const name = book === "PSA" ? "Psalm" : BOOK_CODES[book].name;
  const start = `${name} ${from[0]}:${from[1]}`;
  if (from[0] === to[0] && from[1] === to[1]) return start;
  return from[0] === to[0] ? `${start}–${to[1]}` : `${start}–${to[0]}:${to[1]}`;
}

function parsePosition(value: unknown, where: string): RawPosition {
  if (typeof value !== "object" || value === null) throw new Error(`debates.json: ${where} is not an object`);
  const p = value as Json;
  if (typeof p["text"] !== "string" || typeof p["source"] !== "string") {
    throw new Error(`debates.json: ${where} needs text and source`);
  }
  const status = p["status"];
  if (!(POSITION_STATUSES as readonly unknown[]).includes(status)) {
    throw new Error(`debates.json: ${where} has status ${JSON.stringify(status)}`);
  }
  return {
    text: p["text"],
    source: p["source"],
    ref: optionalText(p["ref"]),
    held_by: optionalText(p["held_by"]),
    check: optionalText(p["check"]) !== null,
    status: status as PositionStatus,
    side: optionalText(p["side"]),
    side_suggested: optionalText(p["side_suggested"]),
    axis: optionalText(p["axis"]),
    axis_suggested: optionalText(p["axis_suggested"]),
  };
}

function loadFile(file: string): { raw: string; loaded: LoadedFile } {
  const raw = readFileSync(file, "utf8");
  const data = JSON.parse(raw) as unknown;
  if (typeof data !== "object" || data === null || !Array.isArray((data as Json)["entries"])) {
    throw new Error(`${file} has no entries list`);
  }
  const entries = (data as Json)["entries"] as unknown[];
  const passages: RawPassage[] = [];
  const seen = new Set<string>();
  entries.forEach((value, i) => {
    if (typeof value !== "object" || value === null) return;
    const entry = value as Json;
    const positions = entry["positions"];
    // Any kind but "held" can carry positions (15 Oct 2026): a "tn-readings" or "data" passage keeps showing
    // its readings meanwhile, and the pipeline shows approved positions whatever the kind (approvedPositions).
    if (entry["kind"] === "held" || !Array.isArray(positions) || positions.length === 0) return;
    const book = entry["book"];
    if (!isBookCode(book)) throw new Error(`debates.json: entry ${i} has book ${JSON.stringify(book)}`);
    const from = chapterVerse(entry["from"], `entry ${i} from`);
    const to = chapterVerse(entry["to"], `entry ${i} to`);
    const id = passageId(book, from, to);
    // Decisions address a passage by its range, so two entries on one range would be ambiguous.
    if (seen.has(id)) throw new Error(`debates.json: two positions entries for ${id}`);
    seen.add(id);
    passages.push({
      id,
      book,
      from,
      to,
      entry,
      positions: positions.map((p, j) => parsePosition(p, `${id} position ${j}`)),
    });
  });
  passages.sort(comparePassages);
  return { raw, loaded: { data: data as Json, passages } };
}

function comparePassages(a: RawPassage, b: RawPassage): number {
  if (a.id === FIRST_PASSAGE_ID || b.id === FIRST_PASSAGE_ID) {
    return a.id === FIRST_PASSAGE_ID ? (b.id === FIRST_PASSAGE_ID ? 0 : -1) : 1;
  }
  return (
    BOOK_CODES[a.book].order - BOOK_CODES[b.book].order ||
    a.from[0] - b.from[0] ||
    a.from[1] - b.from[1] ||
    a.to[0] - b.to[0] ||
    a.to[1] - b.to[1]
  );
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Sides match whatever their spacing or case: "Sethite" and "sethite " are one side. */
export function sideKey(side: string): string {
  return side.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Distinct sides of the approved positions, first spelling kept. Untagged positions count toward none. */
export function distinctSides(positions: ReadonlyArray<{ status: PositionStatus; side: string | null }>): string[] {
  const seen = new Map<string, string>();
  for (const p of positions) {
    if (p.status !== "approved" || p.side === null) continue;
    const key = sideKey(p.side);
    if (!seen.has(key)) seen.set(key, p.side);
  }
  return [...seen.values()];
}

/**
 * The most distinct sides any one axis holds among approved positions, framing sides ("context", "lists the
 * views") left out: the number the app's rule counts. Untagged positions share the default axis.
 */
export function countingSides(
  positions: ReadonlyArray<{ status: PositionStatus; side: string | null; axis: string | null }>,
): number {
  const axes = new Map<string, Set<string>>();
  for (const p of positions) {
    if (p.status !== "approved" || p.side === null || isFramingSide(p.side)) continue;
    const axis = sideKey(p.axis ?? "");
    axes.set(axis, (axes.get(axis) ?? new Set<string>()).add(sideKey(p.side)));
  }
  return Math.max(0, ...[...axes.values()].map((sides) => sides.size));
}

/** Distinct axes set on approved positions, first spelling kept. */
export function distinctAxes(positions: ReadonlyArray<{ status: PositionStatus; axis: string | null }>): string[] {
  const seen = new Map<string, string>();
  for (const p of positions) {
    if (p.status !== "approved" || p.axis === null) continue;
    const key = sideKey(p.axis);
    if (!seen.has(key)) seen.set(key, p.axis);
  }
  return [...seen.values()];
}

export function counterText(sides: number, needsSide: number): string {
  const head =
    sides >= POSITIONS_TO_SHOW
      ? `${sides} positions approved · shows in the app`
      : `${sides} ${sides === 1 ? "position" : "positions"} · doesn't show`;
  return needsSide > 0 ? `${head} · ${needsSide} ${needsSide === 1 ? "needs" : "need"} a side` : head;
}

const RANGE_SQL = `
  SELECT v.chapter, v.verse, t.text
  FROM verses v JOIN texts t ON t.ord = v.ord AND t.translation = 'BSB'
  WHERE v.book = ?
    AND v.ord BETWEEN (SELECT ord FROM verses WHERE book = ? AND chapter = ? AND verse = ?)
                  AND (SELECT ord FROM verses WHERE book = ? AND chapter = ? AND verse = ?)
  ORDER BY v.ord`;

function readVerses(db: DatabaseSync | null, p: RawPassage): PassageVerse[] {
  if (db === null) return [];
  return db
    .prepare(RANGE_SQL)
    .all(p.book, p.book, p.from[0], p.from[1], p.book, p.to[0], p.to[1])
    .map((row) => ({ chapter: Number(row["chapter"]), verse: Number(row["verse"]), text: String(row["text"]) }));
}

/** Only the fields a reader would see. `question`, `kind`, `ref` and `note` are never copied. */
function toPassage(p: RawPassage, verses: PassageVerse[]): DebatePassage {
  const positions: DebatePosition[] = p.positions.map((raw, index) => ({
    index,
    text: raw.text,
    source: raw.source,
    held_by: raw.held_by,
    check: raw.check,
    status: raw.status,
    side: raw.side,
    side_suggested: raw.side_suggested,
    axis: raw.axis,
    axis_suggested: raw.axis_suggested,
    text_sha256: sha256(raw.text),
  }));
  const approved = positions.filter((pos) => pos.status === "approved");
  const sides = distinctSides(positions);
  const counting = countingSides(positions);
  const needsSide = approved.filter((pos) => pos.side === null).length;
  return {
    id: p.id,
    display_ref: displayRange(p.book, p.from, p.to),
    verses,
    positions,
    approved: approved.length,
    sides,
    axes: distinctAxes(positions),
    needs_side: needsSide,
    shows_in_app: counting >= POSITIONS_TO_SHOW,
    counter: counterText(counting, needsSide),
  };
}

function withCore<T>(file: string, fn: (db: DatabaseSync | null, error: string | null) => T): T {
  if (!existsSync(file)) return fn(null, `No core bundle at ${file}; set YADA_CORE_DB.`);
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return fn(db, null);
  } finally {
    db.close();
  }
}

/** The queue. Pure read: debates.json and the core bundle are opened read-only. */
export function buildDebates(ctx: DebatesContext): DebatesResponse {
  const { loaded } = loadFile(ctx.debatesPath);
  return withCore(ctx.coreDbPath, (db, error) => ({
    passages: loaded.passages.map((p) => toPassage(p, readVerses(db, p))),
    text_error: error,
  }));
}

const NEXT_STATUS: Readonly<Record<"approve" | "reject" | "undo", PositionStatus>> = {
  approve: "approved",
  reject: "rejected",
  undo: "draft",
};

const LOGGED_DECISION: Readonly<Record<PositionAction, PositionDecisionRecord["decision"]>> = {
  approve: "approved",
  reject: "rejected",
  undo: "undo",
  side: "side",
  "accept-suggestion": "side",
  axis: "axis",
  "accept-axis": "axis",
};

/** Only approve and side take a side; every request names the sentence it read and nothing else. */
const BODY_KEYS: Readonly<Record<PositionAction, readonly string[]>> = {
  approve: ["text_sha256", "side"],
  reject: ["text_sha256"],
  undo: ["text_sha256"],
  side: ["text_sha256", "side"],
  "accept-suggestion": ["text_sha256"],
  axis: ["text_sha256", "axis"],
  "accept-axis": ["text_sha256"],
};

function sideFromBody(value: unknown): string {
  if (typeof value !== "string") throw new RefusedError("Name the side this position holds.", 400);
  const side = value.trim().replace(/\s+/g, " ");
  if (side === "") throw new RefusedError("Name the side this position holds.", 400);
  if (side.length > SIDE_MAX_LENGTH) throw new RefusedError(`A side is a short label, at most ${SIDE_MAX_LENGTH} characters.`, 400);
  return side;
}

/** An empty axis returns the position to the passage's one default question. */
function axisFromBody(value: unknown): string | null {
  if (typeof value !== "string") throw new RefusedError("Name the question this position answers.", 400);
  const axis = value.trim().replace(/\s+/g, " ");
  if (axis.length > SIDE_MAX_LENGTH) throw new RefusedError(`An axis is a short label, at most ${SIDE_MAX_LENGTH} characters.`, 400);
  return axis === "" ? null : axis;
}

/** The file's own formatting: Python's json.dump(indent=1, ensure_ascii=False). */
function serialize(data: unknown, raw: string): string {
  return JSON.stringify(data, null, 1) + (raw.endsWith("\n") ? "\n" : "");
}

/**
 * One position, one decision. The body may name only the sentence it read
 * (`text_sha256`): there are no bulk actions, so anything else is refused.
 */
export function decidePosition(
  ctx: DebatesContext,
  id: string,
  indexText: string,
  action: PositionAction,
  body: Record<string, unknown>,
): DebatePassage {
  if (!/^\d+$/.test(indexText)) throw new RefusedError("One position per request.", 400);
  const extra = Object.keys(body).filter((key) => !BODY_KEYS[action].includes(key));
  if (extra.length > 0) {
    throw new RefusedError(`One position per request; unexpected ${extra.join(", ")}.`, 400);
  }

  const { raw, loaded } = loadFile(ctx.debatesPath);
  // If the file does not round-trip byte for byte, a write would reformat it; refuse instead.
  if (serialize(loaded.data, raw) !== raw) {
    throw new RefusedError(`${ctx.debatesPath} is not in json.dump(indent=1) form; not rewriting it.`, 500);
  }
  const passage = loaded.passages.find((p) => p.id === id);
  if (passage === undefined) throw new RefusedError(`No debate passage ${id}.`, 404);
  const index = Number(indexText);
  const position = passage.positions[index];
  if (position === undefined) throw new RefusedError(`${id} has no position ${index}.`, 404);

  // The sentence decided on must be the sentence on screen, as with payload_sha256 for entries.
  const seen = body["text_sha256"];
  if (typeof seen !== "string") throw new RefusedError("The request does not say which sentence was read.", 400);
  if (seen !== sha256(position.text)) {
    throw new RefusedError(`${id} position ${index} changed after it was loaded. Reload and read it again.`, 409);
  }

  let next = position.status;
  let side = position.side;
  let axis = position.axis;
  if (action === "axis" || action === "accept-axis") {
    if (position.status !== "approved") throw new RefusedError(`${id} position ${index} is not approved; approve it first.`, 409);
    if (action === "axis") axis = axisFromBody(body["axis"]);
    else if (position.axis_suggested === null) throw new RefusedError(`${id} position ${index} has no suggested axis.`, 409);
    else axis = axisFromBody(position.axis_suggested);
    if (position.axis === axis) throw new RefusedError(`${id} position ${index} is already on that axis.`, 409);
  } else if (action === "side" || action === "accept-suggestion") {
    if (position.status !== "approved") throw new RefusedError(`${id} position ${index} is not approved; approve it with a side.`, 409);
    if (action === "side") side = sideFromBody(body["side"]);
    else if (position.side_suggested === null) throw new RefusedError(`${id} position ${index} has no suggested side.`, 409);
    else side = sideFromBody(position.side_suggested);
    if (position.side === side) throw new RefusedError(`${id} position ${index} is already on side "${side}".`, 409);
  } else {
    next = NEXT_STATUS[action];
    if (position.status === next) {
      throw new RefusedError(`${id} position ${index} is already ${next}.`, 409);
    }
    // A side and an axis belong to an approved position: approving needs a side, and leaving approved drops both.
    side = action === "approve" ? sideFromBody(body["side"]) : null;
    if (action !== "approve") axis = null;
  }

  const stored = (passage.entry["positions"] as Json[])[index] as Json;
  stored["status"] = next;
  if (side === null) delete stored["side"];
  else stored["side"] = side;
  // Once John names a side, the machine suggestion has done its job.
  if (side !== null) delete stored["side_suggested"];
  if (axis === null) delete stored["axis"];
  else stored["axis"] = axis;
  // An axis decision settles the suggestion either way, even a return to the default axis.
  if (action === "axis" || action === "accept-axis") delete stored["axis_suggested"];

  const line: PositionDecisionRecord = {
    at: (ctx.now?.() ?? new Date()).toISOString(),
    kind: "debate_position",
    passage: { book: passage.book, from: passage.from, to: passage.to },
    position: index,
    source: position.source,
    decision: LOGGED_DECISION[action],
    action,
    status: next,
    previous_status: position.status,
    side,
    previous_side: position.side,
    axis,
    previous_axis: position.axis,
    reviewer: ctx.reviewer,
    ref: position.ref,
  };

  // Temp file in the same directory, then rename: a crash leaves either the old
  // file or the new one, never half of one. The log line goes in before the
  // rename, so the file never holds a decision the log lacks (README, Durability).
  const temp = path.join(
    path.dirname(ctx.debatesPath),
    `.${path.basename(ctx.debatesPath)}.${randomBytes(6).toString("hex")}.tmp`,
  );
  writeFileSync(temp, serialize(loaded.data, raw), "utf8");
  try {
    mkdirSync(ctx.reviewDir, { recursive: true });
    appendFileSync(decisionsPath(ctx.reviewDir), `${JSON.stringify(line)}\n`, "utf8");
    renameSync(temp, ctx.debatesPath);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }

  position.status = next;
  position.side = side;
  if (side !== null) position.side_suggested = null;
  position.axis = axis;
  if (action === "axis" || action === "accept-axis") position.axis_suggested = null;
  return withCore(ctx.coreDbPath, (db) => toPassage(passage, readVerses(db, passage)));
}
