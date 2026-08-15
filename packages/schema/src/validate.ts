/**
 * The deterministic quality contract (PRD §11.7 tier 1, §16 "0C").
 *
 * Pure functions over already-parsed entries. They never throw and never call
 * an API: they return structured findings so the same code can be the CI
 * regression tier, the pipeline's `yada validate` stage, and the review tool's
 * flag source. Zod owns structure; this file owns semantics.
 */

import type { Claim, ClaimCategory, DisplayGroup } from "./claims.js";
import { displayGroup } from "./claims.js";
import type { BookEntry, PericopeEntry, VerseEntry } from "./entries.js";
import { BOOK_ENTRY_SECTIONS } from "./entries.js";
import { bookOfRef, parseVerseId, parseVerseRef } from "./refs.js";

export type FindingLevel = "error" | "warn";

export interface Finding {
  level: FindingLevel;
  rule: string;
  claimId?: string;
  message: string;
}

export const RULES = {
  EVIDENCE_REF_RESOLVES: "evidence-ref-resolves",
  CLAIM_ATOMICITY: "claim-atomicity",
  TEXT_CLAIM_GROUNDING: "text-claim-grounding",
  DEBATED_CLAIM_POSITIONS: "debated-claim-positions",
  DISPLAY_RANK_UNIQUE: "display-rank-unique",
  ENTRY_REF_CONSISTENCY: "entry-ref-consistency",
  RELATED_PASSAGE_REF: "related-passage-ref",
  MOVEMENT_RANGE: "movement-range",
} as const;

export type Rule = (typeof RULES)[keyof typeof RULES];

export function hasErrors(findings: readonly Finding[]): boolean {
  return findings.some((f) => f.level === "error");
}

function finding(
  level: FindingLevel,
  rule: Rule,
  message: string,
  claimId?: string,
): Finding {
  return claimId === undefined ? { level, rule, message } : { level, rule, message, claimId };
}

// ---------------------------------------------------------------------------
// Atomicity heuristic
// ---------------------------------------------------------------------------

/** Removes (...) and [...] content, innermost first, so nesting collapses. */
function stripBracketed(text: string): string {
  const bracketed = /\([^()]*\)|\[[^\][]*\]/g;
  let previous = text;
  let next = text.replace(bracketed, " ");
  while (next !== previous) {
    previous = next;
    next = next.replace(bracketed, " ");
  }
  return next;
}

/**
 * A terminator is `.`/`?`/`!` at the end of the string, or followed by
 * whitespace and something that is not a lowercase letter or a digit. That
 * exempts abbreviations and verse references ("v. 35", "1 Cor. 14") while still
 * catching a genuine second sentence.
 */
export function countSentenceTerminators(text: string): number {
  const matches = stripBracketed(text).match(/[.?!]+(?=\s*$|\s+[^\p{Ll}\p{N}])/gu);
  return matches === null ? 0 : matches.length;
}

/** True when the claim text reads as one assertion by the heuristic above. */
export function isAtomicClaimText(text: string): boolean {
  const stripped = stripBracketed(text);
  if (stripped.includes(";")) return false;
  return countSentenceTerminators(text) <= 1;
}

// ---------------------------------------------------------------------------
// Claim-level rules
// ---------------------------------------------------------------------------

function validateEvidence(claim: Claim, findings: Finding[]): void {
  const refs = [...claim.evidence, ...(claim.positions ?? []).flatMap((p) => p.evidence)];
  for (const ref of refs) {
    if (ref.type === "verse" && parseVerseRef(ref.ref) === null) {
      findings.push(
        finding(
          "error",
          RULES.EVIDENCE_REF_RESOLVES,
          `evidence ref "${ref.ref}" is not a resolvable verse id or range`,
          claim.id,
        ),
      );
    }
  }

  if (claim.evidence.length === 0 && claim.grounding === "source_data") {
    findings.push(
      finding(
        "error",
        RULES.EVIDENCE_REF_RESOLVES,
        "grounding is source_data but no evidence is cited",
        claim.id,
      ),
    );
  }
}

function validateAtomicity(claim: Claim, findings: Finding[]): void {
  if (!isAtomicClaimText(claim.claim)) {
    findings.push(
      finding(
        "error",
        RULES.CLAIM_ATOMICITY,
        "claim is not one independently testable assertion (unbracketed semicolon or more than one sentence)",
        claim.id,
      ),
    );
  }
}

function validateGrounding(claim: Claim, findings: Finding[]): void {
  // PRD §11.4: a Text claim is recoverable from the supplied original-language
  // text. If it needs model knowledge, it is not a Text claim.
  if (claim.category === "text" && claim.grounding !== "source_data") {
    findings.push(
      finding(
        "error",
        RULES.TEXT_CLAIM_GROUNDING,
        `text claims must be grounded in source_data, found "${claim.grounding}"`,
        claim.id,
      ),
    );
  }
}

function validatePositions(
  claim: Claim,
  noSignificantDispute: boolean,
  findings: Finding[],
): void {
  if (claim.category !== "debated") return;
  const positions = claim.positions ?? [];
  if (positions.length >= 2) return;

  if (noSignificantDispute) {
    findings.push(
      finding(
        "warn",
        RULES.DEBATED_CLAIM_POSITIONS,
        `debated claim has ${positions.length} position(s); allowed only because the entry is marked no_significant_dispute`,
        claim.id,
      ),
    );
    return;
  }

  findings.push(
    finding(
      "error",
      RULES.DEBATED_CLAIM_POSITIONS,
      `debated claim must carry at least two positions, found ${positions.length}`,
      claim.id,
    ),
  );
}

/**
 * display_rank orders claims within the group the reader actually sees
 * ("What we can see" spans text and context; "Where interpretation differs"
 * spans interpretation and debated), so uniqueness is checked per group, not
 * per category.
 */
function validateDisplayRanks(claims: readonly Claim[], findings: Finding[]): void {
  const seen = new Map<DisplayGroup, Map<number, string>>();
  for (const claim of claims) {
    const group = displayGroup(claim.category);
    let ranks = seen.get(group);
    if (ranks === undefined) {
      ranks = new Map<number, string>();
      seen.set(group, ranks);
    }
    const existing = ranks.get(claim.display_rank);
    if (existing !== undefined) {
      findings.push(
        finding(
          "error",
          RULES.DISPLAY_RANK_UNIQUE,
          `display_rank ${claim.display_rank} is already used by claim "${existing}" in group ${group}`,
          claim.id,
        ),
      );
      continue;
    }
    ranks.set(claim.display_rank, claim.id);
  }
}

function validateUniqueClaimIds(claims: readonly Claim[], findings: Finding[]): void {
  const seen = new Set<string>();
  for (const claim of claims) {
    if (seen.has(claim.id)) {
      findings.push(
        finding("error", RULES.ENTRY_REF_CONSISTENCY, "duplicate claim id", claim.id),
      );
    }
    seen.add(claim.id);
  }
}

export interface ValidateClaimsOptions {
  /** Entry-level "no significant dispute" marker. */
  noSignificantDispute?: boolean;
}

export function validateClaims(
  claims: readonly Claim[],
  options: ValidateClaimsOptions = {},
): Finding[] {
  const findings: Finding[] = [];
  const noSignificantDispute = options.noSignificantDispute ?? false;

  for (const claim of claims) {
    validateAtomicity(claim, findings);
    validateGrounding(claim, findings);
    validateEvidence(claim, findings);
    validatePositions(claim, noSignificantDispute, findings);
  }
  validateDisplayRanks(claims, findings);
  validateUniqueClaimIds(claims, findings);

  return findings;
}

// ---------------------------------------------------------------------------
// Entry-level rules
// ---------------------------------------------------------------------------

function validateRelatedPassages(
  refs: readonly { ref: string }[] | undefined,
  findings: Finding[],
): void {
  for (const related of refs ?? []) {
    if (parseVerseRef(related.ref) === null) {
      findings.push(
        finding(
          "error",
          RULES.RELATED_PASSAGE_REF,
          `related passage "${related.ref}" is not a resolvable verse id or range`,
        ),
      );
    }
  }
}

export function validateVerseEntry(entry: VerseEntry): Finding[] {
  const findings: Finding[] = validateClaims(entry.claims, {
    noSignificantDispute: entry.no_significant_dispute ?? false,
  });

  const verse = parseVerseId(entry.verse_id);
  const pericope = parseVerseRef(entry.pericope_id);

  if (verse === null) {
    findings.push(
      finding("error", RULES.ENTRY_REF_CONSISTENCY, `verse_id "${entry.verse_id}" does not parse`),
    );
  }
  if (pericope === null) {
    findings.push(
      finding(
        "error",
        RULES.ENTRY_REF_CONSISTENCY,
        `pericope_id "${entry.pericope_id}" does not parse`,
      ),
    );
  }

  if (verse !== null && pericope !== null) {
    if (verse.book !== pericope.book) {
      findings.push(
        finding(
          "error",
          RULES.ENTRY_REF_CONSISTENCY,
          `verse_id book ${verse.book} does not match pericope_id book ${pericope.book}`,
        ),
      );
    } else {
      const position = verse.chapter * 1000 + verse.verse;
      const start = pericope.start.chapter * 1000 + pericope.start.verse;
      const end = pericope.end.chapter * 1000 + pericope.end.verse;
      if (position < start || position > end) {
        findings.push(
          finding(
            "error",
            RULES.ENTRY_REF_CONSISTENCY,
            `${entry.verse_id} falls outside its pericope ${entry.pericope_id}`,
          ),
        );
      }
    }
  }

  validateRelatedPassages(entry.related_passages, findings);
  return findings;
}

export function validatePericopeEntry(entry: PericopeEntry): Finding[] {
  const findings: Finding[] = validateClaims(entry.claims, {
    noSignificantDispute: entry.no_significant_dispute ?? false,
  });

  const start = parseVerseId(entry.span.start);
  const end = parseVerseId(entry.span.end);

  if (start === null || end === null) {
    findings.push(finding("error", RULES.ENTRY_REF_CONSISTENCY, "span does not parse"));
  } else if (start.book !== entry.book || end.book !== entry.book) {
    findings.push(
      finding(
        "error",
        RULES.ENTRY_REF_CONSISTENCY,
        `span books (${start.book}, ${end.book}) do not match entry book ${entry.book}`,
      ),
    );
  } else if (start.chapter * 1000 + start.verse > end.chapter * 1000 + end.verse) {
    findings.push(finding("error", RULES.ENTRY_REF_CONSISTENCY, "span end precedes span start"));
  }

  if (bookOfRef(entry.pericope_id) !== entry.book) {
    findings.push(
      finding(
        "error",
        RULES.ENTRY_REF_CONSISTENCY,
        `pericope_id "${entry.pericope_id}" does not belong to book ${entry.book}`,
      ),
    );
  }

  for (const step of entry.movement ?? []) {
    if (parseVerseRef(step.range) === null) {
      findings.push(
        finding("error", RULES.MOVEMENT_RANGE, `movement range "${step.range}" does not parse`),
      );
    }
  }

  validateRelatedPassages(entry.related_passages, findings);
  return findings;
}

export function validateBookEntry(entry: BookEntry): Finding[] {
  const findings: Finding[] = [];
  const allClaims: Claim[] = [];

  for (const section of BOOK_ENTRY_SECTIONS) {
    const claims = entry[section];
    allClaims.push(...claims);
    // Ranks are scoped to a section here: each section renders as its own list.
    findings.push(...validateClaims(claims));
  }

  validateUniqueClaimIds(allClaims, findings);
  return findings;
}

// ---------------------------------------------------------------------------
// Reporting helpers
// ---------------------------------------------------------------------------

export function countByCategory(claims: readonly Claim[]): Record<ClaimCategory, number> {
  const counts: Record<ClaimCategory, number> = {
    text: 0,
    context: 0,
    interpretation: 0,
    debated: 0,
  };
  for (const claim of claims) counts[claim.category] += 1;
  return counts;
}

export function formatFinding(f: Finding): string {
  const where = f.claimId === undefined ? "" : ` [${f.claimId}]`;
  return `${f.level.toUpperCase()} ${f.rule}${where}: ${f.message}`;
}
