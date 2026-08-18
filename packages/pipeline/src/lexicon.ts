/**
 * Greek lemma -> extended Strong's number, from TBESG.
 *
 * Why this module exists: MorphGNT carries lemma and morphology but **no
 * Strong's numbers**. The seven golden fixtures were hand-authored with Greek
 * Strong's numbers anyway, and the oracle caught it — those numbers came from
 * recall, not from a dataset, which is the one thing the generation prompt
 * forbids ("explain the parsing you are given; never recall parsing from
 * memory"). The rule has to hold for the pipeline too, so the numbers now come
 * from a source that can be cited.
 *
 * Only the *mapping* is used here — Strong's number against lemma form. The
 * Abbott-Smith definitions in the same file are not read, so nothing in the
 * shipped corpus derives from them.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { canonicalStrongs } from "@yada/schema";

import { RAW } from "./paths.js";

export interface LexiconReport {
  entries: number;
  lemmas: number;
  /** Lemma forms that map to more than one Strong's number. */
  ambiguous: string[];
}

/** How a lemma was resolved. Every non-`direct` route is a stated inference. */
export type MatchRoute = "direct" | "variant" | "optional-segment" | "iota-subscript" | "deponent";

/**
 * TBESG writes accents with the polytonic "oxia" codepoints (λόγος as U+1F79)
 * while MorphGNT uses the monotonic "tonos" ones (U+03CC). They look identical
 * and compare unequal. NFC folds oxia onto tonos, so both sides are normalised
 * before they ever meet — without this, common words like λόγος, θεός and γυνή
 * silently fail to match while ὁ and ἐν succeed.
 */
function key(lemma: string): string {
  return lemma.normalize("NFC").trim();
}

const STRONGS_RE = /^G\d{1,5}[a-zA-Z]?$/;

let cache: { map: Map<string, string>; report: LexiconReport } | null = null;

export function loadGreekLexicon(): { map: Map<string, string>; report: LexiconReport } {
  if (cache !== null) return cache;

  const file = path.join(RAW, "TBESG.txt");
  const empty = { map: new Map<string, string>(), report: { entries: 0, lemmas: 0, ambiguous: [] } };
  if (!existsSync(file)) return empty;

  const byLemma = new Map<string, Set<string>>();
  let entries = 0;

  const add = (lemma: string, strongs: string): void => {
    if (lemma === "") return;
    const existing = byLemma.get(lemma);
    if (existing === undefined) byLemma.set(lemma, new Set([strongs]));
    else existing.add(strongs);
  };

  for (const line of readFileSync(file, "utf8").split("\n")) {
    const columns = line.split("\t");
    if (columns.length < 5) continue;
    const raw = (columns[0] ?? "").trim();
    const cell = key(columns[3] ?? "");
    if (!STRONGS_RE.test(raw) || cell === "") continue;
    const strongs = canonicalStrongs(raw, "G");
    if (strongs === undefined) continue;
    entries += 1;

    // One cell can hold several accepted spellings of the same headword, comma
    // separated: `Μωϋσῆς, Μωσῆς`. Indexing the cell verbatim matches neither.
    for (const variant of cell.split(",")) add(key(variant), strongs);
  }

  // An ambiguous lemma is left unmapped rather than guessed. 0.2% of forms are
  // ambiguous, and a wrong Strong's number is worse than an absent one: it is
  // indistinguishable from a correct one downstream.
  const map = new Map<string, string>();
  const ambiguous: string[] = [];
  for (const [lemma, numbers] of byLemma) {
    if (numbers.size === 1) map.set(lemma, [...numbers][0] as string);
    else ambiguous.push(lemma);
  }

  cache = { map, report: { entries, lemmas: byLemma.size, ambiguous } };
  return cache;
}

/**
 * Drop the iota subscript (combining ypogegrammeni). MorphGNT writes
 * ἀποθνῄσκω, TBESG writes ἀποθνήσκω — the same verb under two orthographic
 * conventions, which NFC cannot reconcile because the letters genuinely differ.
 */
function withoutIotaSubscript(lemma: string): string {
  return lemma.normalize("NFD").replace(/ͅ/g, "").normalize("NFC");
}

/** `οὕτω(ς)` -> [`οὕτως`, `οὕτω`]: MorphGNT parenthesises an optional ending. */
function optionalSegmentForms(lemma: string): string[] {
  if (!lemma.includes("(")) return [];
  return [lemma.replace(/[()]/g, ""), lemma.replace(/\([^)]*\)/g, "")];
}

/**
 * TBESG cites the active headword where MorphGNT cites the deponent: `ἀποκρίνω`
 * against `ἀποκρίνομαι`, and likewise πορεύομαι, φοβέομαι, ἐκπορεύομαι.
 *
 * This is the one route here that is a rule rather than a spelling fix, so it is
 * the most restricted: it fires only after every other route has missed, and
 * only when the transformed form maps to exactly one number. It is reported as
 * its own class so its contribution stays visible and can be withdrawn.
 */
function deponentForms(lemma: string): string[] {
  if (!lemma.endsWith("ομαι")) return [];
  return [`${lemma.slice(0, -"ομαι".length)}ω`];
}

export interface LemmaMatch {
  strongs: string;
  route: MatchRoute;
}

export function matchGreekLemma(lemma: string): LemmaMatch | undefined {
  const { map } = loadGreekLexicon();
  const normalized = key(lemma);

  const direct = map.get(normalized);
  if (direct !== undefined) return { strongs: direct, route: "direct" };

  for (const candidate of optionalSegmentForms(normalized)) {
    const hit = map.get(candidate);
    if (hit !== undefined) return { strongs: hit, route: "optional-segment" };
  }

  const folded = map.get(withoutIotaSubscript(normalized));
  if (folded !== undefined) return { strongs: folded, route: "iota-subscript" };

  for (const candidate of deponentForms(normalized)) {
    const hit = map.get(candidate) ?? map.get(withoutIotaSubscript(candidate));
    if (hit !== undefined) return { strongs: hit, route: "deponent" };
  }

  return undefined;
}

export function greekStrongs(lemma: string): string | undefined {
  return matchGreekLemma(lemma)?.strongs;
}
