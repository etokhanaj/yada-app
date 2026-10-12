import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { verseOrd } from "./bundle.js";
import {
  NoteKindSchema,
  STUDY_DDL,
  StudyInfoSchema,
  bookOfOrd,
  compareXrefs,
  studyBookFileName,
  unknownStudyTags,
} from "./study.js";

function studyDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(STUDY_DDL);
  db.prepare(
    "INSERT INTO sources (id, key, name, license, license_notice, attribution, homepage, sha256, modifications) VALUES (1, 'tosn', 'Tyndale Open Study Notes', 'CC-BY-SA-4.0', 'notice', 'credit', 'https://example.test', 'x', 'none')",
  ).run();
  return db;
}

describe("STUDY_DDL", () => {
  it("creates the tables the app reads by name", () => {
    const tables = studyDb()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row["name"]);
    expect(tables).toEqual(["meta", "notes", "people", "people_verses", "places", "places_verses", "sources", "xrefs"]);
  });

  it("finds every note whose range covers a verse", () => {
    const db = studyDb();
    const insert = db.prepare("INSERT INTO notes (ord_start, ord_end, kind, title, text, source) VALUES (?, ?, ?, ?, ?, 1)");
    insert.run(verseOrd("GEN", 1, 1), verseOrd("GEN", 2, 3), "note", null, "1:1–2:3 …");
    insert.run(verseOrd("GEN", 1, 1), verseOrd("GEN", 50, 26), "intro", "Genesis", "…");
    insert.run(verseOrd("GEN", 3, 1), verseOrd("GEN", 3, 1), "note", null, "3:1 …");
    const ord = verseOrd("GEN", 1, 5);
    const kinds = db
      .prepare("SELECT kind FROM notes WHERE ord_start <= ? AND ord_end >= ? ORDER BY id")
      .all(ord, ord)
      .map((row) => row["kind"]);
    expect(kinds).toEqual(["note", "intro"]);
  });

  it("refuses an unknown note kind and a range that ends before it starts", () => {
    const db = studyDb();
    const insert = db.prepare("INSERT INTO notes (ord_start, ord_end, kind, text, source) VALUES (?, ?, ?, 'x', 1)");
    expect(() => insert.run(1, 1, "commentary")).toThrow(/CHECK/);
    expect(() => insert.run(2, 1, "note")).toThrow(/CHECK/);
    expect(NoteKindSchema.options).toEqual(["note", "intro", "intro_summary", "profile", "theme"]);
  });

  it("keeps one row per cross-reference", () => {
    const db = studyDb();
    const insert = db.prepare("INSERT INTO xrefs (from_ord, to_ord_start, to_ord_end, votes) VALUES (?, ?, ?, ?)");
    insert.run(verseOrd("GEN", 1, 1), verseOrd("JHN", 1, 1), verseOrd("JHN", 1, 3), 200);
    expect(() => insert.run(verseOrd("GEN", 1, 1), verseOrd("JHN", 1, 1), verseOrd("JHN", 1, 3), 1)).toThrow(/UNIQUE/);
  });
});

describe("study fragments", () => {
  it("flags tags outside the allowed set", () => {
    expect(unknownStudyTags("<h>Setting</h>\n<x>God</x> <sc>Lord</sc> <i>’elohim</i> <b>1:1</b>")).toEqual([]);
    expect(unknownStudyTags('<a href="?bref=Gen.1.1">1:1</a> <span class="ital">x</span>')).toEqual(["a", "span"]);
  });
});

describe("per-book study bundles", () => {
  const info = {
    book: "JHN",
    version: 2,
    file: "study-jhn.v2.db",
    sha256: "a".repeat(64),
    bytes: 400_000,
    download_bytes: 140_000,
    format: 1,
    licenses: ["CC-BY-SA-4.0", "CC-BY-4.0"],
    notes: 545,
    xrefs: 4_100,
  };

  it("names a book's file and holds the manifest entry to that name", () => {
    expect(studyBookFileName("1CO", 3)).toBe("study-1co.v3.db");
    expect(StudyInfoSchema.parse(info).book).toBe("JHN");
    expect(StudyInfoSchema.safeParse({ ...info, file: "../study-jhn.v2.db" }).success).toBe(false);
    expect(StudyInfoSchema.safeParse({ ...info, licenses: ["NLT"] }).success).toBe(false);
  });

  it("finds a verse's book and ranks references by votes, ties in canonical order", () => {
    expect(bookOfOrd(verseOrd("JHN", 3, 16))).toBe("JHN");
    expect(bookOfOrd(0)).toBeUndefined();
    const refs = [
      { to_ord_start: 30, to_ord_end: 30, votes: 5 },
      { to_ord_start: 10, to_ord_end: 12, votes: 5 },
      { to_ord_start: 20, to_ord_end: 20, votes: 9 },
      { to_ord_start: 10, to_ord_end: 10, votes: 5 },
    ];
    expect([...refs].sort(compareXrefs).map((r) => `${r.to_ord_start}-${r.to_ord_end}`)).toEqual(["20-20", "10-10", "10-12", "30-30"]);
  });
});
