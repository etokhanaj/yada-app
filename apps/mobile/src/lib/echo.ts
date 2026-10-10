/**
 * D-03, the echo pair: when a Go deeper passage opens with the same words as
 * the verse it came from, the peek shows the two openings side by side. The
 * match is on the sourced glosses only (STEPBible), never on a judgement:
 * John 1:1 Ἐν ἀρχῇ "In" + "beginning" and Genesis 1:1 בְּרֵאשִׁית "in
 * beginning" both gloss to "in beginning".
 */

export interface GlossedWord {
  readonly surface: string;
  readonly gloss: string | null;
}

const fold = (s: string) => s.toLowerCase().replace(/[^\p{L}\s]/gu, "").replace(/\s+/g, " ").trim();

function joined(words: readonly GlossedWord[], n: number): string | null {
  const glosses = words.slice(0, n).map((w) => w.gloss);
  if (glosses.length < n || glosses.some((g) => g === null)) return null;
  return fold(glosses.join(" "));
}

/**
 * The longest shared opening, up to three words a side, of at least two
 * English words so a lone "and" or "the" is never called an echo.
 */
export function sameOpening(
  a: readonly GlossedWord[],
  b: readonly GlossedWord[],
): { a: GlossedWord[]; b: GlossedWord[]; gloss: string } | null {
  let best: { a: GlossedWord[]; b: GlossedWord[]; gloss: string } | null = null;
  for (let i = 1; i <= 3; i++) {
    for (let j = 1; j <= 3; j++) {
      const ga = joined(a, i);
      if (ga === null || ga !== joined(b, j) || ga.split(" ").length < 2) continue;
      if (best === null || ga.length > best.gloss.length) best = { a: a.slice(0, i), b: b.slice(0, j), gloss: ga };
    }
  }
  return best;
}
