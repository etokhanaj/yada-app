/**
 * The JSON contract between the review server and its client.
 *
 * Types plus a few constants and nothing that touches Node or the DOM, so both
 * sides import it directly and cannot drift apart.
 */

import type { Finding, VerseEntry } from "@yada/schema";

/** Queues John works through. Order is the order they are worked. */
export const REVIEW_QUEUES = [
  "flagged",
  "adversary_disagreement",
  "random_sample",
  "targeted_expert",
] as const;

export type ReviewQueue = (typeof REVIEW_QUEUES)[number];

export function isReviewQueue(value: unknown): value is ReviewQueue {
  return typeof value === "string" && (REVIEW_QUEUES as readonly string[]).includes(value);
}

export const QUEUE_LABELS: Readonly<Record<ReviewQueue, string>> = {
  flagged: "Flagged",
  adversary_disagreement: "Adversary disagreements",
  random_sample: "Random sample per book",
  targeted_expert: "Targeted expert",
};

/**
 * The adversary contract. Another agent writes `adversary_flags`; these are the
 * values it promises. Rows are still read as plain strings, so an unexpected
 * value shows up in review rather than disappearing.
 */
export const ADVERSARY_VERDICTS = [
  "upheld",
  "unsupported",
  "miscategorised",
  "compound",
  "overclaimed",
] as const;
export type AdversaryVerdict = (typeof ADVERSARY_VERDICTS)[number];

export const ADVERSARY_SEVERITIES = ["critical", "minor", "none"] as const;
export type AdversarySeverity = (typeof ADVERSARY_SEVERITIES)[number];

export interface AdversaryFlag {
  verse_id: string;
  claim_id: string;
  verdict: string;
  severity: string;
  note: string | null;
  model: string;
  created_at: string;
}

export const DECISIONS = ["approved", "rejected"] as const;
export type Decision = (typeof DECISIONS)[number];

/** PRD 0C: nothing is approved below this rating. */
export const APPROVAL_MIN_RATING = 4;

/** The app's first-screen caps, per display group (apps/mobile Understand.tsx). */
export const FIRST_SCREEN_CAP = {
  what_we_can_see: 3,
  where_interpretation_differs: 2,
} as const;

/** One `review_state` row. A verse with no row reads as flagged. */
export interface ReviewState {
  verse_id: string;
  status: string;
  decision: string | null;
  rating: number | null;
  reason: string | null;
  updated_at: string | null;
}

export type TargetReasonKind =
  | "debated_claim"
  | "model_knowledge_claim"
  | "translation_note"
  | "related_passage"
  | "critical_adversary_flag";

/** Why the targeted-expert queue picked an entry. One per trigger. */
export interface TargetReason {
  kind: TargetReasonKind;
  claim_id: string | null;
  ref: string | null;
  detail: string;
}

export interface AdversarySummary {
  /** Rows whose verdict is not `upheld`. */
  disagreements: number;
  critical: number;
  minor: number;
  /** Worst severity among the disagreements. */
  worst: string;
}

export interface QueueItem {
  verse_id: string;
  display_ref: string;
  status: string;
  decision: string | null;
  rating: number | null;
  reasons: TargetReason[];
  adversary: AdversarySummary | null;
}

export interface SampleInfo {
  seed: string;
  rate: number;
  books: Array<{ book: string; total: number; sampled: number }>;
}

export interface QueueResponse {
  queue: ReviewQueue;
  items: QueueItem[];
  sample: SampleInfo | null;
}

export interface MetaResponse {
  db_path: string;
  review_dir: string;
  reviewer: string;
  sample: { seed: string; rate: number };
  counts: Record<ReviewQueue, number>;
  total_entries: number;
}

export interface VerseText {
  translation: string;
  text: string;
}

export interface EntryResponse {
  verse_id: string;
  display_ref: string;
  script: "greek" | "hebrew";
  pericope_id: string;
  schema_version: string;
  prompt_version: string;
  state: ReviewState;
  /** sha256 of the stored payload; an approval names it to say which text was read. */
  payload_sha256: string;
  /** Null when the stored payload does not parse under the current schema. */
  entry: VerseEntry | null;
  parse_issues: string[];
  payload: unknown;
  texts: VerseText[];
  /** `validateVerseEntry` output. Empty when the entry did not parse. */
  findings: Finding[];
  adversary_flags: AdversaryFlag[];
  /** Targeted-expert triggers, whether or not that queue is the one open. */
  reasons: TargetReason[];
}

export interface DecisionRequest {
  rating?: number | null;
  reason?: string | null;
  queue?: ReviewQueue | null;
  /** The `payload_sha256` of the entry on screen. Required to approve. */
  payload_sha256?: string | null;
}

export interface DecisionResponse {
  state: ReviewState;
  logged_to: string;
}

export interface ErrorResponse {
  error: string;
}
