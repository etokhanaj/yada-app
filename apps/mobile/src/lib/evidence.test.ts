import { readFileSync } from "node:fs";
import path from "node:path";

import type { Claim, VerseEntry } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { claimKind, claimLabel, claimWord, datasetName, howWeKnow, lexicalNotes, readingsTitle, verseLinks } from "./evidence";

const golden = (file: string): VerseEntry =>
  JSON.parse(readFileSync(path.resolve(__dirname, "../../../../golden", file), "utf8")) as VerseEntry;
const cor = golden("1co.14.34.json");
const jhn = golden("jhn.1.1.json");
const gen = golden("gen.1.1.json");
const claim = (entry: VerseEntry, id: string): Claim => {
  const found = entry.claims.find((c) => c.id === id);
  if (found === undefined) throw new Error(id);
  return found;
};

describe("claimLabel (decision 4: exceptions only)", () => {
  it("labels nothing on a strong, data-grounded claim", () => {
    expect(claimLabel(claim(cor, "1CO.14.34.c1"))).toBeNull();
  });

  it("labels supported and background claims (J01-04)", () => {
    expect(claimLabel(claim(cor, "1CO.14.34.c4"))).toBe("Supported");
    expect(claimLabel(claim(cor, "1CO.14.34.c6"))).toBe("Background");
  });

  it("labels nothing on a disputed claim: its readings say it", () => {
    expect(claimLabel(claim(cor, "1CO.14.34.c7"))).toBeNull();
  });
});

describe("claimKind (brief §8.19: grammar moves under Original)", () => {
  const kinds = (entry: VerseEntry, kind: "reading" | "grammar") =>
    entry.claims.filter((c) => claimKind(c) === kind).map((c) => c.id.split(".").pop());

  it("splits 1 Corinthians 14:34 as the canvas does (U-01–03)", () => {
    // c7 and c9 are debated: reading, shown under Where readers differ.
    expect(kinds(cor, "reading")).toEqual(["c3", "c4", "c5", "c6", "c7", "c9"]);
    expect(kinds(cor, "grammar")).toEqual(["c1", "c2", "c8"]);
  });

  it("keeps debated claims as reading even when their evidence has a lexical note", () => {
    expect(claimKind(claim(cor, "1CO.14.34.c7"))).toBe("reading");
    expect(claimKind(claim(cor, "1CO.14.34.c9"))).toBe("reading");
  });

  it("splits John 1:1 the same way (U-04)", () => {
    expect(kinds(jhn, "grammar")).toEqual(["c1", "c2", "c3", "c5", "c6", "c7"]);
    expect(kinds(jhn, "reading")).toEqual(["c4", "c8", "c9", "c10", "c11", "c12"]);
  });

  it("reads a pipeline-written kind over the rule", () => {
    expect(claimKind({ ...claim(cor, "1CO.14.34.c1"), kind: "reading" })).toBe("reading");
    expect(claimKind({ ...claim(cor, "1CO.14.34.c3"), kind: "grammar" })).toBe("grammar");
  });
});

describe("howWeKnow", () => {
  it("names the parsing source for a morphology claim (J01-05)", () => {
    expect(howWeKnow(claim(cor, "1CO.14.34.c1"), "greek", "1CO.14.34")).toBe("From the Greek text and its parsing (MorphGNT).");
    expect(howWeKnow(claim(gen, "GEN.1.1.c1"), "hebrew", "GEN.1.1")).toBe("From the Hebrew text and its parsing (OSHB).");
  });

  it("names the edition for variant markers", () => {
    expect(howWeKnow(claim(cor, "1CO.14.34.c8"), "greek", "1CO.14.34")).toBe("From the variant markers in SBLGNT.");
  });

  it("names a lexicon when that is the source", () => {
    expect(howWeKnow(claim(cor, "1CO.14.34.c7"), "greek", "1CO.14.34")).toBe("From the STEP lexicon.");
  });

  it("falls back to the passages when only verses are cited", () => {
    expect(howWeKnow(claim(cor, "1CO.14.34.c5"), "greek", "1CO.14.34")).toBe("From the text of the passages below.");
  });

  it("never promises passages it will not draw", () => {
    expect(howWeKnow({ grounding: "source_data", evidence: [{ type: "verse", ref: "JHN.1.1" }] }, "greek", "JHN.1.1")).toBe(
      "From the text of this verse.",
    );
    expect(howWeKnow({ grounding: "source_data", evidence: [] }, "greek", "JHN.1.1")).toBeNull();
  });

  it("says plainly when a claim is background knowledge", () => {
    expect(howWeKnow(claim(cor, "1CO.14.34.c6"), "greek", "1CO.14.34")).toMatch(/^Background knowledge/);
  });
});

describe("datasetName", () => {
  it("drops the pin and keeps the name a reader can look up", () => {
    expect(datasetName("MorphGNT/SBLGNT @ aaed91e")).toBe("MorphGNT");
    expect(datasetName("OSHB morphhb @ 3d15126")).toBe("OSHB");
    expect(datasetName("STEP lexicon")).toBe("STEP lexicon");
  });
});

describe("readingsTitle", () => {
  it("asks the question the claim states (J01-09)", () => {
    expect(readingsTitle(claim(cor, "1CO.14.34.c7").claim)).toBe("Who the instruction addresses");
  });
});

describe("verseLinks", () => {
  it("never links to the verse already open (v2-review X2)", () => {
    expect(verseLinks(claim(cor, "1CO.14.34.c1").evidence, "1CO.14.34")).toEqual([]);
    expect(verseLinks(claim(cor, "1CO.14.34.c3").evidence, "1CO.14.34").map((l) => l.ref)).toEqual(["1CO.14.28", "1CO.14.30"]);
  });
});

describe("lexicalNotes", () => {
  it("drops a parse code that restates the claim (v2-review S2)", () => {
    expect(lexicalNotes(claim(cor, "1CO.14.34.c1").evidence)).toEqual([]);
  });

  it("keeps a lexical observation with its source", () => {
    expect(lexicalNotes(claim(cor, "1CO.14.34.c7").evidence)).toEqual([
      { lemma: "γυνή", note: "the same noun covers both 'woman' and 'wife'", dataset: "STEP lexicon" },
    ]);
  });
});

describe("claimWord", () => {
  const tokens = [
    { lemma: "ὁ", surface: "Αἱ", position: 1 },
    { lemma: "γυνή", surface: "γυναῖκες", position: 2 },
    { lemma: "σιγάω", surface: "σιγάτωσαν", position: 5 },
  ];

  it("finds the word a claim is about (See the word σιγάτωσαν)", () => {
    expect(claimWord(claim(cor, "1CO.14.34.c1"), tokens)?.surface).toBe("σιγάτωσαν");
    expect(claimWord(claim(cor, "1CO.14.34.c2"), tokens)?.surface).toBe("γυναῖκες");
  });

  it("finds nothing for a claim without lexical evidence", () => {
    expect(claimWord(claim(jhn, "JHN.1.1.c8"), tokens)).toBeNull();
  });
});
