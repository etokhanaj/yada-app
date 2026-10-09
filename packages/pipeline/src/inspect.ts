/**
 * `yada inspect` — validate generated entries and report the quality signal.
 *
 * Prompt 05 §3: report the violation rate per rule. That table is the quality
 * signal, more than any impression of whether the prose reads well — a fluent
 * entry that asserts a parse the source data does not contain is worse than a
 * clumsy one that does not, and only the rules can see the difference.
 *
 * Nothing here repairs an entry. A malformed or invalid entry is a finding
 * about the prompt or the model, and patching it by hand would destroy the
 * measurement this session exists to take.
 */

import { assemble, isComposed } from "./assemble.js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

import {
  PericopeEntrySchema,
  VerseEntrySchema,
  validatePericopeEntry,
  validateVerseEntry,
  type Finding,
} from "@yada/schema";

import { RESPONSES } from "./paths.js";

export interface EntryReport {
  source: string;
  model: string;
  kind: "verse" | "pericope" | "unknown";
  id: string;
  /** Zod rejected it. The entry is not counted as valid at all. */
  parseError?: string;
  findings: Finding[];
  /** Provenance problems, which are separate from the schema's own rules. */
  provenance: string[];
}

export interface InspectReport {
  responses: number;
  entries: EntryReport[];
  parsed: number;
  parseFailures: number;
  /** Rule -> how many entries violated it. */
  byRule: Map<string, number>;
  /** Responses whose text was not usable JSON at all. */
  unreadable: string[];
}

/**
 * Pull JSON out of a response body.
 *
 * The prompt says "schema JSON only", so anything else is itself a finding —
 * but the finding is worth more than a crash, so a fenced block or a JSON
 * object embedded in prose is recovered and the deviation recorded.
 */
export function extractJson(text: string): { value: unknown; recovered: string | null } | null {
  const direct = tryParse(text);
  if (direct !== undefined) return { value: direct, recovered: null };

  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fenced?.[1] !== undefined) {
    const value = tryParse(fenced[1]);
    if (value !== undefined) return { value, recovered: "wrapped in a code fence" };
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const value = tryParse(text.slice(firstBrace, lastBrace + 1));
    if (value !== undefined) return { value, recovered: "surrounded by prose" };
  }
  return null;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text.trim());
  } catch {
    return undefined;
  }
}

/** Flatten whatever container the entries arrived in into a flat list. */
export function collectEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(collectEntries);
  if (value === null || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  // A wrapper such as { pericope: {...}, verses: [...] }.
  if (record["verses"] !== undefined || record["pericope"] !== undefined) {
    return [
      ...(record["pericope"] === undefined ? [] : collectEntries(record["pericope"])),
      ...(record["verses"] === undefined ? [] : collectEntries(record["verses"])),
    ];
  }
  return [value];
}

/**
 * Provenance rules, which the schema deliberately cannot enforce because a
 * valid entry may legitimately be reviewed later.
 *
 * `human_reviewed` on a generated entry is the one that matters. The seed
 * fixture carried it for four sessions without a human ever having read it,
 * which is exactly how an unreviewed corpus becomes a reviewed-looking one.
 */
export function checkProvenance(entry: Record<string, unknown>, model: string): string[] {
  const problems: string[] = [];
  const review = entry["review"] as { status?: string } | undefined;
  const status = review?.status;

  if (status === "human_reviewed" || status === "expert_reviewed") {
    problems.push(`claims review.status "${status}" — nothing generated has been reviewed`);
  } else if (status !== "flagged") {
    problems.push(`review.status is "${status ?? "missing"}"; generated entries must be "flagged"`);
  }
  if (entry["prompt_version"] === undefined) problems.push("prompt_version is missing");
  if (model === "unknown") problems.push("generating model could not be determined from the filename");
  return problems;
}

function inspectEntry(raw: unknown, source: string, model: string): EntryReport {
  const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const looksVerse = record["verse_id"] !== undefined;
  const kind = looksVerse ? "verse" : record["pericope_id"] !== undefined ? "pericope" : "unknown";
  const id = String(record["verse_id"] ?? record["pericope_id"] ?? "?");

  const parsed = looksVerse ? VerseEntrySchema.safeParse(raw) : PericopeEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      source, model, kind, id,
      parseError: parsed.error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
      findings: [],
      provenance: checkProvenance(record, model),
    };
  }

  const findings = looksVerse
    ? validateVerseEntry(parsed.data as never)
    : validatePericopeEntry(parsed.data as never);

  return { source, model, kind, id, findings, provenance: checkProvenance(record, model) };
}

/** `GEN.1.1-1.5.claude-opus-5.json` -> `GEN.1.1-1.5` */
function pericopeFromFile(file: string): string | undefined {
  return /^(.+?)\.claude-[a-z0-9-]+\.json$/.exec(file)?.[1];
}

/** `GEN.1.1-1.5.claude-opus-5.json` -> `claude-opus-5` */
function modelFromFilename(file: string): string {
  const match = /\.(claude-[a-z0-9-]+)\.json$/.exec(file);
  return match?.[1] ?? "unknown";
}

export function inspectAll(dir: string = RESPONSES): InspectReport {
  const report: InspectReport = {
    responses: 0, entries: [], parsed: 0, parseFailures: 0,
    byRule: new Map(), unreadable: [],
  };
  if (!existsSync(dir)) return report;

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    report.responses += 1;
    const body = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as { text?: string };
    const text = body.text ?? "";
    const extracted = extractJson(text);
    if (extracted === null) {
      report.unreadable.push(file);
      continue;
    }

    const model = modelFromFilename(file);
    // Composed model output is assembled into full entries exactly as ingest does.
    const pericopeId = pericopeFromFile(file);
    const value =
      isComposed(extracted.value) && pericopeId !== undefined ? assemble(extracted.value, pericopeId, model) : extracted.value;
    for (const raw of collectEntries(value)) {
      const entry = inspectEntry(raw, file, model);
      report.entries.push(entry);
      if (entry.parseError === undefined) report.parsed += 1;
      else report.parseFailures += 1;
      for (const rule of new Set(entry.findings.map((f) => f.rule))) {
        report.byRule.set(rule, (report.byRule.get(rule) ?? 0) + 1);
      }
    }
  }
  return report;
}
