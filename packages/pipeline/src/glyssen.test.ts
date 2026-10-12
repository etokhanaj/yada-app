import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { BOOK_ORDER, ordToParts, verseOrd } from "@yada/schema";

import {
  GLYSSEN_LICENSE,
  SpeakersRefused,
  characterKind,
  checkGlyssenLicence,
  deliveryTo,
  packageSpeakers,
  parseCharacterDetail,
  parseCharacterVerse,
  passageSpeakers,
  type PassageSpeaker,
} from "./glyssen.js";
import { BUNDLES, highestVersionOnDisk } from "./package.js";
import { RAW } from "./paths.js";
import { GLYSSEN_COMMIT, SOURCES } from "./sources.js";

// Excerpts copied unmodified from sillsdev/Glyssen at commit e912d20 (GLYSSEN_COMMIT):
// CharacterVerse.txt carries its attribution in '#' comment lines, which the format allows.
// CharacterDetail.txt has no comment syntax, so its attribution is here: lines of
// GlyssenCharacters/Resources/CharacterDetail.txt, Copyright (c) 2014-2020 SIL LSDev and Faith
// Comes By Hearing, Copyright © 2014-2023 Faith Comes By Hearing and SIL International, MIT
// License. LICENSE and GlyssenCharacters.csproj are whole copies.
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/glyssen");
const fixture = (name: string): string => readFileSync(path.join(FIXTURES, name), "utf8");

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "yada-speakers-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Every verse of the books the fixtures touch, as a core stand-in, minus `without`. */
function setup(without: readonly number[] = []): { rawDir: string; outDir: string; corePath: string } {
  const rawDir = path.join(dir, "raw");
  cpSync(FIXTURES, path.join(rawDir, "glyssen"), { recursive: true });
  const corePath = path.join(dir, "core.db");
  const core = new DatabaseSync(corePath);
  core.exec("CREATE TABLE verses (ord INTEGER PRIMARY KEY)");
  const insert = core.prepare("INSERT INTO verses VALUES (?)");
  core.exec("BEGIN");
  for (const book of ["GEN", "1SA", "EZR", "PSA", "MAT", "JHN", "ACT"] as const) {
    for (let chapter = 1; chapter <= 52; chapter += 1) {
      for (let verse = 0; verse <= 60; verse += 1) {
        const ord = verseOrd(book, chapter, verse);
        if (!without.includes(ord)) insert.run(ord);
      }
    }
  }
  core.exec("COMMIT");
  core.close();
  return { rawDir, outDir: path.join(dir, "bundles"), corePath };
}

const names = (list: readonly PassageSpeaker[]): string[] => list.map((s) => s.name);
const versesOf = (s: PassageSpeaker | undefined): string[] =>
  (s?.ords ?? []).map((ord) => {
    const { chapter, verse } = ordToParts(ord);
    return `${chapter}:${verse}`;
  });

describe("the licence", () => {
  it("is read from LICENSE and the .csproj and gives both copyright lines", () => {
    expect(checkGlyssenLicence(fixture("LICENSE"), fixture("GlyssenCharacters.csproj"))).toEqual([
      "Copyright (c) 2014-2020 SIL LSDev and Faith Comes By Hearing",
      "Copyright © 2014-2023 Faith Comes By Hearing and SIL International",
    ]);
    // CRLF line endings are the same text.
    expect(() => checkGlyssenLicence(fixture("LICENSE").replace(/\n/g, "\r\n"), fixture("GlyssenCharacters.csproj"))).not.toThrow();
  });

  it("refuses a LICENSE whose wording or copyright line changed", () => {
    const csproj = fixture("GlyssenCharacters.csproj");
    expect(() => checkGlyssenLicence(fixture("LICENSE").replace("2014-2020", "2014-2027"), csproj)).toThrow(SpeakersRefused);
    expect(() => checkGlyssenLicence(fixture("LICENSE").replace("free of charge", "for non-commercial use"), csproj)).toThrow(SpeakersRefused);
    expect(() => checkGlyssenLicence(`${GLYSSEN_LICENSE}\n\nThe character data is licensed separately.`, csproj)).toThrow(SpeakersRefused);
  });

  it("refuses a .csproj whose licence expression, copyright or content list changed", () => {
    const license = fixture("LICENSE");
    const csproj = fixture("GlyssenCharacters.csproj");
    expect(() => checkGlyssenLicence(license, csproj.replace(">MIT<", ">GPL-3.0-only<"))).toThrow(/PackageLicenseExpression/);
    expect(() => checkGlyssenLicence(license, csproj.replace("2014-2023", "2014-2026"))).toThrow(/Copyright/);
    expect(() => checkGlyssenLicence(license, csproj.replace('<Content Include="Resources\\CharacterVerse.txt" />', ""))).toThrow(/CharacterVerse/);
    expect(() =>
      checkGlyssenLicence(license, csproj.replace("</PropertyGroup>", "<PackageLicenseFile>DATA-LICENSE.txt</PackageLicenseFile></PropertyGroup>")),
    ).toThrow(/2 package licences/);
  });
});

describe("CharacterVerse.txt", () => {
  it("reads rows as written, skipping the version line and '#' comments", () => {
    const parsed = parseCharacterVerse(fixture("CharacterVerse.txt"));
    expect(parsed.controlFileVersion).toBe(171);
    // The column header, three attribution lines and Glyssen's own note at Genesis 1:5.
    expect(parsed.comments).toBe(5);
    expect(parsed.rows[0]).toEqual({
      line: 6,
      book: "GEN",
      chapter: 1,
      verseStart: 3,
      verseEnd: 3,
      character: "God",
      delivery: null,
      alias: "God (Yahweh)",
      quoteType: "Normal",
      defaultCharacter: null,
      parallelPassage: null,
      quotePosition: "ContainedWithinVerse",
    });
    const ezra = parsed.rows.find((r) => r.book === "EZR");
    expect(ezra).toMatchObject({ chapter: 9, verseStart: 6, verseEnd: 15, character: "narrator-EZR", quoteType: "ImplicitWithPotentialSelfQuote" });
    const priests = parsed.rows.find((r) => r.book === "JHN" && r.verseStart === 25);
    expect(priests).toMatchObject({ character: "priests/Levites", alias: "messengers sent from Pharisees (the Jews)", quotePosition: "EndOfVerse" });
    // An empty Quote Position is absent, not Glyssen's in-code "Unspecified".
    expect(parsed.rows.find((r) => r.book === "JHN" && r.verseStart === 19)?.quotePosition).toBeNull();
    expect(parsed.rows.find((r) => r.book === "PSA")).toMatchObject({ verseStart: 0, defaultCharacter: "narrator-PSA" });
  });

  it("refuses what Glyssen would quietly default or what is not its format", () => {
    const head = "Control File Version\t171\n";
    const row = (fields: string[]): string => `${head}${fields.join("\t")}\n`;
    const good = ["JHN", "1", "20", "John the Baptist", "", "", "Dialogue", "", "", "Unspecified"];
    expect(parseCharacterVerse(row(good)).rows).toHaveLength(1);
    // Glyssen reads an empty quote type as Normal; the file has none, and here it is not assumed.
    expect(() => parseCharacterVerse(row(good.map((f, i) => (i === 6 ? "" : f))))).toThrow(/quote type ""/);
    expect(() => parseCharacterVerse(row(good.map((f, i) => (i === 6 ? "Certain" : f))))).toThrow(/quote type "Certain"/);
    expect(() => parseCharacterVerse(row(good.map((f, i) => (i === 9 ? "Middle" : f))))).toThrow(/quote position/);
    expect(() => parseCharacterVerse(row(good.slice(0, 9)))).toThrow(/9 fields/);
    expect(() => parseCharacterVerse(row(good.map((f, i) => (i === 0 ? "JOH" : f))))).toThrow(/unknown book/);
    expect(() => parseCharacterVerse(row(good.map((f, i) => (i === 2 ? "20a" : f))))).toThrow(/unreadable reference/);
    expect(() => parseCharacterVerse(row(good.map((f, i) => (i === 2 ? "9-6" : f))))).toThrow(/backwards/);
    expect(() => parseCharacterVerse(`${good.join("\t")}\n`)).toThrow(/control file version/);
  });

  it("copies an addressee only from an explicit 'to X' delivery note", () => {
    expect(deliveryTo("to crowd")).toBe("crowd");
    expect(deliveryTo("to Jesus")).toBe("Jesus");
    expect(deliveryTo("speaking to Peter (Simon)")).toBe("Peter (Simon)");
    expect(deliveryTo("said to himself")).toBe("himself");
    expect(deliveryTo("saying to each other")).toBe("each other");
    // "to" here does not name who is spoken to.
    expect(deliveryTo("ready to fight")).toBeNull();
    expect(deliveryTo("response to Isaiah")).toBeNull();
    expect(deliveryTo("call to worship")).toBeNull();
    expect(deliveryTo("thinking or talking to himself")).toBeNull();
    expect(deliveryTo("praying")).toBeNull();
    expect(deliveryTo(null)).toBeNull();
  });
});

describe("CharacterDetail.txt", () => {
  it("reads each character as written, empty fields left empty", () => {
    const rows = parseCharacterDetail(fixture("CharacterDetail.txt"));
    expect(rows).toHaveLength(18);
    expect(rows.find((r) => r.id === "many Samaritans")).toEqual({
      line: 11,
      id: "many Samaritans",
      maxSpeakers: -1,
      gender: null,
      age: null,
      comment: null,
      referenceComment: "JHN 4:40 & JHN 4:42",
      fcbhCharacter: null,
    });
    expect(rows.find((r) => r.id === "woman, Samaritan")).toMatchObject({ gender: "Female", fcbhCharacter: "Woman (Samaritan)" });
    // Glyssen would call an empty age "Adult"; the file does not say so.
    expect(rows.find((r) => r.id === "John the Baptist")?.age).toBeNull();
  });

  it("refuses a changed header, a '#' line, a duplicate ID and a non-numeric max", () => {
    const text = fixture("CharacterDetail.txt");
    const [header = "", first = ""] = text.split("\n");
    expect(() => parseCharacterDetail(text.replace("FCBH Character", "FCBH"))).toThrow(/header/);
    expect(() => parseCharacterDetail(`${header}\n# note\n${first}\n`)).toThrow(/'#'/);
    expect(() => parseCharacterDetail(`${header}\n${first}\n${first}\n`)).toThrow(/twice/);
    expect(() => parseCharacterDetail(`${header}\n${first.replace("\t1\t", "\tmany\t")}\n`)).toThrow(/not a number/);
  });

  it("knows Glyssen's reserved IDs and its '/' multi-character IDs", () => {
    expect(characterKind("narrator-JHN")).toBe("narrator");
    expect(characterKind("interruption-JHN")).toBe("interruption");
    expect(characterKind("Needs Review")).toBe("needs_review");
    expect(characterKind("scripture")).toBe("scripture");
    expect(characterKind("priests/Levites")).toBe("multiple");
    expect(characterKind("woman, Samaritan")).toBe("character");
  });
});

describe("package speakers", () => {
  it("pins every file by commit and digest, the licence files among them", () => {
    const glyssen = SOURCES.find((s) => s.key === "glyssen");
    expect(glyssen?.license).toBe("MIT");
    expect(glyssen?.commit).toBe(GLYSSEN_COMMIT);
    expect(glyssen?.files.map((f) => f.file)).toEqual([
      "glyssen/LICENSE",
      "glyssen/GlyssenCharacters.csproj",
      "glyssen/CharacterVerse.txt",
      "glyssen/CharacterDetail.txt",
      "glyssen/NarratorOverrides.xml",
      "glyssen/RelatedCharacters.xml",
    ]);
    for (const file of glyssen?.files ?? []) {
      expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(file.url).toContain(`/sillsdev/Glyssen/${GLYSSEN_COMMIT}/`);
    }
    // The fixtures are excerpts, so a pinned build of them is refused.
    expect(() => packageSpeakers({ ...setup(), verifyPins: true })).toThrow(/sha256/);
  });

  it("writes every row, expands ranges, and keeps the licence with the data", () => {
    const options = setup();
    const report = packageSpeakers({ ...options, verifyPins: false });
    expect(report.file).toBe("speakers.v1.db");
    expect(report.unmapped).toBe(0);
    expect(report.lines).toBe(87);
    // EZR 9:6-15 is one line and ten rows.
    expect(report.rows).toBe(87 + 9);
    expect(report.mapped).toBe(report.rows);
    expect(report.byStanding).toEqual({
      speaks: report.byQuoteType["Normal"]! + report.byQuoteType["Dialogue"]! + report.byQuoteType["ImplicitWithPotentialSelfQuote"]!,
      uncertain: report.byQuoteType["Potential"]! + report.byQuoteType["Rare"]! + report.byQuoteType["Hypothetical"]! + report.byQuoteType["Alternate"]!,
      reported: report.byQuoteType["Indirect"]! + report.byQuoteType["Quotation"]! + report.byQuoteType["Interruption"]!,
    });
    expect(report.deliveryTo).toBe(2);

    const db = new DatabaseSync(path.join(options.outDir, report.file), { readOnly: true });
    const source = db.prepare("SELECT * FROM sources").get();
    expect(source?.["license"]).toBe("MIT");
    expect(source?.["license_notice"]).toBe(GLYSSEN_LICENSE);
    expect(String(source?.["copyright"]).split("\n")).toEqual(report.copyright);
    expect(source?.["commit_hash"]).toBe(GLYSSEN_COMMIT);

    const ezra = db.prepare("SELECT ord FROM verse_speakers WHERE line = 14 ORDER BY ord").all();
    expect(ezra.map((r) => ordToParts(Number(r["ord"])).verse)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

    // "priests/Levites" stays one ID; its parts are listed, and each part is described.
    const multiple = db.prepare("SELECT * FROM characters WHERE name = 'priests/Levites'").get();
    expect(multiple).toMatchObject({ kind: "multiple", in_detail: 0, gender: null, max_speakers: null });
    const parts = db
      .prepare("SELECT c.name, c.in_detail FROM character_parts p JOIN characters c ON c.id = p.part WHERE p.character = ? ORDER BY p.position")
      .all(Number(multiple?.["id"]));
    expect(parts).toEqual([
      { name: "priests", in_detail: 1 },
      { name: "Levites", in_detail: 1 },
    ]);

    const pilate = db.prepare("SELECT delivery, delivery_to, standing FROM verse_speakers WHERE ord = ?").get(verseOrd("MAT", 27, 17));
    expect(pilate).toEqual({ delivery: "to crowd", delivery_to: "crowd", standing: "speaks" });
    const sadducees = db.prepare("SELECT quote_type, standing FROM verse_speakers WHERE ord = ?").get(verseOrd("MAT", 22, 23));
    expect(sadducees).toEqual({ quote_type: "Hypothetical", standing: "uncertain" });
    db.close();

    // Unchanged inputs, unchanged bytes: the file is kept, not versioned again.
    const again = packageSpeakers({ ...options, verifyPins: false });
    expect(again).toMatchObject({ file: "speakers.v1.db", reused: true, sha256: report.sha256 });
  });

  it("counts and lists rows whose verse core does not have, and leaves them out", () => {
    const report = packageSpeakers({ ...setup([verseOrd("PSA", 52, 0)]), verifyPins: false });
    expect(report.unmapped).toBe(2);
    expect(report.mapped).toBe(report.rows - 2);
    expect(report.unmappedExamples).toEqual([
      "line 15: PSA 52:0 Doeg the Edomite (Quotation)",
      "line 16: PSA 52:0 narrator-PSA (Quotation)",
    ]);
  });

  it("refuses without a core bundle to map against", () => {
    const options = setup();
    expect(() => packageSpeakers({ ...options, corePath: path.join(dir, "missing.db"), verifyPins: false })).toThrow(/no core bundle/);
  });

  it("refuses when the LICENSE in the raw directory changed", () => {
    const options = setup();
    writeFileSync(path.join(options.rawDir, "glyssen/LICENSE"), fixture("LICENSE").replace("MIT", "Apache"));
    expect(() => packageSpeakers({ ...options, verifyPins: false })).toThrow(SpeakersRefused);
    expect(existsSync(path.join(options.outDir, "speakers.v1.db"))).toBe(false);
  });
});

describe("who speaks in a passage", () => {
  function built(): DatabaseSync {
    const options = setup();
    const report = packageSpeakers({ ...options, verifyPins: false });
    return new DatabaseSync(path.join(options.outDir, report.file), { readOnly: true });
  }

  it("John 1:19-34: John the Baptist, then priests/Levites; 1:19 is reported speech", () => {
    const db = built();
    const view = passageSpeakers(db, verseOrd("JHN", 1, 19), verseOrd("JHN", 1, 34));
    db.close();
    expect(names(view.speaking)).toEqual(["John the Baptist", "priests/Levites"]);
    expect(versesOf(view.speaking[1])).toEqual(["1:21", "1:22", "1:25"]);
    expect(view.speaking[1]?.aliases).toEqual(["messengers sent from Pharisees (the Jews)"]);
    expect(names(view.uncertain)).toEqual([]);
    expect(view.reported.map((s) => [s.name, s.quoteTypes])).toEqual([["priests/Levites", ["Indirect"]]]);
  });

  it("John 3:1-21: Nicodemus and Jesus; Jesus only Potential from 3:14", () => {
    const db = built();
    const view = passageSpeakers(db, verseOrd("JHN", 3, 1), verseOrd("JHN", 3, 21));
    db.close();
    expect(names(view.speaking)).toEqual(["Nicodemus", "Jesus"]);
    expect(versesOf(view.speaking[1])).toEqual(["3:3", "3:5", "3:6", "3:7", "3:8", "3:10", "3:11", "3:12", "3:13"]);
    expect(names(view.uncertain)).toEqual(["Jesus"]);
    expect(versesOf(view.uncertain[0])).toEqual(["3:14", "3:15", "3:16", "3:17", "3:18", "3:19", "3:20", "3:21"]);
    expect(view.uncertain[0]?.quoteTypes).toEqual(["Potential"]);
  });

  it("John 4:1-42: four speakers in order; markers kept apart from characters", () => {
    const db = built();
    const view = passageSpeakers(db, verseOrd("JHN", 4, 1), verseOrd("JHN", 4, 42));
    db.close();
    expect(names(view.speaking)).toEqual(["Jesus", "woman, Samaritan", "disciples", "many Samaritans"]);
    expect(names(view.uncertain)).toEqual([]);
    expect(names(view.reported)).toEqual(["people", "woman, Samaritan", "many Samaritans"]);
    expect(names(view.markers)).toEqual(["interruption-JHN", "Needs Review", "narrator-JHN"]);
  });
});

const CORE = highestVersionOnDisk("core", BUNDLES);
const HAVE_SOURCES = existsSync(path.join(RAW, "glyssen/CharacterVerse.txt")) && CORE > 0;
const describeIfIngested = HAVE_SOURCES ? describe : describe.skip;

describeIfIngested("the pinned files against the real core bundle", () => {
  it("builds from the pinned files with every row mapped", () => {
    const outDir = path.join(dir, "bundles");
    const report = packageSpeakers({ outDir, corePath: path.join(BUNDLES, `core.v${CORE}.db`) });
    expect(report.controlFileVersion).toBe(171);
    expect(report.unmapped).toBe(0);
    expect(report.undescribedParts).toEqual([]);
    // Glyssen lists no speech in Philemon or 3 John.
    expect(report.books).toBe(BOOK_ORDER.length - 2);
    const db = new DatabaseSync(path.join(outDir, report.file), { readOnly: true });
    const john3 = passageSpeakers(db, verseOrd("JHN", 3, 1), verseOrd("JHN", 3, 21));
    db.close();
    expect(names(john3.speaking)).toEqual(["Nicodemus", "Jesus"]);
    expect(names(john3.uncertain)).toEqual(["Jesus"]);
  });
});
