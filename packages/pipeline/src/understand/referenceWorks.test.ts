/**
 * Matthew Henry's Concise Commentary and Easton's Bible Dictionary: the SWORD readers and parsers on
 * small inline fixtures, then spot checks against the pinned modules where content/raw holds them
 * (CI has none, so those skip).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";

import { afterAll, describe, expect, it } from "vitest";

import { EASTON_DIR, eastonEntries, eastonEntry, eastonParse, firstSentence } from "./easton.js";
import { MHC_DIR, mhcOutline, mhcParse, mhcSections } from "./matthewHenry.js";
import { understandPaths } from "./package.js";
import { UnderstandRefused } from "./sources.js";
import { pinnedFile, zComEntries, zLdEntries } from "./sword.js";

const u32 = (...n: number[]): Buffer => {
  const b = Buffer.alloc(n.length * 4);
  n.forEach((x, i) => b.writeUInt32LE(x, i * 4));
  return b;
};

const OSIS = [
  '<div canonical="true" osisID="Dan" sID="gen2" type="book"/>',
  '<chapter n="6" osisID="Dan.6" sID="Dan.6"/> <title type="x-ms">Daniel</title> An introduction (not a section).',
  '<title type="x-s2">Chapter 6</title> The malice of Daniel&apos;s enemies. (<reference osisRef="Dan.6.1-Dan.6.5">Dn 6:1-5</reference>)',
  'He is cast into the lion\'s den. (<reference osisRef="Dan.6.6-Dan.6.17">Dn 6:6-17</reference>)',
  '<div sID="g1" type="x-p"/><hi type="bold">Verses 1-5</hi> <div eID="g1" type="x-p"/> We notice to the glory of God that Daniel was faithful. It is for the glory of God when those who profess religion walk well.',
  '<hi type="bold">Verses 6-17</hi> Daniel prayed openly, as he had done <reference osisRef="Dan.6.10">before</reference> ; he was thrown to the lions. <chapter eID="Dan.6"/>',
  '<chapter n="7" osisID="Dan.7" sID="Dan.7"/> <table> <row><cell>Daniel\'s vision of the four beasts.</cell><cell>(1-8)</cell></row> </table>',
  '<hi type="bold">Verse 1</hi> The prophet saw four great beasts rise out of the sea &amp; the wind. <chapter eID="Dan.7"/>',
  '<div eID="gen2" type="book"/>',
].join("\n");

describe("Matthew Henry's sections", () => {
  const dan = mhcParse(OSIS).get("DAN") ?? [];

  it("takes each range from its Verses marker and leaves the introduction and outline out", () => {
    expect(dan.map((s) => [s.c1, s.v1, s.c2, s.v2])).toEqual([
      [6, 1, 6, 5],
      [6, 6, 6, 17],
      [7, 1, 7, 1],
    ]);
    expect(dan.map((s) => s.text).join(" ")).not.toContain("introduction");
  });

  it("keeps the words verbatim, markup and spacing removed", () => {
    expect(dan[1]?.text).toBe("Daniel prayed openly, as he had done before; he was thrown to the lions.");
    expect(dan[2]?.text).toBe("The prophet saw four great beasts rise out of the sea & the wind.");
    expect(dan[0]?.sentences).toEqual(["We notice to the glory of God that Daniel was faithful.", "It is for the glory of God when those who profess religion walk well."]);
  });

  it("gives a section its outline line, from references or from table cells, where the range matches", () => {
    expect(dan.map((s) => s.outline)).toEqual(["The malice of Daniel's enemies.", "He is cast into the lion's den.", null]);
    expect(mhcOutline("<row><cell>The creation of light.</cell><cell>(3-5)</cell></row><row><cell>Food.</cell><cell>(31)</cell></row>")).toEqual(
      new Map([
        ["3-5", "The creation of light."],
        ["31-31", "Food."],
      ]),
    );
  });
  it("reads a chapter with no marker as one whole-chapter section, its outline line before the dash", () => {
    const ps = mhcParse(
      '<div osisID="Ps" sID="b" type="book"/><chapter n="23" osisID="Ps.23" sID="Ps.23"/> <title type="x-s2">Chapter 23</title> <div sID="g" type="x-p"/>Confidence in God\'s grace and care. <div eID="g" type="x-p"/> <div sID="i" type="introduction"/> --"The Lord is my shepherd." In these words the believer is taught. <chapter eID="Ps.23"/>',
    ).get("PSA");
    expect(ps).toEqual([
      { book: "PSA", c1: 23, v1: 1, c2: 23, v2: 999, text: '"The Lord is my shepherd." In these words the believer is taught.', sentences: ['"The Lord is my shepherd." In these words the believer is taught.'], outline: "Confidence in God's grace and care." },
    ]);
  });
});

describe("Easton entries", () => {
  it("reads the headword from the title and the first sentence verbatim", () => {
    const e = eastonParse({
      key: "ABIMELECH",
      text: '<entryFree n="Abimelech">\n<title>Abimelech</title>\n<p>My father a king, a name of the Philistine kings (<ref osisRef="Bible:Gen.20.1">Gen. 20:1</ref>). He rebuked Abraham.</p>\n<p>(2.) A king of Gerar.</p>\n</entryFree>',
    });
    expect(e.headword).toBe("Abimelech");
    expect(e.first).toBe("My father a king, a name of the Philistine kings (Gen. 20:1).");
    expect(e.text).toBe("My father a king, a name of the Philistine kings (Gen. 20:1). He rebuked Abraham.\n\n(2.) A king of Gerar.");
  });

  it("does not end a sentence at an abbreviation or inside brackets", () => {
    expect(firstSentence("Lover of God (comp. Acts 1:1. Luke). Nothing more. Else.")).toBe("Lover of God (comp. Acts 1:1. Luke).");
    expect(firstSentence("Alpha, i.e. The first letter. More.")).toBe("Alpha, i.e. The first letter.");
  });
});

describe("SWORD module readers", () => {
  it("reads a zCom testament once per section, however many verses link to it", () => {
    const block = Buffer.from("first sectionsecond");
    const bzz = deflateSync(block);
    const bzs = u32(0, bzz.length, block.length);
    const verse = (b: number, off: number, size: number): Buffer => Buffer.concat([u32(b, off), Buffer.from([size & 0xff, size >> 8])]);
    const bzv = Buffer.concat([verse(0, 0, 0), verse(0, 0, 13), verse(0, 0, 13), verse(0, 13, 6)]);
    expect(zComEntries(bzs, bzv, bzz)).toEqual(["first section", "second"]);
  });

  it("reads a zLD dictionary's keys and entries", () => {
    const body = Buffer.from("<title>A</title>\0<title>B</title>");
    const blk = Buffer.concat([u32(2, 20, 17, 37, 16), body]);
    const zdt = deflateSync(blk);
    const zdx = u32(0, zdt.length);
    const rec = (key: string, entry: number): Buffer => Buffer.concat([Buffer.from(`${key}\r\n`), u32(0, entry)]);
    const dat = Buffer.concat([rec("A", 0), rec("B", 1)]);
    const idx = u32(0, rec("A", 0).length, rec("A", 0).length, rec("B", 1).length);
    expect(zLdEntries(idx, dat, zdx, zdt)).toEqual([
      { key: "A", text: "<title>A</title>" },
      { key: "B", text: "<title>B</title>" },
    ]);
  });

  describe("pins", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "yada-pins-"));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));
    mkdirSync(path.join(dir, "m"));
    writeFileSync(path.join(dir, "m/f.bin"), "data");
    const digest = createHash("sha256").update("data").digest("hex");

    it("reads a file whose sha256 matches its pin and refuses one that does not, or has none", () => {
      writeFileSync(path.join(dir, "m.sha256"), `${digest}  m/f.bin\n`);
      expect(pinnedFile(dir, "m.sha256", "m/f.bin").toString()).toBe("data");
      writeFileSync(path.join(dir, "m.sha256"), `${"0".repeat(64)}  m/f.bin\n`);
      expect(() => pinnedFile(dir, "m.sha256", "m/f.bin")).toThrow(UnderstandRefused);
      writeFileSync(path.join(dir, "m.sha256"), "");
      expect(() => pinnedFile(dir, "m.sha256", "m/f.bin")).toThrow(/no pin/);
    });
  });
});

const RAW = understandPaths().raw;
const HAVE_MHC = existsSync(path.join(RAW, MHC_DIR, "ot.bzz"));
const HAVE_EASTON = existsSync(path.join(RAW, EASTON_DIR, "easton.zdt"));

describe.skipIf(!HAVE_MHC)("Matthew Henry against the pinned module", () => {
  it("covers all 66 books, and Daniel 6's sections reach the lions' den", () => {
    const dan = mhcSections("DAN").filter((s) => s.c1 === 6);
    expect(dan.map((s) => `${s.v1}-${s.v2}`)).toEqual(["1-5", "6-10", "11-17", "18-24", "25-28"]);
    expect(dan.find((s) => s.v1 === 11)?.text).toContain("den of lions");
    expect(dan.find((s) => s.v1 === 11)?.outline).toBe("He is cast into the lion's den.");
    expect(mhcSections("REV").length).toBeGreaterThan(0);
  });

  it("has a section on the tribute coin, Matthew 22:15-22", () => {
    const s = mhcSections("MAT").find((x) => x.c1 === 22 && x.v1 === 15);
    expect([s?.v2, s?.outline]).toEqual([22, "The Pharisees question Jesus as to the tribute."]);
    expect(s?.sentences.length).toBeGreaterThan(3);
  });
});

describe.skipIf(!HAVE_EASTON)("Easton against the pinned module", () => {
  it("has Theophilus, Abimelech and Anathoth", () => {
    expect(eastonEntry("Theophilus")?.first).toBe("Lover of God, a Christian, probably a Roman, to whom Luke dedicated both his Gospel (Luke 1:3) and the Acts of the Apostles (1:1).");
    expect(eastonEntry("abimelech")?.first).toBe("My father a king, or father of a king, a common name of the Philistine kings, as “Pharaoh” was of the Egyptian kings.");
    expect(eastonEntry("Anathoth")?.text).toContain("Jeremiah");
    expect(eastonEntry("Not a headword")).toBeNull();
    expect(eastonEntries("Kadesh").map((e) => e.first.slice(0, 22))).toEqual(["The sacred city of the", "Holy, or Kadesh-Barnea"]);
  });
});

describe("Henry's outline lines as statements (build 8)", () => {
  it("tells a line that says who did what from a label", async () => {
    const { isStatement } = await import("./matthewHenry.js");
    expect(isStatement("Herod causes the infants of Bethlehem to be massacred.")).toBe(true);
    expect(isStatement("The disciples of Christ are his nearest relations.")).toBe(true);
    expect(isStatement("The plague of frogs.")).toBe(false);
    expect(isStatement("Christian salutations.")).toBe(false);
    expect(isStatement("The covenant, Those who signed it.")).toBe(false);
  });
});
