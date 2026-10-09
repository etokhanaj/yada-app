/**
 * The four review queues (build plan §5, PRD §11.7) and the per-entry view.
 *
 * Pure reads over staging.db. Queue membership never depends on wall-clock
 * time or randomness at call time: the sample is seeded, and every ordering
 * ends in canonical verse order so ties are stable.
 */

import { createHash } from "node:crypto";

import {
  BOOK_CODES,
  compareVerseRefs,
  formatDisplayRef,
  isBookCode,
  parseVerseId,
  validateVerseEntry,
  VerseEntrySchema,
  type VerseEntry,
} from "@yada/schema";

import type {
  AdversaryFlag,
  AdversarySummary,
  EntryResponse,
  QueueItem,
  QueueResponse,
  ReviewQueue,
  ReviewState,
  SampleInfo,
  TargetReason,
  VerseText,
} from "../shared/api.js";
import { REVIEW_QUEUES } from "../shared/api.js";
import { intOrNull, tableExists, text, textOrNull, type Db, type Row } from "./db.js";

/** A verse with no review_state row reads as flagged, exactly as bundle packaging treats it. */
export const MISSING_STATE_STATUS = "flagged";

export interface StoredEntry {
  verse_id: string;
  pericope_id: string;
  schema_version: string;
  prompt_version: string;
  payload: string;
  state: ReviewState;
}

const ENTRY_SELECT = `
  SELECT e.verse_id, e.pericope_id, e.schema_version, e.prompt_version, e.payload,
         r.status, r.decision, r.rating, r.reason, r.updated_at
  FROM entries e LEFT JOIN review_state r ON r.verse_id = e.verse_id`;

function toStored(row: Row): StoredEntry {
  const verseId = text(row, "verse_id");
  return {
    verse_id: verseId,
    pericope_id: text(row, "pericope_id"),
    schema_version: text(row, "schema_version"),
    prompt_version: text(row, "prompt_version"),
    payload: text(row, "payload"),
    state: {
      verse_id: verseId,
      status: textOrNull(row, "status") ?? MISSING_STATE_STATUS,
      decision: textOrNull(row, "decision"),
      rating: intOrNull(row, "rating"),
      reason: textOrNull(row, "reason"),
      updated_at: textOrNull(row, "updated_at"),
    },
  };
}

/** Canonical book/chapter/verse order; unparseable ids sort last, lexically. */
export function canonicalOrder(a: string, b: string): number {
  const left = parseVerseId(a);
  const right = parseVerseId(b);
  if (left !== null && right !== null) return compareVerseRefs(left, right);
  if (left !== null) return -1;
  if (right !== null) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function loadEntries(db: Db): StoredEntry[] {
  return db
    .prepare(ENTRY_SELECT)
    .all()
    .map(toStored)
    .sort((a, b) => canonicalOrder(a.verse_id, b.verse_id));
}

export function loadEntry(db: Db, verseId: string): StoredEntry | null {
  const row = db.prepare(`${ENTRY_SELECT} WHERE e.verse_id = ?`).get(verseId);
  return row === undefined ? null : toStored(row);
}

export function displayRef(verseId: string): string {
  const ref = parseVerseId(verseId);
  return ref === null ? verseId : formatDisplayRef(ref);
}

export function bookOf(verseId: string): string {
  return parseVerseId(verseId)?.book ?? verseId.split(".")[0] ?? verseId;
}

export function scriptOf(verseId: string): "greek" | "hebrew" {
  const ref = parseVerseId(verseId);
  return ref !== null && BOOK_CODES[ref.book].testament === "OT" ? "hebrew" : "greek";
}

// ---------------------------------------------------------------------------
// Payload parsing
// ---------------------------------------------------------------------------

export interface ParsedPayload {
  entry: VerseEntry | null;
  payload: unknown;
  issues: string[];
}

export function payloadDigest(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export function parsePayload(payload: string): ParsedPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(payload) as unknown;
  } catch (error) {
    return { entry: null, payload, issues: [`payload is not JSON: ${(error as Error).message}`] };
  }
  const result = VerseEntrySchema.safeParse(raw);
  if (result.success) return { entry: result.data, payload: raw, issues: [] };
  return {
    entry: null,
    payload: raw,
    issues: result.error.issues.map(
      (issue) => `${issue.path.length === 0 ? "(root)" : issue.path.join(".")}: ${issue.message}`,
    ),
  };
}

// ---------------------------------------------------------------------------
// Adversary flags
// ---------------------------------------------------------------------------

export function loadAdversaryFlags(db: Db, verseId?: string): AdversaryFlag[] {
  if (!tableExists(db, "adversary_flags")) return [];
  const sql = `SELECT verse_id, claim_id, verdict, severity, note, model, created_at
               FROM adversary_flags ${verseId === undefined ? "" : "WHERE verse_id = ?"}
               ORDER BY verse_id, claim_id, model`;
  const rows = verseId === undefined ? db.prepare(sql).all() : db.prepare(sql).all(verseId);
  return rows.map((row) => ({
    verse_id: text(row, "verse_id"),
    claim_id: text(row, "claim_id"),
    verdict: text(row, "verdict"),
    severity: text(row, "severity"),
    note: textOrNull(row, "note"),
    model: text(row, "model"),
    created_at: text(row, "created_at"),
  }));
}

const SEVERITY_RANK: Readonly<Record<string, number>> = { critical: 0, minor: 1, none: 2 };

/** Unknown severities rank after `none`, so they are visible but never jump the queue. */
export function severityRank(severity: string): number {
  return SEVERITY_RANK[severity] ?? 3;
}

export function isDisagreement(flag: AdversaryFlag): boolean {
  return flag.verdict !== "upheld";
}

export function summarizeDisagreements(flags: readonly AdversaryFlag[]): AdversarySummary | null {
  const disagreements = flags.filter(isDisagreement);
  if (disagreements.length === 0) return null;
  const worst = [...disagreements].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))[0];
  return {
    disagreements: disagreements.length,
    critical: disagreements.filter((f) => f.severity === "critical").length,
    minor: disagreements.filter((f) => f.severity === "minor").length,
    worst: worst?.severity ?? "none",
  };
}

// ---------------------------------------------------------------------------
// Targeted expert selection
// ---------------------------------------------------------------------------

const TARGETED_RELATIONSHIPS: ReadonlySet<string> = new Set(["quotation", "allusion", "fulfillment"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Why an entry needs an expert. Reads the raw payload rather than the parsed
 * entry, so an entry that no longer parses under the current schema is still
 * routed on what it says, and so the queue does not run Zod over the corpus.
 *
 * A critical adversary flag counts whatever its verdict: a critical severity
 * on an `upheld` verdict is contradictory, and a contradiction is exactly what
 * an expert should see.
 */
export function targetedReasons(payload: unknown, flags: readonly AdversaryFlag[]): TargetReason[] {
  const reasons: TargetReason[] = [];
  if (isRecord(payload)) {
    for (const claim of records(payload["claims"])) {
      const id = str(claim["id"]) ?? "(claim without id)";
      if (claim["category"] === "debated") {
        reasons.push({ kind: "debated_claim", claim_id: id, ref: null, detail: `${id} is a debated claim` });
      }
      if (claim["grounding"] === "model_knowledge") {
        reasons.push({
          kind: "model_knowledge_claim",
          claim_id: id,
          ref: null,
          detail: `${id} is grounded in model knowledge, not supplied source data`,
        });
      }
    }
    if (payload["translation_note"] !== undefined) {
      reasons.push({
        kind: "translation_note",
        claim_id: null,
        ref: null,
        detail: "carries a translation note",
      });
    }
    for (const related of records(payload["related_passages"])) {
      const relationship = str(related["relationship"]);
      if (relationship !== null && TARGETED_RELATIONSHIPS.has(relationship)) {
        const ref = str(related["ref"]) ?? "(no ref)";
        reasons.push({
          kind: "related_passage",
          claim_id: null,
          ref,
          detail: `related passage ${ref} is marked ${relationship}`,
        });
      }
    }
  }
  for (const flag of flags) {
    if (flag.severity !== "critical") continue;
    reasons.push({
      kind: "critical_adversary_flag",
      claim_id: flag.claim_id,
      ref: null,
      detail: `${flag.model} judged ${flag.claim_id} ${flag.verdict}, severity critical`,
    });
  }
  return reasons;
}

function payloadOrNull(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-book random sample
// ---------------------------------------------------------------------------

/** Deterministic rank: sha256 of seed and verse id. */
export function sampleRank(seed: string, verseId: string): string {
  return createHash("sha256").update(`${seed} ${verseId}`).digest("hex");
}

export function sampleSize(total: number, rate: number): number {
  return total === 0 ? 0 : Math.max(1, Math.ceil(total * rate));
}

/**
 * Within each book, rank verses by `sampleRank` and take the first
 * `sampleSize`. Insertion order, load order and the rest of the corpus do not
 * affect a book's sample; only its own verse ids and the seed do.
 */
export function selectSample(
  verseIds: readonly string[],
  seed: string,
  rate: number,
): { selected: Set<string>; books: SampleInfo["books"] } {
  const byBook = new Map<string, string[]>();
  for (const id of verseIds) {
    const book = bookOf(id);
    const list = byBook.get(book) ?? [];
    list.push(id);
    byBook.set(book, list);
  }

  const selected = new Set<string>();
  const books: SampleInfo["books"] = [];
  for (const [book, ids] of byBook) {
    const ranked = ids
      .map((id) => ({ id, rank: sampleRank(seed, id) }))
      .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
    const size = sampleSize(ids.length, rate);
    for (const { id } of ranked.slice(0, size)) selected.add(id);
    books.push({ book, total: ids.length, sampled: size });
  }

  const order = (book: string): number => (isBookCode(book) ? BOOK_CODES[book].order : Number.MAX_SAFE_INTEGER);
  books.sort((a, b) => order(a.book) - order(b.book));
  return { selected, books };
}

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------

export interface QueueOptions {
  sampleSeed: string;
  sampleRate: number;
}

interface QueueData {
  entries: StoredEntry[];
  flagsByVerse: Map<string, AdversaryFlag[]>;
}

function loadQueueData(db: Db): QueueData {
  const flagsByVerse = new Map<string, AdversaryFlag[]>();
  for (const flag of loadAdversaryFlags(db)) {
    const list = flagsByVerse.get(flag.verse_id) ?? [];
    list.push(flag);
    flagsByVerse.set(flag.verse_id, list);
  }
  return { entries: loadEntries(db), flagsByVerse };
}

function toItem(
  stored: StoredEntry,
  reasons: TargetReason[] = [],
  adversary: AdversarySummary | null = null,
): QueueItem {
  return {
    verse_id: stored.verse_id,
    display_ref: displayRef(stored.verse_id),
    status: stored.state.status,
    decision: stored.state.decision,
    rating: stored.state.rating,
    reasons,
    adversary,
  };
}

function queueFrom(data: QueueData, queue: ReviewQueue, options: QueueOptions): QueueResponse {
  switch (queue) {
    case "flagged":
      return {
        queue,
        items: data.entries.filter((e) => e.state.status === "flagged").map((e) => toItem(e)),
        sample: null,
      };

    case "random_sample": {
      const { selected, books } = selectSample(
        data.entries.map((e) => e.verse_id),
        options.sampleSeed,
        options.sampleRate,
      );
      return {
        queue,
        items: data.entries.filter((e) => selected.has(e.verse_id)).map((e) => toItem(e)),
        sample: { seed: options.sampleSeed, rate: options.sampleRate, books },
      };
    }

    case "adversary_disagreement": {
      const items: QueueItem[] = [];
      for (const stored of data.entries) {
        const summary = summarizeDisagreements(data.flagsByVerse.get(stored.verse_id) ?? []);
        if (summary !== null) items.push(toItem(stored, [], summary));
      }
      // Critical first; then more critical rows, then more disagreements; then verse order.
      items.sort((a, b) => {
        const left = a.adversary as AdversarySummary;
        const right = b.adversary as AdversarySummary;
        return (
          severityRank(left.worst) - severityRank(right.worst) ||
          right.critical - left.critical ||
          right.disagreements - left.disagreements ||
          canonicalOrder(a.verse_id, b.verse_id)
        );
      });
      return { queue, items, sample: null };
    }

    case "targeted_expert": {
      const items: QueueItem[] = [];
      for (const stored of data.entries) {
        const reasons = targetedReasons(
          payloadOrNull(stored.payload),
          data.flagsByVerse.get(stored.verse_id) ?? [],
        );
        if (reasons.length > 0) items.push(toItem(stored, reasons));
      }
      return { queue, items, sample: null };
    }
  }
}

export function buildQueue(db: Db, queue: ReviewQueue, options: QueueOptions): QueueResponse {
  return queueFrom(loadQueueData(db), queue, options);
}

export function queueCounts(
  db: Db,
  options: QueueOptions,
): { counts: Record<ReviewQueue, number>; total: number } {
  const data = loadQueueData(db);
  const counts = Object.fromEntries(
    REVIEW_QUEUES.map((queue) => [queue, queueFrom(data, queue, options).items.length]),
  ) as Record<ReviewQueue, number>;
  return { counts, total: data.entries.length };
}

// ---------------------------------------------------------------------------
// Entry view
// ---------------------------------------------------------------------------

const TRANSLATION_ORDER = ["BSB", "WEB", "KJV"];

function translationRank(translation: string): number {
  const index = TRANSLATION_ORDER.indexOf(translation);
  return index === -1 ? TRANSLATION_ORDER.length : index;
}

export function loadTexts(db: Db, verseId: string): VerseText[] {
  if (!tableExists(db, "texts")) return [];
  return db
    .prepare("SELECT translation, text FROM texts WHERE verse_id = ?")
    .all(verseId)
    .map((row) => ({ translation: text(row, "translation"), text: text(row, "text") }))
    .sort(
      (a, b) =>
        translationRank(a.translation) - translationRank(b.translation) ||
        (a.translation < b.translation ? -1 : 1),
    );
}

export function buildEntry(db: Db, verseId: string): EntryResponse | null {
  const stored = loadEntry(db, verseId);
  if (stored === null) return null;
  const parsed = parsePayload(stored.payload);
  const flags = loadAdversaryFlags(db, verseId);
  return {
    verse_id: stored.verse_id,
    display_ref: displayRef(stored.verse_id),
    script: scriptOf(stored.verse_id),
    pericope_id: stored.pericope_id,
    schema_version: stored.schema_version,
    prompt_version: stored.prompt_version,
    state: stored.state,
    payload_sha256: payloadDigest(stored.payload),
    entry: parsed.entry,
    parse_issues: parsed.issues,
    payload: parsed.payload,
    texts: loadTexts(db, verseId),
    findings: parsed.entry === null ? [] : validateVerseEntry(parsed.entry),
    adversary_flags: flags,
    reasons: targetedReasons(parsed.payload, flags),
  };
}
