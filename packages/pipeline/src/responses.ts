/**
 * `yada ingest-responses` — generated entries from content/responses/ into staging.
 *
 * `inspect` measures; this stores. Both use the same extraction, provenance and
 * validation, so an entry `inspect` calls clean is exactly an entry this stage
 * accepts — two harnesses with different opinions would make the violation
 * table meaningless.
 *
 * What gets refused, and why each is refused rather than repaired:
 *
 *   - a review status other than `flagged`. The seed fixture carried
 *     `human_reviewed` for four sessions without a human reading it; storing
 *     that label is how an unreviewed corpus becomes a reviewed-looking one.
 *   - a response that stopped at `max_tokens`. The JSON may still parse — a
 *     model can close its brackets early — but the pericope is incomplete, and
 *     an incomplete sample stored as if whole is the failure budget.ts exists
 *     to prevent.
 *   - schema or error-level contract failures. A patched entry is no longer
 *     a measurement of the prompt.
 *   - the same verse from two models. Milestone 0 generates with both, and
 *     `entries` holds one row per verse, so storing both means the later file
 *     silently wins. The choice is made explicitly with `--model`.
 *
 * Everything stored is `flagged`. Nothing here can promote an entry.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import {
  PericopeEntrySchema,
  SCHEMA_VERSION,
  VerseEntrySchema,
  hasErrors,
  validatePericopeEntry,
  validateVerseEntry,
  type PericopeEntry,
  type Finding,
  type VerseEntry,
} from "@yada/schema";

import { assemble, isComposed } from "./assemble.js";
import { deriveVerseFrom } from "./derive.js";
import { checkProvenance, extractJson, responseEntries } from "./inspect.js";
import { RESPONSES } from "./paths.js";
import { storeVerseEntry } from "./store.js";

export interface StoredEntry {
  id: string;
  kind: "verse" | "pericope";
  model: string;
  source: string;
  warnings: number;
}

export interface RejectedEntry {
  source: string;
  /** `*` when the whole response was refused. */
  id: string;
  reason: string;
}

export interface IngestReport {
  responses: number;
  /** Responses from a model other than the one `--model` selected. */
  skipped: number;
  stored: StoredEntry[];
  rejected: RejectedEntry[];
}

interface ResponseFile {
  pericope_id?: unknown;
  /** Set on one part of a pericope split across requests (generate.ts chunkVerses). */
  part?: unknown;
  parts?: unknown;
  verses?: unknown;
  model?: unknown;
  stop_reason?: unknown;
  text?: unknown;
}

/** Rule names and what each said, so a rejection reads without re-running validate. */
function contractReason(findings: readonly Finding[]): string {
  const errors = findings.filter((f) => f.level === "error");
  const rules = [...new Set(errors.map((f) => f.rule))].join(", ");
  const shown = errors.slice(0, 3).map((f) => `${f.claimId === undefined ? "" : `[${f.claimId}] `}${f.message}`);
  const more = errors.length > shown.length ? `; and ${errors.length - shown.length} more` : "";
  return `contract: ${rules} (${shown.join("; ")}${more})`;
}

type Candidate =
  | { kind: "verse"; id: string; entry: VerseEntry; model: string; source: string; warnings: number }
  | { kind: "pericope"; id: string; entry: PericopeEntry; model: string; source: string; warnings: number };

function modelOf(file: string, body: ResponseFile): string {
  if (typeof body.model === "string" && body.model !== "") return body.model;
  return /\.(claude-[a-z0-9-]+)\.json$/.exec(file)?.[1] ?? "unknown";
}

function issues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

export function ingestResponses(
  db: DatabaseSync,
  dir: string = RESPONSES,
  options: { model?: string } = {},
): IngestReport {
  const report: IngestReport = { responses: 0, skipped: 0, stored: [], rejected: [] };
  if (!existsSync(dir)) return report;

  const candidates: Candidate[] = [];
  const reject = (source: string, id: string, reason: string) => report.rejected.push({ source, id, reason });

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    let body: ResponseFile;
    try {
      body = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as ResponseFile;
    } catch (error) {
      report.responses += 1;
      reject(file, "*", `response file is not JSON: ${(error as Error).message}`);
      continue;
    }
    const model = modelOf(file, body);
    if (options.model !== undefined && model !== options.model) {
      report.skipped += 1;
      continue;
    }
    report.responses += 1;

    if (body.stop_reason === "max_tokens") {
      reject(file, "*", "stop_reason max_tokens: the response was truncated, so the pericope is incomplete");
      continue;
    }
    const extracted = extractJson(typeof body.text === "string" ? body.text : "");
    if (extracted === null) {
      reject(file, "*", "no JSON could be recovered from the response text");
      continue;
    }
    const requested = typeof body.pericope_id === "string" ? body.pericope_id : undefined;

    let value = extracted.value;
    if (isComposed(value) && requested !== undefined) {
      // A response naming a pericope id that does not parse is refused like
      // any other bad response, rather than aborting the whole ingest.
      try {
        value = assemble(value, requested, model, (verseId) => deriveVerseFrom(db, verseId));
      } catch (error) {
        reject(file, "*", (error as Error).message);
        continue;
      }
    }

    // A part of a split pericope was asked for its own verses only. One it was
    // not asked for would collide with the part that was, and the duplicate
    // rule below would then refuse both copies, losing the good one.
    const partVerses = Array.isArray(body.verses) ? new Set(body.verses.map(String)) : undefined;

    for (const raw of responseEntries(value, body)) {
      const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
      const isVerse = record["verse_id"] !== undefined;
      const id = String(record["verse_id"] ?? record["pericope_id"] ?? "?");

      if (isVerse && partVerses !== undefined && !partVerses.has(id)) {
        reject(file, id, `part ${String(body.part)} of ${String(body.parts)} was asked for ${[...partVerses].join(", ")}, not ${id}`);
        continue;
      }

      const provenance = checkProvenance(record, model);
      if (provenance.length > 0) {
        reject(file, id, provenance.join("; "));
        continue;
      }
      if (record["schema_version"] !== SCHEMA_VERSION) {
        reject(file, id, `schema_version ${String(record["schema_version"])}, corpus is at ${SCHEMA_VERSION}`);
        continue;
      }

      if (isVerse) {
        const parsed = VerseEntrySchema.safeParse(raw);
        if (!parsed.success) {
          reject(file, id, `schema: ${issues(parsed.error)}`);
          continue;
        }
        if (requested !== undefined && parsed.data.pericope_id !== requested) {
          reject(file, id, `entry names pericope ${parsed.data.pericope_id}, but the request was for ${requested}`);
          continue;
        }
        const findings = validateVerseEntry(parsed.data);
        if (hasErrors(findings)) {
          reject(file, id, contractReason(findings));
          continue;
        }
        candidates.push({ kind: "verse", id, entry: parsed.data, model, source: file, warnings: findings.length });
      } else if (record["pericope_id"] !== undefined) {
        const parsed = PericopeEntrySchema.safeParse(raw);
        if (!parsed.success) {
          reject(file, id, `schema: ${issues(parsed.error)}`);
          continue;
        }
        if (requested !== undefined && parsed.data.pericope_id !== requested) {
          reject(file, id, `pericope entry is ${parsed.data.pericope_id}, but the request was for ${requested}`);
          continue;
        }
        const findings = validatePericopeEntry(parsed.data);
        if (hasErrors(findings)) {
          reject(file, id, contractReason(findings));
          continue;
        }
        candidates.push({ kind: "pericope", id, entry: parsed.data, model, source: file, warnings: findings.length });
      } else {
        reject(file, id, "neither a verse entry (verse_id) nor a pericope entry (pericope_id)");
      }
    }
  }

  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.kind}:${candidate.id}`;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  db.exec("BEGIN");
  try {
    for (const group of groups.values()) {
      if (group.length > 1) {
        const models = [...new Set(group.map((c) => c.model))];
        const reason =
          models.length > 1
            ? `supplied by ${models.length} models (${models.join(", ")}); pass --model to choose which is stored`
            : `appears ${group.length} times in ${[...new Set(group.map((c) => c.source))].join(", ")}`;
        for (const c of group) reject(c.source, c.id, reason);
        continue;
      }
      const candidate = group[0] as Candidate;
      if (candidate.kind === "verse") {
        const changed = storeVerseEntry(
          db,
          candidate.entry,
          "flagged",
          `generated by ${candidate.model}; ingested from ${candidate.source}`,
        );
        // Adversary verdicts address claims by id, and a regenerated entry
        // reuses ids for different claims. Keeping them would attach one
        // entry's criticism to another entry's text. Re-ingesting the same
        // text is not a regeneration: its verdicts still apply, and deleting
        // them threw away paid adversary work.
        if (changed) db.prepare("DELETE FROM adversary_flags WHERE verse_id = ?").run(candidate.id);
      } else {
        db.prepare(
          `INSERT OR REPLACE INTO pericope_entries (pericope_id, schema_version, prompt_version, payload)
           VALUES (?, ?, ?, ?)`,
        ).run(candidate.id, candidate.entry.schema_version, candidate.entry.prompt_version, JSON.stringify(candidate.entry));
      }
      report.stored.push({
        id: candidate.id,
        kind: candidate.kind,
        model: candidate.model,
        source: candidate.source,
        warnings: candidate.warnings,
      });
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return report;
}
