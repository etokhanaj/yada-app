/**
 * `yada adversary <BOOK>` — the adversarial pass (PRD §11.7.2).
 *
 * A second model, with a prompt written to attack rather than to write, gives
 * each claim a verdict. The default is Sonnet against an Opus-generated corpus
 * on purpose: two different models disagreeing is the product working, and the
 * same model checking its own output mostly agrees with itself.
 *
 * This spends money, so it goes through budget.ts in the same order as
 * submit.ts — count tokens, check the ceiling, check --confirm, send, write the
 * response, record usage — and the order is the point. The ceiling is checked
 * before confirm so an oversized run stops either way, and usage is recorded
 * before the next request so a crash cannot lose the record of spend.
 *
 * Verdicts go to `adversary_flags`, which the review tool reads. A verdict is
 * never allowed to promote anything: an entry every claim of which is upheld
 * keeps whatever status it had, and one with any contested claim is `flagged`.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import Anthropic from "@anthropic-ai/sdk";

import {
  BOOK_CODES,
  VerseEntrySchema,
  isBookCode,
  parseVerseRef,
  type VerseEntry,
  type VerseRange,
} from "@yada/schema";

import {
  assertWithinCeiling,
  priceUsage,
  recordUsage,
  requireApiKey,
  type UsageRecord,
} from "./budget.js";
import { extractJson } from "./inspect.js";
import { CONTENT, PROMPTS } from "./paths.js";

export const ADVERSARY_MODEL = "claude-sonnet-5";
export const ADVERSARY_PROMPT = "adversary.v1.md";
export const ADVERSARY_RESPONSES = path.join(CONTENT, "adversary");
export const ADVERSARY_REQUESTS = path.join(CONTENT, "requests", "adversary");

export const VERDICTS = ["upheld", "unsupported", "miscategorised", "compound", "overclaimed"] as const;
export type Verdict = (typeof VERDICTS)[number];
export const SEVERITIES = ["critical", "minor", "none"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** PRD §16 0C: at most 10% of claims contested, and none critically. */
export const ZERO_C_MAX_DISAGREEMENT = 0.1;

/**
 * Verses of source data carried per request. A claim citing a whole chapter
 * range would otherwise ship that chapter's interlinear once per verse entry;
 * beyond this, ranges are named but not expanded, and the request says so.
 */
export const MAX_SOURCE_VERSES = 60;

export interface AdversaryVerdict {
  claim_id: string;
  verdict: Verdict;
  severity: Severity;
  note: string;
  alternative: string | null;
}

// ---------------------------------------------------------------------------
// Building the request
// ---------------------------------------------------------------------------

export interface StagedEntry {
  entry: VerseEntry;
  status: string;
}

export function loadBookEntries(db: DatabaseSync, book: string): { entries: StagedEntry[]; unparseable: string[] } {
  const rows = db
    .prepare(
      `SELECT e.verse_id, e.payload, COALESCE(r.status, 'flagged') AS status
       FROM entries e LEFT JOIN review_state r ON r.verse_id = e.verse_id
       WHERE e.verse_id LIKE ? ORDER BY e.verse_id`,
    )
    .all(`${book}.%`);
  const entries: StagedEntry[] = [];
  const unparseable: string[] = [];
  for (const row of rows) {
    const parsed = VerseEntrySchema.safeParse(JSON.parse(String(row["payload"])));
    if (parsed.success) entries.push({ entry: parsed.data, status: String(row["status"]) });
    else unparseable.push(String(row["verse_id"]));
  }
  return { entries, unparseable };
}

export interface AdversaryRequest {
  verse_id: string;
  pericope_id: string;
  claimIds: string[];
  body: string;
  characters: number;
}

function sourceLines(db: DatabaseSync, ranges: readonly VerseRange[]): { lines: string[]; unexpanded: string[] } {
  const verseRows = db.prepare(
    `SELECT verse_id FROM verses WHERE book = ? AND (chapter * 1000 + verse) BETWEEN ? AND ?
     ORDER BY chapter, verse`,
  );
  const tokenRows = db.prepare("SELECT surface, lemma, morph, strongs FROM tokens WHERE verse_id = ? ORDER BY position");
  const textRow = db.prepare("SELECT text FROM texts WHERE translation = 'BSB' AND verse_id = ?");

  const verseIds: string[] = [];
  const unexpanded: string[] = [];
  for (const range of ranges) {
    const ids = verseRows
      .all(range.book, range.start.chapter * 1000 + range.start.verse, range.end.chapter * 1000 + range.end.verse)
      .map((r) => String(r["verse_id"]))
      .filter((id) => !verseIds.includes(id));
    if (verseIds.length + ids.length > MAX_SOURCE_VERSES) {
      unexpanded.push(`${range.book}.${range.start.chapter}.${range.start.verse}-${range.end.chapter}.${range.end.verse}`);
      continue;
    }
    verseIds.push(...ids);
  }

  const lines: string[] = [];
  for (const id of verseIds) {
    const words = tokenRows
      .all(id)
      .map((t) => `${String(t["surface"])}|${String(t["lemma"])}|${String(t["morph"])}|${t["strongs"] == null ? "-" : String(t["strongs"])}`);
    const english = textRow.get(id);
    lines.push(`${id}\t${words.join(" ")}`);
    if (english !== undefined) lines.push(`${id}\tBSB: ${String(english["text"])}`);
  }
  return { lines, unexpanded };
}

/** The claims under attack plus the source data they could be checked against. */
export function buildAdversaryRequest(db: DatabaseSync, entry: VerseEntry, promptDir: string = PROMPTS): AdversaryRequest {
  const prompt = readFileSync(path.join(promptDir, ADVERSARY_PROMPT), "utf8");

  const ranges: VerseRange[] = [];
  const own = parseVerseRef(entry.verse_id);
  if (own !== null) ranges.push(own);
  for (const claim of entry.claims) {
    for (const ref of [...claim.evidence, ...(claim.positions ?? []).flatMap((p) => p.evidence)]) {
      if (ref.type !== "verse") continue;
      const range = parseVerseRef(ref.ref);
      if (range !== null) ranges.push(range);
    }
  }
  const { lines, unexpanded } = sourceLines(db, ranges);
  const book = entry.verse_id.slice(0, 3);
  const script = isBookCode(book) && BOOK_CODES[book].testament === "OT" ? "hebrew" : "greek";

  // Only what the adversary is asked to judge. close_rendering and prose are
  // left out so the verdict is about claims, not about how the entry reads.
  const claims = entry.claims.map((c) => ({
    id: c.id,
    claim: c.claim,
    category: c.category,
    evidence_strength: c.evidence_strength,
    grounding: c.grounding,
    evidence: c.evidence,
    ...(c.positions === undefined ? {} : { positions: c.positions }),
  }));

  const body = [
    prompt,
    "",
    "## Entry under attack",
    `verse_id: ${entry.verse_id}`,
    `pericope_id: ${entry.pericope_id}`,
    `Script: ${script}`,
    ...(entry.no_significant_dispute === true ? ["The entry marks itself no_significant_dispute."] : []),
    "",
    "```json",
    JSON.stringify(claims, null, 2),
    "```",
    "",
    "## Supplied source data (surface|lemma|morph|strongs, then English)",
    ...lines,
    ...(unexpanded.length > 0
      ? ["", `Ranges cited but not expanded here (too long to carry): ${unexpanded.join(", ")}`]
      : []),
    "",
  ].join("\n");

  return {
    verse_id: entry.verse_id,
    pericope_id: entry.pericope_id,
    claimIds: entry.claims.map((c) => c.id),
    body,
    characters: body.length,
  };
}

/** Worst-case output for one entry, and so the number the ceiling is checked against. */
export function maxAdversaryTokens(claims: number): number {
  return claims * 800 + 8000;
}

// ---------------------------------------------------------------------------
// Parsing the response
// ---------------------------------------------------------------------------

export type ParsedVerdicts = { ok: true; verdicts: AdversaryVerdict[] } | { ok: false; problems: string[] };

/**
 * Strict. A response missing a claim, inventing one, or pairing `upheld` with a
 * severity is unusable as a whole: storing the parts that look right would
 * report a disagreement rate over a sample the adversary never fully judged.
 */
export function parseAdversaryResponse(text: string, verseId: string, claimIds: readonly string[]): ParsedVerdicts {
  const extracted = extractJson(text);
  if (extracted === null) return { ok: false, problems: ["no JSON could be recovered"] };
  const value = extracted.value as { verse_id?: unknown; verdicts?: unknown };
  const problems: string[] = [];
  if (extracted.recovered !== null) problems.push(`output was ${extracted.recovered}; the prompt requires strict JSON`);
  if (value === null || typeof value !== "object") return { ok: false, problems: ["top level is not an object"] };
  if (value.verse_id !== verseId) problems.push(`verse_id is ${String(value.verse_id)}, expected ${verseId}`);
  if (!Array.isArray(value.verdicts)) return { ok: false, problems: [...problems, "verdicts is not an array"] };

  const expected = new Set(claimIds);
  const seen = new Set<string>();
  const verdicts: AdversaryVerdict[] = [];
  for (const raw of value.verdicts as unknown[]) {
    const v = (raw ?? {}) as Record<string, unknown>;
    const id = typeof v["claim_id"] === "string" ? v["claim_id"] : "";
    if (!expected.has(id)) {
      problems.push(`verdict for unknown claim id "${id}"`);
      continue;
    }
    if (seen.has(id)) {
      problems.push(`more than one verdict for ${id}`);
      continue;
    }
    seen.add(id);
    const verdict = v["verdict"];
    const severity = v["severity"];
    const note = v["note"];
    const alternative = v["alternative"];
    if (!VERDICTS.includes(verdict as Verdict)) problems.push(`${id}: verdict "${String(verdict)}" is not one of ${VERDICTS.join("|")}`);
    if (!SEVERITIES.includes(severity as Severity)) problems.push(`${id}: severity "${String(severity)}" is not one of ${SEVERITIES.join("|")}`);
    if (verdict === "upheld" && severity !== "none") problems.push(`${id}: upheld must carry severity none`);
    if (verdict !== "upheld" && severity === "none") problems.push(`${id}: ${String(verdict)} cannot carry severity none`);
    if (typeof note !== "string" || note.trim() === "") problems.push(`${id}: note is required`);
    if (alternative !== undefined && alternative !== null && typeof alternative !== "string") {
      problems.push(`${id}: alternative must be a string or null`);
    }
    verdicts.push({
      claim_id: id,
      verdict: verdict as Verdict,
      severity: severity as Severity,
      note: typeof note === "string" ? note : "",
      alternative: typeof alternative === "string" && alternative.trim() !== "" ? alternative : null,
    });
  }
  for (const id of expected) if (!seen.has(id)) problems.push(`no verdict for ${id}`);

  // A fence or surrounding prose is recorded but not fatal; everything else is.
  const fatal = problems.filter((p) => !p.startsWith("output was"));
  return fatal.length === 0 ? { ok: true, verdicts } : { ok: false, problems };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export interface AttackOptions {
  /** Nothing is sent unless this is true. */
  confirm: boolean;
  /** Injected in tests so the gate is exercised without a network or a key. */
  client?: Anthropic;
  responsesDir?: string;
}

export interface AttackResult {
  verse_id: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  stopReason: string | null;
  text: string;
}

export async function attackEntry(request: AdversaryRequest, model: string, options: AttackOptions): Promise<AttackResult> {
  const client = options.client ?? new Anthropic({ apiKey: requireApiKey() });
  const messages = [{ role: "user" as const, content: request.body }];
  const maxTokens = maxAdversaryTokens(request.claimIds.length);

  const counted = await client.messages.countTokens({ model, messages });
  const inputTokens = counted.input_tokens;

  assertWithinCeiling(model, inputTokens, maxTokens);

  if (!options.confirm) {
    throw new Error(
      `refusing to submit adversary pass for ${request.verse_id}: --confirm not given. ` +
        `Would have sent ${inputTokens} input tokens to ${model}.`,
    );
  }

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    messages,
    // Adaptive, never budget_tokens: the latter is a 400 on these models.
    thinking: { type: "adaptive" },
  });
  const message = await stream.finalMessage();
  const outputTokens = message.usage.output_tokens;
  const costUsd = priceUsage(model, inputTokens, outputTokens);
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Written before parsing, so an unusable verdict is still evidence.
  const dir = options.responsesDir ?? ADVERSARY_RESPONSES;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, `${request.verse_id}.${model}.json`),
    `${JSON.stringify({ verse_id: request.verse_id, model, stop_reason: message.stop_reason, usage: message.usage, text }, null, 2)}\n`,
  );

  const record: UsageRecord = {
    at: new Date().toISOString(),
    model,
    pericope_id: request.pericope_id,
    verses: 1,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    thinking_tokens: message.usage.output_tokens_details?.thinking_tokens ?? 0,
    cost_usd: costUsd,
    stage: "adversary",
  };
  recordUsage(record);

  return { verse_id: request.verse_id, model, inputTokens, outputTokens, costUsd, stopReason: message.stop_reason, text };
}

// ---------------------------------------------------------------------------
// Recording verdicts
// ---------------------------------------------------------------------------

const HUMAN_STATUSES = new Set(["human_reviewed", "expert_reviewed"]);

export interface ApplyResult {
  contested: AdversaryVerdict[];
  /** A human decision stands; the verdicts are stored for the reviewer to see. */
  humanDecisionKept: boolean;
}

/**
 * Re-flag, never promote.
 *
 * `flagged` and `auto_passed` become `flagged` with the contested claims as the
 * reason: auto_passed is itself a machine judgment, and a second machine
 * disagreeing is exactly what should send it to a human. A human or expert
 * decision is not overwritten by a model — the rows are written, the review
 * tool's adversary_disagreement queue surfaces them, and the person decides.
 */
function reflag(db: DatabaseSync, verseId: string, reason: string, at: string): boolean {
  const existing = db.prepare("SELECT status FROM review_state WHERE verse_id = ?").get(verseId);
  if (existing !== undefined && HUMAN_STATUSES.has(String(existing["status"]))) return true;
  if (existing === undefined) {
    db.prepare(
      "INSERT INTO review_state (verse_id, status, rating, reason, updated_at) VALUES (?, 'flagged', NULL, ?, ?)",
    ).run(verseId, reason, at);
  } else {
    db.prepare("UPDATE review_state SET status = 'flagged', reason = ?, updated_at = ? WHERE verse_id = ?").run(
      reason,
      at,
      verseId,
    );
  }
  return false;
}

/**
 * `alternative` has no column in the review tool's contract, so it is folded
 * into `note` after a fixed separator the review tool can split on.
 */
export const ALTERNATIVE_SEPARATOR = " | alternative: ";

export function applyVerdicts(
  db: DatabaseSync,
  verseId: string,
  model: string,
  verdicts: readonly AdversaryVerdict[],
  at: string = new Date().toISOString(),
): ApplyResult {
  const insert = db.prepare(
    `INSERT OR REPLACE INTO adversary_flags (verse_id, claim_id, verdict, severity, note, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  db.exec("BEGIN");
  try {
    for (const v of verdicts) {
      const note = v.alternative === null ? v.note : `${v.note}${ALTERNATIVE_SEPARATOR}${v.alternative}`;
      insert.run(verseId, v.claim_id, v.verdict, v.severity, note, model, at);
    }
    const contested = verdicts.filter((v) => v.verdict !== "upheld");
    let humanDecisionKept = false;
    if (contested.length > 0) {
      const reason =
        `adversary ${model}: ${contested.length} of ${verdicts.length} claims contested — ` +
        contested.map((v) => `${v.claim_id} ${v.verdict}/${v.severity}`).join(", ");
      humanDecisionKept = reflag(db, verseId, reason, at);
    }
    db.exec("COMMIT");
    return { contested, humanDecisionKept };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** An adversary response that could not be used still sends the entry to a human. */
export function flagUnusable(db: DatabaseSync, verseId: string, model: string, problem: string): boolean {
  return reflag(db, verseId, `adversary ${model}: response unusable — ${problem}`, new Date().toISOString());
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export interface DisagreementReport {
  verdicts: number;
  contested: number;
  critical: number;
  rate: number;
  byVerdict: Map<string, number>;
  meetsBar: boolean;
}

/**
 * Computed from the table, not from this run, so a resumed run reports the
 * whole book rather than the slice that happened to be sent this time.
 */
export function disagreement(db: DatabaseSync, book: string, model: string): DisagreementReport {
  const rows = db
    .prepare("SELECT verdict, severity FROM adversary_flags WHERE verse_id LIKE ? AND model = ?")
    .all(`${book}.%`, model);
  const byVerdict = new Map<string, number>();
  let contested = 0;
  let critical = 0;
  for (const row of rows) {
    const verdict = String(row["verdict"]);
    byVerdict.set(verdict, (byVerdict.get(verdict) ?? 0) + 1);
    if (verdict !== "upheld") contested += 1;
    if (String(row["severity"]) === "critical") critical += 1;
  }
  const rate = rows.length === 0 ? 0 : contested / rows.length;
  return {
    verdicts: rows.length,
    contested,
    critical,
    rate,
    byVerdict,
    meetsBar: rows.length > 0 && rate <= ZERO_C_MAX_DISAGREEMENT && critical === 0,
  };
}

/** Entries whose every current claim already has a verdict from this model. */
export function alreadyJudged(db: DatabaseSync, entry: VerseEntry, model: string): boolean {
  const rows = db
    .prepare("SELECT claim_id FROM adversary_flags WHERE verse_id = ? AND model = ?")
    .all(entry.verse_id, model)
    .map((r) => String(r["claim_id"]));
  const judged = new Set(rows);
  return entry.claims.length > 0 && entry.claims.every((c) => judged.has(c.id));
}

export interface AdversaryRun {
  sent: number;
  skipped: number;
  unusable: Array<{ verse_id: string; problem: string }>;
  humanDecisionsKept: string[];
  spentUsd: number;
  /** Set when the run stopped early; spend up to that point is already recorded. */
  stoppedOn?: { verse_id: string; error: string };
}

/**
 * The confirmed loop. Resumable: entries already fully judged by this model are
 * skipped, so re-running after a crash or a ceiling stop does not pay twice.
 * The first thrown error stops the run, because it has usually cost money
 * already and pressing on is how a mistake reaches the ceiling.
 */
export async function runAdversary(
  db: DatabaseSync,
  book: string,
  model: string,
  options: AttackOptions & { log?: (line: string) => void },
): Promise<AdversaryRun> {
  const log = options.log ?? (() => undefined);
  const run: AdversaryRun = { sent: 0, skipped: 0, unusable: [], humanDecisionsKept: [], spentUsd: 0 };
  const { entries } = loadBookEntries(db, book);

  for (const { entry } of entries) {
    if (entry.claims.length === 0 || alreadyJudged(db, entry, model)) {
      run.skipped += 1;
      continue;
    }
    const request = buildAdversaryRequest(db, entry);
    let result: AttackResult;
    try {
      result = await attackEntry(request, model, options);
    } catch (error) {
      run.stoppedOn = { verse_id: entry.verse_id, error: (error as Error).message };
      return run;
    }
    run.sent += 1;
    run.spentUsd += result.costUsd;

    if (result.stopReason === "max_tokens") {
      const problem = "stop_reason max_tokens: verdicts truncated";
      run.unusable.push({ verse_id: entry.verse_id, problem });
      if (flagUnusable(db, entry.verse_id, model, problem)) run.humanDecisionsKept.push(entry.verse_id);
      log(`  ${entry.verse_id.padEnd(14)} UNUSABLE ${problem}`);
      continue;
    }
    const parsed = parseAdversaryResponse(result.text, entry.verse_id, request.claimIds);
    if (!parsed.ok) {
      const problem = parsed.problems.slice(0, 3).join("; ");
      run.unusable.push({ verse_id: entry.verse_id, problem });
      if (flagUnusable(db, entry.verse_id, model, problem)) run.humanDecisionsKept.push(entry.verse_id);
      log(`  ${entry.verse_id.padEnd(14)} UNUSABLE ${problem}`);
      continue;
    }
    const applied = applyVerdicts(db, entry.verse_id, model, parsed.verdicts);
    if (applied.humanDecisionKept) run.humanDecisionsKept.push(entry.verse_id);
    log(
      `  ${entry.verse_id.padEnd(14)} ${applied.contested.length}/${parsed.verdicts.length} contested` +
        `  $${result.costUsd.toFixed(3)}`,
    );
  }
  return run;
}

/** Dry run: build and write every request, send nothing, need no key. */
export function adversaryDryRun(db: DatabaseSync, book: string, outDir: string = ADVERSARY_REQUESTS): AdversaryRequest[] {
  mkdirSync(outDir, { recursive: true });
  const { entries } = loadBookEntries(db, book);
  const requests: AdversaryRequest[] = [];
  for (const { entry } of entries) {
    if (entry.claims.length === 0) continue;
    const request = buildAdversaryRequest(db, entry);
    requests.push(request);
    writeFileSync(
      path.join(outDir, `${entry.verse_id}.json`),
      `${JSON.stringify({ verse_id: request.verse_id, body: request.body }, null, 2)}\n`,
    );
  }
  return requests;
}
