/**
 * Writing entries into staging.db, with their review state.
 *
 * Two callers: `yada import-golden`, which loads the hand-authored fixtures so
 * the review tool and the app have real content before any generation, and the
 * generation ingest path, which stores model output. Both go through the same
 * function so a fixture and a generated entry are indistinguishable downstream
 * except by their review status — which is the one thing that must differ.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  VerseEntrySchema,
  hasErrors,
  validateVerseEntry,
  type ReviewStatus,
  type VerseEntry,
} from "@yada/schema";

import { openStaging } from "./db.js";
import { GOLDEN } from "./paths.js";

type Db = ReturnType<typeof openStaging>;

export function storeVerseEntry(db: Db, entry: VerseEntry, status: ReviewStatus, reason?: string): void {
  db.prepare(
    `INSERT OR REPLACE INTO entries (verse_id, pericope_id, schema_version, prompt_version, payload)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(entry.verse_id, entry.pericope_id, entry.schema_version, entry.prompt_version, JSON.stringify(entry));

  // An existing review decision is kept when the status is unchanged, so
  // re-importing does not wipe a rating or a rejection reason.
  const existing = db.prepare("SELECT status FROM review_state WHERE verse_id = ?").get(entry.verse_id) as
    | { status?: string }
    | undefined;
  if (existing?.status !== status) {
    db.prepare(
      `INSERT OR REPLACE INTO review_state (verse_id, status, rating, reason, updated_at)
       VALUES (?, ?, NULL, ?, ?)`,
    ).run(entry.verse_id, status, reason ?? null, new Date().toISOString());
  }
}

export interface ImportReport {
  imported: string[];
  rejected: Array<{ file: string; problem: string }>;
}

/**
 * Load the golden fixtures as flagged entries.
 *
 * Every fixture is `flagged`: none has been reviewed by a human. Importing them
 * does not promote them, and a fixture claiming a human review is refused
 * rather than trusted — the seed fixture spent four sessions wrongly marked
 * human_reviewed, and this import is exactly where that label would have
 * propagated into a shipped bundle.
 */
export function importGolden(dir: string = GOLDEN): ImportReport {
  const report: ImportReport = { imported: [], rejected: [] };
  const db = openStaging();
  db.exec("BEGIN");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const raw = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as unknown;
    const parsed = VerseEntrySchema.safeParse(raw);
    if (!parsed.success) {
      report.rejected.push({ file, problem: parsed.error.issues[0]?.message ?? "schema" });
      continue;
    }
    const findings = validateVerseEntry(parsed.data);
    if (hasErrors(findings)) {
      report.rejected.push({ file, problem: findings.map((f) => f.rule).join(", ") });
      continue;
    }
    const status = parsed.data.review.status;
    if (status === "human_reviewed" || status === "expert_reviewed") {
      report.rejected.push({
        file,
        problem: `claims ${status}; fixtures are hand-authored and unreviewed, so refusing rather than trusting the label`,
      });
      continue;
    }
    storeVerseEntry(db, parsed.data, status, "imported from golden/");
    report.imported.push(parsed.data.verse_id);
  }
  db.exec("COMMIT");
  db.close();
  return report;
}
