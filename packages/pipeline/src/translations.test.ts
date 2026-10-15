import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { TranslationInfoSchema, translationLabel, verseOrd } from "@yada/schema";

import { parseVpl } from "./english.js";
import { SOURCES, checkLicense, checkPin } from "./sources.js";
import { DOWNLOADABLE, REFERENCE_VPL, TranslationRefused, gzipTranslation, packageTranslation, verseGaps } from "./translations.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "yada-translation-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

// Six verses of the English versification, in eBible's BibleWorks codes.
const REFERENCE = [
  "GEN 1:1 In the beginning God created the heaven and the earth.",
  "MAT 23:14 Woe unto you, scribes and Pharisees, hypocrites!",
  "MAR 1:1 The beginning of the gospel of Jesus Christ, the Son of God;",
  "JOH 1:1 In the beginning was the Word.",
  "1JO 4:8 He that loveth not knoweth not God; for God is love.",
  "SOL 2:1 I am the rose of Sharon.",
];

function write(name: string, lines: string[]): string {
  const file = path.join(dir, name);
  writeFileSync(file, `${lines.join("\r\n")}\r\n`);
  return file;
}

describe("parseVpl for any translation", () => {
  it("maps eBible's book codes and keeps the code it is given", () => {
    const file = write("engylt_vpl.txt", [
      "JOH 1:1 In the beginning was the Word, and the Word was with God,",
      "MAR 1:1 A beginning of the good news of Jesus Christ, Son of God.",
      "1JO 4:8 he who is not loving did not know God, because God is love.",
      "SOL 2:1 I [am] a rose of Sharon,",
      "EZE 37:1 There hath been upon me the hand of Jehovah,",
    ]);
    const verses = parseVpl(file, "YLT");
    expect(verses.map((v) => v.verse_id)).toEqual(["JHN.1.1", "MRK.1.1", "1JN.4.8", "SNG.2.1", "EZK.37.1"]);
    expect(verses.every((v) => v.translation === "YLT")).toBe(true);
    // Unaltered apart from whitespace: YLT's brackets are its own text, not the KJV's markup.
    expect(verses[3]?.text).toBe("I [am] a rose of Sharon,");
  });

  it("skips eBible's '-' placeholder and refuses an unknown book code", () => {
    expect(parseVpl(write("a_vpl.txt", ["3JO 1:15 -", "3JO 1:14 but I hope to see you soon"]), "X")).toHaveLength(1);
    expect(() => parseVpl(write("b_vpl.txt", ["XYZ 1:1 text"]), "X")).toThrow(/unknown VPL book code XYZ/);
  });
});

describe("verseGaps", () => {
  it("lists missing and extra verses in canonical order, not string order", () => {
    const gaps = verseGaps(
      ["GEN.1.1", "GEN.1.2", "MAT.23.14", "ACT.8.37", "GEN.1.10"],
      ["GEN.1.1", "GEN.1.2", "REV.12.18"],
    );
    expect(gaps.missing).toEqual(["GEN.1.10", "MAT.23.14", "ACT.8.37"]);
    expect(gaps.extra).toEqual(["REV.12.18"]);
  });

  it("reports nothing for a complete translation", () => {
    expect(verseGaps(["JHN.1.1"], ["JHN.1.1"])).toEqual({ missing: [], extra: [] });
  });
});

describe("package translation", () => {
  const options = () => ({ rawDir: dir, outDir: dir });

  beforeEach(() => {
    write(REFERENCE_VPL, REFERENCE);
  });

  it("builds texts keyed by ord, a working search index, and meta naming what is missing", () => {
    // A text that omits Matthew 23:14, as the critical texts do: the ASV keeps its number, empty.
    write("eng-asv_vpl.txt", REFERENCE.map((l) => (l.startsWith("MAT 23:14") ? "MAT 23:14 " : l)));
    const report = packageTranslation("asv", options());

    expect(report.info.file).toBe("translation-asv.v1.db");
    expect(report.info.cover).toBe("sage");
    expect(report.info.verses).toBe(5);
    expect(report.info.missing).toEqual(["MAT.23.14"]);
    expect(TranslationInfoSchema.safeParse(report.info).success).toBe(true);
    // publish uploads `file` by name, so it may only be the translation's own.
    expect(TranslationInfoSchema.safeParse({ ...report.info, file: "../core.v1.db" }).success).toBe(false);

    const db = new DatabaseSync(path.join(dir, report.info.file), { readOnly: true });
    const meta = Object.fromEntries(
      db.prepare("SELECT key, value FROM meta").all().map((r) => [String(r["key"]), String(r["value"])]),
    );
    expect(meta).toMatchObject({
      code: "ASV",
      name: "American Standard Version",
      year: "1901",
      license: "PUBLIC_DOMAIN",
      source_sha256: SOURCES.find((s) => s.key === "asv")?.files[0]?.sha256,
      missing: JSON.stringify(["MAT.23.14"]),
    });
    expect(meta["attribution"]).toContain("American Standard Version");
    expect(db.prepare("SELECT text FROM texts WHERE ord = ?").get(verseOrd("JHN", 1, 1))?.["text"]).toBe(
      "In the beginning was the Word.",
    );
    const hits = db.prepare("SELECT rowid FROM texts_fts WHERE texts_fts MATCH 'rose'").all();
    expect(hits.map((h) => Number(h["rowid"]))).toEqual([verseOrd("SNG", 2, 1)]);
    db.close();
  });

  it("records the gzipped size publish will upload, the same every time", () => {
    write("eng-asv_vpl.txt", REFERENCE);
    const { info } = packageTranslation("ASV", options());
    const bytes = readFileSync(path.join(dir, info.file));
    const gzipped = gzipTranslation(bytes);
    expect(info.download_bytes).toBe(gzipped.length);
    expect(info.download_bytes).toBeLessThan(info.bytes);
    // Byte-identical across runs: publish re-compresses and checks the size against this.
    expect(gzipTranslation(bytes).equals(gzipped)).toBe(true);
    // An older manifest, without the field, still parses.
    const { download_bytes: _absent, ...older } = info;
    expect(TranslationInfoSchema.safeParse(older).success).toBe(true);
  });

  it("adds the gzipped size to a reused entry that was written without one", () => {
    write("engmsb_vpl.txt", REFERENCE);
    const first = packageTranslation("MSB", options());
    const { download_bytes: _absent, ...older } = first.info;
    const again = packageTranslation("MSB", { ...options(), previous: older });
    expect(again.reused).toBe(true);
    expect(again.info).toEqual(first.info);
  });

  it("keeps the file when the bytes are unchanged, and versions up when they change", () => {
    write("engmsb_vpl.txt", REFERENCE);
    const first = packageTranslation("MSB", options());
    const again = packageTranslation("MSB", { ...options(), previous: first.info });
    expect(again.reused).toBe(true);
    expect(again.info).toEqual(first.info);

    write("engmsb_vpl.txt", [...REFERENCE.slice(0, 5), "SOL 2:1 I am a rose of Sharon, a lily of the valleys."]);
    const changed = packageTranslation("MSB", { ...options(), previous: first.info });
    expect(changed.info.file).toBe("translation-msb.v2.db");
    expect(readdirSync(dir).filter((f) => f.startsWith("translation-msb"))).toEqual([
      "translation-msb.v1.db",
      "translation-msb.v2.db",
    ]);
  });

  it("refuses a text numbered outside the English versification, naming both sides", () => {
    // As eBible's Geneva does (left out for that reason, 10 Oct 2026): Revelation 12:18 printed
    // as part of chapter 12 where English has 13:1.
    write("engylt_vpl.txt", [...REFERENCE.filter((l) => !l.startsWith("GEN")), "REV 12:18 And I stood on the sea sand."]);
    let refused: unknown;
    try {
      packageTranslation("YLT", options());
    } catch (error) {
      refused = error;
    }
    expect(refused).toBeInstanceOf(TranslationRefused);
    expect((refused as TranslationRefused).gaps).toEqual({ missing: ["GEN.1.1"], extra: ["REV.12.18"] });
    expect(readdirSync(dir).some((f) => f.endsWith(".db"))).toBe(false);
  });

  describe("an Old Testament text in Hebrew order (JPS 1917)", () => {
    // TVTMS's table, padded past the parser's 1000-row floor with rows that change nothing.
    const tvtms = [
      "English (NRSV, ESV, KJV etc)\tHebrew MT",
      "Jol.2:28\tJol.3:1",
      "Jol.3:1\tJol.4:1",
      "Psa.3:0\tPsa.3:1",
      "Psa.3:1\tPsa.3:2",
      ...Array.from({ length: 1000 }, (_, i) => `Psa.150:${i + 100}\tPsa.150:${i + 100}`),
      "",
      "Phrases and Abbreviations",
    ];
    const reference = [...REFERENCE, "PSA 3:1 LORD, how are they increased that trouble me!", "JOE 3:1 For, behold, in those days"];
    const jps = [
      "GEN 1:1 IN THE beginning God created the heaven and the earth.",
      "SOL 2:1 I am a rose of Sharon, a lily of the valleys.",
      "PSA 3:1 (3-1) A Psalm of David, when he fled from Absalom his son. (3-2) LORD, how many are mine adversaries become!",
      "JOE 3:1 (4-1) For, behold, in those days, and in that time,",
    ];

    beforeEach(() => {
      write(REFERENCE_VPL, reference);
      write("TVTMS.txt", tvtms);
    });

    it("counts only Old Testament verses as missing, and labels itself OT", () => {
      write("engjps_vpl.txt", jps);
      const { info, gaps, numbering } = packageTranslation("JPS", options());
      expect(info.verses).toBe(4);
      expect(info.missing).toEqual([]);
      expect(gaps).toEqual({ missing: [], extra: [] });
      expect(info.testament).toBe("OT");
      expect(translationLabel(info)).toBe("JPS 1917 · Jewish Publication Society · Old Testament");
      expect(info.description).toMatch(/thee and thou/);
      expect(numbering?.renumbered).toBe(2);
      expect(TranslationInfoSchema.safeParse(info).success).toBe(true);

      const db = new DatabaseSync(path.join(dir, info.file), { readOnly: true });
      const meta = Object.fromEntries(
        db.prepare("SELECT key, value FROM meta").all().map((r) => [String(r["key"]), String(r["value"])]),
      );
      expect(meta).toMatchObject({ code: "JPS", testament: "OT", publisher: "Jewish Publication Society" });
      expect(db.prepare("SELECT text FROM texts WHERE ord = ?").get(verseOrd("PSA", 3, 1))?.["text"]).toBe(
        "A Psalm of David, when he fled from Absalom his son. LORD, how many are mine adversaries become!",
      );
      expect(db.prepare("SELECT count(*) AS n FROM texts WHERE ord >= ?").get(verseOrd("MAT", 1, 1))?.["n"]).toBe(0);
      db.close();
    });

    it("refuses a New Testament verse in an Old Testament text", () => {
      write("engjps_vpl.txt", [...jps, "JOH 1:1 In the beginning was the Word."]);
      expect(() => packageTranslation("JPS", options())).toThrow(TranslationRefused);
    });

    it("refuses words TVTMS places in another verse", () => {
      write("engjps_vpl.txt", [...jps.slice(0, 3), "JOE 3:1 (3-1) For, behold, in those days"]);
      expect(() => packageTranslation("JPS", options())).toThrow(/TVTMS places elsewhere \(JOL\.3\.1\)/);
    });

    it("leaves whole-Bible versions without a testament", () => {
      expect(DOWNLOADABLE.filter((t) => t.testament !== undefined).map((t) => t.code)).toEqual(["JPS"]);
      expect(translationLabel({ name: "Young's Literal Translation" })).toBe("Young's Literal Translation");
    });
  });

  it("refuses a code it has no definition for", () => {
    expect(() => packageTranslation("NIV", options())).toThrow(TranslationRefused);
  });
});

describe("downloadable translation sources", () => {
  it("assigns each version the cover tone the plan gives it", () => {
    expect(Object.fromEntries(DOWNLOADABLE.map((t) => [t.code, t.cover]))).toEqual({
      ASV: "sage",
      YLT: "paper",
      MSB: "lime",
      JPS: "lime",
    });
  });

  it("pins the JPS 1917 to the eBible zip downloaded on 12 Oct 2026, its licence from engjps_about.htm", () => {
    const file = SOURCES.find((s) => s.key === "jps1917")?.files[0];
    expect(file?.url).toBe("https://ebible.org/Scriptures/engjps_vpl.zip");
    expect(file?.sha256).toBe("12b1812db23e9c10be68f2dd417aa1a190db4c03c6e6f5c29f53f97332b659d7");
    expect(file?.licenseIn).toEqual({ zipMember: "engjps_about.htm", mustContain: "Public Domain" });
    expect(SOURCES.find((s) => s.key === "jps1917")?.license).toBe("PUBLIC_DOMAIN");
  });

  it("pins every download by full digest and re-reads its licence from the package", () => {
    for (const t of DOWNLOADABLE) {
      const source = SOURCES.find((s) => s.key === t.source);
      expect(source?.downloadable, t.code).toBe(true);
      expect(source?.files[0]?.sha256, t.code).toMatch(/^[0-9a-f]{64}$/);
      expect(source?.files[0]?.licenseIn?.zipMember, t.code).toMatch(/_about\.htm$/);
    }
  });

  it("refuses bytes that differ from the pin", () => {
    const body = Buffer.from("zip bytes");
    const file = { file: "x.txt", url: "https://example.test/x.zip", sha256: createHash("sha256").update(body).digest("hex") };
    expect(() => checkPin(file, body)).not.toThrow();
    expect(() => checkPin(file, Buffer.from("other bytes"))).toThrow(/pinned/);
  });

  it("refuses a package whose licence statement has changed", () => {
    const file = { file: "x.txt", url: "u", licenseIn: { zipMember: "x_about.htm", mustContain: "Public Domain" } };
    expect(() => checkLicense(file, "<a href='…/Public_domain'>Public Domain</a>")).not.toThrow();
    expect(() => checkLicense(file, "Copyright © 2027. All rights reserved.")).toThrow(/x_about\.htm/);
  });
});
