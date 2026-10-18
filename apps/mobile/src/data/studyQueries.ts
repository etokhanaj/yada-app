/**
 * Reads against one book's study bundle (STUDY_DDL in @yada/schema), over the same two-method
 * interface as queries.ts, so the SQL runs under vitest on a file built with the pipeline's DDL.
 */

import { STUDY_FORMAT, XREFS_PER_VERSE } from "@yada/schema";

import { notesForVerse, passageNoteFor, rankXrefs, type StudyNoteRow } from "../lib/study";
import type { Db } from "./queries";

export interface StudyXref {
  readonly to_ord_start: number;
  readonly to_ord_end: number;
  readonly votes: number;
}

export interface StudySource {
  readonly key: string;
  readonly name: string;
  readonly license: string;
  readonly license_notice: string;
  readonly attribution: string;
  readonly homepage: string;
  readonly modifications: string;
}

const COLUMNS = "id, ord_start, ord_end, kind, title, text";

/** The verse's study notes in the order Understand shows them (lib/study.ts notesForVerse). */
export async function getStudyNotes(db: Db, ord: number): Promise<StudyNoteRow[]> {
  const rows = await db.getAllAsync<StudyNoteRow>(
    `SELECT ${COLUMNS} FROM notes WHERE kind = 'note' AND ord_start <= ? AND ord_end >= ?`,
    [ord, ord],
  );
  return notesForVerse(rows, ord);
}

/**
 * Every note touching a passage, for the guide's Study notes row (WM-05, "Tyndale on 11:1–44"): before, the
 * row opened the first verse's notes only. In reading order, a note on the wider range before a verse's own.
 */
export async function getStudyNotesInRange(db: Db, lo: number, hi: number): Promise<StudyNoteRow[]> {
  return db.getAllAsync<StudyNoteRow>(
    `SELECT ${COLUMNS} FROM notes WHERE kind = 'note' AND ord_start <= ? AND ord_end >= ? ORDER BY ord_start, ord_end DESC, id`,
    [hi, lo],
  );
}

/** Tyndale's passage note for a pericope range (lib/study.ts passageNoteFor), for the guide's opener. */
export async function getPassageNote(db: Db, startOrd: number, endOrd: number): Promise<StudyNoteRow | null> {
  const rows = await db.getAllAsync<StudyNoteRow>(
    `SELECT ${COLUMNS} FROM notes WHERE kind = 'note' AND ord_start <= ? AND ord_end >= ? AND ord_end > ord_start`,
    [startOrd, endOrd],
  );
  return passageNoteFor(rows, startOrd, endOrd);
}

/** The verses in [lo, hi] with a verse note or a cross-reference: the reader offers Understand on them. */
export async function noteOrdsInRange(db: Db, lo: number, hi: number): Promise<Set<number>> {
  const rows = await db.getAllAsync<{ ord_start: number; ord_end: number }>(
    "SELECT ord_start, ord_end FROM notes WHERE kind = 'note' AND ord_start <= ? AND ord_end >= ?",
    [hi, lo],
  );
  const out = new Set<number>();
  for (const r of rows) for (let o = Math.max(lo, r.ord_start); o <= Math.min(hi, r.ord_end); o++) out.add(o);
  // A verse with cross-references has See also to show, so it offers Understand too (edge case 6).
  const from = await db.getAllAsync<{ from_ord: number }>("SELECT DISTINCT from_ord FROM xrefs WHERE from_ord BETWEEN ? AND ?", [lo, hi]);
  for (const r of from) out.add(r.from_ord);
  return out;
}

/** Every profile in the book's file: a few dozen at most (John has 13), matched against verse text in JS. */
export async function getProfiles(db: Db): Promise<StudyNoteRow[]> {
  return db.getAllAsync<StudyNoteRow>(`SELECT ${COLUMNS} FROM notes WHERE kind = 'profile' ORDER BY ord_start, id`, []);
}

export async function getProfile(db: Db, id: number): Promise<StudyNoteRow | null> {
  return db.getFirstAsync<StudyNoteRow>(`SELECT ${COLUMNS} FROM notes WHERE kind = 'profile' AND id = ?`, [id]);
}

/** Cross-references from the verse, best-voted first; the file keeps XREFS_PER_VERSE of them. */
export async function getXrefs(db: Db, ord: number): Promise<StudyXref[]> {
  const rows = await db.getAllAsync<StudyXref>(
    "SELECT to_ord_start, to_ord_end, votes FROM xrefs WHERE from_ord = ? ORDER BY votes DESC, to_ord_start, to_ord_end LIMIT ?",
    [ord, XREFS_PER_VERSE],
  );
  return rankXrefs(rows);
}

export async function getStudySources(db: Db): Promise<StudySource[]> {
  return db.getAllAsync<StudySource>(
    "SELECT key, name, license, license_notice, attribution, homepage, modifications FROM sources ORDER BY id",
    [],
  );
}

/** A downloaded file is the book it claims and a format this build reads, before it is ever shown. */
export async function checkStudyFile(db: Db, book: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM meta WHERE key IN ('format', 'book')", []);
  const meta = new Map(rows.map((r) => [r.key, r.value]));
  return meta.get("book") === book && Number(meta.get("format")) === STUDY_FORMAT;
}
