/**
 * @yada/review — STUB.
 *
 * Will become the local Vite + React review app over staging.db (build plan
 * §5): flagged queue, per-book random sample, adversary disagreements,
 * targeted expert selection, approve / reject-with-reason / rate 1-5.
 */

import type { ReviewStatus } from "@yada/schema";

/** Queues John works through. Order is the order they are worked. */
export const REVIEW_QUEUES = [
  "flagged",
  "adversary_disagreement",
  "random_sample",
  "targeted_expert",
] as const;

export type ReviewQueue = (typeof REVIEW_QUEUES)[number];

/** Nothing ships below these statuses; see build plan §5. */
export const SHIPPABLE_STATUSES: readonly ReviewStatus[] = [
  "auto_passed",
  "human_reviewed",
  "expert_reviewed",
];
