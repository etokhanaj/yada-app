import { describe, expect, it } from "vitest";

import {
  CREDITS,
  UW_SOURCES,
  UnderstandRefused,
  bsbTables,
  checkUwLicence,
  barePart,
  cleanTitle,
  tnNumberedItems,
  md,
  obsStory,
  tnBookOutline,
  tnGuides,
  tqAnswers,
  twArticle,
  twLinkPath,
  ustVerses,
} from "./sources.js";
import { opcodes, seededSample } from "./text.js";

const TN_HEADER = "Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote";
const tnRow = (ref: string, note: string, support = "", quote = ""): string => [ref, "ab12", "", support, quote, "1", note].join("\t");

describe("UST USFM", () => {
  it("splits on markers anywhere, so a verse that starts mid-line in poetry is its own verse", () => {
    const usfm = [
      "\\id PSA",
      "\\c 23",
      "\\s1 A psalm of David",
      "\\q1 \\v 1 \\zaln-s |x-strong=\"H3068\"\\*\\w Yahweh|x-occurrence=\"1\"\\w*\\zaln-e\\* is my shepherd ,",
      "\\q2 I have all I need . \\q1 \\v 2 He lets me rest",
      "\\q2 in green fields .",
    ].join("\n");
    const v = ustVerses(usfm);
    expect(v.get("23:1")).toBe("Yahweh is my shepherd, I have all I need.");
    expect(v.get("23:2")).toBe("He lets me rest in green fields.");
  });

  it("gives a bridged verse's text to each verse it covers", () => {
    const v = ustVerses("\\c 3\n\\p \\v 1-2 Both verses here.\n\\v 3 Then one.");
    expect(v.get("3:1")).toBe("Both verses here.");
    expect(v.get("3:2")).toBe("Both verses here.");
    expect(v.get("3:3")).toBe("Then one.");
  });

  it("drops footnotes, and keeps the UST's {added words}", () => {
    const v = ustVerses("\\c 1\n\\v 1 In the beginning {God} spoke \\f + \\ft a note\\f* clearly.");
    expect(v.get("1:1")).toBe("In the beginning {God} spoke clearly.");
  });

  it("summary reading: closes up brackets and braces, rejoins split possessives, drops an inline section range", () => {
    const v = ustVerses("\\c 2\n\\v 4 \\sr 2:4-25\n( This is { the } story of Jesse’ s son ) .", { summary: true });
    expect(v.get("2:4")).toBe("(This is {the} story of Jesse’s son).");
  });
});

describe("Translation Notes outlines and asides", () => {
  const tn = [
    TN_HEADER,
    tnRow("front:intro", "# Introduction\\n\\n1. Introduction about who Jesus is ([1:1–18](../01/01.md))\\n3. Jesus preaches (2–11)\\n    * Jesus meets with the disciples (21)\\n5. Story (7:53–8:11)"),
    tnRow("1:intro", "## Structure\\n\\n1. Jesus is God ([1:1–5](../01/01.md))\\n    * Jesus calls four disciples ([1:14–20](../01/14.md))\\n2. Summary statement ([1:33](../01/33.md))\\n3. A long section ([1:40–2:3](../01/40.md))\\n4. Joseph’s death Genesis ([1:50–51](../01/50.md))"),
    tnRow("1:2", "Background note.", "rc://*/ta/man/translate/writing-background"),
    tnRow("1:3", "Events out of order.", "rc://*/ta/man/translate/figs-events"),
    tnRow("1:4", "A metaphor.", "rc://*/ta/man/translate/figs-metaphor"),
  ].join("\n");

  it("reads numbered items and * bullets (Mark lists its passages as bullets), single verses and chapter-crossing ranges", () => {
    const { events, asides } = tnGuides(tn);
    expect(events).toEqual([
      { chapter: 1, v1: 1, v2: 5, line: "Jesus is God" },
      { chapter: 1, v1: 14, v2: 20, line: "Jesus calls four disciples" },
      { chapter: 1, v1: 33, v2: 33, line: "Summary statement" },
      { chapter: 1, v1: 40, v2: 999, line: "A long section" },
      { chapter: 1, v1: 50, v2: 51, line: "Joseph’s death" },
    ]);
    expect([...asides]).toEqual(["1:2", "1:3"]);
  });

  it("reads the book outline, whole-chapter items included", () => {
    expect(tnBookOutline(tn)).toEqual([
      { c1: 1, v1: 1, c2: 1, v2: 18, line: "Introduction about who Jesus is" },
      { c1: 2, v1: 1, c2: 11, v2: 999, line: "Jesus preaches" },
      { c1: 21, v1: 1, c2: 21, v2: 999, line: "Jesus meets with the disciples" },
      { c1: 7, v1: 53, c2: 8, v2: 11, line: "Story" },
    ]);
  });

  it("reads an outline written reference first (Joel, Malachi), under its heading only", () => {
    const intro = [
      "# Introduction to Malachi",
      "1:5 is not an outline item here",
      "### Outline of Malachi",
      "",
      "[1:1](../01/01.md) Title",
      "1:2–5 Yahweh will punish the wicked: Edom",
      "[2:17](../02/17.md)–[3:5](../03/05.md) Yahweh is concerned for justice",
      "### What is the book about?",
      "3:1 neither is this",
    ].join("\\n");
    const row = ["Reference", "ID", "Tags", "SupportReference", "Quote", "Occurrence", "Note"].join("\t");
    expect(tnBookOutline(`${row}\nfront:intro\tx\t\t\t\t0\t${intro}`)).toEqual([
      { c1: 1, v1: 1, c2: 1, v2: 1, line: "Title" },
      { c1: 1, v1: 2, c2: 1, v2: 5, line: "Yahweh will punish the wicked: Edom" },
      { c1: 2, v1: 17, c2: 3, v2: 5, line: "Yahweh is concerned for justice" },
    ]);
  });

  it("lists an outline's numbered items in order, under its heading only (Habakkuk)", () => {
    const intro = ["1. Not the outline", "### Outline of Habakkuk", "1. Superscription", "2. Habakkuk’s first complaint", "    * Woe to the one", "### Next", "3. Not this"].join("\\n");
    const row = ["Reference", "ID", "Tags", "SupportReference", "Quote", "Occurrence", "Note"].join("\t");
    expect(tnNumberedItems(`${row}\nfront:intro\tx\t\t\t\t0\t${intro}`)).toEqual(["Superscription", "Habakkuk’s first complaint"]);
  });

  it("drops a trailing book name from an outline title", () => {
    expect(cleanTitle("  Joseph’s  death Genesis ")).toBe("Joseph’s death");
    expect(cleanTitle("Paul greets 1 Corinthians")).toBe("Paul greets");
  });

  it("markdown: links to their words, (See: …) and bold removed", () => {
    expect(md("A **word** [here](../x.md) (See: [Metaphor](rc://en/ta/man/translate/figs-metaphor)).\\nNext")).toBe("A word here.\nNext");
  });
});

describe("Translation Questions", () => {
  it("keeps plain answers and strips a trailing reference; skips answers that lean on the question", () => {
    const tq = [
      "Reference\tID\tTags\tQuote\tOccurrence\tQuestion\tResponse",
      "1:1\ta\t\t\t0\tWhat was there?\tIn the beginning was the Word.",
      "1:2\tb\t\t\t0\tWhy?\tJoseph told them to encourage them . 50:22-26",
      "1:3\tc\t\t\t0\tDid he?\tNo, he did not do that at all.",
      "1:4\td\t\t\t0\tWho?\tThe Word.",
    ].join("\n");
    expect(tqAnswers(tq)).toEqual([
      { chapter: 1, verse: 1, answer: "In the beginning was the Word." },
      { chapter: 1, verse: 2, answer: "Joseph told them to encourage them." },
    ]);
  });
});

describe("Translation Words", () => {
  it("reads only the Definition section's first paragraph", () => {
    const article = "# church, Church\n\n## Definition:\n\nIn the New Testament, the term “church” refers to all people who believe in Jesus.\n\n* more\n\n## Translation Suggestions:\n\n* Translate it as “assembly”.";
    expect(twArticle(article, "kt")).toEqual({ term: "church", definition: "In the New Testament, the term “church” refers to all people who believe in Jesus.", kind: "kt" });
    expect(twLinkPath("rc://*/tw/dict/bible/kt/church")).toEqual(["kt", "church"]);
  });

  it("reads a Facts section the same way", () => {
    expect(twArticle("# Corinth\n\n## Facts:\n\nCorinth was a city in Greece.\n", "names")?.definition).toBe("Corinth was a city in Greece.");
  });
});

describe("Open Bible Stories", () => {
  const names = new Map([["john", "JHN"], ["luke", "LUK"], ["psalm", "PSA"]]);

  it("reads spans from the 'A Bible story from' line and drops images", () => {
    const story = obsStory(
      38,
      "# 38. Jesus Is Betrayed\n\n![OBS Image](https://cdn.door43.org/obs/jpg/38-01.jpg)\n\nJesus went to Jerusalem.\n\n![OBS Image](x.jpg)\n\nJudas went to the leaders.\n\n_A Bible story from: Luke 22:1-23; John 13:21-30; Psalm 23_",
      names,
    );
    expect(story.frames).toEqual(["Jesus went to Jerusalem.", "Judas went to the leaders."]);
    expect(story.spans).toEqual([
      { book: "LUK", c1: 22, v1: 1, c2: 22, v2: 23 },
      { book: "JHN", c1: 13, v1: 21, c2: 13, v2: 30 },
      { book: "PSA", c1: 23, v1: 1, c2: 23, v2: 999 },
    ]);
  });
});

describe("Berean BSB tables", () => {
  const row = (verse: string, orig: string, strong: string, bsb: string, opts: { heading?: string; foot?: string } = {}): string => {
    const r = new Array<string>(23).fill("");
    r[6] = orig;
    r[11] = strong;
    r[12] = verse;
    r[13] = opts.heading ?? "";
    r[18] = ` ${bsb} `;
    r[21] = opts.foot ?? "";
    return r.join("\t");
  };
  const header = new Array<string>(23).fill("h").join("\t");

  it("normalises Psalm and Psalms, so the tables' 'Psalm 23:1' is core's Psalms", () => {
    const names = new Map([["psalm", "PSA"]]);
    const t = bsbTables([header, row("Psalm 23:1", "יְהוָה", "3068", "The LORD", { heading: "<p class=|hdg|>The LORD Is My Shepherd" }), row("", "רֹעִי", "7462", "is my shepherd")].join("\r\n"), "PSA", names);
    expect(t.verses.get("23:1")?.map((w) => w.bsb)).toEqual(["The LORD", "is my shepherd"]);
    expect(t.headings).toEqual([{ chapter: 23, verse: 1, heading: "The LORD Is My Shepherd", summaryHeading: "The LORD Is My Shepherd", parallels: "" }]);
  });

  it("keeps each word's footnote with tags and the | quote marks removed", () => {
    const names = new Map([["john", "JHN"]]);
    const t = bsbTables([header, row("John 5:3", "x", "1", "word", { foot: "<i>BYZ</i> and TR include |4|" })].join("\n"), "JHN", names);
    expect(t.verses.get("5:3")?.[0]?.foot).toBe("BYZ and TR include 4");
  });
});

describe("licences and credits", () => {
  it("reads CC BY-SA 4.0 from each LICENSE.md, and refuses a file that no longer says it", () => {
    const ust = UW_SOURCES[0];
    if (ust === undefined) throw new Error("no sources");
    expect(checkUwLicence(ust, "﻿This work is made available under the Creative Commons Attribution-ShareAlike 4.0 International License.")).toContain("ShareAlike");
    expect(() => checkUwLicence(ust, "All rights reserved.")).toThrow(UnderstandRefused);
  });

  it("credits say what changed, word for word as the prototype", () => {
    expect(CREDITS.ust).toBe("Simplified Text, adapted from unfoldingWord (alignment markup removed) · CC BY-SA 4.0");
    expect(CREDITS.tyndale).toBe("Adapted from Tyndale Open Study Notes: references and some quotations removed; some terms in plain words (e.g. “Gentiles” → “non-Jews”) · CC BY-SA 4.0");
    expect(CREDITS.tq).toBe("Translation Questions, adapted from unfoldingWord (verse references removed, spacing tidied) · CC BY-SA 4.0");
    expect(CREDITS.bsb).toBe("Berean Standard Bible footnotes · public domain");
  });
});

describe("Python-compatible tools", () => {
  it("diffs as difflib.SequenceMatcher(autojunk=False) does", () => {
    expect(opcodes(["women", "should", "be", "silent"], ["let", "your", "wives", "keep", "silent"])).toEqual([
      ["replace", 0, 3, 0, 4],
      ["equal", 3, 4, 4, 5],
    ]);
  });

  it("draws the seeded sample as CPython 3.9's random.Random(seed).sample does", () => {
    // Values from python3 -c "import random; print(random.Random('yada-summary-sample-JHN').sample(list(range(46)), 5))".
    const range = (n: number): number[] => [...Array(n).keys()];
    expect(seededSample("yada-summary-sample-JHN", range(46), 5)).toEqual([41, 24, 0, 23, 20]);
    expect(seededSample("yada-summary-sample-RUT", range(8), 5)).toEqual([6, 1, 7, 0, 2]);
    expect(seededSample("abc", range(100), 7)).toEqual([98, 71, 58, 90, 45, 99, 20]);
  });
});

describe("chapter-introduction parts", () => {
  it("reads a bare range after or before the title, in the introduction's chapter", () => {
    expect(barePart("* Woe to Ariel (1–8)", 29)).toEqual({ c1: 29, v1: 1, c2: 29, v2: 8, line: "Woe to Ariel" });
    expect(barePart("* (vv. 2–19) Elijah speaks with Yahweh", 19)).toEqual({ c1: 19, v1: 2, c2: 19, v2: 19, line: "Elijah speaks with Yahweh" });
    expect(barePart("Not an item", 1)).toBeNull();
  });
});
