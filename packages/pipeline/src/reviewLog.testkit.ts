import { readFileSync } from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "./paths.js";

export interface LoggedDecision {
  decision: string;
  reviewer: string;
  text_sha256: string;
}

/**
 * The review tool's last logged decision per item of one Extracts kind, from review/decisions.jsonl
 * (packages/review/src/server/extracts.ts writes it). Tests hold each approved entry to it (rule 2).
 */
export function lastDecisions(extract: "book_intro" | "grammar"): Map<string, LoggedDecision> {
  const out = new Map<string, LoggedDecision>();
  for (const line of readFileSync(path.join(REPO_ROOT, "review", "decisions.jsonl"), "utf8").split("\n")) {
    if (line.trim() === "") continue;
    const r = JSON.parse(line) as Record<string, unknown>;
    if (r["kind"] !== "extract" || r["extract"] !== extract || typeof r["id"] !== "string") continue;
    out.set(r["id"], { decision: String(r["decision"]), reviewer: String(r["reviewer"]), text_sha256: String(r["text_sha256"]) });
  }
  return out;
}
