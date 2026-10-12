import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { StudyInfoSchema, verseOrd } from "@yada/schema";

import { SOURCES } from "./sources.js";
import {
  StudyRefused,
  osisRange,
  packageStudy,
  parseOpenBible,
  parseTosn,
  tosnBody,
  tosnInline,
  tosnRange,
  topXrefs,
} from "./study.js";

// Excerpts copied unmodified from the real files; each carries its source's attribution.
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/study");
const fixture = (name: string): string => readFileSync(path.join(FIXTURES, name), "utf8");

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "yada-study-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("Tyndale references", () => {
  it("reads a verse, a range within a chapter and a range across chapters", () => {
    expect(tosnRange("Gen.1.1")).toEqual({ start: verseOrd("GEN", 1, 1), end: verseOrd("GEN", 1, 1) });
    expect(tosnRange("Ps.3.1-2")).toEqual({ start: verseOrd("PSA", 3, 1), end: verseOrd("PSA", 3, 2) });
    expect(tosnRange("Gen.1.1-2.3")).toEqual({ start: verseOrd("GEN", 1, 1), end: verseOrd("GEN", 2, 3) });
    // Tyndale's own abbreviations, which are not OpenBible's.
    expect(tosnRange("Pr.8.22").start).toBe(verseOrd("PRO", 8, 22));
    expect(tosnRange("1Thes.4.13").start).toBe(verseOrd("1TH", 4, 13));
    expect(tosnRange("3Jn.1.15").start).toBe(verseOrd("3JN", 1, 15));
  });

  it("refuses an unknown book or a range that runs backwards", () => {
    expect(() => tosnRange("Prov.8.22")).toThrow(StudyRefused);
    expect(() => tosnRange("Gen.2.3-1.1")).toThrow(/ends before it starts/);
    expect(() => tosnRange("Gen 1:1")).toThrow(/unreadable/);
  });
});

describe("OpenBible references", () => {
  it("reads OSIS references, including a range across books", () => {
    expect(osisRange("Prov.8.22").start).toBe(verseOrd("PRO", 8, 22));
    expect(osisRange("John.1.1-John.1.3")).toEqual({ start: verseOrd("JHN", 1, 1), end: verseOrd("JHN", 1, 3) });
    expect(osisRange("Hag.2.20-Zech.1.1")).toEqual({ start: verseOrd("HAG", 2, 20), end: verseOrd("ZEC", 1, 1) });
    expect(() => osisRange("Pr.8.22")).toThrow(/unknown book Pr/);
  });

  it("keeps the header's licence comment and leaves out downvoted rows", () => {
    const parsed = parseOpenBible(fixture("openbible-cross_references.txt"));
    expect(parsed.notice).toBe("www.openbible.info CC-BY 2026-10-05");
    expect(parsed.downvoted).toBe(1);
    expect(parsed.xrefs).toHaveLength(5);
    expect(parsed.xrefs[1]).toEqual({
      from: verseOrd("GEN", 1, 1),
      toStart: verseOrd("JHN", 1, 1),
      toEnd: verseOrd("JHN", 1, 3),
      votes: 379,
    });
    expect(parsed.xrefs.every((x) => x.votes >= 0)).toBe(true);
  });

  it("refuses a file that has lost its licence comment", () => {
    expect(() => parseOpenBible("From Verse\tTo Verse\tVotes\nGen.1.1\tIsa.40.28\t67\n")).toThrow(/licence comment/);
  });
});

describe("Tyndale markup", () => {
  it("keeps the words and the distinctions, and drops only the links", () => {
    const [note] = parseTosn(fixture("tosn-StudyNotes.xml"), "note");
    expect(note?.name).toBe("Gen.1.1-2.3");
    expect(note?.text).toMatch(/^<b>1:1–2:3<\/b> These verses introduce the Pentateuch/);
    expect(note?.text).toContain("animal life (1:22-25), human life (1:27)");
    expect(note?.text).not.toContain("<a ");
  });

  it("marks Bible-text excerpts, the divine name and transliterations", () => {
    expect(
      tosnInline(
        '<span class="sn-excerpt">I am the <span class="sn-excerpt-divine-name">Lord</span></span> (Hebrew <span class="hebrew">’elohim</span>), ca. 1000 <span class="era">BC</span>',
      ),
    ).toBe("<x>I am the <sc>Lord</sc></x> (Hebrew <i>’elohim</i>), ca. 1000 <sc>BC</sc>");
  });

  it("reads the one-off forms in the real file", () => {
    const notes = parseTosn(fixture("tosn-StudyNotes.xml"), "note");
    // `ts="…"` after the class on John 1:1-18; `<x2002/>` after Num 20:1's label.
    expect(notes.find((n) => n.name === "John.1.1-18")?.text).toMatch(/^<b>1:1-18<\/b> The beginning of this prologue/);
    expect(notes.find((n) => n.name === "Num.20.1")?.text).toMatch(/^<b>20:1<\/b> The number of years/);
    expect(tosnInline('a<span class="ital"/>b')).toBe("ab");
  });

  it("refuses markup it does not know rather than dropping it", () => {
    expect(() => tosnInline('<span class="new-class">x</span>')).toThrow(/unknown Tyndale span class/);
    expect(() => tosnInline("<img src='x'/>")).toThrow(/unknown Tyndale markup/);
    expect(() => tosnBody("<p class=\"sn-text\">a</p><p>b</p>")).toThrow(/paragraph was not read/);
  });

  it("marks headings, keeps a book introduction's title, and spans the book", () => {
    const [intro] = parseTosn(fixture("tosn-BookIntros.xml"), "intro");
    // Tyndale's own title, kept as printed: its numbered books drop the number ("John" for 3 John).
    expect(intro?.title).toBe("John");
    expect(intro?.start).toBe(verseOrd("3JN", 1, 1));
    expect(intro?.end).toBe(verseOrd("3JN", 1, 15));
    expect(intro?.text.split("\n").some((line) => /^<h>[^<]+<\/h>$/.test(line))).toBe(true);
  });

  it("takes the kind from the file, not from the item's typename", () => {
    // ThemeNotes.xml types "The Church" as a Profile; it is one of the 299 theme articles.
    const xml = '<item name="TheChurch" typename="Profile"><title>The Church</title><refs>Eph.1.22-23</refs><body><p class="theme-title">The Church</p></body></item>';
    expect(parseTosn(xml, "theme")[0]?.kind).toBe("theme");
  });
});

describe("topXrefs", () => {
  it("keeps the best-voted few per verse, ties in canonical order", () => {
    const from = verseOrd("JHN", 1, 1);
    const xs = [10, 50, 50, 3, 7, 90, 1].map((votes, i) => ({ from, toStart: verseOrd("GEN", 1, 1 + i), toEnd: verseOrd("GEN", 1, 1 + i), votes }));
    const other = { from: verseOrd("GEN", 1, 1), toStart: from, toEnd: from, votes: 1 };
    const kept = topXrefs([...xs, other], 3);
    expect(kept.map((x) => x.votes)).toEqual([1, 90, 50, 50]);
    // The two 50s keep their canonical order: Genesis 1:2 before 1:3.
    expect(kept.slice(2).map((x) => x.toStart)).toEqual([verseOrd("GEN", 1, 2), verseOrd("GEN", 1, 3)]);
  });
});

describe("packageStudy", () => {
  function rawDir(): string {
    const raw = path.join(dir, "raw");
    cpSync(FIXTURES, raw, { recursive: true });
    return raw;
  }

  it("writes one file per book, each with its own notes, its verses' cross-references and both licence notices", () => {
    const outDir = path.join(dir, "bundles");
    const report = packageStudy({ rawDir: rawDir(), outDir });
    expect(report.books.map((b) => b.info.file)).toEqual([
      "study-gen.v1.db",
      "study-lev.v1.db",
      "study-num.v1.db",
      "study-2ch.v1.db",
      "study-psa.v1.db",
      "study-amo.v1.db",
      "study-hag.v1.db",
      "study-jhn.v1.db",
      "study-eph.v1.db",
      "study-3jn.v1.db",
    ]);
    expect(report.notes).toEqual({ note: 4, intro: 1, intro_summary: 1, profile: 1, theme: 1 });
    expect(report.noteBooks).toEqual(["GEN", "NUM", "PSA", "JHN"]);
    expect(report.xrefsKept).toBe(5);
    expect(report.gzipBytes).toBeLessThan(report.bytes);

    const john = report.books.find((b) => b.info.book === "JHN")?.info;
    expect(john).toMatchObject({ notes: 2, xrefs: 0, format: 1, licenses: ["CC-BY-SA-4.0", "CC-BY-4.0"] });
    expect(john?.download_bytes).toBeLessThan(john?.bytes ?? 0);

    const db = new DatabaseSync(path.join(outDir, "study-gen.v1.db"), { readOnly: true });
    const sources = db.prepare("SELECT key, license, license_notice, attribution FROM sources ORDER BY id").all();
    // ShareAlike: the Tyndale notice travels inside every file, read from the package's README.
    expect(sources[0]?.["license"]).toBe("CC-BY-SA-4.0");
    expect(String(sources[0]?.["license_notice"])).toContain(
      "This work is licensed under the Creative Commons Attribution-ShareAlike 4.0 International License.",
    );
    expect(String(sources[0]?.["attribution"])).toContain("Adapted from Tyndale Open Study Notes.");
    expect(sources[1]?.["license_notice"]).toBe("www.openbible.info CC-BY 2026-10-05");
    expect(db.prepare("SELECT value FROM meta WHERE key = 'book'").get()?.["value"]).toBe("GEN");
    const ord = verseOrd("GEN", 1, 1);
    const covering = db.prepare("SELECT kind FROM notes WHERE ord_start <= ? AND ord_end >= ?").all(ord, ord);
    expect(covering.map((r) => r["kind"])).toEqual(["note"]);
    // Cross-references go with the verse they start from: Genesis 1:1 → John 1:1–3 is in Genesis's file.
    expect(db.prepare("SELECT COUNT(*) AS n FROM xrefs WHERE from_ord = ?").get(ord)?.["n"]).toBe(2);
    expect(db.prepare("SELECT COUNT(*) AS n FROM notes WHERE ord_start >= ?").get(verseOrd("EXO", 1, 1))?.["n"]).toBe(0);
    db.close();

    // The entries go to a fragment beside the files, never into manifest.json.
    const fragment = JSON.parse(readFileSync(report.fragment, "utf8")) as { study: unknown[] };
    expect(fragment.study.map((entry) => StudyInfoSchema.parse(entry).file)).toEqual(report.books.map((b) => b.info.file));
    expect(existsSync(path.join(outDir, "manifest.json"))).toBe(false);
  });

  it("keeps a book's file when nothing in it changed, and versions up only the book that did", () => {
    const raw = rawDir();
    const outDir = path.join(dir, "bundles");
    packageStudy({ rawDir: raw, outDir });
    const again = packageStudy({ rawDir: raw, outDir });
    expect(again.books.every((b) => b.reused)).toBe(true);
    writeFileSync(path.join(raw, "openbible-cross_references.txt"), fixture("openbible-cross_references.txt").replace("\t67", "\t68"));
    const changed = packageStudy({ rawDir: raw, outDir });
    expect(changed.books.filter((b) => !b.reused).map((b) => b.info.file)).toEqual(["study-gen.v2.db"]);
  });

  it("packages only the books asked for", () => {
    const report = packageStudy({ rawDir: rawDir(), outDir: path.join(dir, "bundles"), books: ["JHN"] });
    expect(report.books.map((b) => b.info.book)).toEqual(["JHN"]);
    expect(report.notes).toEqual({ note: 1, intro: 0, intro_summary: 0, profile: 1, theme: 0 });
  });

  it("refuses when the README no longer states the licence", () => {
    const raw = rawDir();
    writeFileSync(path.join(raw, "tosn-README.txt"), "All rights reserved.");
    expect(() => packageStudy({ rawDir: raw, outDir: path.join(dir, "bundles") })).toThrow(/no longer states CC BY-SA/);
  });
});

describe("study sources", () => {
  it("pins each archive by full digest and re-reads its licence from the package", () => {
    for (const key of ["tosn", "openbible-xrefs"]) {
      const def = SOURCES.find((s) => s.key === key);
      expect(def?.downloadable, key).toBe(true);
      expect(def?.files.length, key).toBeGreaterThan(0);
      for (const file of def?.files ?? []) {
        expect(file.sha256, file.file).toMatch(/^[0-9a-f]{64}$/);
        expect(file.licenseIn?.mustContain, file.file).toBeTruthy();
      }
    }
    expect(SOURCES.find((s) => s.key === "tosn")?.license).toBe("CC-BY-SA-4.0");
  });
});
