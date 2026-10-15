/**
 * passage_summary.py `checks()`, the cases that need no source files (John's 12 Oct 2026 findings on the
 * modes by kind of writing). The ones that read the Bible text, the notes or run a whole book are in
 * golden.test.ts. John's tables are read from prototypes/data, which is in git.
 */

import { describe, expect, it } from "vitest";

import { readKinds, readLetters, readPlainWords } from "./package.js";
import { GENEALOGY_HEAD, LETTERS, MEASURE, framed, gate, joinedText, readsHarder, repeatsItself, speakerName, type SummarySentence } from "./passage.js";
import { beforeAfter, caseCounts, kindLine, makeOwner, outlineItem, plainWordsIn, ustSubs } from "./modes.js";
import { cleanFootnote, cleanTitle, footnoteFact, vk } from "./sources.js";

const plain = readPlainWords();
const letters = readLetters();
const kinds = readKinds();
const cases = caseCounts([]);
const owner = (mode: string, speakers: Record<string, string> = {}, bsb: Record<string, string> = {}, extra: { letter?: (typeof letters.letters)[string] | undefined; voice?: string } = {}) =>
  makeOwner({
    mode,
    speakerOf: new Map(Object.entries(speakers).map(([k, v]) => [k as `${number}:${number}`, v])),
    bsb: new Map(Object.entries(bsb).map(([k, v]) => [k as `${number}:${number}`, v])),
    letter: extra.letter,
    voice: extra.voice,
    cases,
  });
const line = (text: string, src: string, where: [number, number]): SummarySentence => ({ text, src, where, aside: false, setting: false });

describe("genealogies and speakers (checks, first 13)", () => {
  it("a heading that only mentions sons, or counts them, is not a genealogy", () => {
    expect(GENEALOGY_HEAD.test("Jacob Blesses His Sons")).toBe(false);
    expect(GENEALOGY_HEAD.test("The Seven Sons of Sceva")).toBe(false);
  });

  it("one named person says, a group says in the plural", () => {
    for (const [who, verb] of [
      ["Cornelius", "says"],
      ["James", "says"],
      ["Chief priests", "say"],
      ["Disciples", "say"],
      ["Epicurean and Stoic philosophers", "say"],
      ["Person who told the guards and priests where the apostles were", "says"],
      ["God", "says"],
    ] as const) {
      expect(framed("x", who), who).toContain(` ${verb}: `);
    }
  });
});

describe("Gospels (Mark)", () => {
  it("swaps the UST's odd words by John's list, only in the books it lists", () => {
    expect(ustSubs("Jesus and his apprentices", "MRK", plain)[0]).toBe("Jesus and his disciples");
    expect(ustSubs("“Instructor, we want”", "MAT", plain)[0]).toBe("“Teacher, we want”");
    expect(ustSubs("the apprentices", "GEN", plain)[0]).toBe("the apprentices");
  });

  it("turns Glyssen's names round, but not a list", () => {
    expect(speakerName("angels in white, two")).toBe("two angels in white");
    expect(speakerName("bystanders at Calvary, some")).toBe("some bystanders at Calvary");
    expect(speakerName("sea captains, seafarers, sailors")).toBe("sea captains, seafarers, sailors");
    expect(framed("x", "bystanders at Calvary, some").startsWith("Some bystanders at Calvary say:")).toBe(true);
  });

  it("shows a footnote as one plain sentence, and drops a quoted verse's glued number (Mark 16:8)", () => {
    const raw16 =
      "Some early manuscripts end the Gospel of Mark after verse 8. Other manuscripts contain only a short ending, a version of the following: <i><span class=|fnv|>9</span>But they quickly reported all these instructions.</i>";
    const [fact, rest] = footnoteFact(cleanFootnote(raw16));
    expect(fact).toBe("Some early manuscripts end the Gospel of Mark after verse 8.");
    expect(rest).not.toContain("9But");
    expect(rest.endsWith("But they quickly reported all these instructions.")).toBe(true);
    expect(cleanFootnote("the following: 9But they")).not.toContain("9But");
  });
});

describe("Letters (Romans)", () => {
  it("uses the UST where tQ keeps the ULT's inverted order, and keeps a short tQ answer", () => {
    expect(readsHarder("By the witnesses of the Law and the Prophets has a righteousness without the law now been made known.", "But now God has revealed how he makes people righteous.")).not.toBeNull();
    expect(readsHarder("Abraham took another wife named Keturah.", "Then Abraham got married again.")).toBeNull();
  });

  it("frames a letter's second person as its writer's words, and never quotes tQ as his", () => {
    const rom = owner("letter", {}, {}, { letter: letters.letters["ROM"] });
    expect(rom([1, 7], "God loves you and has called you.", "UST")).toBe("Paul tells the believers in Rome: “God loves you and has called you.”");
    expect(rom([1, 7], "God loves you.", "tQ")).toBeNull();
  });

  it("names the parts of the argument either side, and every letter has a setting line", () => {
    const sec = (c1: number, v1: number, c2: number, v2: number, l: string) => ({ c1, v1, c2, v2, line: l });
    expect(beforeAfter(sec(3, 21, 5, 21, "B"), [sec(1, 18, 3, 20, "A"), sec(3, 21, 5, 21, "B"), sec(6, 1, 8, 39, "C")])).toEqual(["A", "C"]);
    expect([...LETTERS].every((b) => (letters.letters[b]?.setting ?? "") !== "")).toBe(true);
  });
});

describe("Law (Leviticus)", () => {
  it("puts tN's translator terms in plain words", () => {
    expect(plainWordsIn("The rule for clean and unclean quadrupeds", plain)).toBe("The rule for clean and unclean animals");
  });

  it("fails check h on unframed first person, and frames God's words with whom he speaks to", () => {
    const unframed = [line("The people should learn what is acceptable to me.", "UST 11:47", [11, 47])];
    expect(gate("x", unframed[0]?.text ?? "", unframed, true, 55, 99, null, "law").some((f) => f.startsWith("h:"))).toBe(true);
    const lev = owner("law", { [vk(11, 47)]: "God" }, { [vk(11, 1)]: "The LORD spoke again to Moses and Aaron, telling them" });
    expect(lev([11, 47], "The people should learn what is acceptable to me.", "UST")?.startsWith("God tells Moses and Aaron: “")).toBe(true);
  });
});

describe("Debate (Job) and the Teacher (Ecclesiastes)", () => {
  it("Job's fixed setting line, merged frames, and a friend's claim as his", () => {
    expect(kindLine(kinds, "settings", "JOB", [[4, 1], [4, 21]])[0]).toBe("Job’s friends argue that his suffering is punishment; at the end God says they were wrong (42:7).");
    expect(joinedText([{ text: "Job says: “I wish I had died.”" }, { text: "Job says: “I have no peace.”" }])).toBe("Job says: “I wish I had died. I have no peace.”");
    const job = owner("debate", { [vk(4, 19)]: "Eliphaz the Temanite" });
    expect(job([4, 19], "Humans are fragile, like tents.", "UST")?.startsWith("Eliphaz the Temanite says: “")).toBe(true);
  });

  it("names the Teacher's view as his, with Ecclesiastes' setting line", () => {
    const ecc = owner("teacher", {}, {}, { voice: "The Teacher" });
    expect(ecc([1, 14], "All the deeds that are done under the sun amount to vapor.", "tQ")).toBe("The Teacher says that all the deeds that are done under the sun amount to vapor.");
    expect(kindLine(kinds, "settings", "ECC", [[1, 1], [1, 11]])[0]).not.toBeNull();
  });
});

describe("Sayings, visions and plans", () => {
  it("keeps a book name a preposition needs", () => {
    expect(cleanTitle("Introduction and purpose for Proverbs")).toBe("Introduction and purpose for Proverbs");
  });

  it("frames a vision line, and a disputed vision line is never a plain fact", () => {
    expect(owner("visions")([7, 4], "144,000 people were sealed.", "UST")).toBe("In John’s vision, 144,000 people were sealed.");
    const plainLine = [line("Satan was bound for a thousand years.", "tQ 20:2", [20, 2])];
    expect(gate("x", plainLine[0]?.text ?? "", plainLine, true, 55, 99, null, "visions").some((f) => f.startsWith("h:"))).toBe(true);
  });

  it("sees a garbled sentence, but not rhetoric (Revelation 13:10, John 17:1)", () => {
    expect(repeatsItself("If anyone’s enemies are going to kill him with a sword, they will kill him with a sword.")).toBe(true);
    expect(repeatsItself("If anyone’s enemies are going to capture him, they will capture him.")).toBe(true);
    expect(repeatsItself("Show everyone how great I, your Son, am in order that I may show everyone how great you are.")).toBe(false);
  });

  it("tells tN prose from an outline item, and a measurement from a plan", () => {
    expect(outlineItem("There are multiple different curtains described using three different Hebrew words: one sort of curtains")).toBe(false);
    expect(MEASURE.test("There must be hangings of fine twisted linen 100 cubits long.")).toBe(true);
    expect(MEASURE.test("Make 50 loops of blue cloth.")).toBe(true);
    expect(MEASURE.test("Make a table from acacia wood.")).toBe(false);
  });
});
