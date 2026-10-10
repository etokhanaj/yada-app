/**
 * The evidence layer's wording, derived only from what a claim carries
 * (rule 4: never state what the data does not contain). Pure, so each rule is
 * tested against the golden entries.
 */

import type { Claim, EvidenceRef, Relationship } from "@yada/schema";

/**
 * Brief §8 decision 4: a label only for the exceptions. Strong, data-grounded
 * claims carry none; disputed ones show their readings instead.
 */
export function claimLabel(claim: Pick<Claim, "grounding" | "evidence_strength">): "Supported" | "Background" | null {
  if (claim.grounding === "model_knowledge") return "Background";
  if (claim.evidence_strength === "supported") return "Supported";
  return null;
}

/** "MorphGNT/SBLGNT @ aaed91e" → "MorphGNT"; "OSHB morphhb @ 3d15126" → "OSHB". The pin is provenance, not a name. */
export function datasetName(dataset: string): string {
  const name = dataset.split(" @ ")[0]?.trim() ?? dataset;
  if (name.startsWith("MorphGNT")) return "MorphGNT";
  if (name.startsWith("OSHB")) return "OSHB";
  return name;
}

const PARSING = new Set(["MorphGNT", "OSHB"]);

/**
 * "How we know" (J01-05): one sentence per kind of source the claim's own
 * evidence names, from its grounding and datasets and nothing else.
 */
export function howWeKnow(
  claim: Pick<Claim, "grounding" | "evidence">,
  script: "greek" | "hebrew",
  currentVerseId: string,
): string | null {
  if (claim.grounding === "model_knowledge") {
    return "Background knowledge, not a dataset Yada ships, so it is never marked strong.";
  }
  const language = script === "hebrew" ? "Hebrew" : "Greek";
  const parsing = new Set<string>();
  const lexicons = new Set<string>();
  const apparatus = new Set<string>();
  for (const e of claim.evidence) {
    if (e.type === "lexical" && e.dataset !== undefined) {
      const name = datasetName(e.dataset);
      (PARSING.has(name) ? parsing : lexicons).add(name);
    } else if (e.type === "apparatus") {
      // "MorphGNT/SBLGNT @ …": the markers are the edition's, SBLGNT.
      const edition = e.dataset === undefined ? "" : ((e.dataset.split(" @ ")[0] ?? "").split("/").pop() ?? "").trim();
      apparatus.add(edition === "" ? `the ${language} text` : edition);
    }
  }
  const sentences: string[] = [];
  if (parsing.size > 0) sentences.push(`From the ${language} text and its parsing (${[...parsing].join(", ")}).`);
  if (apparatus.size > 0) sentences.push(`From the variant markers in ${[...apparatus].join(", ")}.`);
  if (lexicons.size > 0) sentences.push(`From the ${[...lexicons].join(", ")}.`);
  if (sentences.length === 0) {
    // Only promise passages that will be drawn: verseLinks never shows the open verse.
    const verses = claim.evidence.filter((e) => e.type === "verse");
    if (verses.some((e) => e.ref !== currentVerseId)) sentences.push("From the text of the passages below.");
    else if (verses.length > 0) sentences.push("From the text of this verse.");
    else return null;
  }
  return sentences.join(" ");
}

/** How a related passage relates, as the Go deeper row and peek name it. */
export const RELATIONSHIP_LABEL: Readonly<Record<Relationship, string>> = {
  parallel: "Parallel",
  quotation: "Quotes",
  allusion: "Echoes",
  thematic: "Same theme",
  development: "Develops",
  contrast: "Contrast",
  fulfillment: "Fulfils",
};

/**
 * "Who the instruction addresses is disputed." → "Who the instruction addresses".
 * Debated claims restate their label (a pipeline content note in brief §7);
 * the readings sheet asks the question instead.
 */
export function readingsTitle(claimText: string): string {
  return claimText.replace(/\s+is disputed\.?$/u, "").replace(/\.$/u, "");
}

/** Verse refs a claim or reading points to, without the verse already open (v2-review X2). */
export function verseLinks(evidence: readonly EvidenceRef[], currentVerseId: string): Array<{ ref: string; note?: string }> {
  return evidence
    .filter((e): e is Extract<EvidenceRef, { type: "verse" }> => e.type === "verse")
    .filter((e) => e.ref !== currentVerseId)
    .map((e) => (e.note === undefined ? { ref: e.ref } : { ref: e.ref, note: e.note }));
}

/**
 * Lexical notes worth a line: a parse code that only restates the claim
 * ("V-PAM-3P", v2-review S2) is dropped.
 */
export function lexicalNotes(evidence: readonly EvidenceRef[]): Array<{ lemma: string; note: string; dataset: string | null }> {
  return evidence
    .filter((e): e is Extract<EvidenceRef, { type: "lexical" }> => e.type === "lexical")
    .filter((e) => e.note !== undefined && !/^[A-Z0-9]{1,4}(-[A-Z0-9]+)+$/u.test(e.note))
    .map((e) => ({ lemma: e.lemma, note: e.note ?? "", dataset: e.dataset === undefined ? null : datasetName(e.dataset) }));
}

/**
 * The word in this verse a claim is about: the first lexical evidence's lemma,
 * matched against the verse's tokens. The surface the claim itself quotes wins
 * when the lemma occurs more than once.
 */
export function claimWord<T extends { lemma: string; surface: string; position: number }>(
  claim: Pick<Claim, "claim" | "evidence">,
  tokens: readonly T[],
): T | null {
  const lemma = claim.evidence.find((e): e is Extract<EvidenceRef, { type: "lexical" }> => e.type === "lexical")?.lemma;
  if (lemma === undefined) return null;
  const strip = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");
  const matches = tokens.filter((t) => strip(t.lemma) === strip(lemma));
  return matches.find((t) => claim.claim.includes(t.surface)) ?? matches[0] ?? null;
}
