/**
 * @yada/review — John's local review tool over staging.db (build plan §5).
 *
 * The server lives in src/server, the React client in src/client, and the
 * contract between them in src/shared/api.ts. See README.md.
 */

import type { ReviewStatus } from "@yada/schema";

export * from "./shared/api.js";

/** Nothing ships below these statuses; see build plan §5. */
export const SHIPPABLE_STATUSES: readonly ReviewStatus[] = [
  "auto_passed",
  "human_reviewed",
  "expert_reviewed",
];
