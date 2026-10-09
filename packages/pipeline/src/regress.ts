/**
 * `yada regress` — the permanent regression suite (build plan §3, §7).
 *
 * Two tiers, because they answer different questions and fail differently:
 *
 *   CI (default)  Does the golden corpus still hold to the contract, and does
 *                 derivation still reproduce it? Zero API calls, deterministic,
 *                 never flaky — a red CI run always means something changed.
 *   --live        Does the generator still produce an honest 1 Cor 14:34? That
 *                 costs money and is judged on structure, never on strings: two
 *                 honest entries for the same verse will not share a sentence,
 *                 and a string-equality test would fail on every run and so be
 *                 ignored.
 *
 * 1 Cor 14:34 is the canonical verse because it is where a system that quietly
 * picks a winner, or files a live dispute under "text", is most visible.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";

import {
  VerseEntrySchema,
  formatFinding,
  isAtomicClaimText,
  parseVerseRef,
  validateVerseEntry,
  type ClaimCategory,
  type VerseEntry,
} from "@yada/schema";

import { assemble, isComposed, type DeriveWords } from "./assemble.js";
import { ORACLE_FIXTURES, checkAgainstFixture, type OracleResult } from "./derive.js";
import { loadPericopes } from "./generate.js";
import { checkProvenance, collectEntries, extractJson } from "./inspect.js";
import { CONTENT, GOLDEN, RAW, STAGING_DB } from "./paths.js";
import { generatePericope, generationClient } from "./submit.js";

export interface RegressCheck {
  name: string;
  status: "pass" | "fail" | "skip";
  detail: string[];
}

export interface CiTierOptions {
  goldenDir?: string;
  rawDir?: string;
  /** Injected in tests; defaults to the real oracle against staging.db. */
  oracle?: (fixture: string) => OracleResult;
  stagingDb?: string;
}

/**
 * Raw sources count as present only when the directory has files in it. Every
 * stage that opens staging calls ensureDirs(), which creates an empty
 * content/raw — so "the directory exists" would turn a CI checkout into one
 * that claims to have sources and then fails the oracle for lack of them.
 */
export function rawSourcesPresent(rawDir: string = RAW): boolean {
  return existsSync(rawDir) && readdirSync(rawDir).some((f) => !f.startsWith("."));
}

export function runCiTier(options: CiTierOptions = {}): RegressCheck[] {
  const goldenDir = options.goldenDir ?? GOLDEN;
  const checks: RegressCheck[] = [];
  const files = readdirSync(goldenDir).filter((f) => f.endsWith(".json")).sort();

  for (const file of files) {
    const detail: string[] = [];
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path.join(goldenDir, file), "utf8"));
    } catch (error) {
      checks.push({ name: `golden/${file}`, status: "fail", detail: [`not JSON: ${(error as Error).message}`] });
      continue;
    }
    const parsed = VerseEntrySchema.safeParse(raw);
    if (!parsed.success) {
      detail.push(...parsed.error.issues.slice(0, 4).map((i) => `schema ${i.path.join(".")}: ${i.message}`));
    } else {
      detail.push(...validateVerseEntry(parsed.data).filter((f) => f.level === "error").map(formatFinding));
    }
    // A fixture is hand-authored, so no model name applies; what matters is
    // that it never claims a review. The seed fixture did, for four sessions.
    detail.push(
      ...checkProvenance((raw ?? {}) as Record<string, unknown>, "golden-fixture").map((p) => `provenance: ${p}`),
    );
    checks.push({ name: `golden/${file}`, status: detail.length === 0 ? "pass" : "fail", detail });
  }

  // A fixture outside the oracle list is a fixture nothing mechanical checks,
  // which is how the invented Greek Strong's numbers survived.
  const listed = new Set<string>(ORACLE_FIXTURES);
  const unlisted = files.map((f) => f.replace(/\.json$/, "")).filter((name) => !listed.has(name));
  checks.push({
    name: "oracle covers every fixture",
    status: unlisted.length === 0 ? "pass" : "fail",
    detail: unlisted.map((name) => `golden/${name}.json is not in ORACLE_FIXTURES`),
  });

  if (!rawSourcesPresent(options.rawDir)) {
    checks.push({
      name: "oracle",
      status: "skip",
      detail: ["content/raw is absent (as in CI): derived output was NOT compared with the fixtures"],
    });
    return checks;
  }

  const stagingDb = options.stagingDb ?? STAGING_DB;
  if (options.oracle === undefined && !existsSync(stagingDb)) {
    checks.push({
      name: "oracle",
      status: "fail",
      detail: ["raw sources are present but staging.db is not; run `yada normalize` before regress"],
    });
    return checks;
  }
  const oracle = options.oracle ?? checkAgainstFixture;
  for (const fixture of ORACLE_FIXTURES) {
    const result = oracle(fixture);
    checks.push({
      name: `oracle ${fixture}`,
      status: result.ok ? "pass" : "fail",
      detail: result.ok
        ? []
        : [
            `words ${result.derivedWords}/${result.fixtureWords}`,
            ...result.surfaceMismatches,
            ...result.strongsMismatches,
            ...result.morphemeMismatches,
          ].slice(0, 8),
    });
  }
  return checks;
}

// ---------------------------------------------------------------------------
// Live tier: structural equivalence
// ---------------------------------------------------------------------------

/**
 * Claim count may drift by 30% of the golden count or 2 claims, whichever is
 * larger. 1 Cor 14:34 has 9 claims, so 6–12 pass. Tighter than this fails on
 * legitimate splitting or merging of context claims; looser lets an entry that
 * dropped a third of its content through.
 */
export const CLAIM_COUNT_TOLERANCE = { ratio: 0.3, floor: 2 } as const;

export function claimCountTolerance(goldenCount: number): number {
  return Math.max(CLAIM_COUNT_TOLERANCE.floor, Math.round(goldenCount * CLAIM_COUNT_TOLERANCE.ratio));
}

export interface StructuralComparison {
  ok: boolean;
  /** Each one fails the comparison. */
  problems: string[];
  /** Worth a reviewer's glance, but judgment rather than rule, so not failing. */
  notes: string[];
}

function evidenceAnchors(entry: VerseEntry, category: ClaimCategory): Set<string> {
  const anchors = new Set<string>();
  for (const claim of entry.claims.filter((c) => c.category === category)) {
    for (const ref of [...claim.evidence, ...(claim.positions ?? []).flatMap((p) => p.evidence)]) {
      if (ref.type === "lexical" && ref.strongs !== undefined) anchors.add(`lexical ${ref.strongs}`);
      if (ref.type === "apparatus") anchors.add("apparatus");
    }
  }
  return anchors;
}

/**
 * Is `candidate` the same *shape* of honest entry as `golden`?
 *
 *   - same categories present: an entry with no `debated` claim for this verse
 *     has resolved a live dispute, and one with no `text` claim has stopped
 *     showing its evidence
 *   - no new compound claims: atomicity is the first thing a prompt regression
 *     loses
 *   - no lost debated claim: fewer debated claims than the golden entry means
 *     a dispute was dropped or folded into a winner
 *   - claim count within CLAIM_COUNT_TOLERANCE
 */
export function compareStructure(
  golden: VerseEntry,
  candidateRaw: unknown,
  tolerance: number = claimCountTolerance(golden.claims.length),
): StructuralComparison {
  const problems: string[] = [];
  const notes: string[] = [];

  const parsed = VerseEntrySchema.safeParse(candidateRaw);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.slice(0, 4).map((i) => `schema ${i.path.join(".")}: ${i.message}`),
      notes,
    };
  }
  const candidate = parsed.data;

  if (candidate.verse_id !== golden.verse_id) {
    problems.push(`verse_id ${candidate.verse_id}, expected ${golden.verse_id}`);
  }
  for (const finding of validateVerseEntry(candidate).filter((f) => f.level === "error")) {
    problems.push(`contract: ${formatFinding(finding)}`);
  }
  if (candidate.review.status !== "flagged") {
    problems.push(`review.status is ${candidate.review.status}; a regenerated entry is never reviewed`);
  }

  const categories = (entry: VerseEntry) => new Set(entry.claims.map((c) => c.category));
  const goldenCategories = categories(golden);
  const candidateCategories = categories(candidate);
  for (const category of goldenCategories) {
    if (!candidateCategories.has(category)) problems.push(`category ${category} is missing`);
  }
  for (const category of candidateCategories) {
    if (!goldenCategories.has(category)) problems.push(`category ${category} is new`);
  }

  const compound = (entry: VerseEntry) => entry.claims.filter((c) => !isAtomicClaimText(c.claim));
  const newCompound = compound(candidate);
  if (newCompound.length > compound(golden).length) {
    problems.push(`compound claims: ${newCompound.map((c) => c.id).join(", ")}`);
  }

  const debated = (entry: VerseEntry) => entry.claims.filter((c) => c.category === "debated");
  if (debated(candidate).length < debated(golden).length) {
    problems.push(`debated claims ${debated(candidate).length}, golden has ${debated(golden).length}: a dispute was lost`);
  }
  if (candidate.no_significant_dispute === true && debated(golden).length > 0) {
    problems.push("marked no_significant_dispute on a verse whose golden entry carries live disputes");
  }
  const goldenAnchors = evidenceAnchors(golden, "debated");
  const candidateAnchors = evidenceAnchors(candidate, "debated");
  for (const anchor of goldenAnchors) {
    if (!candidateAnchors.has(anchor)) {
      notes.push(`no debated claim cites ${anchor}, which a golden debated claim rests on`);
    }
  }

  const delta = candidate.claims.length - golden.claims.length;
  if (Math.abs(delta) > tolerance) {
    problems.push(`claim count ${candidate.claims.length}, golden ${golden.claims.length} (tolerance ±${tolerance})`);
  }

  return { ok: problems.length === 0, problems, notes };
}

// ---------------------------------------------------------------------------
// Live tier: the gated regeneration
// ---------------------------------------------------------------------------

export const LIVE_FIXTURE = "1co.14.34";
export const LIVE_VERSE = "1CO.14.34";
/** The generator, not the adversary: this tier regresses what gets generated. */
export const LIVE_MODEL = "claude-opus-5";
/** Kept out of content/responses/ so ingest-responses never stores a regression run. */
export const LIVE_RESPONSES = path.join(CONTENT, "regress");

export interface LiveOptions {
  confirm: boolean;
  client?: Anthropic;
  goldenDir?: string;
  responsesDir?: string;
}

export interface LiveResult {
  pericopeId: string;
  costUsd: number;
  stopReason: string | null;
  comparison: StructuralComparison;
}

/**
 * Regenerate the pericope containing 1 Cor 14:34 — the real request shape, so
 * the regression measures what production generation does — and compare the
 * verse entry structurally with the golden one.
 *
 * Confirm is checked before anything else, including the key, so a forgotten
 * flag cannot even reach count_tokens. The spend itself goes through
 * generatePericope, which re-checks confirm after pricing against the ceiling.
 */
export async function runLiveRegress(options: LiveOptions): Promise<LiveResult> {
  if (!options.confirm) {
    throw new Error("refusing to run the live regression: --confirm not given. It regenerates a pericope and spends money.");
  }
  const client = options.client ?? generationClient();

  const target = parseVerseRef(LIVE_VERSE);
  const pericope = loadPericopes("1CO").find((p) => {
    const range = parseVerseRef(p.id);
    if (range === null || target === null) return false;
    const at = target.start.chapter * 1000 + target.start.verse;
    return at >= range.start.chapter * 1000 + range.start.verse && at <= range.end.chapter * 1000 + range.end.verse;
  });
  if (pericope === undefined) throw new Error(`no pericope in data/1co-pericopes.json contains ${LIVE_VERSE}`);

  const responsesDir = options.responsesDir ?? LIVE_RESPONSES;
  mkdirSync(responsesDir, { recursive: true });
  const result = await generatePericope("1CO", pericope, LIVE_MODEL, {
    confirm: true,
    client,
    responsesDir,
    stage: "regress-live",
  });

  const golden = VerseEntrySchema.parse(
    JSON.parse(readFileSync(path.join(options.goldenDir ?? GOLDEN, `${LIVE_FIXTURE}.json`), "utf8")),
  );
  return {
    pericopeId: pericope.id,
    costUsd: result.costUsd,
    stopReason: result.stopReason,
    comparison: judgeLiveResponse(golden, result.text, result.stopReason, { pericopeId: pericope.id }),
  };
}

/**
 * Separated from the request so the judgment is testable without one.
 *
 * Since prompt 1.1 the model writes the composed shape, which has no ids,
 * versions or gloss until `assemble` stamps them. Judged raw, every live run
 * failed the schema and the money bought no measurement.
 */
export function judgeLiveResponse(
  golden: VerseEntry,
  text: string,
  stopReason: string | null,
  composed?: { pericopeId: string; derive?: DeriveWords },
): StructuralComparison {
  if (stopReason === "max_tokens") {
    return { ok: false, problems: ["stop_reason max_tokens: the regenerated pericope is truncated"], notes: [] };
  }
  const extracted = extractJson(text);
  if (extracted === null) return { ok: false, problems: ["no JSON could be recovered from the response"], notes: [] };
  const value =
    composed !== undefined && isComposed(extracted.value)
      ? assemble(extracted.value, composed.pericopeId, LIVE_MODEL, composed.derive)
      : extracted.value;
  const entry = collectEntries(value).find(
    (e) => typeof e === "object" && e !== null && (e as Record<string, unknown>)["verse_id"] === golden.verse_id,
  );
  if (entry === undefined) {
    return { ok: false, problems: [`the response contains no entry for ${golden.verse_id}`], notes: [] };
  }
  return compareStructure(golden, entry);
}
