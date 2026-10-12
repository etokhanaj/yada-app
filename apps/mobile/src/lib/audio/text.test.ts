import { describe, expect, it } from "vitest";

import { splitDivineName } from "../reader";
import { phrasesOf } from "./cadence";
import { markPieces, spokenFor, spokenOffsetOf, toneAt, wordAt, wordRanges } from "./text";

/** The drawn word a spoken substring starts in, found the way AVSpeechSynthesizer reports it. */
function wordFor(display: string, spokenWord: string, nth = 0): string | null {
  const spoken = spokenFor(display);
  let at = -1;
  for (let k = 0; k <= nth; k++) at = spoken.text.indexOf(spokenWord, at + 1);
  const words = wordRanges(display);
  const i = wordAt(words, spoken, at);
  if (i === null) return null;
  const w = words[i];
  return w === undefined ? null : display.slice(w.start, w.end);
}

describe("spokenFor", () => {
  it("reads LORD and GOD as words, at the same length", () => {
    const display = "A Psalm of David. The LORD is my shepherd; I shall not want.";
    const s = spokenFor(display);
    expect(s.text).toBe("A Psalm of David. The Lord is my shepherd; I shall not want.");
    expect(s.source).toEqual([...display].map((_, i) => i));
  });

  it("keeps LORD’s possessive", () => {
    expect(spokenFor("the LORD’s house").text).toBe("the Lord’s house");
  });

  it("reads the LSV's capitalised titles as words, not letters", () => {
    expect(spokenFor("A PSALM OF DAVID. YHWH [is] my shepherd").text).toBe("A Psalm Of David. Yahweh is my shepherd");
  });

  it("drops the LSV's brackets and line divider without moving a word", () => {
    const display = "give ear [to] my saying: For I have slain a man for my wound, || Even a young man";
    const s = spokenFor(display);
    expect(s.text).toBe("give ear to my saying: For I have slain a man for my wound,  Even a young man");
    expect(wordFor(display, "to")).toBe("[to]");
    expect(wordFor(display, "Even")).toBe("Even");
  });

  it("leaves numbers as printed, so they are read as numbers", () => {
    const display = "with about 600,000 men on foot";
    expect(spokenFor(display).text).toBe(display);
    expect(wordFor(display, "600,000")).toBe("600,000");
  });

  it("reads no footnote markers", () => {
    expect(spokenFor("in the beginning* was† the Word").text).toBe("in the beginning was the Word");
  });
});

describe("wordAt", () => {
  it("lands on the drawn word, punctuation and quotes attached", () => {
    const display = "Then Lamech said to his wives: “Adah and Zillah, hear my voice;";
    expect(wordFor(display, "wives")).toBe("wives:");
    expect(wordFor(display, "Adah")).toBe("“Adah");
    expect(wordFor(display, "voice")).toBe("voice;");
  });

  it("maps YHWH's six spoken letters inside its four drawn ones", () => {
    const display = "YHWH [is] my shepherd";
    const s = spokenFor(display);
    const words = wordRanges(display);
    for (let k = 0; k < 6; k++) expect(wordAt(words, s, k)).toBe(0);
    expect(wordAt(words, s, s.text.indexOf("is"))).toBe(1);
  });

  it("gives a range on white space to the next word, and nothing past the end", () => {
    const display = "The Light shines";
    const s = spokenFor(display);
    expect(wordAt(wordRanges(display), s, 3)).toBe(1);
    expect(wordAt(wordRanges(display), s, 99)).toBeNull();
  });

  it("finds the same word again later in the verse", () => {
    const display = "The Light shines in the darkness, and the darkness has not overcome it.";
    expect(wordFor(display, "darkness", 1)).toBe("darkness");
    const s = spokenFor(display);
    const words = wordRanges(display);
    expect(wordAt(words, s, s.text.lastIndexOf("darkness"))).toBe(8);
  });
});

describe("spokenOffsetOf", () => {
  it("resumes at a word's first spoken character", () => {
    const display = "YHWH [is] my shepherd";
    const s = spokenFor(display);
    const words = wordRanges(display);
    expect(s.text.slice(spokenOffsetOf(s, words[1]!))).toBe("is my shepherd");
  });
});

/**
 * Every word the synthesizer would report for `display` read phrase by phrase (cadence.ts):
 * each utterance reports ranges from its own start, and the app adds the phrase's offset.
 */
function heardThroughPhrases(display: string, from = 0): string[] {
  const spoken = spokenFor(display);
  const words = wordRanges(display);
  const heard: string[] = [];
  for (const p of phrasesOf(spoken.text, from)) {
    const utterance = spoken.text.slice(p.start, p.end);
    for (const m of utterance.matchAll(/\S+/g)) {
      const i = wordAt(words, spoken, p.start + m.index);
      const w = i === null ? undefined : words[i];
      heard.push(w === undefined ? "?" : display.slice(w.start, w.end));
    }
  }
  return heard;
}

describe("word mapping through phrases", () => {
  it("lands every reported word on its drawn word, across cuts", () => {
    const display = "Then Lamech said to his wives: “Adah and Zillah, hear my voice; wives of Lamech, listen to my speech. For I have slain a man.";
    expect(heardThroughPhrases(display)).toEqual(wordRanges(display).map((w) => display.slice(w.start, w.end)));
  });

  it("keeps LORD, YHWH and the LSV's silent marks exact after a cut", () => {
    const display = "A PSALM OF DAVID. YHWH [is] my shepherd; I do not lack, || In pastures of tender grass He causes me to lie down.";
    const heard = heardThroughPhrases(display);
    expect(heard.slice(0, 7)).toEqual(["A", "PSALM", "OF", "DAVID.", "YHWH", "[is]", "my"]);
    expect(heard).not.toContain("?");
    expect(heard).not.toContain("||");
    expect(heard[heard.indexOf("lack,") + 1]).toBe("In");
  });

  it("resumes mid-verse at the same drawn word (speed change)", () => {
    const display = "He cried out, saying, “This is He of whom I said, ‘He was before me.’” Then the LORD spoke.";
    const spoken = spokenFor(display);
    const words = wordRanges(display);
    const of = words.findIndex((w) => display.slice(w.start, w.end) === "whom");
    expect(heardThroughPhrases(display, spokenOffsetOf(spoken, words[of]!))).toEqual(
      words.slice(of).map((w) => display.slice(w.start, w.end)),
    );
  });
});

describe("markPieces", () => {
  const display = "The LORD is my shepherd";
  const segments = splitDivineName(display);
  const words = wordRanges(display);

  it("splits ink, the pill and muted at the spoken word, keeping small capitals", () => {
    const pieces = markPieces(segments, { kind: "current", word: words[1]! });
    expect(pieces.map((p) => [p.text, p.tone, p.smallCaps])).toEqual([
      ["The ", "ink", false],
      ["LORD", "pill", true],
      [" is my shepherd", "muted", false],
    ]);
  });

  it("draws an upcoming verse, or one not yet started, all muted", () => {
    expect(markPieces(segments, { kind: "upcoming" }).every((p) => p.tone === "muted")).toBe(true);
    expect(markPieces(segments, { kind: "current", word: null }).every((p) => p.tone === "muted")).toBe(true);
  });

  it("counts from an offset when a verse is drawn in parts", () => {
    const rest = [{ text: "my shepherd", smallCaps: false }];
    const pieces = markPieces(rest, { kind: "current", word: words[3]! }, 12);
    expect(pieces.map((p) => [p.text, p.tone])).toEqual([
      ["my", "pill"],
      [" shepherd", "muted"],
    ]);
    expect(toneAt({ kind: "current", word: words[3]! }, 0)).toBe("ink");
  });
});
