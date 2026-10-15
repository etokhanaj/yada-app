import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { certainPairs, emptyCounts, addCounts, fileLines, textLines, linkVerse, normaliseWord, phraseKind, phraseWords, tableVerses, type CoreToken, type TableVerse } from "./wordLinks.js";

// Real rows from content/raw/bsb-tables/bsb_tables.tsv (public domain), copied unaltered: Genesis 1:1,
// John 1:1 and John 1:18. Tokens and BSB text below are core.v5.db's, as stored.
const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/bsb-tables/mm03.tsv");
const verses = tableVerses(readFileSync(FIXTURE, "utf8"));
const table = (ref: string): TableVerse => {
  const v = verses.find((x) => x.ref === ref);
  if (v === undefined) throw new Error(`fixture has no ${ref}`);
  return v;
};
const toks = (rows: Array<[string, string]>): CoreToken[] => rows.map(([surface, strongs], i) => ({ position: i + 1, surface, strongs }));

/** [start, end) of the nth (1-based) whole-word occurrence of `word`. */
function at(text: string, word: string, nth = 1): [number, number] {
  let from = 0;
  for (let k = 1; ; k++) {
    const i = text.indexOf(word, from);
    if (i === -1) throw new Error(`${word} #${nth} not in text`);
    const before = text[i - 1];
    const after = text[i + word.length];
    const whole = (before === undefined || !/\p{L}/u.test(before)) && (after === undefined || !/\p{L}/u.test(after));
    if (whole && k === nth) return [i, i + word.length];
    if (!whole) k--;
    from = i + 1;
  }
}

const JHN_1_1 = "In the beginning was the Word, and the Word was with God, and the Word was God.";
const JHN_1_1_TOKENS = toks([
  ["Ἐν", "G1722"], ["ἀρχῇ", "G0746"], ["ἦν", "G1510"], ["ὁ", "G3588"], ["λόγος", "G3056"], ["καὶ", "G2532"], ["ὁ", "G3588"], ["λόγος", "G3056"], ["ἦν", "G1510"],
  ["πρὸς", "G4314"], ["τὸν", "G3588"], ["θεόν", "G2316"], ["καὶ", "G2532"], ["θεὸς", "G2316"], ["ἦν", "G1510"], ["ὁ", "G3588"], ["λόγος", "G3056"],
]);

const GEN_1_1 = "In the beginning God created the heavens and the earth.";
const GEN_1_1_TOKENS = toks([["בְּרֵאשִׁ֖ית", "H7225"], ["בָּרָ֣א", "H1254a"], ["אֱלֹהִ֑ים", "H0430"], ["אֵ֥ת", "H0853"], ["הַשָּׁמַ֖יִם", "H8064"], ["וְאֵ֥ת", "H0853"], ["הָאָֽרֶץ", "H0776"]]);

const JHN_1_18 = "No one has ever seen God, but the one and only Son, who is Himself God and is at the Father’s side, has made Him known.";
const JHN_1_18_TOKENS = toks([
  ["θεὸν", "G2316"], ["οὐδεὶς", "G3762"], ["ἑώρακεν", "G3708"], ["πώποτε", "G4455"], ["μονογενὴς", "G3439"], ["θεὸς", "G2316"], ["ὁ", "G3588"], ["ὢν", "G1510"],
  ["εἰς", "G1519"], ["τὸν", "G3588"], ["κόλπον", "G2859"], ["τοῦ", "G3588"], ["πατρὸς", "G3962"], ["ἐκεῖνος", "G1565"], ["ἐξηγήσατο", "G1834"],
]);

/**
 * Brute force for certainPairs: every pair of equal-length index sets that spell the same non-empty
 * words, the longest of them, and the pairs all of those share.
 */
function allLcsIntersection(a: readonly string[], b: readonly string[]): Array<[number, number]> {
  const subsets = (n: number): number[][] => Array.from({ length: 2 ** n }, (_, mask) => Array.from({ length: n }, (_, i) => i).filter((i) => (mask >> i) & 1));
  let best = 0;
  let shared = new Set<string>();
  for (const s of subsets(a.length)) {
    for (const u of subsets(b.length)) {
      if (s.length !== u.length || s.length < best || !s.every((i, k) => a[i] !== "" && a[i] === b[u[k]!])) continue;
      const keys = new Set(s.map((i, k) => `${i}:${u[k]!}`));
      if (s.length > best) {
        best = s.length;
        shared = keys;
      } else shared = new Set([...shared].filter((x) => keys.has(x)));
    }
  }
  if (best === 0) return [];
  return [...shared].map((x): [number, number] => x.split(":").map(Number) as [number, number]).sort((x, y) => x[0] - y[0]);
}

const spansOf = (result: ReturnType<typeof linkVerse>): Map<number, Array<[number, number]>> => new Map(result.links.map((l) => [l.position, l.spans]));

describe("MM-03 word links: John 1:1", () => {
  const result = linkVerse(JHN_1_1_TOKENS, JHN_1_1, table("John 1:1"));
  const spans = spansOf(result);

  it("links each Greek word to its BSB phrase, by order and surface", () => {
    expect(spans.get(1)).toEqual([at(JHN_1_1, "In")]);
    expect(spans.get(3)).toEqual([at(JHN_1_1, "was", 1)]);
    expect(spans.get(4)).toEqual([at(JHN_1_1, "the", 2)]);
    expect(spans.get(5)).toEqual([at(JHN_1_1, "Word", 1)]);
    expect(spans.get(8)).toEqual([at(JHN_1_1, "Word", 2)]);
    expect(spans.get(12)).toEqual([at(JHN_1_1, "God", 1)]);
  });

  it("follows the BSB's reordering: θεὸς (word 14) is the last “God”, after “the Word was”", () => {
    expect(spans.get(14)).toEqual([at(JHN_1_1, "God", 2)]);
    expect(spans.get(15)).toEqual([at(JHN_1_1, "was", 3)]);
    expect(spans.get(17)).toEqual([at(JHN_1_1, "Word", 3)]);
  });

  it("leaves a supplied [the] out of ἀρχῇ's underline", () => {
    expect(spans.get(2)).toEqual([at(JHN_1_1, "beginning")]);
  });

  it("gives τὸν (“-” in the tables) nothing, and says why", () => {
    expect(spans.has(11)).toBe(false);
    expect(result.outcomes.get(11)).toBe("none");
  });

  it("links every other token, and skips none", () => {
    expect(result.links).toHaveLength(16);
    expect([...result.outcomes.values()].filter((o) => o === "skipped")).toHaveLength(0);
  });
});

describe("MM-03 word links: Genesis 1:1, Hebrew read right to left", () => {
  const result = linkVerse(GEN_1_1_TOKENS, GEN_1_1, table("Genesis 1:1"));
  const spans = spansOf(result);

  it("pairs by Heb Sort, so the BSB's “God created” reverses the Hebrew's verb-first order", () => {
    expect(spans.get(2)).toEqual([at(GEN_1_1, "created")]);
    expect(spans.get(3)).toEqual([at(GEN_1_1, "God")]);
    expect(at(GEN_1_1, "God")[0]).toBeLessThan(at(GEN_1_1, "created")[0]);
  });

  it("keeps a prefixed word's whole phrase, and matches הָאָֽרֶץ without the tables' sof pasuq", () => {
    expect(spans.get(1)).toEqual([[0, "In the beginning".length]]);
    expect(spans.get(5)).toEqual([[at(GEN_1_1, "the", 2)[0], at(GEN_1_1, "heavens")[1]]]);
    expect(spans.get(7)).toEqual([[at(GEN_1_1, "the", 3)[0], at(GEN_1_1, "earth")[1]]]);
  });

  it("the object marker אֵ֥ת has no English", () => {
    expect(result.outcomes.get(4)).toBe("none");
    expect(spans.get(6)).toEqual([at(GEN_1_1, "and")]);
  });
});

describe("MM-03 word links: John 1:18, “-”, “. . .”, “vvv” and supplied-only rows", () => {
  const result = linkVerse(JHN_1_18_TOKENS, JHN_1_18, table("John 1:18"));
  const spans = spansOf(result);

  it("a row whose English is folded into another's links nothing (πώποτε in “has ever seen”)", () => {
    expect(result.outcomes.get(4)).toBe("folded");
    expect(spans.get(3)).toEqual([[at(JHN_1_18, "has")[0], at(JHN_1_18, "seen")[1]]]);
  });

  it("“[who is Himself] God” underlines only God; “[and]” alone links nothing", () => {
    expect(spans.get(6)).toEqual([at(JHN_1_18, "God", 2)]);
    expect(result.outcomes.get(7)).toBe("supplied");
  });

  it("a supplied word inside a phrase splits the underline: “has made [Him] known”", () => {
    expect(spans.get(15)).toEqual([
      [at(JHN_1_18, "has", 2)[0], at(JHN_1_18, "made")[1]],
      at(JHN_1_18, "known"),
    ]);
  });

  it("“-” rows (ἐκεῖνος) give nothing, and nothing is skipped", () => {
    expect(result.outcomes.get(14)).toBe("none");
    expect([...result.outcomes.values()]).not.toContain("skipped");
  });
});

describe("MM-03 word links: certainty", () => {
  it("a mismatched verse emits nothing: Genesis 1:1's Hebrew against John 1:1's rows", () => {
    const result = linkVerse(GEN_1_1_TOKENS, GEN_1_1, table("John 1:1"));
    expect(result.links).toEqual([]);
    expect([...result.outcomes.values()].every((o) => o === "skipped")).toBe(true);
  });

  it("a BSB text that is not the one the tables translate emits nothing once the order breaks", () => {
    const result = linkVerse(JHN_1_1_TOKENS, "At first was the Word, and the Word was with God, and the Word was God.", table("John 1:1"));
    expect(result.links).toEqual([]);
  });

  it("a word one edition spells differently is paired only when its Strong's number agrees", () => {
    // John 1:34: SBLGNT has ἐκλεκτὸς where the tables' text has υἱὸς (“Son”): different numbers, no link.
    const t: TableVerse = { ref: "John 1:34", language: "Greek", rows: [
      { sort: 1, orig: "ὁ", strong: "3588", english: "the" },
      { sort: 2, orig: "υἱὸς", strong: "5207", english: "Son" },
    ] };
    const r = linkVerse(toks([["ὁ", "G3588"], ["ἐκλεκτὸς", "G1588"]]), "the Son", t);
    expect(r.outcomes.get(2)).toBe("skipped");
    // ἐστι / ἐστιν (movable nu): same number, paired.
    const t2: TableVerse = { ref: "John 6:55", language: "Greek", rows: [
      { sort: 1, orig: "ἐστιν", strong: "1510", english: "is" },
      { sort: 2, orig: "ἀληθής", strong: "227", english: "real" },
    ] };
    expect(linkVerse(toks([["ἐστι", "G1510"], ["ἀληθής", "G0227"]]), "is real", t2).outcomes.get(1)).toBe("linked");
  });

  it("a repeated word that could pair either way is left out", () => {
    // ὁ ὁ λόγος against ὁ λόγος: which ὁ is unclear, so neither is certain; λόγος is.
    expect(certainPairs(["ο", "ο", "λογοσ"], ["ο", "λογοσ"])).toEqual([[2, 1]]);
  });

  it("pairs nothing the leftmost and rightmost alignments agree on but a third LCS avoids (review, 15 Oct 2026)", () => {
    // c at 0, 2 and 3 can each be the one LCS pair; the old intersection kept 3:1.
    expect(certainPairs(["c", "a", "c", "c", "a", "a"], ["b", "c"])).toEqual([]);
    // b c b a / a c b b a: 3:2 is in one LCS but not in "b c b a" taken through 2:1.
    expect(certainPairs([..."acbba"], [..."bcba"]).some(([i, j]) => i === 3 && j === 2)).toBe(false);
    expect(certainPairs([..."acbba"], [..."bcba"])).toEqual(allLcsIntersection([..."acbba"], [..."bcba"]));
  });

  it("keeps exactly the pairs every LCS contains, against brute force over random words", () => {
    let seed = 20261015;
    const rand = (k: number): number => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % k;
    };
    const alphabet = ["a", "b", "c", ""];
    for (let t = 0; t < 400; t++) {
      const a = Array.from({ length: 1 + rand(6) }, () => alphabet[rand(alphabet.length)]!);
      const b = Array.from({ length: 1 + rand(6) }, () => alphabet[rand(alphabet.length)]!);
      expect(certainPairs(a, b), `${JSON.stringify(a)} ${JSON.stringify(b)}`).toEqual(allLcsIntersection(a, b));
    }
  }, 30_000);

  it("counts what it skips", () => {
    const counts = emptyCounts();
    addCounts(counts, linkVerse(GEN_1_1_TOKENS, GEN_1_1, table("John 1:1")));
    addCounts(counts, linkVerse(JHN_1_1_TOKENS, JHN_1_1, table("John 1:1")));
    expect(counts).toMatchObject({ verses: 2, versesWithSkip: 1, tokens: 24, skipped: 7, linked: 16, none: 1 });
  });
});

describe("MM-03 word links: parsing", () => {
  it("normalises accents, case, final sigma and Hebrew points and punctuation", () => {
    expect(normaliseWord("Λόγος")).toBe(normaliseWord("λόγος"));
    expect(normaliseWord("δι’")).toBe("δι");
    expect(normaliseWord("הָאָֽרֶץ׃")).toBe(normaliseWord("הָאָֽרֶץ"));
  });

  it("reads phrase kinds and supplied words", () => {
    expect(phraseKind("-")).toBe("none");
    expect(phraseKind(". . .")).toBe("folded");
    expect(phraseKind("vvv")).toBe("folded");
    expect(phraseWords("[the] beginning")).toEqual([{ word: "the", supplied: true }, { word: "beginning", supplied: false }]);
    expect(phraseWords("{will} crush")).toEqual([{ word: "will", supplied: false }, { word: "crush", supplied: false }]);
  });

  it("reads the file in chunks exactly as the whole text, and keeps only the verses asked for", () => {
    expect([...fileLines(FIXTURE)]).toEqual([...textLines(readFileSync(FIXTURE, "utf8"))]);
    expect(tableVerses(fileLines(FIXTURE), (ref) => ref.startsWith("Genesis")).map((v) => v.ref)).toEqual(["Genesis 1:1"]);
  });

  it("groups rows by verse, keeping BSB order and the original order", () => {
    const j = table("John 1:1");
    expect(j.rows.map((r) => r.english).at(-1)).toBe("God");
    expect([...j.rows].sort((a, b) => a.sort - b.sort).map((r) => r.orig).at(-1)).toBe("Λόγος");
    expect(table("Genesis 1:1").language).toBe("Hebrew");
  });
});
