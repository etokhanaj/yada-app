/**
 * The system surfaces (canvas SX-01–23; IA-13), fed from the app:
 * - the widgets and Lock Screen accessories: the reading place in its passage and two weeks of "A passage
 *   for today", BSB text only (SX-01–08);
 * - what is playing, for the Listen buttons and the Control Center toggle (SX-05, SX-09);
 * - Spotlight: every BSB verse and every chapter, once per core version (SX-12);
 * - the doors back in (Siri, App Shortcuts, Spotlight, widget buttons): each lands at depth 0 or 1, never a
 *   sheet on a sheet; the Listen and stop/repeat doors act without opening the app.
 *
 * Every word handed to the system passes lib/systemSurfaces.ts maySurfaceText (rule 9).
 */

import { BOOK_CODES, BOOK_ORDER, type BookCode, ordToParts, parseVerseId, verseOrd } from "@yada/schema";
import type { SQLiteDatabase } from "expo-sqlite";

import { system } from "../../modules/yada-system";
import { openFromOutside, openHref } from "../components/navigation";
import { listen, pause, resume, setRepeat, setStop } from "./audio";
import { loadMcheyne, loadYourPlan } from "./plans";
import { type Db, getChapter, type VerseText } from "./queries";
import { loadProgress } from "./startHere";
import { loadPassageFor, loadPericopes } from "./understand";
import { loadPosition, loadSettings, saveSetting } from "./user";
import { pericopeForVerse, type PericopeRow } from "../lib/pericopes";
import { MCHEYNE_READINGS, nextPortion } from "../lib/plans";
import { parsePsalter, type PsalterChoice, setForChoice } from "../lib/dailyPsalms";
import { chapterTitle } from "../lib/reader";
import { verseLabel } from "../lib/saved";
import { nextPassage } from "../lib/startHere";
import {
  type ContinueData,
  type ListeningData,
  placeInPassage,
  psalmTitleLine,
  rangeRef,
  surfaceText,
  type SurfaceVerse,
  type TodayData,
  todayReading,
  type WatchPart,
  watchPart,
} from "../lib/systemSurfaces";
import { dayOf, type Part, partOf } from "../lib/today";
import { currentVerse, useAudio } from "../state/audio";
import { CORE_BUNDLE } from "./bundles";
import { dayVerse } from "./today";

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const url = openHref;

/** The widgets always show the BSB, whatever the reader reads (rule 9; SX-01: "John 5:6 · BSB"). */
const WIDGET_TEXT = "BSB";

const asSurface = (v: VerseText, text = v.text): SurfaceVerse => ({ n: v.verse, text: surfaceText(WIDGET_TEXT, text) });

/** SX-01, SX-02: the place, in its passage (or its chapter where the book has none), with the verses around it. */
async function continueData(user: SQLiteDatabase, core: Db): Promise<ContinueData | null> {
  const id = await loadPosition(user);
  const place = id === null ? null : parseVerseId(id);
  if (place === null) return null;
  const ord = verseOrd(place.book, place.chapter, place.verse);
  const verses = await getChapter(core, place.book, place.chapter, WIDGET_TEXT);
  const at = verses.findIndex((v) => v.verse >= place.verse);
  if (at < 0) return null;
  const passage = await loadPassageFor(place.book, ord).catch(() => null);
  const first = verses[0]?.ord ?? ord;
  const last = verses[verses.length - 1]?.ord ?? ord;
  const start = passage?.startOrd ?? first;
  const end = passage?.endOrd ?? last;
  const around = verses.slice(Math.max(0, at - 1), at + 2).map((v) => asSurface(v, psalmTitleLine(place.book, v.verse, v.text).body));
  return {
    title: passage?.label ?? chapterTitle(place.book, place.chapter),
    span: passage === null ? chapterTitle(place.book, place.chapter) : rangeRef(start, end),
    ref: verseLabel(place),
    short: `${place.chapter}:${place.verse}`,
    book: place.book,
    chapter: place.chapter,
    verse: place.verse,
    position: placeInPassage(ord, start, end),
    verses: around,
    url: url(place.book, place.chapter, place.verse),
  };
}

/** DR-07, SX-03, SX-04: one day's and part's reading, its BSB title set apart (decision 1), its first three verses. */
async function todayData(core: Db, date: Date, part: Part, choice: PsalterChoice): Promise<TodayData> {
  const reading = todayReading(date, part, choice);
  const verses = (await getChapter(core, reading.book, reading.chapter, WIDGET_TEXT)).filter((v) => v.verse >= reading.verse).slice(0, 3);
  const split = psalmTitleLine(reading.book, verses[0]?.verse ?? 0, verses[0]?.text ?? "");
  return {
    ...reading,
    date: day(date),
    titleLine: split.title,
    verses: verses.map((v, i) => asSurface(v, i === 0 ? split.body : v.text)),
    url: url(reading.book, reading.chapter, reading.verse),
  };
}

/** What the Today widget shows now, under Settings › Daily psalms (DR-07): Listen and Siri's "today's psalm" go there. */
async function todayNow(user: SQLiteDatabase): Promise<{ book: BookCode; chapter: number; verse: number }> {
  const now = new Date();
  const r = todayReading(dayOf(now), partOf(now), parsePsalter((await loadSettings(user))["dailyPsalms"]));
  return { book: r.book, chapter: r.chapter, verse: r.verse };
}

/**
 * SX-01–08, DR-07: the place, and Today's reading for each morning and evening two weeks ahead; the widget's timeline
 * turns at 03:00 and 17:00 as Today does (lib/today.ts). A change in Settings › Daily psalms reaches it when the app
 * next goes to the background, as the place does.
 */
export async function updateWidgets(user: SQLiteDatabase, core: Db): Promise<void> {
  if (system === null) return;
  // The watch first and on its own: it was sent only after the widgets' data, so a failure there left the watch with
  // nothing (John's watch, 18 Oct 2026).
  const watch = watchParts(user, core).then((parts) => system?.setWatchData(JSON.stringify({ parts })));
  // Handled now, so a failure while the widgets are still loading is not an unhandled rejection; `finally` rethrows it.
  watch.catch(() => undefined);
  try {
    const cont = await continueData(user, core);
    const choice = parsePsalter((await loadSettings(user))["dailyPsalms"]);
    const first = dayOf(new Date());
    const today: TodayData[] = [];
    for (let d = 0; d < 14; d++) {
      const date = new Date(first);
      date.setDate(first.getDate() + d);
      for (const part of ["morning", "evening"] as const) today.push(await todayData(core, date, part, choice));
    }
    system.setWidgetData(JSON.stringify({ continue: cont, today }));
  } finally {
    await watch;
  }
}

/**
 * AW-01, AW-03: a week of mornings and evenings for the watch, so its widgets turn each part over without the
 * phone. The day's verse in the BSB (rule 9); the psalms as Settings › Daily psalms chooses them.
 */
async function watchParts(user: SQLiteDatabase, core: Db): Promise<WatchPart[]> {
  const choice = parsePsalter((await loadSettings(user))["dailyPsalms"]);
  const now = Date.now();
  const first = dayOf(new Date());
  const parts: WatchPart[] = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date(first.getFullYear(), first.getMonth(), first.getDate() + d);
    for (const part of ["morning", "evening"] as const) {
      const verse = await dayVerse(core, WIDGET_TEXT, day, part);
      parts.push(watchPart(day, part, verse, setForChoice(day, part, choice)));
    }
  }
  return parts.filter((p) => p.until > now);
}

/**
 * The Listen buttons and Control Center learn what plays (SX-05, SX-09); their commands and the headphones' reach the
 * reading through Speech's onRemote (data/audio.ts). The lock screen, Dynamic Island and the watch show iOS's own Now Playing, which data/audio.ts
 * fills: Yada's Live Activity duplicated it on the lock screen and was removed (John, 19 Oct 2026, after Apple Music
 * and Spotify, which show only Now Playing). Returns the unsubscribe.
 */
export function followListening(): () => void {
  if (system === null) return () => undefined;
  // A session lives in memory only, so one left by a killed app is gone, and the App Group's "playing" with it,
  // or widgets showed Pause (review, 15 Oct 2026).
  if (useAudio.getState().session === null) system.setListening("");
  let listening = "";
  const update = () => {
    const s = useAudio.getState().session;
    const verse = s === null ? undefined : currentVerse(s);
    const heard: ListeningData | null =
      s === null || verse === undefined || s.status === "finished"
        ? null
        : { book: s.book, chapter: s.chapter, verse: verse.verse, ref: verseLabel({ book: s.book, chapter: s.chapter, verse: verse.verse }), playing: s.status === "playing" };
    const key = JSON.stringify(heard);
    if (key === listening) return;
    listening = key;
    system?.setListening(heard === null ? "" : key);
  };
  const unsubscribe = useAudio.subscribe(update);
  return unsubscribe;
}

/** SX-12: the BSB in Spotlight, every verse and every chapter, once per core version, in batches. */
export async function indexSpotlight(user: SQLiteDatabase, core: Db): Promise<void> {
  if (system === null || CORE_BUNDLE === undefined) return;
  const done = (await loadSettings(user))["spotlight"];
  // ".2": chapters joined the index in build 6 (SX-12), so a phone indexed before indexes again. ".3": each
  // chapter carries its first passage's name, and from iOS 18 Read and Listen (build 10).
  const version = `${CORE_BUNDLE.version}.3`;
  if (done === version) return;
  await system.clearIndex().catch(() => undefined);
  const rows = await core.getAllAsync<{ ord: number; text: string }>("SELECT ord, text FROM texts WHERE translation = 'BSB' AND text <> '' ORDER BY ord", []);
  for (let i = 0; i < rows.length; i += 1000) {
    const items = rows.slice(i, i + 1000).map((r) => {
      const p = ordToParts(r.ord);
      const name = BOOK_CODES[p.book].name;
      return {
        id: `${p.book}.${p.chapter}.${p.verse}`,
        title: `${name} ${p.chapter}:${p.verse}`,
        text: r.text,
        keywords: [`${name} ${p.chapter} ${p.verse}`, `${name} ${p.chapter}:${p.verse}`, `${p.book} ${p.chapter}:${p.verse}`].join("|"),
      };
    });
    await system.indexVerses(items);
  }
  // A chapter with its first verse whole, as SX-12 shows it, so "psalm 23" finds the psalm itself first, under the
  // name of the passage it opens with ("The Lord is my shepherd") where the book's passages are on the phone.
  const chapters = rows.filter((r) => r.ord % 1000 === 1);
  const passages = new Map<BookCode, readonly PericopeRow[]>();
  for (const book of new Set(chapters.map((r) => ordToParts(r.ord).book))) passages.set(book, await loadPericopes(book).catch((): PericopeRow[] => []));
  for (let i = 0; i < chapters.length; i += 500) {
    const items = chapters.slice(i, i + 500).map((r) => {
      const p = ordToParts(r.ord);
      const title = chapterTitle(p.book, p.chapter);
      const name = pericopeForVerse(passages.get(p.book) ?? [], r.ord)?.label ?? "";
      return { id: `${p.book}.${p.chapter}`, title, name, text: r.text, keywords: [title, `${BOOK_CODES[p.book].name} ${p.chapter}`, `${p.book} ${p.chapter}`].join("|") };
    });
    await system.indexChapters(items);
  }
  await saveSetting(user, "spotlight", version);
}

/** The place, or today's psalm where there is none: what Listen in Continue and Control Center plays. */
async function placeOf(user: SQLiteDatabase): Promise<{ book: BookCode; chapter: number; verse: number } | null> {
  const id = await loadPosition(user);
  const v = id === null ? null : parseVerseId(id);
  return v === null ? null : { book: v.book, chapter: v.chapter, verse: v.verse };
}

/** "PSA.23" or "JHN.3.16" from Siri and Spotlight. */
function chapterOrVerse(id: string): { book: BookCode; chapter: number; verse: number } | null {
  const v = parseVerseId(id);
  if (v !== null) return { book: v.book, chapter: v.chapter, verse: v.verse };
  const [book, chapter] = id.split(".");
  const c = Number(chapter);
  if (book === undefined || !(BOOK_ORDER as readonly string[]).includes(book) || !Number.isInteger(c)) return null;
  const code = book as BookCode;
  return c >= 1 && c <= BOOK_CODES[code].chapters ? { book: code, chapter: c, verse: 1 } : null;
}

/**
 * Listen from a widget, the Lock Screen, Control Center or Siri (SX-05, SX-07, SX-09, SX-10): the same button
 * pauses what it started, so a second press is Pause, as the widget draws it.
 */
async function listenTo(target: { book: BookCode; chapter: number; verse: number }): Promise<void> {
  const s = useAudio.getState().session;
  if (s !== null && s.book === target.book && s.chapter === target.chapter && s.status !== "finished") {
    if (s.status === "playing") pause();
    else resume();
    return;
  }
  await listen(target.book, target.chapter, target.verse);
}

/**
 * A door from outside (IA-13). Opening: "verse:JHN.3.16" and "chapter:PSA.23" from Spotlight and Siri,
 * "continue", "today" and "listen-next" from Siri or a shortcut. Acting without opening: "listen:today",
 * "listen:continue", "listen:PSA.23", "pause", "stop:chapter", "repeat:passage" (SX-05, SX-09, SX-11).
 * Listen reads the BSB under a licensed page (NT-05, IA-13; data/audio.ts audioTranslation).
 */
export async function openDoor(door: string, user: SQLiteDatabase): Promise<void> {
  if (door.startsWith("verse:") || door.startsWith("chapter:")) {
    const v = chapterOrVerse(door.slice(door.indexOf(":") + 1));
    if (v !== null) openFromOutside(v);
    return;
  }
  if (door === "continue") {
    const v = await placeOf(user);
    openFromOutside(v === null ? null : { ...v, resume: true });
    return;
  }
  if (door === "today") {
    openFromOutside(await todayNow(user));
    return;
  }
  if (door === "listen-next") {
    const target = await nextToRead(user);
    if (target === null) return;
    openFromOutside({ book: target.book, chapter: target.chapter, verse: target.verse, resume: true });
    await listen(target.book, target.chapter, target.verse);
    return;
  }
  if (door === "listen:today") return listenTo(await todayNow(user));
  if (door === "listen:continue") {
    // Control Center's toggle carries on what was playing; with nothing begun, the place.
    const s = useAudio.getState().session;
    if (s !== null && s.status === "paused") return resume();
    const place = await placeOf(user);
    return listenTo(place ?? (await todayNow(user)));
  }
  if (door.startsWith("listen:")) {
    const v = chapterOrVerse(door.slice("listen:".length));
    if (v !== null) await listenTo(v);
    return;
  }
  if (door === "pause") return pause();
  // SX-11's two build-6 shortcuts act on what is playing, as the player's menu does (LB-02, LB-05).
  const s = useAudio.getState().session;
  if (s === null) return;
  if (door === "stop:chapter") setStop("chapter");
  if (door === "repeat:passage") {
    const passages = await loadPericopes(s.book).catch((): PericopeRow[] => []);
    setRepeat(passages.length > 0 ? "passage" : "chapter");
  }
}

/** The next passage of the reader's plan: John's next passage, or M'Cheyne's next portion. */
async function nextToRead(user: SQLiteDatabase): Promise<{ book: BookCode; chapter: number; verse: number } | null> {
  if ((await loadYourPlan(user)) === "mcheyne") {
    const n = nextPortion(await loadMcheyne(user));
    const first = n === null ? undefined : MCHEYNE_READINGS[n.reading]?.[n.portion]?.[0];
    return first === undefined ? null : { book: first.b, chapter: first.c, verse: first.vs ?? 1 };
  }
  const p = await loadProgress(user);
  const i = nextPassage(p.passages.length, p.read, p.lastFinished);
  const passage = i === null ? undefined : p.passages[i];
  if (passage === undefined) return null;
  const s = ordToParts(passage.start_ord);
  return { book: s.book, chapter: s.chapter, verse: s.verse };
}

/** The doors' listener, and the one a cold launch left waiting. Returns the unsubscribe. */
export function watchDoors(user: SQLiteDatabase): () => void {
  if (system === null) return () => undefined;
  // "Read Psalm 23 in Yada" (SX-10, SX-11): Siri learns the chapters it may hear.
  system.updateShortcuts();
  // The door waits in the module until taken: here at launch, and each time it says one arrived.
  const take = () => {
    const door = system?.takePendingOpen() ?? null;
    if (door !== null) void openDoor(door, user);
  };
  take();
  const sub = system.addListener("onOpen", take);
  return () => sub.remove();
}
