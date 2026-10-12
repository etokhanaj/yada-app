import { describe, expect, it } from "vitest";

import { endingOf, LEAD, leadFor, PAUSE, pauseFor, phrasesOf } from "./cadence";

const pieces = (text: string, from = 0) => phrasesOf(text, from).map((p) => [text.slice(p.start, p.end), p.pause]);

describe("phrasesOf", () => {
  it("cuts after a full stop, colon and semicolon, white space to the left", () => {
    expect(pieces("Then Lamech said to his wives: “Adah and Zillah, hear my voice; wives of Lamech, listen to my speech. For I have slain a man.")).toEqual([
      ["Then Lamech said to his wives: ", PAUSE.clause],
      ["“Adah and Zillah, hear my voice; ", PAUSE.clause],
      ["wives of Lamech, listen to my speech. ", PAUSE.sentence],
      ["For I have slain a man.", 0],
    ]);
  });

  it("cuts after closing quotes, where the voice gave a full stop no rest at all", () => {
    expect(pieces("He cried out, saying, “This is He of whom I said, ‘He was before me.’” Then he left.")).toEqual([
      ["He cried out, saying, ", PAUSE.quote],
      ["“This is He of whom I said, ", PAUSE.quote],
      ["‘He was before me.’” ", PAUSE.sentence],
      ["Then he left.", 0],
    ]);
  });

  it("rests briefly, not a full stop, before a speaker tag after a quotation", () => {
    expect(pieces("“Enough!” declared Israel. “My son Joseph is still alive!”")).toEqual([
      ["“Enough!” ", PAUSE.quote],
      ["declared Israel. ", PAUSE.sentence],
      ["“My son Joseph is still alive!”", 0],
    ]);
  });

  it("leaves ordinary commas, a dash and a verse number's colon to the voice", () => {
    const text = "In the beginning was the Word, and the Word was with God—as in 3:16.";
    expect(pieces(text)).toEqual([[text, 0]]);
  });

  it("does not cut at a verse's last mark: the rest before the next verse covers it", () => {
    expect(pieces("Who are you?”")).toEqual([["Who are you?”", 0]]);
  });

  it("tiles the text exactly, so an offset maps back through any phrase", () => {
    const text = "A Psalm of David. The Lord is my shepherd; I shall not want.";
    const phrases = phrasesOf(text);
    expect(phrases[0]?.start).toBe(0);
    expect(phrases[phrases.length - 1]?.end).toBe(text.length);
    for (let k = 1; k < phrases.length; k++) expect(phrases[k]?.start).toBe(phrases[k - 1]?.end);
    expect(phrases.map((p) => text.slice(p.start, p.end)).join("")).toBe(text);
  });

  it("starts mid-verse at `from`, inside a phrase", () => {
    const text = "A Psalm of David. The Lord is my shepherd; I shall not want.";
    const from = text.indexOf("is my");
    expect(pieces(text, from)).toEqual([
      ["is my shepherd; ", PAUSE.clause],
      ["I shall not want.", 0],
    ]);
  });

  it("starts at a cut exactly, and gives an empty tail one empty phrase", () => {
    const text = "Jesus wept. Then the Jews said";
    expect(pieces(text, text.indexOf("Then"))).toEqual([["Then the Jews said", 0]]);
    expect(phrasesOf("", 0)).toEqual([{ start: 0, end: 0, pause: 0 }]);
  });
});

describe("endingOf and leadFor", () => {
  it("reads how a verse ends through closing quotes and brackets", () => {
    expect(endingOf("I have surpassed me because He was before me.’”")).toBe("sentence");
    expect(endingOf("Who are you?")).toBe("sentence");
    expect(endingOf("YHWH is my shepherd, I do not lack,")).toBe("comma");
    expect(endingOf("hearken unto my speech:")).toBe("clause");
    expect(endingOf("the Lamb of God—")).toBe("comma");
    expect(endingOf("and he who was sent")).toBe("none");
  });

  it("answers a tap at once, and rests longer at a passage and a chapter", () => {
    expect(leadFor("start", "It is finished.")).toBe(0);
    expect(leadFor("verse", "It is finished.")).toBe(LEAD.sentence);
    expect(leadFor("verse", "and he said,")).toBe(LEAD.comma);
    expect(leadFor("passage", "and he said,")).toBe(LEAD.passage);
    expect(leadFor("chapter", null)).toBe(LEAD.chapter);
    expect(LEAD.chapter).toBeGreaterThan(LEAD.passage);
    expect(LEAD.passage).toBeGreaterThan(LEAD.sentence);
  });
});

describe("pauseFor", () => {
  it("scales every rest with the speed", () => {
    expect(pauseFor(0.6, 1)).toBe(0.6);
    expect(pauseFor(0.6, 1.5)).toBe(0.4);
    expect(pauseFor(0.6, 0.8)).toBe(0.75);
  });
});
