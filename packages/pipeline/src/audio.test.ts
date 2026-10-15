import { describe, expect, it } from "vitest";

import { alignWords, AudioRefused, audioText, buildAudio, chapterTimings, cutParts, numberWords, passes, speakableParts, spokenTitle } from "./audio.js";

/**
 * The timings only ever come from the recording: the recogniser's words are compared with the BSB's and
 * dropped (docs/research/bsb-audio-printing-check.md).
 */
describe("aligning a recording with the BSB text", () => {
  const heard = [
    { word: "John", at: 1 },
    { word: "1.", at: 4 },
    { word: "In", at: 4.2 },
    { word: "the", at: 4.4 },
    { word: "beginning", at: 4.5 },
    { word: "was", at: 5.2 },
    { word: "the", at: 5.4 },
    { word: "Word,", at: 5.6 },
  ];

  it("skips the spoken heading and times each word of the text", () => {
    const { times, matched } = alignWords(["In", "the", "beginning", "was", "the", "Word,"], heard);
    expect(times).toEqual([4.2, 4.4, 4.5, 5.2, 5.4, 5.6]);
    expect(matched).toBe(1);
  });

  it("gives a word the recogniser missed the time before it, never an earlier one", () => {
    const { times, matched } = alignWords(["In", "the", "very", "beginning"], heard);
    expect(times).toEqual([4.2, 4.4, 4.4, 4.5]);
    expect(matched).toBe(0.75);
  });

  it("cuts the chapter into verses that end where the next begins", () => {
    const t = chapterTimings("JHN", 1, "hays", [{ verse: 1, text: "In the beginning" }, { verse: 2, text: "was the Word," }], heard, 9);
    expect(t.verses.map((v) => [v.verse, v.start, v.end])).toEqual([
      [1, 4.2, 5.2],
      [2, 5.2, 9],
    ]);
  });
});

describe("which texts may become audio (rule 9)", () => {
  it("allows only the four public-domain texts", () => {
    for (const t of ["BSB", "WEB", "KJV", "LSV"]) expect(audioText(t)).toBe(t);
  });

  it("refuses licensed versions, and anything else, before reading anything", async () => {
    for (const t of ["NKJV", "NLT", "MSG", "NIV", "ESV", "CSB", "bsb", ""]) {
      expect(() => audioText(t)).toThrow(AudioRefused);
      // A root that does not exist: the refusal comes first, so nothing is opened to find that out.
      await expect(buildAudio("JHN", "heart", t, "/nonexistent")).rejects.toThrow(/licensed text never becomes audio/);
    }
  });
});

describe("speakableParts (Kokoro's input limit)", () => {
  it("keeps a short verse whole", () => {
    expect(speakableParts("Jesus wept.")).toEqual(["Jesus wept."]);
  });

  it("splits a long verse at sentences, then commas, keeping every word in order", () => {
    const long = `${"And he said, ".repeat(30)}behold. Then they went out; and it was night.`;
    const parts = speakableParts(long);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(280);
    expect(parts.join(" ").split(/\s+/)).toEqual(long.split(/\s+/));
  });
});

describe("folding words for alignment", () => {
  it("matches a word inside closing quotes (John 1:15, “… before me.’”)", () => {
    const { matched } = alignWords(["was", "before", "me.’”"], [{ word: "was", at: 1 }, { word: "before", at: 1.2 }, { word: "me.", at: 1.5 }]);
    expect(matched).toBe(1);
  });
});

describe("speakableParts with no commas to split at", () => {
  it("cuts between words, never past the limit", () => {
    const run = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    const parts = speakableParts(`${run}.`);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(280);
    expect(parts.join(" ")).toBe(`${run}.`);
  });
});

describe("a verse the BSB leaves blank (Matthew 17:21)", () => {
  it("gets no timing and leaves the verse before it its own end", () => {
    const verses = [
      { verse: 20, text: "He answered." },
      { verse: 21, text: "" },
      { verse: 22, text: "They gathered." },
    ];
    const heard = ["He", "answered.", "They", "gathered."].map((word, i) => ({ word, at: i }));
    const t = chapterTimings("MAT", 17, "heart", verses, heard, 9);
    expect(t.verses.map((v) => v.verse)).toEqual([20, 22]);
    expect(t.verses[0]?.end).toBe(2);
  });
});

describe("the check a computer voice must pass", () => {
  it("allows the recogniser's misses but not a part made too fast for its length", () => {
    expect(passes("heart", { matched: 0.75 })).toBe(true);
    expect(passes("hays", { matched: 0.95 })).toBe(false);
    expect(passes("heart", { matched: 0.99, cutShort: [7] })).toBe(false);
    expect(cutParts([{ verse: 1, start: 0, end: 2, chars: 200 }, { verse: 2, start: 2, end: 14, chars: 200 }]).map((p) => p.verse)).toEqual([1]);
  });

  it("times a computer voice's verse from its parts and places unheard names between heard words", () => {
    const verses = [{ verse: 1, text: "Adam, Seth, Enosh, Kenan" }];
    const heard = [{ word: "Adam,", at: 0.5 }, { word: "Kenan", at: 3 }];
    const t = chapterTimings("1CH", 1, "heart", verses, heard, 5, [{ verse: 1, start: 0.4, end: 3.6, chars: 24 }]);
    const [v] = t.verses;
    expect([v?.start, v?.end]).toEqual([0.4, 3.6]);
    const w = v?.words ?? [];
    expect(w[0]).toBe(0.5);
    expect(w[3]).toBe(3);
    expect((w[1] as number) > 0.5 && (w[1] as number) < (w[2] as number) && (w[2] as number) < 3).toBe(true);
  });
});

describe("chapter titles", () => {
  it("spells the numbers out", () => {
    expect([1, 13, 20, 23, 100, 119, 150].map(numberWords)).toEqual(["one", "thirteen", "twenty", "twenty-three", "one hundred", "one hundred and nineteen", "one hundred and fifty"]);
    expect(() => numberWords(0)).toThrow(RangeError);
  });

  it("says a book's name as a reader would", () => {
    expect(spokenTitle("JHN", 3)).toBe("John, chapter three");
    expect(spokenTitle("1SA", 1)).toBe("First Samuel, chapter one");
    expect(spokenTitle("3JN", 1)).toBe("Third John, chapter one");
    expect(spokenTitle("PSA", 23)).toBe("Psalm twenty-three");
    expect(spokenTitle("SNG", 8)).toBe("Song of Songs, chapter eight");
  });
});
