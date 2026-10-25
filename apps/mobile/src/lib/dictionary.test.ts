import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DICTIONARY, DICTIONARY_FROM, type DictionaryRow, GUIDES } from "../data/dictionary.generated";
import { DICTIONARY_GROUPS, dictionaryEntry, dictionaryWords, entryOf, filterWords, findGuides, findTerms, firstSentence } from "./dictionary";

const ROWS: DictionaryRow[] = [
  ["abomination", "kt", "Something that causes disgust. More text.", [1043032, 1, 2008026, 3]],
  ["Almighty", "kt", "A title of God.", [1017001, 2]],
  ["church", "kt", "In the New Testament, the term “church” refers to all people who believe in Jesus. More.", [40016018, 2, 44005011, 18]],
  ["Holy Spirit", "kt", "The Spirit of God.", [40001018, 5]],
  ["Pharisee", "kt", "The Pharisees were a group.", [40003007, 29]],
  ["Aaron", "names", "Moses' brother.", [2004014, 100]],
  ["acacia", "other", "A tree.", [2025005, 20]],
];

describe("the generated dictionary", () => {
  it("was read from the Understand bundles this app ships the manifest of", () => {
    // A stale dictionary would find terms the books no longer carry: run scripts/sync-dictionary.mjs. Read as text:
    // bundled.generated.ts requires the .db assets, which only Metro can load.
    const generated = readFileSync(join(__dirname, "../data/bundled.generated.ts"), "utf8");
    const manifest = generated.slice(0, generated.indexOf("export const BUNDLED_STUDY"));
    const shipped = [...manifest.matchAll(/"file": "(understand-[^"]+)"/gu)].map((m) => m[1]);
    expect(DICTIONARY_FROM).toEqual(shipped);
  });

  it("holds every group DI-30 draws, and John's first guide", () => {
    const words = dictionaryWords();
    expect(DICTIONARY_GROUPS.map((g) => g.title)).toEqual(["Key words", "People and places", "More words"]);
    for (const g of DICTIONARY_GROUPS) expect(words.filter((w) => w.kind === g.kind).length).toBeGreaterThan(100);
    for (const w of words) expect(w.letter).toMatch(/^[A-Z]$/u);
    expect(GUIDES).toContainEqual(["The Word became flesh", "JHN.1.1-1.18"]);
    expect(new Set(DICTIONARY.map((r) => r[0])).size).toBe(DICTIONARY.length);
  });
});

describe("dictionary entries", () => {
  it("unpacks uses into books, first verses and counts", () => {
    const entry = entryOf(ROWS[2] as DictionaryRow);
    expect(entry.uses).toEqual([
      { book: "MAT", ord: 40016018, verses: 2 },
      { book: "ACT", ord: 44005011, verses: 18 },
    ]);
    expect(entry.verses).toBe(20);
  });

  it("finds an entry by its exact term, or nothing", () => {
    expect(dictionaryEntry("Aaron", ROWS)?.kind).toBe("names");
    expect(dictionaryEntry("aaron", ROWS)).toBeNull();
  });

  it("gives each word its own first sentence and its rail letter (DI-30)", () => {
    const words = dictionaryWords(ROWS);
    expect(words[0]).toEqual({ term: "abomination", kind: "kt", first: "Something that causes disgust.", letter: "A" });
    expect(dictionaryWords([["Ēl", "names", "A name.", []]])[0]?.letter).toBe("E");
  });

  it("filters as you type: words that begin with it, then words that hold it", () => {
    const words = dictionaryWords(ROWS);
    expect(filterWords("a", words).map((w) => w.term)).toEqual(["abomination", "Almighty", "Aaron", "acacia", "Pharisee"]);
    expect(filterWords("SPIRIT", words).map((w) => w.term)).toEqual(["Holy Spirit"]);
    expect(filterWords("  ", words)).toHaveLength(ROWS.length);
  });

  it("cuts a definition at its first sentence", () => {
    expect(firstSentence("Something that causes disgust. More text.")).toBe("Something that causes disgust.");
    expect(firstSentence("No full stop")).toBe("No full stop");
  });
});

describe("findTerms (DI-03, PD-04)", () => {
  it("finds the term itself first, whatever its case", () => {
    expect(findTerms("Church", ROWS).map((e) => e.term)).toEqual(["church"]);
  });

  it("finds TW's singular from a plural: Pharisees finds Pharisee", () => {
    expect(findTerms("Pharisees", ROWS).map((e) => e.term)).toEqual(["Pharisee"]);
  });

  it("finds a term while it is still being typed, and a term holding the word", () => {
    expect(findTerms("phari", ROWS).map((e) => e.term)).toEqual(["Pharisee"]);
    expect(findTerms("spirit", ROWS).map((e) => e.term)).toEqual(["Holy Spirit"]);
  });

  it("ranks the exact term above a term that starts with it", () => {
    const rows: DictionaryRow[] = [["God's will", "kt", "x.", []], ["God", "kt", "y.", []]];
    expect(findTerms("god", rows).map((e) => e.term)).toEqual(["God", "God's will"]);
  });

  it("leaves references, short input, Greek and Hebrew to their own groups", () => {
    expect(findTerms("jn 3", ROWS)).toEqual([]);
    expect(findTerms("ch", ROWS)).toEqual([]);
    expect(findTerms("λόγος", ROWS)).toEqual([]);
    expect(findTerms("שלום", ROWS)).toEqual([]);
  });

  it("finds church and Pharisee in the shipped dictionary", () => {
    expect(findTerms("church")[0]?.term).toBe("church");
    expect(findTerms("Pharisees")[0]?.term).toBe("Pharisee");
  });
});

describe("findGuides (IA-06)", () => {
  const guides: Array<readonly [string, string]> = [
    ["The first disciples", "JHN.1.35-1.51"],
    ["The Word became flesh", "JHN.1.1-1.18"],
    ["Jesus, the Word", "1JN.1.1-1.4"],
    ["Swords into plowshares", "ISA.2.1-2.5"],
    ["Word and deed", "JAS.1.19-1.27"],
  ];

  it("finds a passage's guide by its title", () => {
    expect(findGuides("The Word became flesh", guides)).toEqual([{ title: "The Word became flesh", ref: "JHN.1.1-1.18" }]);
  });

  it("puts titles that begin with the query first, then those holding it from a word's start", () => {
    expect(findGuides("word", guides).map((g) => g.ref)).toEqual(["JAS.1.19-1.27", "JHN.1.1-1.18", "1JN.1.1-1.4"]);
  });

  it("never matches inside a word, and waits for four letters", () => {
    expect(findGuides("ords", guides)).toEqual([]);
    expect(findGuides("the", guides)).toEqual([]);
  });

  it("finds John 1's guide in the shipped titles", () => {
    expect(findGuides("the word became flesh")[0]).toEqual({ title: "The Word became flesh", ref: "JHN.1.1-1.18" });
  });
});
