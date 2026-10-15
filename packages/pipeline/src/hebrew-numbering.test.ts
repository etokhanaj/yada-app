import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

import { parseBsb } from "./english.js";
import {
  ACCEPTED_DIVERGENCES,
  divergenceKey,
  hebrewSegments,
  mapHebrewNumbered,
  parseHebrewCell,
  parseTvtmsHebrew,
  readHebrewNumberedVpl,
  type TvtmsHebrew,
} from "./hebrew-numbering.js";
import { RAW } from "./paths.js";

/**
 * TVTMS's English/Hebrew MT table, a few rows of each kind, in its own layout. The parser refuses
 * a table under 1000 rows (a format change must not read as "no differences"), so the test pads it
 * with Psalm 119-style identity rows that change nothing.
 */
function tvtmsText(rows: string[]): string {
  const padding = Array.from({ length: 1000 }, (_, i) => `Psa.150:${i + 100}\tPsa.150:${i + 100}`);
  return [
    "Differences resulting in substituted verse numbers:",
    "English (NRSV, ESV, KJV etc)\tHebrew MT\t\t\t",
    "'================\t'=========",
    "",
    ...rows,
    ...padding,
    "",
    "Phrases and Abbreviations to translate to different languages: \t\t",
  ].join("\r\n");
}

const ROWS = [
  "Gen.31:55\tGen.32:1",
  "Num.26:1\tNum.25:19; 26:1",
  "1Ki.22:43\t1Ki.22:43,44",
  "Neh.7:69\t",
  "Psa.3:0\tPsa.3:1",
  "Psa.3:1\tPsa.3:2",
  "*Psa.38:16\tPsa.38:17",
  "Psa.51:0\tPsa.51:1,2",
  "Psa.51:1\tPsa.51:3",
  "Isa.63:19\tIsa.63:19a",
  "Isa.64:1\tIsa.63:19b",
  "Jol.2:28\tJol.3:1",
  "Jol.3:1\tJol.4:1",
  "Jol.3:21\tJol.4:21",
  "Mal.4:1\tMal.3:19",
  "Mal.4:6\tMal.3:24",
];

describe("TVTMS English/Hebrew MT table", () => {
  const tvtms = parseTvtmsHebrew(tvtmsText(ROWS));

  it("maps Hebrew verse ids to English ones, a psalm title onto English verse 1", () => {
    expect(tvtms.toEnglish.get("GEN.32.1")).toEqual(["GEN.31.55"]);
    // Psalm 3: the superscription is Hebrew 3:1, which English prints inside 3:1.
    expect(tvtms.toEnglish.get("PSA.3.1")).toEqual(["PSA.3.1"]);
    expect(tvtms.toEnglish.get("PSA.3.2")).toEqual(["PSA.3.1"]);
    expect(tvtms.toEnglish.get("PSA.51.2")).toEqual(["PSA.51.1"]);
    expect(tvtms.toEnglish.get("PSA.38.17")).toEqual(["PSA.38.16"]);
  });

  it("knows Joel's four chapters and Malachi's three", () => {
    expect(tvtms.toEnglish.get("JOL.3.1")).toEqual(["JOL.2.28"]);
    expect(tvtms.toEnglish.get("JOL.4.1")).toEqual(["JOL.3.1"]);
    expect(tvtms.toEnglish.get("JOL.4.21")).toEqual(["JOL.3.21"]);
    expect(tvtms.toEnglish.get("MAL.3.19")).toEqual(["MAL.4.1"]);
    expect(tvtms.toEnglish.get("MAL.3.24")).toEqual(["MAL.4.6"]);
  });

  it("keeps both halves of a split and both sources of a join", () => {
    expect(tvtms.toEnglish.get("ISA.63.19")).toEqual(["ISA.63.19", "ISA.64.1"]);
    expect(tvtms.toEnglish.get("NUM.25.19")).toEqual(["NUM.26.1"]);
    expect(tvtms.toEnglish.get("1KI.22.44")).toEqual(["1KI.22.43"]);
    expect(tvtms.englishOnly).toEqual(new Set(["NEH.7.69"]));
  });

  it("reads every cell shape and refuses one it cannot read", () => {
    expect(parseHebrewCell("Num.25:19; 26:1", "NUM")).toEqual(["NUM.25.19", "NUM.26.1"]);
    expect(parseHebrewCell("Psa.51:1,2", "PSA")).toEqual(["PSA.51.1", "PSA.51.2"]);
    expect(parseHebrewCell("Isa.63:19b", "ISA")).toEqual(["ISA.63.19"]);
    expect(() => parseHebrewCell("Psa.x", "PSA")).toThrow(/unreadable/);
  });

  it("fails on a table it cannot find or that has shrunk", () => {
    expect(() => parseTvtmsHebrew("no table here")).toThrow(/not found/);
    expect(() => parseTvtmsHebrew(`English (NRSV, ESV, KJV etc)\tHebrew MT\r\nGen.31:55\tGen.32:1\r\n`)).toThrow(/only 1 rows/);
  });
});

describe("placing a Hebrew-numbered text", () => {
  const tvtms: TvtmsHebrew = parseTvtmsHebrew(tvtmsText(ROWS));

  it("splits a line at eBible's markers, the text before the first keeping the line's number", () => {
    expect(hebrewSegments("1SA.20.42", "Go in peace. (21-1) And he arose")).toEqual([
      { hebrew: "1SA.20.42", text: "Go in peace." },
      { hebrew: "1SA.21.1", text: "And he arose" },
    ]);
  });

  it("joins Psalm 3's superscription (JPS 3:1) to English 3:1 and drops the markers", () => {
    const { verses, report } = mapHebrewNumbered(
      [
        { verse_id: "PSA.3.1", text: "(3-1) A Psalm of David, when he fled from Absalom his son. (3-2) LORD, how many are mine adversaries become!" },
        { verse_id: "PSA.3.2", text: "(3-3) Many there are that say of my soul" },
      ],
      { ...tvtms, toEnglish: new Map([...tvtms.toEnglish, ["PSA.3.3", ["PSA.3.2"]]]) },
    );
    expect(verses[0]).toEqual({
      verse_id: "PSA.3.1",
      text: "A Psalm of David, when he fled from Absalom his son. LORD, how many are mine adversaries become!",
    });
    expect(verses[1]?.text).toBe("Many there are that say of my soul");
    expect(report.unmapped).toEqual([]);
    expect(report.renumbered).toBe(2);
  });

  it("places Joel 4 and Malachi 3:19-24 on English Joel 3 and Malachi 4", () => {
    const { verses, report } = mapHebrewNumbered(
      [
        { verse_id: "JOL.2.28", text: "(3-1) I will pour out My spirit upon all flesh" },
        { verse_id: "JOL.3.1", text: "(4-1) For, behold, in those days" },
        { verse_id: "MAL.4.1", text: "(3-19) For, behold, the day cometh" },
      ],
      tvtms,
    );
    expect(verses.map((v) => v.verse_id)).toEqual(["JOL.2.28", "JOL.3.1", "MAL.4.1"]);
    expect(report.unmapped).toEqual([]);
  });

  it("leaves out a whole verse whose words TVTMS places elsewhere, and says so", () => {
    // Hebrew Joel 4:1 is English 3:1, never 2:28.
    const { verses, report } = mapHebrewNumbered([{ verse_id: "JOL.2.28", text: "(4-1) For, behold" }], tvtms, new Map());
    expect(verses).toEqual([]);
    expect(report.dropped).toEqual(["JOL.2.28"]);
    expect(report.unmapped[0]).toMatchObject({ key: "JOL.2.28", hebrew: "JOL.4.1", tvtms: ["JOL.3.1"] });
  });

  it("accepts a divergence only for the exact English and Hebrew pair checked by hand", () => {
    expect(ACCEPTED_DIVERGENCES.size).toBe(37);
    expect(ACCEPTED_DIVERGENCES.has(divergenceKey("EXO.20.15", "EXO.20.13"))).toBe(true);
    expect(ACCEPTED_DIVERGENCES.has(divergenceKey("EXO.20.15", "EXO.20.14"))).toBe(false);
    const { report } = mapHebrewNumbered([{ verse_id: "EXO.20.15", text: "(20-13) Thou shalt not steal." }], tvtms);
    expect(report.unmapped).toEqual([]);
    expect(report.accepted).toHaveLength(1);
  });

  it("removes the Psalter's book headings, and only at a psalm's first verse", () => {
    const { verses, report } = mapHebrewNumbered(
      [
        { verse_id: "PSA.1.1", text: "BOOK I HAPPY IS the man" },
        { verse_id: "PSA.2.2", text: "BOOK I is not a heading here" },
      ],
      tvtms,
    );
    expect(verses.map((v) => v.text)).toEqual(["HAPPY IS the man", "BOOK I is not a heading here"]);
    expect(report.headings).toEqual(["PSA.1.1"]);
  });
});

/**
 * The pinned eBible file itself, checked against TVTMS and the BSB. Skipped on a clean checkout
 * without `yada ingest`, as versification.test.ts is.
 */
const JPS_FILE = path.join(RAW, "engjps_vpl.txt");
const HAVE_JPS = existsSync(JPS_FILE) && existsSync(path.join(RAW, "TVTMS.txt")) && existsSync(path.join(RAW, "bsb.txt"));
const describeIfIngested = HAVE_JPS ? describe : describe.skip;

describeIfIngested("JPS 1917 against TVTMS and the BSB", () => {
  const { verses, report } = HAVE_JPS
    ? readHebrewNumberedVpl(JPS_FILE, "JPS", path.join(RAW, "TVTMS.txt"))
    : { verses: [], report: undefined };
  const jps = new Map(verses.map((v) => [v.verse_id, v.text]));
  const bsb = new Map(HAVE_JPS ? parseBsb().map((v) => [v.verse_id, v.text]) : []);

  it("places every verse: 23,145, none unmapped, 37 hand-checked divergences", () => {
    expect(verses).toHaveLength(23145);
    expect(report?.unmapped).toEqual([]);
    expect(report?.accepted).toHaveLength(37);
    expect(report?.headings).toEqual(["PSA.1.1", "PSA.42.1", "PSA.73.1", "PSA.90.1", "PSA.107.1"]);
    expect([...jps.values()].some((text) => /\(\d+-\d+\)/.test(text))).toBe(false);
  });

  it("reads 'young woman' at Isaiah 7:14, where the BSB has 'virgin'", () => {
    expect(jps.get("ISA.7.14")).toContain("the young woman shall conceive");
    expect(bsb.get("ISA.7.14")).toContain("virgin");
  });

  it("reads 'like a lion' at JPS Psalm 22:17, English 22:16", () => {
    expect(jps.get("PSA.22.16")).toContain("like a lion, they are at my hands and my feet");
    expect(bsb.get("PSA.22.16")).toContain("pierced");
    expect(jps.get("PSA.22.17")).toMatch(/^I may count all my bones/);
  });

  it("sets Isaiah 52:13-53:12 beside the BSB verse for verse", () => {
    const ids = [
      ...[13, 14, 15].map((v) => `ISA.52.${v}`),
      ...Array.from({ length: 12 }, (_, i) => `ISA.53.${i + 1}`),
    ];
    for (const id of ids) {
      expect(jps.get(id), id).toBeTruthy();
      expect(bsb.get(id), id).toBeTruthy();
    }
    expect(jps.get("ISA.52.13")).toMatch(/^Behold, My servant shall prosper/);
    expect(jps.get("ISA.53.5")).toMatch(/^But he was wounded because of our transgressions/);
    expect(jps.get("ISA.53.12")).toMatch(/made intercession for the transgressors\.$/);
  });

  it("puts Psalm 3's superscription in English 3:1, Joel 4 in Joel 3, Malachi 3:19-24 in Malachi 4", () => {
    expect(jps.get("PSA.3.1")).toMatch(/^A Psalm of David, when he fled from Absalom his son\. LORD, how many/);
    expect(jps.get("PSA.3.8")).toMatch(/^Salvation belongeth unto the LORD/);
    expect(jps.has("PSA.3.9")).toBe(false);
    expect(jps.get("JOL.2.28")).toMatch(/^And it shall come to pass afterward, that I will pour out My spirit/);
    expect(jps.get("JOL.3.1")).toMatch(/^For, behold, in those days/);
    expect(jps.has("JOL.4.1")).toBe(false);
    expect(jps.get("MAL.4.5")).toMatch(/I will send you Elijah the prophet/);
    expect(jps.has("MAL.3.19")).toBe(false);
  });
});
