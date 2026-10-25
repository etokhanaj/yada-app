/**
 * The rows Choose a verse (SW-02) lists, each with its words: Today's verses, what the reader saved, the moods'
 * passages and what they explored lately, or what a search finds. Long passages are left out (`sittable`).
 */

import { ordToParts, parseVerseId } from "@yada/schema";
import type { SQLiteDatabase } from "expo-sqlite";

import { MOMENTS, passageLabel } from "../lib/moments";
import { verseLabel } from "../lib/saved";
import { planSearch } from "../lib/searchQuery";
import { mergeSaved } from "../lib/sitChoices";
import { sittable } from "../lib/sit";
import { psalmTitleLine } from "../lib/systemSurfaces";
import type { HighlightColor } from "../lib/highlights";
import { dayOf } from "../lib/today";
import type { SitVerse } from "../state/sit";
import { isLicensedCode } from "./licensed";
import { type Db, getTextsInRange, searchPassages } from "./queries";
import { dayVerse, textOf } from "./today";
import { listBookmarks, listHighlights, listNotes, recentlyExplored } from "./user";

export interface SitRow {
  readonly verse: SitVerse;
  /** "Today · morning", "Highlighted", "Anxious": under the reference. */
  readonly why: string | null;
  readonly color: HighlightColor | null;
}

async function verseRow(core: Db, translation: string, verseId: string): Promise<SitVerse | null> {
  const ref = parseVerseId(verseId);
  if (ref === null) return null;
  const v = await textOf(core, ref, translation);
  return v.text === "" ? null : { text: v.text, ref: verseLabel(ref), bsb: v.bsb, place: verseId };
}

export async function todayRows(core: Db, translation: string, now = new Date()): Promise<SitRow[]> {
  const day = dayOf(now);
  const parts = await Promise.all((["morning", "evening"] as const).map(async (part) => ({ part, v: await dayVerse(core, translation, day, part) })));
  return parts.flatMap(({ part, v }) =>
    v === null
      ? []
      : [{ verse: { text: v.text, ref: v.ref, bsb: v.bsb, place: `${v.place.book}.${v.place.chapter}.${v.place.verse}` }, why: part === "morning" ? "Morning" : "Evening", color: null }],
  );
}

export async function savedRows(core: Db, user: SQLiteDatabase, translation: string): Promise<SitRow[]> {
  const [bookmarks, highlights, notes] = await Promise.all([listBookmarks(user), listHighlights(user), listNotes(user)]);
  const kept = mergeSaved(bookmarks, highlights, notes).slice(0, 60);
  const rows = await Promise.all(kept.map(async (k) => ({ k, v: await verseRow(core, translation, k.verseId) })));
  return rows.flatMap(({ k, v }) => (v === null ? [] : [{ verse: v, why: k.kept, color: k.color }]));
}

export async function moodRows(core: Db, translation: string): Promise<SitRow[]> {
  const rows = await Promise.all(
    MOMENTS.flatMap((m) =>
      m.passages.map(async (q): Promise<SitRow | null> => {
        const texts = await getTextsInRange(core, q.start, q.end);
        // The moods are the BSB's (rule 9 and moment.tsx); a psalm's printed title is not what the mood is for.
        const text = texts
          .map((r) => {
            const t = r.texts.BSB ?? "";
            const at = ordToParts(r.ord);
            return at.verse === 1 ? psalmTitleLine(at.book, at.verse, t).body : t;
          })
          .join(" ");
        const a = ordToParts(q.start);
        if (!sittable(text)) return null;
        return { verse: { text, ref: passageLabel(q), bsb: translation !== "BSB", place: `${a.book}.${a.chapter}.${a.verse}` }, why: m.name, color: null };
      }),
    ),
  );
  return rows.filter((r) => r !== null);
}

export async function recentRows(core: Db, user: SQLiteDatabase, translation: string): Promise<SitRow[]> {
  const recent = await recentlyExplored(user, 30);
  const rows = await Promise.all(recent.map((r) => verseRow(core, translation, r.verse_id)));
  return rows.flatMap((v) => (v === null || !sittable(v.text) ? [] : [{ verse: v, why: null, color: null }]));
}

/** A reference opens that verse; words find verses in Bible order, as Search's verse results do. */
export async function searchRows(core: Db, translation: string, query: string): Promise<SitRow[]> {
  const plan = planSearch(query);
  if (plan.reference !== null) {
    const r = plan.reference;
    const v = await verseRow(core, translation, `${r.book}.${r.chapter}.${r.verse ?? 1}`);
    return v === null ? [] : [{ verse: v, why: null, color: null }];
  }
  if (plan.fts === null) return [];
  // A licensed translation is searched through its own proxy; Sit's words are the BSB's there (rule 9).
  const hits = await searchPassages(core, plan.fts, isLicensedCode(translation) ? "BSB" : translation, 40);
  const rows = await Promise.all(
    hits.map((h) => {
      const at = ordToParts(h.ord);
      return verseRow(core, translation, `${at.book}.${at.chapter}.${at.verse}`);
    }),
  );
  return rows.flatMap((v) => (v === null ? [] : [{ verse: v, why: null, color: null }]));
}
