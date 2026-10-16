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
  "omitted_qualifier",
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

// ---------------------------------------------------------------------------
// Debate positions (packages/pipeline/prototypes/data/debates.json)
//
// The payload carries only what a reader would see, plus the counter. The
// entry's `question` and `kind`, each position's `ref` and `note`, and any
// working notes stay on the server: John judges the sentence the app would show.
// ---------------------------------------------------------------------------

export const POSITION_STATUSES = ["draft", "approved", "rejected"] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

/**
 * "side" tags or retags an approved position's view; "accept-suggestion" makes its machine-written
 * `side_suggested` the side. "axis" and "accept-axis" do the same for the question it answers, where a
 * passage asks two (Hosea 1:2). A suggestion never counts until John accepts it (rule 2).
 */
export const POSITION_ACTIONS = ["approve", "reject", "undo", "side", "accept-suggestion", "axis", "accept-axis"] as const;
export type PositionAction = (typeof POSITION_ACTIONS)[number];

/** An Extracts item takes only these: no sides, axes or suggestions, which are for debate positions. */
export const EXTRACT_ACTIONS = ["approve", "reject", "undo"] as const;
export type ExtractAction = (typeof EXTRACT_ACTIONS)[number];
export function isExtractAction(value: unknown): value is ExtractAction {
  return typeof value === "string" && (EXTRACT_ACTIONS as readonly string[]).includes(value);
}

export function isPositionAction(value: unknown): value is PositionAction {
  return typeof value === "string" && (POSITION_ACTIONS as readonly string[]).includes(value);
}

/**
 * The app shows a passage's positions only once approved positions on one axis hold this many distinct sides
 * that are not framing (John, 15 Oct 2026): two approved sentences on one side (1 Corinthians 11:2–16), a
 * "context" or "lists the views" side, or answers to two different questions (Hosea 1:2) are not two positions.
 */
export const POSITIONS_TO_SHOW = 2;

/** A side is a short internal label for the view a position holds ("Sethite", "royal"); never shown in the app. */
export const SIDE_MAX_LENGTH = 40;

/** A framing side frames the question without holding a view: it never makes a passage show. */
export function isFramingSide(side: string): boolean {
  const key = side.trim().replace(/\s+/g, " ").toLowerCase();
  return key === "context" || key.startsWith("lists");
}

export const CHECK_NOTE = "Check against a page scan before shipping";

export interface DebatePosition {
  index: number;
  text: string;
  source: string;
  held_by: string | null;
  /** The sentence still needs checking against a page scan. Never blocks approval. */
  check: boolean;
  status: PositionStatus;
  /** The view this approved position holds, set by John. Null until tagged; only approved positions carry one. */
  side: string | null;
  /** A machine-written side to accept or replace. Not a side until John accepts it. */
  side_suggested: string | null;
  /** The question this approved position answers, set by John. Null is the passage's one default question. */
  axis: string | null;
  /** A machine-written axis to accept or replace. Not an axis until John accepts it. */
  axis_suggested: string | null;
  /** sha256 of `text`; a decision names it to say which sentence was read. */
  text_sha256: string;
}

export interface PassageVerse {
  chapter: number;
  verse: number;
  text: string;
}

export interface DebatePassage {
  /** `BOOK.c.v-c.v`, the passage's address in the API. */
  id: string;
  display_ref: string;
  /** BSB, in order. Empty when the core bundle has no text for the range. */
  verses: PassageVerse[];
  positions: DebatePosition[];
  approved: number;
  /** Distinct sides among approved positions, in first-seen order. */
  sides: string[];
  /** Distinct axes set on approved positions, in first-seen order. */
  axes: string[];
  /** Approved positions with no side yet: they count toward no side. */
  needs_side: number;
  shows_in_app: boolean;
  /** For example "2 positions approved · shows in the app" or "1 position · doesn't show". */
  counter: string;
}

export interface DebatesResponse {
  passages: DebatePassage[];
  /** Why there is no BSB text, when the core bundle could not be read. */
  text_error: string | null;
}

export interface PositionDecisionRequest {
  text_sha256: string;
  /** Required to approve and to tag a side; refused on every other action. */
  side?: string;
  /** Required by "axis"; an empty string returns the position to the default axis. */
  axis?: string;
}

export interface PositionDecisionResponse {
  passage: DebatePassage;
  logged_to: string;
}

// ---------------------------------------------------------------------------
// Passage summaries (packages/pipeline/prototypes/data/passage_reviews.json)
//
// Each summary is built by rule from published sources, and the gate hides the
// ones it flags. John says yes or no to the text as built; he never edits it
// (rule 2). An approval names the sha256 of the text he read, and the pipeline
// shows the summary only while its text still has that hash. "Needs a fix" holds
// a summary whose facts are right but whose sentences need a pipeline change; its
// note is the pipeline session's work list and never reaches the app.
// ---------------------------------------------------------------------------

export const SUMMARY_ACTIONS = ["approve", "reject", "fix"] as const;
export type SummaryAction = (typeof SUMMARY_ACTIONS)[number];

export function isSummaryAction(value: unknown): value is SummaryAction {
  return typeof value === "string" && (SUMMARY_ACTIONS as readonly string[]).includes(value);
}

/** What John's reject writes as the hold's reason. */
export const REJECTED_REASON = "rejected by John";

/** What "Needs a fix" writes as the hold's reason; the note goes in its own `fix` field. */
export const FIX_REASON = "needs a fix";

/** The longest note "Needs a fix" takes. */
export const FIX_NOTE_MAX = 500;

/**
 * Where a summary stands in passage_reviews.json:
 * - `pending`: no decision.
 * - `approved`: approved, and the text is the one John read, so it shows.
 * - `changed`: approved, but the text has changed since, so it is hidden again.
 * - `held`: hidden by hand.
 * - `fix`: held for a pipeline fix, and the text is still the one the note was about.
 * - `fix_changed`: held for a fix, but the text has changed since the note (a fix landed): undecided again.
 */
export type SummaryStatus = "pending" | "approved" | "changed" | "held" | "fix" | "fix_changed";

export interface SummaryItem {
  /** The passage id, `BOOK.c.v-c.v`. */
  id: string;
  label: string;
  range: string;
  text: string;
  /** The gate's flags, before any hand decision. */
  flags: string[];
  status: SummaryStatus;
  /** The hold's reason, when held. */
  reason: string | null;
  /** The "Needs a fix" note, when held for a fix. */
  fix: string | null;
  /** False where passage_reviews.json is never read (no candidate sentences, Psalms, Proverbs): no decision is offered. */
  reviewable: boolean;
  /** sha256 of `text`; a decision names it to say which text was read. */
  text_sha256: string;
  verses: PassageVerse[];
}

export type SummariesResponse =
  | { state: "loading" }
  | { state: "error"; error: string }
  | { state: "ready"; items: SummaryItem[] };

export interface SummaryDecisionRequest {
  text_sha256: string;
  /** Required for "fix", refused otherwise. */
  note?: string;
}

export interface SummaryDecisionResponse {
  item: SummaryItem;
  logged_to: string;
}

// ---------------------------------------------------------------------------
// Extracts (build 6): book introductions (book_intros.json) and grammar terms (grammar.json), each a
// source's own words cut by rule. John checks each against the paragraph it was cut from and approves
// or rejects it; nothing is edited here. Only approved text reaches the app (rule 2).
// ---------------------------------------------------------------------------

// Build 7a adds samples of the daily texts: Spurgeon's entries and the Daily Light references.
export const EXTRACT_KINDS = ["book_intro", "grammar", "devotional", "daily_light"] as const;
export type ExtractKind = (typeof EXTRACT_KINDS)[number];

export function isExtractKind(value: unknown): value is ExtractKind {
  return typeof value === "string" && (EXTRACT_KINDS as readonly string[]).includes(value);
}

export interface ExtractItem {
  kind: ExtractKind;
  /** The book code, or the grammar key ("greek:aorist"). */
  id: string;
  /** "Romans", or "Greek · aorist". */
  title: string;
  /** What the app would show. */
  text: string;
  /** The paragraph it was cut from, to check the cut against. */
  context: string;
  /** Where it came from, and anything John should know (a weak opening, an unfinished article). */
  ref: string;
  note: string | null;
  status: PositionStatus;
  text_sha256: string;
}

export interface ExtractGroup {
  kind: ExtractKind;
  title: string;
  items: ExtractItem[];
  approved: number;
}

export interface ExtractsResponse {
  groups: ExtractGroup[];
}

export interface ExtractDecisionResponse {
  item: ExtractItem;
  logged_to: string;
}
