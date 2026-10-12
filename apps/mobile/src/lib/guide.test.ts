import { readFileSync } from "node:fs";
import path from "node:path";

import type { VerseEntry } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { claimPlace, evidenceMarks, firstSentence, GUIDE_PICKS, guideFields, marksAnnouncement, pickClaims, showsPericopeText } from "./guide";

const golden = (file: string): VerseEntry =>
  JSON.parse(readFileSync(path.resolve(__dirname, "../../../../golden", file), "utf8")) as VerseEntry;
const jhn = golden("jhn.1.1.json");
const cor = golden("1co.14.34.json");
const claim = (entry: VerseEntry, suffix: string) => {
  const found = entry.claims.find((c) => c.id.endsWith(`.${suffix}`));
  if (found === undefined) throw new Error(`no claim ${suffix}`);
  return found;
};

// John 1:1 as core.v4 holds it: the BSB text, and the SBLGNT tokens' lemma and TAGNT gloss.
const JHN_1_1_BSB = "In the beginning was the Word, and the Word was with God, and the Word was God.";
const JHN_1_1_TOKENS = [
  ["ἐν", "In"], ["ἀρχή", "beginning"], ["εἰμί", "was"], ["ὁ", "the"], ["λόγος", "Word"], ["καί", "and"], ["ὁ", "the"],
  ["λόγος", "Word"], ["εἰμί", "was"], ["πρός", "with"], ["ὁ", "the"], ["θεός", "God"], ["καί", "and"], ["θεός", "God"],
  ["εἰμί", "was"], ["ὁ", "the"], ["λόγος", "Word"],
].map(([lemma, gloss]) => ({ lemma: lemma ?? "", gloss: gloss ?? null }));
const verse11 = { ord: 43001001, verseId: "JHN.1.1", text: JHN_1_1_BSB, tokens: JHN_1_1_TOKENS };

describe("guide picks", () => {
  it("takes the canvas's claims from the golden entries, in its order (PG-02, PG-07)", () => {
    const j = GUIDE_PICKS["JHN.1.1-1.18"];
    const c = GUIDE_PICKS["1CO.14.26-14.40"];
    expect(pickClaims(jhn.claims, j?.notice ?? []).map((x) => x.id)).toEqual(["JHN.1.1.c9", "JHN.1.1.c2", "JHN.1.1.c10"]);
    expect(pickClaims(jhn.claims, j?.differ ?? []).map((x) => x.id)).toEqual(["JHN.1.1.c11", "JHN.1.1.c12"]);
    expect(pickClaims(cor.claims, c?.notice ?? []).map((x) => x.id)).toEqual(["1CO.14.34.c3", "1CO.14.34.c5", "1CO.14.34.c6"]);
    expect(pickClaims(cor.claims, c?.differ ?? []).map((x) => x.id)).toEqual(["1CO.14.34.c7", "1CO.14.34.c9"]);
  });

  it("skips an id the entry does not have rather than inventing a row", () => {
    expect(pickClaims(jhn.claims, ["c2", "c99"]).map((x) => x.id)).toEqual(["JHN.1.1.c2"]);
  });

  it("opens Where we are with the entry's own first sentence, verbatim", () => {
    expect(firstSentence(jhn.whats_happening)).toBe(
      "John opens his Gospel (his account of Jesus' life) not with a birth or a family tree but before the world exists, using the same first words as the opening of Genesis.",
    );
    expect(firstSentence("One sentence only")).toBe("One sentence only");
  });
});

describe("claimPlace", () => {
  it("names the verse in words, as the canvas does", () => {
    expect(claimPlace(claim(jhn, "c2").evidence, "JHN.1.1", 1)).toBe("Verse 1");
    expect(claimPlace(claim(cor, "c3").evidence, "1CO.14.34", 14)).toBe("Verses 28, 30");
    expect(claimPlace(claim(cor, "c7").evidence, "1CO.14.34", 14)).toBe("Verses 34–35");
  });

  it("keeps the chapter for a verse outside the passage's chapter", () => {
    expect(claimPlace(claim(cor, "c5").evidence, "1CO.14.34", 14)).toBe("Chapter 11, verse 5");
  });

  it("falls back to the entry's verse when the claim cites none", () => {
    expect(claimPlace(claim(jhn, "c9").evidence, "JHN.1.1", 1)).toBe("Verse 1");
    expect(claimPlace(claim(cor, "c6").evidence, "1CO.14.34", 14)).toBe("Verse 34");
  });
});

describe("evidenceMarks (PG-10)", () => {
  it("marks the three 'was' of John 1:1 for the three ἦν", () => {
    const marks = evidenceMarks(claim(jhn, "c2"), [verse11]);
    expect(marks?.word).toBe("was");
    expect(marks?.count).toBe(3);
    const ranges = marks?.ranges.get(43001001) ?? [];
    expect(ranges.map(([a, b]) => JHN_1_1_BSB.slice(a, b))).toEqual(["was", "was", "was"]);
    expect(marks === null ? "" : marksAnnouncement(marks)).toBe("“was” marked 3 times in verse 1.");
  });

  it("marks nothing for a claim with no lexical evidence", () => {
    expect(evidenceMarks(claim(jhn, "c9"), [verse11])).toBeNull();
  });

  it("marks nothing when the English count differs from the Greek (no alignment is guessed, rule 4)", () => {
    // Two "was" in the English for three ἦν: which two is a guess, so neither is marked.
    const two = { ...verse11, text: "In the beginning was the Word, and the Word was with God, and the Word is God." };
    expect(evidenceMarks(claim(jhn, "c2"), [two])).toBeNull();
  });

  it("marks nothing when the cited verse is not in the passage text given", () => {
    expect(evidenceMarks(claim(cor, "c3"), [verse11])).toBeNull();
  });

  it("marks nothing when the lemma's tokens carry different glosses", () => {
    const mixed = { ...verse11, tokens: verse11.tokens.map((t, i) => (i === 2 ? { ...t, gloss: "existed" } : t)) };
    expect(evidenceMarks(claim(jhn, "c2"), [mixed])).toBeNull();
  });
});

describe("guideFields", () => {
  it("reads the passage-guide fields when a payload has them", () => {
    const payload = JSON.stringify({ orientation: "Paul orders who speaks.", moves: ["Build up", "Take turns"], look_first: "What is it for?" });
    expect(guideFields(payload)).toEqual({ orientation: "Paul orders who speaks.", moves: ["Build up", "Take turns"], lookFirst: "What is it for?" });
  });

  it("shows nothing for missing, empty or malformed fields", () => {
    expect(guideFields(null)).toEqual({});
    expect(guideFields("not json")).toEqual({});
    expect(guideFields(JSON.stringify({ orientation: "", moves: ["ok", ""], look_first: 3 }))).toEqual({});
  });
});

describe("showsPericopeText", () => {
  it("counts guide fields from a payload the schema rejected, so a draft keeps its label", () => {
    expect(showsPericopeText(false, guideFields(JSON.stringify({ orientation: "Paul orders who speaks." })))).toBe(true);
    expect(showsPericopeText(false, guideFields(JSON.stringify({ moves: ["Build up"] })))).toBe(true);
    expect(showsPericopeText(true, {})).toBe(true);
  });

  it("is false for a label-only pericope", () => {
    expect(showsPericopeText(false, guideFields(null))).toBe(false);
  });
});
