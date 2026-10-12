/**
 * The passage guide's content rules (canvas PG-01–10, ON-04), pure so they
 * are tested once: which reviewed-entry claims a guide shows, where each one
 * points in words, which English words its evidence marks, and the
 * passage-level fields a newer pericope payload may carry.
 *
 * Nothing here writes prose. Every line a guide shows is a field of an entry,
 * a pericope payload or the passage text (rule 2: generated content is shown
 * as it was written and flagged as unreviewed).
 */

import type { Claim, EvidenceRef } from "@yada/schema";

// ---------------------------------------------------------------------------
// Which claims a guide shows
// ---------------------------------------------------------------------------

export interface GuidePick {
  /** The verse entry the guide is built from. */
  readonly entry: string;
  /** Three things to notice, in the canvas's order. Claim id suffixes ("c9"). */
  readonly notice: readonly string[];
  /** Where readers differ. */
  readonly differ: readonly string[];
  /** The notice row that carries "Closer to the Greek", and the lemma it opens. */
  readonly closer?: { readonly claim: string; readonly lemma: string };
}

/**
 * Until the John batch writes passage payloads, two passages have a full
 * guide, each built from one golden verse entry exactly as the canvas drew it
 * (PG-02–05, PG-07–09; John confirmed the scope 11 Oct 2026). The picks are a
 * choice among the entry's own claims, not new content. Every other passage
 * gets the fallback guide: a study note as the opener, the text, Next.
 */
export const GUIDE_PICKS: Readonly<Record<string, GuidePick>> = {
  "JHN.1.1-1.18": { entry: "JHN.1.1", notice: ["c9", "c2", "c10"], differ: ["c11", "c12"], closer: { claim: "c10", lemma: "λόγος" } },
  "1CO.14.26-14.40": { entry: "1CO.14.34", notice: ["c3", "c5", "c6"], differ: ["c7", "c9"], closer: { claim: "c3", lemma: "σιγάω" } },
};

/** The claims named by `ids`, in that order; an id the entry lacks is skipped, never invented. */
export function pickClaims(claims: readonly Claim[], ids: readonly string[]): Claim[] {
  const bySuffix = new Map(claims.map((c) => [c.id.slice(c.id.lastIndexOf(".") + 1), c]));
  return ids.map((id) => bySuffix.get(id)).filter((c): c is Claim => c !== undefined);
}

/**
 * "Where we are" before a passage payload exists: the entry's first sentence
 * of What's happening, verbatim (canvas `first_sentence`).
 */
export function firstSentence(text: string): string {
  const at = text.indexOf(". ");
  return at < 0 ? text : text.slice(0, at + 1);
}

// ---------------------------------------------------------------------------
// Where a claim points, in words
// ---------------------------------------------------------------------------

function parts(ref: string): { chapter: number; verse: number; endChapter: number; endVerse: number } | null {
  // BOOK.c.v, BOOK.c.v-v2, BOOK.c.v-c2.v2
  const m = /^[1-3A-Z]{3}\.(\d+)\.(\d+)(?:-(?:(\d+)\.)?(\d+))?$/u.exec(ref);
  if (m === null) return null;
  const chapter = Number(m[1]);
  const verse = Number(m[2]);
  return {
    chapter,
    verse,
    endChapter: m[3] === undefined ? chapter : Number(m[3]),
    endVerse: m[4] === undefined ? verse : Number(m[4]),
  };
}

/**
 * "1:1 · Background" meant nothing to a reader (John, 11 Oct 2026), so a
 * guide row says which verse in words: "Verse 1", "Verses 28, 30",
 * "Verses 34–35"; a verse outside the passage's chapter keeps its chapter
 * ("Chapter 11, verse 5"). The claim's own verse references, or the entry's
 * verse when it cites none.
 */
export function claimPlace(evidence: readonly EvidenceRef[], entryVerseId: string, chapter: number): string {
  const refs = evidence.filter((e): e is Extract<EvidenceRef, { type: "verse" }> => e.type === "verse").map((e) => e.ref);
  const all = (refs.length > 0 ? refs : [entryVerseId]).map(parts).filter((p) => p !== null);
  if (all.length === 0) return "";
  const first = all[0];
  if (first !== undefined && first.chapter !== chapter) {
    return `Chapter ${first.chapter}, verse ${first.verse}${first.endVerse !== first.verse ? `–${first.endVerse}` : ""}`;
  }
  const inChapter = all.filter((p) => p.chapter === chapter && p.endChapter === chapter);
  const spans = inChapter.map((p) => (p.endVerse === p.verse ? String(p.verse) : `${p.verse}–${p.endVerse}`));
  const unique = [...new Set(spans)];
  const plural = unique.length > 1 || unique.some((s) => s.includes("–"));
  return `${plural ? "Verses" : "Verse"} ${unique.join(", ")}`;
}

// ---------------------------------------------------------------------------
// Marking a claim's evidence in the passage (PG-10)
// ---------------------------------------------------------------------------

export interface GuideToken {
  readonly lemma: string;
  readonly gloss: string | null;
}

export interface EvidenceMarks {
  /** The English the marks fall on: "was". */
  readonly word: string;
  /** Character ranges [start, end) per verse ord, in that verse's text. */
  readonly ranges: ReadonlyMap<number, ReadonlyArray<readonly [number, number]>>;
  readonly count: number;
  /** The verse numbers marked, for the VoiceOver status line. */
  readonly verses: readonly number[];
}

const strip = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * The words in the passage's English that a claim's evidence is about, or
 * null when that cannot be said from the data.
 *
 * The bundle has no word alignment between the English and the Greek (the
 * occurrences sheet says the same: guessing one would state a match the data
 * does not contain, rule 4). So a mark is made only where it is unambiguous:
 * the claim cites a verse and a lemma; every token of that lemma in the verse
 * carries the same STEPBible gloss; and that gloss occurs as a whole word in
 * the verse's English exactly as many times as the lemma does in the Greek.
 * John 1:1's three ἦν, glossed "was", against the BSB's three "was" pass;
 * anything less certain marks nothing and the row opens its evidence instead.
 */
export function evidenceMarks(
  claim: Pick<Claim, "evidence">,
  verses: ReadonlyArray<{ readonly ord: number; readonly verseId: string; readonly text: string; readonly tokens: readonly GuideToken[] }>,
): EvidenceMarks | null {
  const lemmas = claim.evidence.filter((e): e is Extract<EvidenceRef, { type: "lexical" }> => e.type === "lexical").map((e) => strip(e.lemma));
  const cited = new Set(claim.evidence.filter((e) => e.type === "verse").map((e) => (e as { ref: string }).ref));
  if (lemmas.length !== 1 || cited.size === 0) return null;
  const lemma = lemmas[0] ?? "";
  const ranges = new Map<number, Array<readonly [number, number]>>();
  const marked: number[] = [];
  let word: string | null = null;
  for (const v of verses) {
    if (!cited.has(v.verseId)) continue;
    const tokens = v.tokens.filter((t) => strip(t.lemma) === lemma);
    if (tokens.length === 0) return null;
    const glosses = new Set(tokens.map((t) => (t.gloss ?? "").trim().toLowerCase()));
    const gloss = [...glosses][0] ?? "";
    if (glosses.size !== 1 || gloss === "" || (word !== null && word !== gloss)) return null;
    word = gloss;
    const found = [...v.text.matchAll(new RegExp(`(?<![\\p{L}’'])${escape(gloss)}(?![\\p{L}’'])`, "giu"))];
    if (found.length !== tokens.length) return null;
    ranges.set(v.ord, found.map((m) => [m.index, m.index + m[0].length] as const));
    marked.push(v.ord % 1000);
  }
  if (word === null || marked.length !== cited.size) return null;
  const count = [...ranges.values()].reduce((n, r) => n + r.length, 0);
  return { word, ranges, count, verses: marked };
}

/** What VoiceOver hears when marks appear (PG-10): `"was" marked 3 times in verse 1.` */
export function marksAnnouncement(marks: EvidenceMarks): string {
  const times = marks.count === 1 ? "once" : `${marks.count} times`;
  const where = marks.verses.length === 1 ? `verse ${marks.verses[0]}` : `verses ${marks.verses.join(", ")}`;
  return `“${marks.word}” marked ${times} in ${where}.`;
}

// ---------------------------------------------------------------------------
// Passage-level fields from a newer pericope payload
// ---------------------------------------------------------------------------

export interface GuideFields {
  /** Where we are: one sentence (pericope@1.5.0). */
  readonly orientation?: string;
  /** How the passage moves: 2–5 short steps. */
  readonly moves?: readonly string[];
  /** One question pointing at something in the text. */
  readonly lookFirst?: string;
}

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/**
 * Whether the guide shows Yada text from the pericope itself, so its review status decides the
 * Unreviewed label. Fields read from a payload the schema rejected count too (gate review,
 * 11 Oct 2026): otherwise a draft orientation could show unlabelled.
 */
export function showsPericopeText(parsed: boolean, fields: GuideFields): boolean {
  return parsed || Object.keys(fields).length > 0;
}

/**
 * Reads the passage-guide fields that branch passage-guide-fields adds to the
 * pericope schema, from the raw payload, without depending on that branch:
 * the schema in this build strips unknown keys, so they are read here, typed,
 * and dropped when malformed. Missing fields show nothing.
 */
export function guideFields(payload: string | null): GuideFields {
  if (payload === null || payload === "") return {};
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return {};
  }
  if (json === null || typeof json !== "object") return {};
  const o = json as Record<string, unknown>;
  const moves = Array.isArray(o["moves"]) && o["moves"].length > 0 && o["moves"].every(nonEmpty) ? (o["moves"] as string[]) : undefined;
  return {
    ...(nonEmpty(o["orientation"]) ? { orientation: o["orientation"] } : {}),
    ...(moves !== undefined ? { moves } : {}),
    ...(nonEmpty(o["look_first"]) ? { lookFirst: o["look_first"] } : {}),
  };
}
