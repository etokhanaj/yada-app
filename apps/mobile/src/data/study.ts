/**
 * Per-book study bundles (`study-jhn.v1.db`): Tyndale's notes and OpenBible's cross-references,
 * downloaded on demand through data/bookFiles.ts, listed by the published manifest's `study` entries.
 *
 * Nothing asks first (canvas SN brief 4): ensureStudy fetches a book's file the first time the
 * book opens while online. Understand shows one line while it runs, if it failed, or offline.
 *
 * Nothing read here leaves the phone, and nothing here is passed to any model (CLAUDE.md rule 9:
 * the notes quote the NLT). The app makes no AI calls at all; the pipeline's side of this is held
 * by packages/pipeline/src/ai-boundary.test.ts.
 */

import { type BookCode } from "@yada/schema";
import { type SQLiteDatabase } from "expo-sqlite";

import { guideNote, isBookQuery, parseStudyCatalogue, peopleInVerse, profileMatches, type StudyCatalogueEntry, type StudyNoteRow } from "../lib/study";
import { asDb } from "./AppData";
import { createBookFiles } from "./bookFiles";
import { BUNDLED_STUDY } from "./bundled.generated";
import type { PassageNoteSource } from "./passageNote";
import {
  checkStudyFile,
  getProfile,
  getPassageNote,
  getProfiles,
  getStudyNotes,
  getStudyNotesInRange,
  getStudySources,
  getXrefs,
  noteOrdsInRange,
  type StudySource,
  type StudyXref,
} from "./studyQueries";

const files = createBookFiles<StudyCatalogueEntry>({
  kind: "study",
  shipped: BUNDLED_STUDY,
  parseCatalogue: parseStudyCatalogue,
  checkFile: checkStudyFile,
});

export const useStudy = files.useStore;
export const openInstalledStudy = files.openInstalled;
export const openStudy = files.open;
export const removeStudy = files.remove;
export const cancelStudyDownloads = files.cancelAll;

/** The first time a book opens online its notes (about 125 KB for John) download; a failure waits for "Try again". */
export function ensureStudy(user: SQLiteDatabase, book: BookCode, retry = false): Promise<void> {
  return files.ensure(user, book, retry);
}

export interface VerseStudy {
  readonly notes: StudyNoteRow[];
  readonly xrefs: StudyXref[];
  /** The book's profiles named in the verse's BSB text (canvas TD-01). */
  readonly people: StudyNoteRow[];
}

/** The verse's notes, cross-references and people, or null when the book's notes are not on the phone. */
export async function loadVerseStudy(book: BookCode, ord: number, bsbText: string): Promise<VerseStudy | null> {
  const db = await openStudy(book);
  if (db === null) return null;
  const [notes, xrefs, profiles] = await Promise.all([getStudyNotes(asDb(db), ord), getXrefs(asDb(db), ord), getProfiles(asDb(db))]);
  return { notes, xrefs, people: peopleInVerse(profiles, bsbText, book, ord) };
}

/**
 * Tyndale's note on a whole passage, for the passage guide's opener: the shortest ranged note
 * covering the pericope, or null (also while the book's notes are not on the phone). The guide
 * shows it as published with TYNDALE_SHORT beside it, and replaces it with Yada's own reviewed
 * opener once there is one.
 */
export async function loadPassageNote(book: BookCode, startOrd: number, endOrd: number): Promise<StudyNoteRow | null> {
  const db = await openStudy(book);
  return db === null ? null : getPassageNote(asDb(db), startOrd, endOrd);
}

/** Every Tyndale note touching a passage (WM-05), or null while the book's notes are not on the phone. */
export async function loadRangeNotes(book: BookCode, lo: number, hi: number): Promise<StudyNoteRow[] | null> {
  const db = await openStudy(book);
  return db === null ? null : getStudyNotesInRange(asDb(db), lo, hi);
}

/** The passage guide's fallback opener (registerPassageNoteSource, data/passageNote.ts): lib/study.ts guideNote. */
export const passageNoteSource: PassageNoteSource = async ({ book, startOrd, endOrd }) => {
  const row = await loadPassageNote(book, startOrd, endOrd);
  return row === null ? null : guideNote(row.text);
};

/**
 * Verses of a chapter with something for Understand to show: a study note, a cross-reference, or a
 * person named in the verse's BSB text (the rule loadVerseStudy applies), so the bar offers
 * Understand exactly where it would open with something in it (edge case: Understand never opens
 * empty). Empty while the book's notes are not on the phone.
 */
export async function loadStudyOrds(
  book: BookCode,
  lo: number,
  hi: number,
  bsb: ReadonlyArray<{ ord: number; text: string }> = [],
): Promise<Set<number>> {
  const db = await openStudy(book);
  if (db === null) return new Set();
  const [out, profiles] = await Promise.all([noteOrdsInRange(asDb(db), lo, hi), getProfiles(asDb(db))]);
  for (const v of bsb) if (!out.has(v.ord) && peopleInVerse(profiles, v.text, book, v.ord).length > 0) out.add(v.ord);
  return out;
}

export async function loadProfile(book: BookCode, id: number): Promise<StudyNoteRow | null> {
  const db = await openStudy(book);
  return db === null ? null : getProfile(asDb(db), id);
}

/** OR-03: the book's Tyndale profiles, in the order they appear; none while its study file is not on the phone. */
export async function loadBookProfiles(book: BookCode): Promise<StudyNoteRow[]> {
  const db = await openStudy(book);
  return db === null ? [] : getProfiles(asDb(db));
}

/** Profiles in every downloaded book whose name matches a search (canvas TD-03). */
export async function searchProfiles(query: string): Promise<Array<StudyNoteRow & { book: BookCode }>> {
  const out: Array<StudyNoteRow & { book: BookCode }> = [];
  // "John" is the book, not John the Baptist (edge case 1).
  if (isBookQuery(query)) return out;
  for (const row of Object.values(useStudy.getState().installed)) {
    if (row === undefined) continue;
    const db = await openStudy(row.book);
    if (db === null) continue;
    for (const p of await getProfiles(asDb(db))) {
      if (typeof p.title === "string" && profileMatches(p.title, query)) out.push({ ...p, book: row.book });
    }
  }
  return out;
}

/** The licence rows inside a downloaded file (rule 3: read from the file, not written into the app). */
export async function loadStudySources(): Promise<StudySource[]> {
  for (const row of Object.values(useStudy.getState().installed)) {
    if (row === undefined) continue;
    const db = await openStudy(row.book);
    if (db !== null) return getStudySources(asDb(db));
  }
  return [];
}

