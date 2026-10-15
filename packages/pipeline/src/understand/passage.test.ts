import { describe, expect, it } from "vitest";

import { vk, type VerseKey } from "./sources.js";
import { summariseBook } from "./summaries.js";
import { GENEALOGY_HEAD, LEANS, NO_KINDS, NO_LETTERS, NO_PLAIN_WORDS, NO_PROPHETS, SPEECH, cleanHeading, framed, gate, genealogyLine, overStop, rebraced, glyssenName, psalmGate, psalmLines, passagesOf, sampleIds, summarise, tyndaleFirstSentence, type PassageBookData, type SummarySentence } from "./passage.js";

const line = (text: string, opts: Partial<SummarySentence> = {}): SummarySentence => ({ text, src: "UST 1:1", where: [1, 1], aside: false, setting: false, ...opts });
const three = [line("Paul wrote to the church in Corinth about their divisions."), line("Paul reminded the believers that Christ was not divided."), line("God chose what the world thinks foolish to shame the wise.")];
const textOf = (ds: readonly SummarySentence[]): string => ds.map((d) => d.text).join(" ");

describe("the leaning filter", () => {
  it("catches an opening pronoun, a clause that leans on one, and reads past the UST's braces", () => {
    for (const s of ["He went home.", "They answered him.", "When they arrived, the crowd waited.", "If he does this, all will be well.", "{So} he left."]) {
      expect(LEANS.test(s.replace(/[{}()]/g, "")), s).toBe(true);
    }
    for (const s of ["Herod wanted to see Jesus.", "When the crowd saw it, they shouted.", "Thomas said this was true."]) expect(LEANS.test(s), s).toBe(false);
  });

  it("drops leaning sentences from the pool when three others remain", () => {
    const ust = new Map<VerseKey, string>([
      ["1:1", "Jesus went to Cana with his disciples."],
      ["1:2", "He saw a wedding there."],
      ["1:3", "The wine ran out at the wedding feast."],
      ["1:4", "Jesus turned the water into wine for the guests."],
    ]);
    const res = summarise({ label: "The wedding at Cana", verses: [[1, 1], [1, 2], [1, 3], [1, 4]], ust, names: ["Jesus"] });
    expect(res?.detail.map((d) => d.text)).not.toContain("He saw a wedding there.");
  });

  it("reads unquoted blessings and commands as speech (Ruth 4:11)", () => {
    expect(SPEECH.test("May you become great in the clan of Ephrathah.")).toBe(true);
    expect(SPEECH.test("Boaz, you must buy the field.")).toBe(true);
    expect(SPEECH.test("Boaz bought the field.")).toBe(false);
  });
});

describe("the gate", () => {
  it("passes a headed summary of three distinct narrated sentences", () => {
    expect(gate("Paul answers the church", textOf(three), three, true, 55, 20)).toEqual([]);
  });

  it("(a) no longer flags a summary with no headline: the passage's title heads it (John, 15 Oct 2026)", () => {
    expect(gate("", textOf(three), three)).toEqual([]);
  });

  it("(g) flags an implied-words brace that closes before it opens, never a paired one", () => {
    const at = (text: string) => [{ text, src: "UST 1:1", where: [1, 1] as [number, number], aside: false, setting: false }];
    expect(gate("Key", "We are sending this letter} to you.", at("We are sending this letter} to you."))).toContain("g: implied-words brace closed before it opens (UST 1:1)");
    expect(gate("Key", "God revealed {his good and true} light.", at("God revealed {his good and true} light.")).some((f) => f.startsWith("g: implied"))).toBe(false);
  });

  it("(b) flags a sentence that leans on missing context", () => {
    const ds = [...three.slice(0, 2), line("He said this to them.", { src: "UST 1:9" })];
    expect(gate("x", textOf(ds), ds)).toContain("b: leans on missing context (UST 1:9)");
  });

  it("(c) flags a summary over the budget", () => {
    const long = line(`${"word ".repeat(80)}end.`);
    expect(gate("x", textOf([long]), [long], true, 55, 2)).toContain("c: over budget (81 words)");
  });

  it("(d) lets an aside verse set the scene, never carry the story", () => {
    const ds = [line(three[0]?.text ?? "", { aside: true, setting: true }), line(three[1]?.text ?? "", { aside: true, src: "tQ 11:2" }), three[2] as SummarySentence];
    expect(gate("x", textOf(ds), ds)).toEqual(["d: aside verse carries the story (tQ 11:2)"]);
  });

  it("(e) flags an Open Bible Stories sentence the book does not support", () => {
    expect(gate("x", textOf(three), three, false)).toEqual(["e: Open Bible Stories sentence not supported by John"]);
  });

  it("(f) needs three distinct sentences, or two in a passage of 12 verses or fewer", () => {
    const two = three.slice(0, 2);
    expect(gate("x", textOf(two), two, true, 55, 13)).toEqual(["f: 2 distinct sentences, needs 3"]);
    expect(gate("x", textOf(two), two, true, 55, 12)).toEqual([]);
    const repeated = [three[0] as SummarySentence, line(`${three[0]?.text ?? ""} Again.`)];
    expect(gate("x", textOf(repeated), repeated, true, 55, 12)).toEqual(["f: 1 distinct sentences, needs 2"]);
  });

  it("(g) flags text glitches: a split possessive, a verse reference, stray spacing, unquoted speech", () => {
    const ds = [line("Paul spoke of Jesse’ s son.", { src: "A" }), line("Paul cited 2:4 as proof here.", { src: "B" }), line("Paul wrote , then left.", { src: "C" })];
    expect(gate("x", textOf(ds), ds, true, 55, 3)).toEqual([
      "g: stray space in a possessive (A)",
      "g: verse reference left in a sentence (B)",
      "g: spacing or dangling punctuation (C)",
    ]);
    expect(gate("Joseph dies Genesis", textOf(three), three)).toEqual(["g: broken headline"]);
  });
});

/** Ten verses of a letter with one BSB heading, two outline sections around them and none naming an event. */
function letter(book: string): PassageBookData {
  const ordRef = new Map<number, [number, number]>();
  const ust = new Map<VerseKey, string>();
  const sentences = [
    "Paul wrote this letter to the believers in Corinth.",
    "The believers in Corinth were arguing about leaders.",
    "Some believers followed Paul and some followed Apollos.",
    "Paul told the believers that Christ is not divided.",
    "God sent Paul to tell the good news about Christ.",
    "The message about the cross seems foolish to many people.",
    "God shows his power through the message about the cross.",
    "God chose humble people to shame proud people.",
    "Christ Jesus makes believers right with God.",
    "Paul tells the believers to boast only about the Lord.",
  ];
  sentences.forEach((s, i) => {
    ordRef.set(46001001 + i, [1, i + 1]);
    ust.set(vk(1, i + 1), s);
  });
  return {
    book,
    name: "1 Corinthians",
    ordRef,
    bsb: new Map(),
    ust,
    tq: [],
    events: [],
    parts: [],
    reviews: new Map(),
    asides: new Set(),
    outline: [
      { c1: 1, v1: 1, c2: 4, v2: 21, line: "Paul writes about divisions in the church" },
      { c1: 1, v1: 1, c2: 1, v2: 31, line: "Paul answers reports of quarrels" },
      { c1: 1, v1: 1, c2: 1, v2: 10, line: "Unity in Christ" },
    ],
    headings: [{ chapter: 1, verse: 1, heading: "Unity in Christ" }],
    footnotes: [],
    pericopes: [],
    speaking: () => [],
    tnNotes: [],
    speakerOrds: new Set(),
    tyndaleInside: () => [],
    stories: [],
    debates: [],
    prophets: NO_PROPHETS,
    bookNames: new Map([[book, "1 Corinthians"]]),
    parallels: [],
    glyssenParallels: () => [],
    ustSpeakers: new Map(),
    kinds: NO_KINDS,
    letters: NO_LETTERS,
    plainWords: NO_PLAIN_WORDS,
  };
}

describe("headlines", () => {
  it("a letter is headed 'Part of' the narrowest outline section that contains the passage, never its own title", () => {
    const [r] = summariseBook(letter("1CO"));
    expect(r?.headlineKind).toBe("Part of");
    expect(r?.headline).toBe("Paul answers reports of quarrels.");
    expect(r?.flags).toEqual([]);
  });

  it("a narrative book falls back to the narrowest book-outline section that contains it, at most three times its length", () => {
    const [r] = summariseBook(letter("JHN"));
    expect(r?.headlineKind).toBe("What happens");
    expect(r?.headlineSource).toBe("tN book outline");
    // Unlike the letters rule, this step does not skip a section named like the passage (as the prototype).
    expect(r?.headline).toBe("Unity in Christ.");
  });

  it("a narrative passage no event names is 'Part of' the narrowest containing book-outline section, any length (Acts)", () => {
    const base = letter("ACT");
    const more = [...Array(21).keys()].map((i): [number, [number, number]] => [46001011 + i, [1, 11 + i]]);
    const [r] = summariseBook({
      ...base,
      ordRef: new Map([...base.ordRef, ...more]),
      headings: [...base.headings, { chapter: 1, verse: 11, heading: "Later" }],
      outline: [{ c1: 1, v1: 1, c2: 1, v2: 31, line: "The church grows" }],
    });
    expect([r?.headlineKind, r?.headline, r?.headlineSource]).toEqual(["Part of", "The church grows.", "tN book outline"]);
  });
});

describe("passages", () => {
  it("a book without its own pericopes uses BSB sections, and one under 3 verses joins the next", () => {
    const data = { ...letter("1CO"), headings: [{ chapter: 1, verse: 1, heading: "Greeting" }, { chapter: 1, verse: 3, heading: "Unity" }, { chapter: 1, verse: 4, heading: "Wisdom" }] };
    expect(passagesOf(data).map((p) => [p.id, p.label])).toEqual([
      ["1CO.1.1-1.3", "Greeting"],
      ["1CO.1.4-1.10", "Wisdom"],
    ]);
  });

  it("the sample is seeded by the book code, so it repeats run to run", () => {
    const ids = [...Array(46).keys()].map((i) => `P${i}`);
    expect(sampleIds("JHN", ids)).toEqual(["P0", "P20", "P23", "P24", "P41"]);
    expect(sampleIds("JHN", ids)).toEqual(sampleIds("JHN", ids));
  });
});

describe("Tyndale in the body chain (rule 9)", () => {
  const note = (body: string): string => `<b>3:2</b> ${body} • <x>threshing floor</x> was a flat surface.`;

  it("takes a note's first sentence, references removed", () => {
    expect(tyndaleFirstSentence([note("Boaz might act as a redeemer for Ruth and Naomi (see study notes on 2:20; 3:9). More.")], "")).toBe(
      "Boaz might act as a redeemer for Ruth and Naomi.",
    );
  });

  it("skips a note that opens on an NLT lemma, or whose first sentence carries one the BSB does not use", () => {
    const opens = note("<x>Redeemer</x> means a family protector who acts.");
    const inside = note("As a <x>close relative</x>, Boaz might act as a redeemer for Ruth.");
    const plain = note("Ruth was to uncover Boaz’s feet to ensure that he would waken.");
    expect(tyndaleFirstSentence([opens, inside, plain], "Is not Boaz our kinsman?")).toBe("Ruth was to uncover Boaz’s feet to ensure that he would waken.");
    // The BSB saying the same words makes them the reader's own, so the sentence stands.
    expect(tyndaleFirstSentence([inside], "a close relative of ours")).toBe("As a close relative, Boaz might act as a redeemer for Ruth.");
  });
});

describe("Old Testament and Psalms rules", () => {
  it("cleans a BSB heading: entities decoded, book divisions dropped, capitals tamed", () => {
    expect(cleanHeading("BOOK I Psalms 1–41 The Two Paths")).toBe("The Two Paths");
    expect(cleanHeading("&#1488; ALEPH")).toBe("א Aleph");
  });

  it("names a Glyssen speaker without its bracketed reading or cut-off tail", () => {
    expect(glyssenName("voice of one calling (preparing way for Christ)")).toBe("voice of one calling");
    expect(glyssenName("seraph, one of the")).toBe("seraph");
  });

  it("frames unquoted speech with its speaker: one named person says, a group says in the plural", () => {
    expect(framed("I will save you.", "Yahweh")).toBe("God says: “I will save you.”");
    expect(framed("Follow me.", "Jesus")).toBe("Jesus says: “Follow me.”");
    // passage_summary.py checks(), John's round (12 Oct 2026).
    const verb = (who: string): string => framed("x", who).split(":")[0]?.split(" ").at(-1) ?? "";
    for (const [who, want] of [
      ["Cornelius", "says"],
      ["James", "says"],
      ["Chief priests", "say"],
      ["Disciples", "say"],
      ["Epicurean and Stoic philosophers", "say"],
      ["Person who told the guards and priests where the apostles were", "says"],
      ["God", "says"],
      ["teachers of religious law", "say"],
    ] as const) {
      expect(verb(who), who).toBe(want);
    }
  });

  it("puts at most two lines before a psalm, in John's order, and the rest behind About this psalm", () => {
    const intro =
      "# Psalm 23 General Notes\\n\\n## Structure and Formatting\\n\\nPsalm 23 is a psalm of trust.\\n\\n1. Yahweh as shepherd (1-4)\\n2. Yahweh as host (5)\\n3. David's trust (6)\\n\\n### Extended Metaphor\\n\\nDavid speaks of Yahweh as if he were a shepherd, and of himself as a sheep. More.";
    const { lead, about } = psalmLines(23, [[23, 1], [23, 6]], [{ ref: "23:intro", support: "", note: intro }], "A Psalm of David. The LORD is my shepherd.", "The Lord Is My Shepherd", null);
    expect(lead).toEqual([
      { label: "The picture", text: "David speaks of Yahweh as if he were a shepherd, and of himself as a sheep.", source: "tN" },
      { label: "What kind", text: "A song of trust in God", source: "tN intro" },
    ]);
    expect(about).toEqual([
      { label: "Title", text: "A Psalm of David.", source: "BSB superscription" },
      { label: "How it moves", text: "Verses 1–4: Yahweh as shepherd", source: "tN outline" },
      { label: "How it moves", text: "Verse 5: Yahweh as host", source: "tN outline" },
      { label: "How it moves", text: "Verse 6: David's trust", source: "tN outline" },
    ]);
    expect(psalmGate(lead, about)).toEqual([]);
  });

  it("leads with when a psalm was written, the author named for the first pronoun, then the turn tN states", () => {
    const intro = "## Structure and Formatting\\n\\nThis psalm moves from deep guilt to joy in forgiveness.";
    const v1 = "For the choirmaster. A Psalm of David, when the prophet Nathan came to him after he had gone in to Bathsheba. Have mercy on me, O God.";
    const { lead, about } = psalmLines(51, [[51, 1], [51, 19]], [{ ref: "51:intro", support: "", note: intro }], v1, "A Clean Heart", null);
    expect(lead).toEqual([
      { label: "Written when", text: "Written when the prophet Nathan came to David after he had gone in to Bathsheba.", source: "BSB superscription" },
      { label: "The turn", text: "It moves from deep guilt to joy in forgiveness.", source: "tN intro" },
    ]);
    expect(about[0]?.label).toBe("Title");
  });

  it("names Psalms 42 and 43 as one psalm at first, and a picture must compare", () => {
    const intro = "Psalms 42 and 43 were originally one psalm.\\n\\n## Structure and Formatting\\n\\n### Metaphor\\n\\nThe sons of Korah were a family of temple singers who led worship.";
    const { lead, about } = psalmLines(42, [[42, 1], [42, 11]], [{ ref: "42:intro", support: "", note: intro }], "", "Longing for God", null);
    expect(lead).toEqual([{ label: "About", text: "Psalms 42 and 43 were probably one psalm at first", source: "tN intro" }]);
    expect(about).toEqual([]);
  });

  it("gates Psalms mode: something before the psalm, at most two lines, clean text", () => {
    const kind = { label: "What kind", text: "A song of praise", source: "tN intro" };
    expect(psalmGate([], [])).toEqual(["a: nothing to show before the psalm"]);
    expect(psalmGate([kind, kind, kind], [])).toEqual(["f: 3 lines before the psalm, at most 2"]);
    expect(psalmGate([kind], [{ label: "Title", text: "BOOK I  of David", source: "x" }])).toEqual(["g: text hygiene (x)"]);
  });

  it("reads a genealogy heading, and draws the list line only from the heading's own two names", () => {
    for (const h of ["The Descendants of Cain", "Genealogy from Shem to Abram", "Terah’s Descendants", "Genealogy of Jesus"]) expect(GENEALOGY_HEAD.test(h), h).toBe(true);
    for (const h of ["Jacob Blesses His Sons", "The Seven Sons of Sceva", "The Parable of the Two Sons"]) expect(GENEALOGY_HEAD.test(h), h).toBe(false);
    const shem = "This is the account of Shem. … Nahor lived 29 years and became the father of Terah. Terah lived 70 years and became the father of Abram, Nahor, and Haran.";
    // passage_summary.py checks(): the text's last name ("Haran") is never used (John, 12 Oct 2026).
    expect(genealogyLine("Genealogy from Shem to Abram", shem)).toBe("The list runs from Shem to Abram.");
    expect(genealogyLine("The Descendants of Cain", "Cain and Enoch and Irad")).toBeNull();
    expect(genealogyLine("Terah’s Descendants", "Terah, Abram, Nahor and Haran")).toBeNull();
    expect(genealogyLine("Genealogy from Shem to Zerubbabel", shem)).toBeNull();
  });

  it("(f) a genealogy needs one distinct sentence", () => {
    const one = [line("Shem’s family line runs through ten generations to Abram.")];
    expect(gate("x", textOf(one), one, true, 55, 17, 1)).toEqual([]);
    expect(gate("x", textOf(one), one, true, 55, 17)).toEqual(["f: 1 distinct sentences, needs 3"]);
  });
});

describe("the stop rule", () => {
  it("stops a book over 15% flagged only once three summaries are flagged", () => {
    expect(overStop(1, 4)).toBe(false);
    expect(overStop(2, 6)).toBe(false);
    expect(overStop(3, 10)).toBe(true);
    expect(overStop(3, 20)).toBe(false);
    expect(overStop(9, 9)).toBe(true);
  });
});

describe("braces cut by a sentence end", () => {
  it("puts back the lost brace at the edge, never touching a word", () => {
    expect(rebraced("We are sending this letter} to you.")).toBe("{We are sending this letter} to you.");
    expect(rebraced("God answered {the prayers of Leah.")).toBe("God answered {the prayers of Leah.}");
    expect(rebraced("God answered {the prayers of} Leah.")).toBe("God answered {the prayers of} Leah.");
  });
});
