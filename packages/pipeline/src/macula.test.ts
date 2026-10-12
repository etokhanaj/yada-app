import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { verseOrd } from "@yada/schema";

import {
  SyntaxRefused,
  align,
  checkMaculaLicence,
  packageSyntax,
  parseFrame,
  parseLowfat,
  surfaceKey,
  verseSyntax,
  type PackageSyntaxOptions,
} from "./macula.js";
import { BUNDLES, highestVersionOnDisk } from "./package.js";
import { parseMorphGntWithCoverage, parseOshb } from "./parsers.js";
import { RAW } from "./paths.js";
import { SOURCES } from "./sources.js";

// Excerpts copied unmodified from the real files. The MACULA and OSHB XML excerpts carry their
// attribution in a comment. 64-Jn-morphgnt.txt, whose parser has no comment syntax, is John 1:1
// from MorphGNT (morphgnt/sblgnt, commit aaed91e), morphological annotations licensed CC BY-SA 3.0,
// SBLGNT text Copyright 2010 Society of Biblical Literature and Logos Bible Software, CC BY 4.0.
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/macula");
const fixture = (name: string): string => readFileSync(path.join(FIXTURES, name), "utf8");

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "yada-syntax-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** A raw directory of fixtures, and a core stand-in holding exactly the tokens the parsers read. */
function setup(mutate?: (db: DatabaseSync) => void): Required<Pick<PackageSyntaxOptions, "rawDir" | "outDir" | "corePath">> {
  const rawDir = path.join(dir, "raw");
  cpSync(FIXTURES, rawDir, { recursive: true });
  const corePath = path.join(dir, "core.db");
  const core = new DatabaseSync(corePath);
  core.exec("CREATE TABLE tokens (ord INTEGER, position INTEGER, surface TEXT, PRIMARY KEY (ord, position))");
  const insert = core.prepare("INSERT INTO tokens VALUES (?, ?, ?)");
  const tokens = [
    ...parseMorphGntWithCoverage("64-Jn-morphgnt.txt", rawDir).tokens,
    ...["Gen.xml", "Job.xml", "Ps.xml"].flatMap((file) => parseOshb(file, rawDir).tokens),
  ];
  for (const token of tokens) {
    const [book, chapter, verse] = token.verse_id.split(".");
    insert.run(verseOrd(book as "GEN", Number(chapter), Number(verse)), token.position, token.surface);
  }
  mutate?.(core);
  core.close();
  return { rawDir, outDir: path.join(dir, "bundles"), corePath };
}

const BOOKS = ["GEN", "JOB", "PSA", "JHN"] as const;

describe("lowfat XML", () => {
  it("reads John 1:1's words, groups and roles as MACULA writes them", () => {
    const { words, nodes } = parseLowfat(fixture("macula-greek-04-john.xml"));
    const verse = words.filter((w) => w.chapter === 1 && w.verse === 1);
    expect(verse.map((w) => w.surface).join(" ")).toBe(
      "Ἐν ἀρχῇ ἦν ὁ λόγος καὶ ὁ λόγος ἦν πρὸς τὸν θεόν καὶ θεὸς ἦν ὁ λόγος",
    );
    expect(verse[2]).toMatchObject({ id: "n43001001003", word: 3, cls: "verb", role: "vc", english: "was" });
    // The article has an empty @english; empty is absent, not "".
    expect(verse[3]?.english).toBe("the");
    const clauses = nodes.filter((n) => n.cls === "cl" && words[n.start]?.chapter === 1);
    expect(clauses.map((c) => c.rule)).toEqual(["P-VC-S", "S-VC-P", "P-VC-S"]);
    // Every group's span holds exactly the words it encloses in the tree.
    const subject = nodes.find((n) => n.role === "s");
    expect(words.slice(subject?.start, (subject?.end ?? 0) + 1).map((w) => w.surface)).toEqual(["ὁ", "λόγος"]);
  });

  it("reads Genesis 1:1 morph by morph, with the verb's frame", () => {
    const { words, nodes } = parseLowfat(fixture("macula-hebrew-01-Gen-001-lowfat.xml"));
    expect(words).toHaveLength(11);
    const nfc = (list: string[]): string[] => list.map((x) => x.normalize("NFC"));
    expect(nfc(words.filter((w) => w.word === 1).map((w) => w.surface))).toEqual(nfc(["בְּ", "רֵאשִׁ֖ית"]));
    const verb = words.find((w) => w.role === "v");
    expect(verb?.links).toEqual([
      { kind: "frame", arg: "A0", target: "o010010010031" },
      { kind: "frame", arg: "A1", target: "o010010010052" },
      { kind: "frame", arg: "A1", target: "o010010010072" },
    ]);
    expect(nodes.filter((n) => n.cls === "cl").map((n) => n.rule)).toEqual(["PP-V-S-O"]);
    // Hebrew writes role on the prepositional phrase as "pp".
    expect(nodes.find((n) => n.role === "pp")?.cls).toBe("pp");
  });

  it("reads both frame spellings, including an argument MACULA names but leaves empty", () => {
    // Matthew 18:24 and Genesis 1:1, as written in the files.
    expect(parseFrame("A1:n40018024010 A2:")).toEqual({
      links: [{ kind: "frame", arg: "A1", target: "n40018024010" }],
      emptyArgs: 1,
    });
    expect(parseFrame("A0:010010010031; A1:010010010052;010010010072;").links.map((l) => `${l.arg}:${l.target}`)).toEqual([
      "A0:o010010010031",
      "A1:o010010010052",
      "A1:o010010010072",
    ]);
    expect(() => parseFrame("n40018024010")).toThrow(SyntaxRefused);
  });

  it("refuses markup it does not understand rather than dropping it", () => {
    expect(() => parseLowfat("<book><sentence><wg>stray text</wg></sentence></book>")).toThrow(/text outside a word/);
    expect(() => parseLowfat("<book><wg></book>")).toThrow(SyntaxRefused);
  });
});

describe("the join", () => {
  it("compares letters only, without OSHB's large-letter markup that core still carries", () => {
    expect(surfaceKey("שְׁמַ֖<seg type=\"x-large\">ע<seg>")).toBe(surfaceKey("שְׁמַ֖ע"));
    expect(surfaceKey("Γεθσημανὶ")).toBe(surfaceKey("Γεθσημανί"));
    expect(surfaceKey("λόγος,")).toBe("λογοσ");
  });

  it("pairs MACULA's pointed qere with core's qere token, not the ketiv that has its letters", () => {
    const slots = ["ידעתה", "שחר", "יִדַּ֖עְתָּה", "הַשַּׁ֣חַר"].map((surface, i) => ({ verseId: "JOB.38.12", position: i + 4, surface }));
    expect(align([{ word: 6, surface: "יִדַּ֖עְתָּה" }, { word: 7, surface: "הַשַּׁ֣חַר" }], slots)).toEqual([
      [0, 2],
      [1, 3],
    ]);
  });

  it("joins every word to its core token, across versification, and counts what it cannot join", () => {
    const report = packageSyntax({ ...setup(), books: BOOKS, verifyPins: false });
    expect(report.coreMismatches).toEqual([]);
    // John 7:53 is in SBLGNT but not in MorphGNT, so core has no tokens for it.
    expect(report.join.greek).toMatchObject({ words: 24, joined: 17, noCoreVerse: 7, unaligned: 0, coreUnmatched: 0 });
    // Job 38:12's ketiv ידעתה שחר stays unmatched; MACULA has only the qere.
    expect(report.join.hebrew).toMatchObject({ unaligned: 0, noCoreVerse: 0, coreUnmatched: 2 });
    expect(report.join.hebrew.examples.coreUnmatched).toEqual(["JOB.38.12#4 ידעתה", "JOB.38.12#5 שחר"]);

    const db = new DatabaseSync(path.join(dir, "bundles", report.file), { readOnly: true });
    const at = (sql: string, ...args: number[]): Record<string, unknown>[] => db.prepare(sql).all(...args);
    // Hebrew Psalm 3:1 is the superscription: English Psalm 3:0.
    expect(at("SELECT DISTINCT ord FROM words WHERE macula_id LIKE 'o19003001%'").map((r) => r["ord"])).toEqual([verseOrd("PSA", 3, 0)]);
    expect(at("SELECT COUNT(*) AS n FROM words WHERE ord = ? AND position IS NULL", verseOrd("JHN", 7, 53))[0]?.["n"]).toBe(7);
    expect(at("SELECT license, attribution FROM sources ORDER BY id").map((r) => r["license"])).toEqual(["CC-BY-4.0", "CC-BY-4.0"]);
    expect(String(at("SELECT license_notice FROM sources WHERE key = 'macula-greek'")[0]?.["license_notice"])).toContain(
      "MACULA Greek Linguistic Datasets, available at https://github.com/Clear-Bible/macula-greek/",
    );
    db.close();
  });

  it("reports a joined word whose core token has a different surface", () => {
    const options = setup((core) =>
      core.prepare("UPDATE tokens SET surface = 'ἐν' WHERE ord = ? AND position = 10").run(verseOrd("JHN", 1, 1)),
    );
    const report = packageSyntax({ ...options, books: BOOKS, verifyPins: false });
    expect(report.coreMismatches).toEqual([`n43001001010 ${verseOrd("JHN", 1, 1)}#10: προσ vs core εν`]);
  });

  it("keeps the file when nothing changed", () => {
    const options = { ...setup(), books: BOOKS, verifyPins: false };
    expect(packageSyntax(options)).toMatchObject({ file: "syntax.v1.db", reused: false });
    expect(packageSyntax(options)).toMatchObject({ file: "syntax.v1.db", reused: true });
  });
});

describe("reading a verse back", () => {
  it("answers who does what to whom from the bundle alone", () => {
    const report = packageSyntax({ ...setup(), books: BOOKS, verifyPins: false });
    const db = new DatabaseSync(path.join(dir, "bundles", report.file), { readOnly: true });
    const show = (ord: number): string[] =>
      verseSyntax(db, ord).clauses.flatMap((c) => c.constituents.map((p) => `${p.role}: ${p.words.map((w) => w.surface).join(" ")}`));
    expect(show(verseOrd("JHN", 1, 1))).toEqual([
      "p: Ἐν ἀρχῇ",
      "vc: ἦν",
      "s: ὁ λόγος",
      "s: ὁ λόγος",
      "vc: ἦν",
      "p: πρὸς τὸν θεόν",
      "p: θεὸς",
      "vc: ἦν",
      "s: ὁ λόγος",
    ]);
    const genesis = verseSyntax(db, verseOrd("GEN", 1, 1));
    expect(genesis.clauses[0]?.constituents.map((p) => p.role)).toEqual(["pp", "v", "s", "o"]);
    expect(genesis.frames[0]?.args.map((a) => `${a.arg}: ${a.words.map((w) => w.english).join(", ")}`)).toEqual([
      "A0: God",
      "A1: heavens, earth",
    ]);
    db.close();
  });
});

describe("licence", () => {
  it("refuses a LICENSE.md that no longer states CC BY 4.0 or its attribution", () => {
    const text = fixture("macula-greek-LICENSE.md");
    expect(() => checkMaculaLicence("greek", text)).not.toThrow();
    expect(() => checkMaculaLicence("hebrew", fixture("macula-hebrew-LICENSE.md"))).not.toThrow();
    expect(() => checkMaculaLicence("greek", text.replace("CC BY 4.0 ]", "CC BY-NC 4.0 ]"))).toThrow(/no longer says/);
    expect(() => checkMaculaLicence("greek", `${text}\nShareAlike — distribute under the same license`)).toThrow(/ShareAlike/);
    // Greek's attribution wording does not satisfy Hebrew's.
    expect(() => checkMaculaLicence("hebrew", text)).toThrow(/no longer says/);
  });

  it("refuses to build when a LICENSE.md is missing", () => {
    const options = setup();
    rmSync(path.join(options.rawDir, "macula-hebrew-LICENSE.md"));
    expect(() => packageSyntax({ ...options, books: BOOKS, verifyPins: false })).toThrow(/macula-hebrew-LICENSE.md is not in/);
  });
});

describe("MACULA sources", () => {
  it("pins every file by commit and digest", () => {
    const greek = SOURCES.find((s) => s.key === "macula-greek");
    const hebrew = SOURCES.find((s) => s.key === "macula-hebrew");
    expect(greek?.files).toHaveLength(28);
    expect(hebrew?.files).toHaveLength(930);
    for (const def of [greek, hebrew]) {
      expect(def?.license).toBe("CC-BY-4.0");
      expect(def?.downloadable).toBe(true);
      expect(def?.commit).toMatch(/^[0-9a-f]{40}$/);
      for (const file of def?.files ?? []) {
        expect(file.sha256, file.file).toMatch(/^[0-9a-f]{64}$/);
        expect(file.url, file.file).toContain(`/${def?.commit ?? ""}/`);
      }
    }
  });
});

// The full join, against the real core bundle. Skipped when the sources or core are absent — a
// clean checkout should not fail its tests for want of a network.
const CORE = highestVersionOnDisk("core", BUNDLES);
const HAVE_SOURCES = existsSync(path.join(RAW, "macula-greek-04-john.xml")) && existsSync(path.join(RAW, "Gen.xml")) && CORE > 0;
const describeIfIngested = HAVE_SOURCES ? describe : describe.skip;

describeIfIngested("join consistency with core", () => {
  it("joins every core token of John and Genesis except Genesis's ketiv, with no surface disagreeing", () => {
    const report = packageSyntax({ books: ["GEN", "JHN"], outDir: path.join(dir, "bundles") });
    expect(report.coreMismatches).toEqual([]);
    const core = new DatabaseSync(path.join(BUNDLES, `core.v${CORE}.db`), { readOnly: true });
    const count = (from: number, to: number): number =>
      Number(core.prepare("SELECT COUNT(*) AS n FROM tokens WHERE ord BETWEEN ? AND ?").get(from, to)?.["n"]);
    const johnTokens = count(verseOrd("JHN", 1, 0), verseOrd("JHN", 21, 999));
    const genesisTokens = count(verseOrd("GEN", 1, 0), verseOrd("GEN", 50, 999));
    core.close();
    // MACULA's John has the pericope adulterae (John 7:53–8:11), which MorphGNT's SBLGNT does not.
    expect(report.join.greek).toMatchObject({ joined: johnTokens, unaligned: 0, coreUnmatched: 0, noCoreVerse: 187 });
    const ketiv = (readFileSync(path.join(RAW, "Gen.xml"), "utf8").match(/type="x-ketiv"/g) ?? []).length;
    expect(report.join.hebrew).toMatchObject({ joined: genesisTokens - ketiv, unaligned: 0, noCoreVerse: 0, coreUnmatched: ketiv });
    expect(readdirSync(path.join(dir, "bundles"))).toEqual(["syntax.v1.db"]);
  }, 180_000);
});
