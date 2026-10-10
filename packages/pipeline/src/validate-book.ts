/**
 * `yada validate <BOOK>` — the deterministic 0C quality contract over staging.
 *
 * PRD §16 0C: "100% of cited lexical items exist in supplied source data".
 * `validateVerseEntry` in @yada/schema is pure and cannot see source data, so it
 * can check that `1CO.14.99` *parses* but not that it exists, and that `G1135`
 * is well-formed but not that the verse contains it. This stage adds exactly
 * those checks, against staging.db.
 *
 * The incident it exists for is in docs/derive-findings.md: the Greek fixtures
 * carried Strong's numbers written from recall, well-formed and wrong, and they
 * survived until something compared them mechanically against the source.
 * Generated entries get that comparison before a reviewer ever sees them.
 *
 * Read-only. It never repairs, re-flags or promotes an entry: a finding is a
 * measurement of the prompt or the model, and editing the entry would destroy it.
 */

import type { DatabaseSync } from "node:sqlite";

import {
  BOOK_CODES,
  PericopeEntrySchema,
  VerseEntrySchema,
  isBookCode,
  parseVerseRef,
  validatePericopeEntry,
  validateVerseEntry,
  type Claim,
  type Finding,
  type LexicalEvidenceRef,
  type VerseRange,
} from "@yada/schema";

import { compareGloss, deriveVerseFrom } from "./derive.js";
import { checkNoteParse } from "./parse-check.js";

export const PIPELINE_RULES = {
  SCHEMA_PARSE: "schema-parse",
  LEXICAL_IN_SOURCE: "lexical-evidence-in-source",
  VERSE_REF_IN_STAGING: "verse-ref-in-staging",
  RELATED_IN_STAGING: "related-passage-in-staging",
  GLOSS_MATCHES_DERIVED: "gloss-matches-derived",
  /** A parse, morph code or Strong's number in a lexical note must be the source's (CLAUDE.md rule 4). */
  PARSE_IN_SOURCE: "lexical-parse-in-source",
} as const;

export interface EntryFinding extends Finding {
  entry: string;
}

export interface RuleTally {
  errors: number;
  warnings: number;
  entries: Set<string>;
}

export interface BookValidation {
  book: string;
  verseEntries: number;
  pericopeEntries: number;
  /** False when staging has no text for the book, so nothing could resolve. */
  stagingReady: boolean;
  findings: EntryFinding[];
  byRule: Map<string, RuleTally>;
}

function ordinal(chapter: number, verse: number): number {
  return chapter * 1000 + verse;
}

interface ScopeToken {
  verseId: string;
  surface: string;
  lemma: string;
  strongs: Set<string>;
  /** The whole-word code: `HC/Vqq2ms`, `V- 3PAD-P--`. */
  morph: string;
  greek: boolean;
}

/**
 * MorphGNT parenthesises optional endings (`οὕτω(ς)`); a citation of either
 * spelling is a citation of that token, as lexicon.ts already concedes.
 */
function lemmaForms(lemma: string): Set<string> {
  const nfc = lemma.normalize("NFC").trim();
  const forms = new Set([nfc]);
  if (nfc.includes("(")) {
    forms.add(nfc.replace(/[()]/g, ""));
    forms.add(nfc.replace(/\([^)]*\)/g, ""));
  }
  return forms;
}

function tokensInRanges(db: DatabaseSync, ranges: readonly VerseRange[]): ScopeToken[] {
  const statement = db.prepare(
    `SELECT t.verse_id, t.surface, t.lemma, t.strongs, t.morph, t.morphemes
     FROM tokens t JOIN verses v ON v.verse_id = t.verse_id
     WHERE v.book = ? AND (v.chapter * 1000 + v.verse) BETWEEN ? AND ?`,
  );
  const seen = new Set<string>();
  const tokens: ScopeToken[] = [];
  for (const range of ranges) {
    const rows = statement.all(
      range.book,
      ordinal(range.start.chapter, range.start.verse),
      ordinal(range.end.chapter, range.end.verse),
    );
    for (const row of rows) {
      const verseId = String(row["verse_id"]);
      const strongs = new Set<string>();
      if (row["strongs"] != null) strongs.add(String(row["strongs"]));
      // A Hebrew word's prefixes and suffix carry their own lemma references;
      // citing the preposition's number is citing something the word contains.
      if (row["morphemes"] != null) {
        for (const m of JSON.parse(String(row["morphemes"])) as Array<{ strongs?: string }>) {
          if (m.strongs !== undefined) strongs.add(m.strongs);
        }
      }
      // The morph is part of identity: one lemma twice in a verse with two
      // parses is two things a note can be right or wrong about.
      const key = `${verseId}#${String(row["lemma"])}#${[...strongs].join(",")}#${String(row["morph"])}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push({
        verseId,
        surface: String(row["surface"]),
        lemma: String(row["lemma"]),
        strongs,
        morph: String(row["morph"]),
        greek: BOOK_CODES[range.book].testament === "NT",
      });
    }
  }
  return tokens;
}

/** The tokens a lexical ref names, by the matching rules described on checkLexicalRef. */
function citedTokens<T extends Pick<ScopeToken, "lemma" | "strongs" | "greek">>(
  ref: LexicalEvidenceRef,
  scope: readonly T[],
): T[] {
  const cited = lemmaForms(ref.lemma);
  return scope.filter((token) => {
    if (ref.strongs !== undefined && !token.strongs.has(ref.strongs)) return false;
    if (!token.greek) return ref.strongs !== undefined;
    return [...lemmaForms(token.lemma)].some((form) => cited.has(form));
  });
}

/**
 * Does the cited lexical item exist in the supplied source data?
 *
 * Greek tokens carry MorphGNT headwords, so lemma and Strong's are both
 * checkable and must sit on the *same* token: γυνή cited with G0435 is an
 * invented pairing even if both exist somewhere in the passage. Hebrew tokens
 * carry OSHB lemma references (`b/7225`), not headwords, so a Hebrew citation is
 * checkable only through its Strong's number — and one without a number cannot
 * be shown to exist, which the 0C bar treats as not existing.
 */
export function checkLexicalRef(
  ref: LexicalEvidenceRef,
  scope: ReadonlyArray<Pick<ScopeToken, "lemma" | "strongs" | "greek">>,
): string | null {
  if (citedTokens(ref, scope).length > 0) return null;

  if (ref.strongs === undefined && scope.length > 0 && scope.every((t) => !t.greek)) {
    return `lexical ref "${ref.lemma}" has no Strong's number, and Hebrew source tokens carry lemma references rather than headwords, so it cannot be shown to exist`;
  }
  const pairedWith = ref.strongs === undefined
    ? []
    : [...new Set(scope.filter((t) => t.greek && t.strongs.has(ref.strongs as string)).map((t) => t.lemma))];
  if (pairedWith.length > 0) {
    return `lexical ref "${ref.lemma}" ${ref.strongs}: the source pairs ${ref.strongs} with ${pairedWith.join(", ")}, not ${ref.lemma}`;
  }
  return `lexical ref "${ref.lemma}"${ref.strongs === undefined ? "" : ` ${ref.strongs}`} does not occur in the entry's verse or any verse the claim cites`;
}

function verseExists(db: DatabaseSync, verseId: string): boolean {
  // texts is the English corpus; verses also holds Hebrew-only verse-0
  // superscriptions, which are real addresses with no English row.
  return (
    db.prepare("SELECT 1 FROM texts WHERE verse_id = ? LIMIT 1").get(verseId) !== undefined ||
    db.prepare("SELECT 1 FROM verses WHERE verse_id = ? LIMIT 1").get(verseId) !== undefined
  );
}

/** A range resolves when both its ends exist; a gap inside it is not a citation error. */
function missingEnds(db: DatabaseSync, range: VerseRange): string[] {
  const ends = [
    `${range.book}.${range.start.chapter}.${range.start.verse}`,
    `${range.book}.${range.end.chapter}.${range.end.verse}`,
  ];
  return [...new Set(ends)].filter((id) => !verseExists(db, id));
}

function verseRefsOf(claim: Claim): string[] {
  return [...claim.evidence, ...(claim.positions ?? []).flatMap((p) => p.evidence)]
    .filter((ref) => ref.type === "verse")
    .map((ref) => (ref as { ref: string }).ref);
}

function checkClaims(
  db: DatabaseSync,
  claims: readonly Claim[],
  base: readonly VerseRange[],
  push: (f: Finding) => void,
): void {
  for (const claim of claims) {
    const cited: VerseRange[] = [];
    for (const ref of verseRefsOf(claim)) {
      const range = parseVerseRef(ref);
      // An unparseable ref is already an error from the schema validator.
      if (range === null) continue;
      cited.push(range);
      const missing = missingEnds(db, range);
      if (missing.length > 0) {
        push({
          level: "error",
          rule: PIPELINE_RULES.VERSE_REF_IN_STAGING,
          claimId: claim.id,
          message: `verse evidence "${ref}" does not resolve in staging (${missing.join(", ")} absent)`,
        });
      }
    }

    // Scope is the entry's own verse plus every verse this claim cites, so
    // "the same verb in v. 28" is checked against v. 28 rather than failing
    // for not being in v. 34.
    const scope = tokensInRanges(db, [...base, ...cited]);
    for (const ref of [...claim.evidence, ...(claim.positions ?? []).flatMap((p) => p.evidence)]) {
      if (ref.type !== "lexical") continue;
      const problem = checkLexicalRef(ref, scope);
      if (problem !== null) {
        push({ level: "error", rule: PIPELINE_RULES.LEXICAL_IN_SOURCE, claimId: claim.id, message: problem });
        continue;
      }
      for (const { level, message } of checkNoteParse(ref.lemma, ref.note, citedTokens(ref, scope), scope)) {
        push({ level, rule: PIPELINE_RULES.PARSE_IN_SOURCE, claimId: claim.id, message });
      }
    }
  }
}

function checkRelated(db: DatabaseSync, related: ReadonlyArray<{ ref: string }>, push: (f: Finding) => void): void {
  for (const passage of related) {
    const range = parseVerseRef(passage.ref);
    if (range === null) continue;
    const missing = missingEnds(db, range);
    if (missing.length > 0) {
      push({
        level: "error",
        rule: PIPELINE_RULES.RELATED_IN_STAGING,
        message: `related passage "${passage.ref}" does not resolve in staging (${missing.join(", ")} absent)`,
      });
    }
  }
}

export function validateBook(db: DatabaseSync, book: string): BookValidation {
  const report: BookValidation = {
    book,
    verseEntries: 0,
    pericopeEntries: 0,
    stagingReady: false,
    findings: [],
    byRule: new Map(),
  };
  if (!isBookCode(book)) throw new Error(`unknown book ${book}`);

  report.stagingReady =
    db.prepare("SELECT 1 FROM texts WHERE verse_id LIKE ? LIMIT 1").get(`${book}.%`) !== undefined;

  const record = (entry: string) => (f: Finding) => {
    report.findings.push({ ...f, entry });
    const tally = report.byRule.get(f.rule) ?? { errors: 0, warnings: 0, entries: new Set<string>() };
    if (f.level === "error") tally.errors += 1;
    else tally.warnings += 1;
    tally.entries.add(entry);
    report.byRule.set(f.rule, tally);
  };

  const verseRows = db
    .prepare("SELECT verse_id, payload FROM entries WHERE verse_id LIKE ? ORDER BY verse_id")
    .all(`${book}.%`);
  for (const row of verseRows) {
    const id = String(row["verse_id"]);
    const push = record(id);
    report.verseEntries += 1;
    const parsed = VerseEntrySchema.safeParse(JSON.parse(String(row["payload"])));
    if (!parsed.success) {
      push({
        level: "error",
        rule: PIPELINE_RULES.SCHEMA_PARSE,
        message: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
      continue;
    }
    const entry = parsed.data;
    for (const finding of validateVerseEntry(entry)) push(finding);

    const own = parseVerseRef(entry.verse_id);
    checkClaims(db, entry.claims, own === null ? [] : [own], push);
    checkRelated(db, entry.related_passages, push);

    const derived = deriveVerseFrom(db, entry.verse_id);
    if (derived.length === 0) {
      push({
        level: "error",
        rule: PIPELINE_RULES.GLOSS_MATCHES_DERIVED,
        message: `staging has no tokens for ${entry.verse_id}, so its gloss cannot be checked`,
      });
    } else {
      const comparison = compareGloss(derived, entry.gloss);
      if (comparison.derivedWords !== comparison.fixtureWords) {
        push({
          level: "error",
          rule: PIPELINE_RULES.GLOSS_MATCHES_DERIVED,
          message: `gloss has ${comparison.fixtureWords} words, derivation has ${comparison.derivedWords}`,
        });
      }
      for (const line of [
        ...comparison.surfaceMismatches,
        ...comparison.strongsMismatches,
        ...comparison.morphemeMismatches,
      ]) {
        push({
          level: "error",
          rule: PIPELINE_RULES.GLOSS_MATCHES_DERIVED,
          // compareGloss names its sides after the oracle; here the entry is the fixture.
          message: line.replace("fixture", "entry"),
        });
      }
    }
  }

  const pericopeRows = db
    .prepare("SELECT pericope_id, payload FROM pericope_entries WHERE pericope_id LIKE ? ORDER BY pericope_id")
    .all(`${book}.%`);
  for (const row of pericopeRows) {
    const id = String(row["pericope_id"]);
    const push = record(id);
    report.pericopeEntries += 1;
    const parsed = PericopeEntrySchema.safeParse(JSON.parse(String(row["payload"])));
    if (!parsed.success) {
      push({
        level: "error",
        rule: PIPELINE_RULES.SCHEMA_PARSE,
        message: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
      continue;
    }
    for (const finding of validatePericopeEntry(parsed.data)) push(finding);
    const span = parseVerseRef(parsed.data.pericope_id);
    checkClaims(db, parsed.data.claims, span === null ? [] : [span], push);
    checkRelated(db, parsed.data.related_passages ?? [], push);
  }

  return report;
}
