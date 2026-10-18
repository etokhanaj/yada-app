/**
 * What Today shows (build 7a; canvas DR-11, DR-12, XT-01): read fresh on every focus, so a reading just finished
 * or a plan changed elsewhere shows at once. Every text on screen is the reader's own translation where it has the
 * verse, otherwise the BSB, labelled (decision 6 of the UX stress test; rule 9 only limits system surfaces).
 */

import { type BookCode, ordToParts, parseVerseId, verseOrd } from "@yada/schema";
import type { SQLiteDatabase } from "expo-sqlite";

import { openDevotional } from "./bundles";
import { DAY_PICTURES } from "./pictures.generated";
import { loadMcheyne, loadYourPlan } from "./plans";
import { type Db, getTexts } from "./queries";
import { loadProgress } from "./startHere";
import { loadDays, loadPositionAt, loadSettings } from "./user";
import { label as psalmsLabel, parsePsalter, type PsalmSet, setForChoice } from "../lib/dailyPsalms";
import { verseFor } from "../lib/dailyLight";
import { MCHEYNE_TOTAL, nextPortion, portionLabel, MCHEYNE_READINGS } from "../lib/plans";
import { excerptOf, shortRef } from "../lib/reader";
import { DAILY_LIGHT_DATASET, PICTURES_DATASET, type SourceInput, SPURGEON_DATASET } from "../lib/sources";
import { homeLead } from "../lib/startHere";
import { type Rhythm, rhythmOf, todayKey } from "../lib/rhythm";
import { dayOf, mmdd, opening, type Part, partOf } from "../lib/today";

export interface Place {
  readonly book: BookCode;
  readonly chapter: number;
  readonly verse: number;
}

export interface TodayData {
  readonly day: Date;
  readonly part: Part;
  /** The day's verse (Daily Light's headline for this morning or evening). */
  readonly verse: { readonly text: string; readonly ref: string; readonly place: Place; readonly bsb: boolean } | null;
  /** This part's psalms and the other part's, for Later / Earlier. Null when Settings › Daily psalms is Off; no
   *  other under One a day (DR-04). */
  readonly psalms: { readonly label: string; readonly opening: string; readonly place: Place } | null;
  readonly other: { readonly part: Part; readonly label: string; readonly place: Place } | null;
  /** Daily prayer (DO-01), mornings only, when Settings › Daily psalms is Daily prayer: the Venite's first words. */
  readonly office: { readonly opening: string } | null;
  readonly devotional: { readonly heading: string; readonly ref: string; readonly key: string; readonly part: Part } | null;
  /** Your plan's next reading, or "A place to start" before anything has been read (XT-01). */
  readonly plan:
    | { readonly kind: "start" }
    | { readonly kind: "john"; readonly title: string; readonly sub: string; readonly count: string; readonly place: Place }
    | { readonly kind: "mcheyne"; readonly title: string; readonly sub: string; readonly place: Place };
  /** The lamp: none before a day has ever counted (XT-01). */
  readonly rhythm: Rhythm;
}

async function textOf(core: Db, place: Place, translation: string): Promise<{ text: string; bsb: boolean }> {
  const ord = verseOrd(place.book, place.chapter, place.verse);
  if (ord === null) return { text: "", bsb: false };
  const texts = await getTexts(core, ord);
  const own = texts[translation];
  return own === undefined ? { text: texts["BSB"] ?? "", bsb: translation !== "BSB" } : { text: own, bsb: false };
}

const psalmPlace = (set: PsalmSet): Place => {
  const first = set[0];
  return { book: "PSA", chapter: first?.psalm ?? 1, verse: first?.from ?? 1 };
};

export async function loadToday(core: Db, user: SQLiteDatabase, translation: string, now = new Date()): Promise<TodayData> {
  const day = dayOf(now);
  const part = partOf(now);
  const otherPart: Part = part === "morning" ? "evening" : "morning";

  const choice = parsePsalter((await loadSettings(user))["dailyPsalms"]);
  const set = setForChoice(day, part, choice);
  let psalms: TodayData["psalms"] = null;
  if (set !== null) {
    const place = psalmPlace(set);
    const first = await textOf(core, place, translation);
    psalms = { label: psalmsLabel(set), opening: opening(excerptOf(first.text)), place };
  }

  const ref = verseFor(day, part);
  let verse: TodayData["verse"] = null;
  {
    const vPlace = { book: ref.book as BookCode, chapter: ref.chapter, verse: ref.verse };
    const v = await textOf(core, vPlace, translation);
    if (v.text !== "") verse = { text: excerptOf(v.text), ref: shortRef(vPlace), place: vPlace, bsb: v.bsb };
  }

  let devotional: TodayData["devotional"] = null;
  const db = await openDevotional().catch(() => null);
  if (db !== null) {
    const key = mmdd(day);
    const row = await db
      .getFirstAsync<{ heading: string; ref: string }>(
        "SELECT heading, ref FROM entries WHERE mmdd = ? AND part IN (?, ?) AND status != 'rejected'",
        [key, part, part === "morning" ? "am" : "pm"],
      )
      .catch(() => null);
    if (row !== null) devotional = { heading: row.heading, ref: row.ref, key, part };
  }

  const [yourPlan, progress, saved] = await Promise.all([loadYourPlan(user), loadProgress(user), loadPositionAt(user)]);
  let plan: TodayData["plan"] = { kind: "start" };
  if (yourPlan === "mcheyne") {
    const next = nextPortion(await loadMcheyne(user));
    const portion = next === null ? undefined : MCHEYNE_READINGS[next.reading]?.[next.portion];
    if (next !== null && portion !== undefined) {
      plan = {
        kind: "mcheyne",
        title: portionLabel(portion),
        sub: `Reading ${next.reading + 1} of ${MCHEYNE_TOTAL}`,
        place: { book: portion[0]?.b ?? "GEN", chapter: portion[0]?.c ?? 1, verse: portion[0]?.vs ?? 1 },
      };
    }
  } else {
    const pos = saved === null ? null : parseVerseId(saved.id);
    const posOrd = pos === null ? null : verseOrd(pos.book, pos.chapter, pos.verse);
    const lead = homeLead({
      passages: progress.passages,
      read: progress.read,
      lastFinished: progress.lastFinished,
      place: pos === null || posOrd === null ? null : { book: pos.book, ord: posOrd },
    });
    const index = lead.kind === "next" ? lead.passage : lead.kind === "continue" ? (lead.johnNext ?? null) : null;
    const p = index === null ? undefined : progress.passages[index];
    // The card is titled The Gospel of John: a place elsewhere (today's psalm) is Bible's Continue, not the
    // plan's, so here the plan's next passage leads instead (simulator, 15 Oct 2026: "Psalms 78:1").
    if (lead.kind === "continue" && pos !== null && pos.book === "JHN") {
      plan = { kind: "john", title: shortRef(pos), sub: "Continue", count: `${progress.read.size} of ${progress.passages.length}`, place: pos };
    } else if (p !== undefined) {
      const start = ordToParts(p.start_ord);
      plan = { kind: "john", title: p.label, sub: shortRef(start), count: `${progress.read.size + 1} of ${progress.passages.length}`, place: start };
    }
  }

  const otherSet = choice === "1662" ? setForChoice(day, otherPart, choice) : null;
  // The office's words are the BSB's, whatever the reader's translation (Daily prayer is built on the BSB).
  const office = choice === "office" && part === "morning" ? { opening: opening(excerptOf((await textOf(core, { book: "PSA", chapter: 95, verse: 1 }, "BSB")).text)) } : null;
  return {
    day,
    part,
    verse,
    psalms,
    other: otherSet === null ? null : { part: otherPart, label: psalmsLabel(otherSet), place: psalmPlace(otherSet) },
    office,
    devotional,
    plan,
    rhythm: rhythmOf(await loadDays(user), todayKey(now)),
  };
}

/**
 * Sources and licences for Today (review, 16 Oct 2026: build 7a's sources were not listed). Spurgeon's licence is
 * read from the bundle's own meta row, copied from the CCEL file (rule 3); Daily Light's from its CCEL header
 * (`<DC.Rights>Public Domain</DC.Rights>`, content/raw/daily-light); the pictures' from each one's manifest entry.
 */
export async function todaySources(): Promise<SourceInput[]> {
  const rows: SourceInput[] = [];
  const db = await openDevotional().catch(() => null);
  const meta = db === null ? [] : await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM meta").catch(() => []);
  const get = (key: string) => meta.find((m) => m.key === key)?.value;
  const licence = get("licence");
  if (licence !== undefined) {
    rows.push({ dataset: SPURGEON_DATASET, license: /Public Domain/i.test(licence) ? "PUBLIC_DOMAIN" : licence, url: get("source_url") ?? "" });
  }
  rows.push({ dataset: DAILY_LIGHT_DATASET, license: "PUBLIC_DOMAIN", url: "https://www.ccel.org/ccel/anonymous/daily_light.html" });
  const licences = [...new Set(DAY_PICTURES.map((p) => p.licence))];
  if (licences.length > 0) rows.push({ dataset: PICTURES_DATASET, license: licences.join(" and "), url: "https://commons.wikimedia.org" });
  return rows;
}
