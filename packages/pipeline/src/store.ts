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

/** True when the stored content is new or changed; false when it was already there verbatim. */
export function storeVerseEntry(db: Db, entry: VerseEntry, status: ReviewStatus, reason?: string): boolean {
  const payload = JSON.stringify(entry);
  const previous = db.prepare("SELECT payload FROM entries WHERE verse_id = ?").get(entry.verse_id) as
    | { payload?: string }
    | undefined;

  db.prepare(
    `INSERT OR REPLACE INTO entries (verse_id, pericope_id, schema_version, prompt_version, payload)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(entry.verse_id, entry.pericope_id, entry.schema_version, entry.prompt_version, payload);

  // A review judged specific content. Re-storing identical content must leave
  // that judgment alone — the first version of this function compared statuses
  // instead, so re-importing a fixture as `flagged` silently wiped a human
  // approval. Changed content is the opposite case: the approval was for text
  // that no longer exists, so the entry goes back to review, on purpose and
  // with the reason recorded.
  const existing = db.prepare("SELECT status FROM review_state WHERE verse_id = ?").get(entry.verse_id) as
    | { status?: string }
    | undefined;
  if (existing?.status !== undefined && previous?.payload === payload) return false;

  const contentChanged = existing?.status !== undefined && previous?.payload !== payload;
  const now = new Date().toISOString();
  const why = contentChanged ? `content changed since last review; ${reason ?? "re-stored"}` : (reason ?? null);

  // Update named columns rather than INSERT OR REPLACE, which rewrites the row
  // and drops columns this module does not know about (the review tool's
  // `decision`). Those are cleared deliberately below, not by accident.
  db.prepare(
    `INSERT INTO review_state (verse_id, status, rating, reason, updated_at) VALUES (?, ?, NULL, ?, ?)
     ON CONFLICT(verse_id) DO UPDATE SET status = excluded.status, rating = NULL,
       reason = excluded.reason, updated_at = excluded.updated_at`,
  ).run(entry.verse_id, status, why, now);
  const columns = new Set(
    db.prepare("PRAGMA table_info(review_state)").all().map((row) => String((row as { name: unknown }).name)),
  );
  if (contentChanged && columns.has("decision")) {
    db.prepare("UPDATE review_state SET decision = NULL WHERE verse_id = ?").run(entry.verse_id);
  }
  return previous?.payload !== payload;
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
  // A throw mid-import rolls back, so staging never holds half a fixture set.
  db.exec("BEGIN");
  try {
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
      } catch (error) {
        report.rejected.push({ file, problem: `not JSON: ${(error as Error).message}` });
        continue;
      }
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
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
  return report;
}
