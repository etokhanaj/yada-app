import { describe, expect, it } from "vitest";

import {
  buildFtsQuery, englishVariants, escapeLike, EXCERPT_TOKENS, excerptAroundHit, glossMatches, glossStem, planSearch, quoteFtsTerm,
  SNIPPET_CLOSE, SNIPPET_OPEN, splitSnippet,
} from "./searchQuery";

describe("FTS5 query building", () => {
  it("quotes every term so user input is never syntax", () => {
    expect(buildFtsQuery("love one another")).toBe('"love" "one" "another"');
    expect(buildFtsQuery("NOT love")).toBe('"NOT" "love"');
    expect(buildFtsQuery("a-b")).toBe('"a-b"');
    expect(buildFtsQuery("(love)")).toBe('"love"');
  });

  it("doubles embedded quotes", () => {
    expect(quoteFtsTerm('say "amen"')).toBe('"say ""amen"""');
    expect(buildFtsQuery('he"llo')).toBe('"he""llo"');
  });

  it("returns null when nothing searchable remains", () => {
    expect(buildFtsQuery("  ")).toBeNull();
    expect(buildFtsQuery('" * : ( )')).toBeNull();
  });

  it("adds a prefix star to the last term only once it has three letters", () => {
    expect(buildFtsQuery("good shep", { prefixLast: true })).toBe('"good" "shep"*');
    expect(buildFtsQuery("go", { prefixLast: true })).toBe('"go"');
  });

  it("escapes LIKE wildcards", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("English gloss matching", () => {
  it("finds regular inflections", () => {
    expect(englishVariants("love")).toEqual(expect.arrayContaining(["love", "loves", "loved", "loving", "lover"]));
    expect(glossMatches("loving", "love")).toBe(true);
    expect(glossMatches("beloved", "love")).toBe(false);
    expect(glossMatches("lover my", "love")).toBe(true);
    expect(glossMatches("word", "love")).toBe(false);
    expect(glossMatches("cried", "cry")).toBe(true);
  });

  it("has a stem every variant contains", () => {
    for (const word of ["love", "cry", "word", "faith", "words"]) {
      const stem = glossStem(word);
      expect(englishVariants(word).every((v) => v.includes(stem))).toBe(true);
    }
  });
});

describe("search planning", () => {
  it("reads a forgiving reference", () => {
    expect(planSearch("jn 3 16").reference).toEqual({ book: "JHN", chapter: 3, verse: 16 });
    expect(planSearch("1 Cor 14:34").reference).toEqual({ book: "1CO", chapter: 14, verse: 34 });
    expect(planSearch("Genesis").reference).toEqual({ book: "GEN", chapter: 1 });
  });

  it("never turns an ordinary word into a book", () => {
    const love = planSearch("love");
    expect(love.reference).toBeNull();
    expect(love.fts).toBe('"love"');
    expect(love.glossWord).toBe("love");
    expect(planSearch("is").reference).toBeNull();
  });

  it("routes Greek and Hebrew to word search with normalised keys", () => {
    const logos = planSearch("λόγος");
    expect(logos.script).toBe("greek");
    expect(logos.wordKey).toBe("λογοσ");
    expect(logos.fts).toBeNull();
    const hebrew = planSearch("אֱלֹהִים");
    expect(hebrew.script).toBe("hebrew");
    expect(hebrew.wordKey).toBe("אלהימ");
  });
});

describe("snippet splitting", () => {
  it("separates hits from context", () => {
    const s = `If you ${SNIPPET_OPEN}love${SNIPPET_CLOSE} those who ${SNIPPET_OPEN}love${SNIPPET_CLOSE} you`;
    expect(splitSnippet(s)).toEqual([
      { text: "If you ", hit: false }, { text: "love", hit: true },
      { text: " those who ", hit: false }, { text: "love", hit: true }, { text: " you", hit: false },
    ]);
  });
});

const mark = (word: string): string => `${SNIPPET_OPEN}${word}${SNIPPET_CLOSE}`;

describe("passage excerpts", () => {
  it("keeps a short verse whole", () => {
    const verse = `For God so ${mark("loved")} the world`;
    expect(excerptAroundHit(verse)).toBe(verse);
  });

  it("starts a long English verse a few words before its first hit", () => {
    // Acts 6:5, ASV.
    const verse = `And the saying pleased the whole multitude: and they chose ${mark("Stephen")}, a man full of faith and of the Holy Spirit, and Philip, and Prochorus, and Nicanor, and Timon, and Parmenas, and Nicolaüs a proselyte of Antioch;`;
    const excerpt = excerptAroundHit(verse);
    expect(excerpt).toBe(`…multitude: and they chose ${mark("Stephen")}, a man full of faith and of the Holy Spirit, and Philip, and Prochorus, and…`);
    expect(excerpt.match(/\p{L}+/gu)).toHaveLength(EXCERPT_TOKENS);
  });

  it("shows a hit near the end of a long verse, where snippet() hid it", () => {
    // The incident: snippet() ended its window on "proselyte", past the row's two lines.
    const verse = `And the saying pleased the whole multitude: and they chose Stephen, a man full of faith and of the Holy Spirit, and Philip, and Prochorus, and Nicanor, and Timon, and Parmenas, and Nicolaüs a ${mark("proselyte")} of Antioch;`;
    expect(excerptAroundHit(verse)).toBe(`…Parmenas, and Nicolaüs a ${mark("proselyte")} of Antioch;`);
  });

  it("counts a word with a combining diacritic as one word, as unicode61 does", () => {
    const verse = `${"and ".repeat(10)}Nicolau\u0308s a ${mark("proselyte")} of Antioch and ${"more ".repeat(20)}`.trim();
    const excerpt = excerptAroundHit(verse);
    expect(excerpt.startsWith("…and and Nicolau\u0308s a ")).toBe(true);
  });

  it("keeps the marker on a hit that opens the window", () => {
    const verse = `${mark("Grace")} ${"and peace ".repeat(15)}`.trim();
    expect(excerptAroundHit(verse).startsWith(SNIPPET_OPEN)).toBe(true);
    expect(excerptAroundHit(verse).endsWith("…")).toBe(true);
  });
});
