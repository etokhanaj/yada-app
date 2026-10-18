/**
 * The app's study SQL against a file built with the pipeline's own DDL (STUDY_DDL), so the two
 * cannot drift; and against the real John bundle when content/bundles holds one.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { STUDY_DDL, verseOrd } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { checkStudyFile, getPassageNote, getProfiles, getStudyNotes, getStudyNotesInRange, getStudySources, getXrefs, noteOrdsInRange } from "./studyQueries";
import type { Db } from "./queries";

function wrap(db: DatabaseSync): Db {
  return {
    getAllAsync: async <T,>(sql: string, params: Array<string | number | null>) => db.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T,>(sql: string, params: Array<string | number | null>) => (db.prepare(sql).get(...params) as T | undefined) ?? null,
  };
}

const j = (c: number, v: number) => verseOrd("JHN", c, v);

function fixture(): Db {
  const db = new DatabaseSync(":memory:");
  db.exec(STUDY_DDL);
  db.prepare("INSERT INTO meta (key, value) VALUES ('format', '1'), ('book', 'JHN')").run();
  db.prepare(
    "INSERT INTO sources (id, key, name, license, license_notice, attribution, homepage, sha256, modifications) VALUES (1, 'tosn', 'Tyndale Open Study Notes', 'CC-BY-SA-4.0', 'notice', 'credit', 'https://example.test', 'x', 'changes'), (2, 'openbible-xrefs', 'OpenBible.info cross-references', 'CC-BY-4.0', 'www.openbible.info CC-BY', 'credit', 'https://example.test', 'y', 'none')",
  ).run();
  const note = db.prepare("INSERT INTO notes (id, ord_start, ord_end, kind, title, text, source) VALUES (?, ?, ?, ?, ?, ?, 1)");
  note.run(1, j(1, 1), j(21, 25), "intro", "John", "intro");
  note.run(2, j(1, 1), j(1, 18), "note", null, "<b>1:1-18</b> prologue");
  note.run(3, j(1, 1), j(1, 1), "note", null, "<b>1:1</b> own");
  note.run(4, j(3, 1), j(3, 9), "profile", "Nicodemus", "<h>Nicodemus</h>");
  const xref = db.prepare("INSERT INTO xrefs (from_ord, to_ord_start, to_ord_end, votes) VALUES (?, ?, ?, ?)");
  xref.run(j(1, 1), verseOrd("GEN", 1, 1), verseOrd("GEN", 1, 1), 400);
  xref.run(j(1, 1), j(17, 5), j(17, 5), 120);
  xref.run(j(1, 1), verseOrd("REV", 19, 13), verseOrd("REV", 19, 13), 120);
  return wrap(db);
}

describe("study queries", () => {
  it("reads a verse's notes in order, its links best first, and the book's profiles", async () => {
    const db = fixture();
    expect((await getStudyNotes(db, j(1, 1))).map((n) => n.id)).toEqual([3, 2]);
    expect((await getStudyNotes(db, j(1, 18))).map((n) => n.id)).toEqual([2]);
    expect((await getStudyNotes(db, j(1, 19))).map((n) => n.id)).toEqual([]);
    expect((await getXrefs(db, j(1, 1))).map((x) => x.to_ord_start)).toEqual([verseOrd("GEN", 1, 1), j(17, 5), verseOrd("REV", 19, 13)]);
    expect((await getProfiles(db)).map((p) => p.title)).toEqual(["Nicodemus"]);
    expect([...(await noteOrdsInRange(db, j(1, 17), j(1, 20)))]).toEqual([j(1, 17), j(1, 18)]);
    expect((await getStudySources(db)).map((s) => s.license)).toEqual(["CC-BY-SA-4.0", "CC-BY-4.0"]);
    expect(await checkStudyFile(db, "JHN")).toBe(true);
    expect(await checkStudyFile(db, "GEN")).toBe(false);
    const other = new DatabaseSync(":memory:");
    other.exec(STUDY_DDL);
    other.prepare("INSERT INTO meta (key, value) VALUES ('format', '2'), ('book', 'JHN')").run();
    expect(await checkStudyFile(wrap(other), "JHN")).toBe(false);
  });

  it("finds Tyndale's passage note for a pericope: the shortest range covering it, never a verse note", async () => {
    const db = fixture();
    expect((await getPassageNote(db, j(1, 1), j(1, 18)))?.id).toBe(2);
    expect((await getPassageNote(db, j(1, 3), j(1, 5)))?.id).toBe(2);
    expect(await getPassageNote(db, j(1, 1), j(1, 1)).then((n) => n?.id)).toBe(2);
    expect(await getPassageNote(db, j(1, 1), j(2, 12))).toBeNull();
  });

  it("reads every note touching a passage, the wider one first, never an intro or a profile (WM-05)", async () => {
    const db = fixture();
    expect((await getStudyNotesInRange(db, j(1, 1), j(1, 18))).map((n) => n.id)).toEqual([2, 3]);
    expect((await getStudyNotesInRange(db, j(1, 3), j(1, 5))).map((n) => n.id)).toEqual([2]);
    expect(await getStudyNotesInRange(db, j(3, 1), j(3, 21))).toEqual([]);
  });

  const real = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../content/bundles/study-jhn.v1.db");
  it.skipIf(!existsSync(real))("reads the real John bundle: 1:1's own note leads, five links at most", async () => {
    const db = wrap(new DatabaseSync(real, { readOnly: true }));
    const notes = await getStudyNotes(db, j(1, 1));
    expect(notes[0]?.text.startsWith("<b>1:1</b> Echoing Gen 1:1")).toBe(true);
    expect(notes.some((n) => n.ord_end === j(1, 18))).toBe(true);
    expect((await getXrefs(db, j(1, 1))).length).toBeLessThanOrEqual(5);
    expect((await getProfiles(db)).some((p) => p.title === "Nicodemus")).toBe(true);
  });
});
