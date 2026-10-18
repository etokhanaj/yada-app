/**
 * Which translations' words may leave Yada's own screens for the system (CLAUDE.md rule 9;
 * policy of 12 Oct 2026, docs/handoff-2026-10-12.md): Siri, Spotlight, App Intents and on-screen
 * entity data, Home Screen widgets and Live Activities carry only references and BSB, WEB, KJV or
 * LSV text. NIV, NKJV, NLT and MSG never: API.Bible §9.2 forbids AI use, and these surfaces feed
 * Apple Intelligence. Downloads stay out until each licence file is read for it (rule 3).
 *
 * Every surface takes its text through this gate (data/system.ts, data/reminder.ts). The rest of this
 * file is what the surfaces show (SX-01–23), pure so it can be tested.
 */

import { BOOK_CODES, type BookCode, ordToParts } from "@yada/schema";

import type { Repeat, Stop } from "./audio/stop";
import { type Segment, segmentFill } from "./audio/session";
import { verseFor } from "./dailyLight";
import { label as psalmsLabel, type PsalmSet, type PsalterChoice, setForChoice } from "./dailyPsalms";
import { chapterTitle } from "./reader";
import { verseLabel } from "./saved";
import { breathSplit } from "./sit";
import { type Part, partSpan, whenLabel } from "./today";

const SYSTEM_TEXT: ReadonlySet<string> = new Set(["BSB", "WEB", "KJV", "LSV"]);

export function maySurfaceText(translation: string): boolean {
  return SYSTEM_TEXT.has(translation);
}

/** A verse's text for a system surface, or "" for a translation the gate refuses. */
export function surfaceText(translation: string, text: string | undefined): string {
  return maySurfaceText(translation) ? (text ?? "") : "";
}

// ---------------------------------------------------------------------------
// A psalm's title line (build-6 decision 1: "Of David." set italic above the verse)
// ---------------------------------------------------------------------------

const QUOTE = "“[^”]*”";
/** Up to the sentence's end: a full stop (with a closing quote after it), or a closing quote itself. */
const TO_END = `(?:[^.“”]|${QUOTE})*?(?:\\.”?|(?<=”)|:)(?=\\s)`;

/**
 * The sentences the BSB prints as a psalm's title, read from its 150 first verses (core.v5). A run of these
 * at the start of verse 1 is the title; the first sentence that is none of them begins the psalm.
 */
const TITLE_SENTENCES: readonly RegExp[] = [
  /^For the choirmaster(?:,[^.:]*)?[.:](?=\s)/u,
  new RegExp(`^To the tune of ${TO_END}`, "u"),
  /^(?:With stringed instruments|According to|For Jeduthun|To bring remembrance)[^.]*\.(?=\s)/u,
  /^A (?:Psalm|psalm|Song|song|Maskil|Miktam|Prayer|prayer|Shiggaion|love song)\b[^.]*\.(?=\s)/u,
  /^Of (?:David|Solomon|Asaph|the sons of Korah)\b[^.]*\.(?=\s)/u,
  // Psalm 18's title ends "He said:".
  /^He said:(?=\s)/u,
];

/** Psalms 51, 52, 54 and 60 add the occasion after "… of David.": only there is "When…" title, not psalm (Ps 126:1). */
const OCCASION = new RegExp(`^(?:When|After) ${TO_END}`, "u");

/**
 * Verse 1 of a psalm split into the BSB's title and the psalm's first words. Display only: both are the
 * BSB's words unchanged, and `title + " " + body` is the verse (rule 4). No title found, the verse is whole.
 */
export function psalmTitleLine(book: BookCode, verse: number, text: string): { title: string | null; body: string } {
  if (book !== "PSA" || verse !== 1) return { title: null, body: text };
  let at = 0;
  let lastWasDavid = false;
  for (;;) {
    const rest = text.slice(at);
    const pattern = TITLE_SENTENCES.find((p) => p.test(rest)) ?? (lastWasDavid ? (OCCASION.test(rest) ? OCCASION : undefined) : undefined);
    const m = pattern?.exec(rest);
    if (m === undefined || m === null) break;
    lastWasDavid = /\bof David\b/.test(m[0]);
    const next = rest.slice(m[0].length).match(/^\s+/);
    if (next === null) break;
    at += m[0].length + next[0].length;
  }
  if (at === 0 || at >= text.length) return { title: null, body: text };
  return { title: text.slice(0, at).trimEnd(), body: text.slice(at) };
}

// ---------------------------------------------------------------------------
// References and the place hairline
// ---------------------------------------------------------------------------

/** "John 5:1–15", "John 4:43–5:15", "Psalm 138": a passage's span, as the frames write it. */
export function rangeRef(startOrd: number, endOrd: number): string {
  const a = ordToParts(startOrd);
  const b = ordToParts(endOrd);
  const head = chapterTitle(a.book, a.chapter);
  if (a.chapter === b.chapter) return a.verse === b.verse ? `${head}:${a.verse}` : `${head}:${a.verse}–${b.verse}`;
  return `${head}:${a.verse}–${b.chapter}:${b.verse}`;
}

/**
 * Where the place sits in its passage, 0 to 1, for the hairline (SX-01: a position, never a count): the
 * share of the passage's verses read up to and including the place.
 */
export function placeInPassage(ord: number, startOrd: number, endOrd: number): number {
  if (endOrd <= startOrd) return 1;
  const a = ordToParts(startOrd);
  const b = ordToParts(endOrd);
  const p = ordToParts(ord);
  // Within one chapter the ords count verses; across a chapter break the share is by chapter and verse.
  if (a.chapter === b.chapter) return clamp((ord - startOrd + 1) / (endOrd - startOrd + 1));
  const done = (p.chapter - a.chapter) * 1000 + p.verse - a.verse + 1;
  const all = (b.chapter - a.chapter) * 1000 + b.verse - a.verse + 1;
  return clamp(done / all);
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

// ---------------------------------------------------------------------------
// The App Group JSON the widgets read (targets/widget/Widgets.swift `Shared`)
// ---------------------------------------------------------------------------

export interface SurfaceVerse {
  readonly n: number;
  readonly text: string;
}

/** SX-01, SX-02, SX-07 (the ring), SX-09 (Continue): the reader's place. */
export interface ContinueData {
  /** The passage's name, "Healing at the pool"; the chapter where the book has no passages. */
  readonly title: string;
  /** "John 5:1–15". */
  readonly span: string;
  /** "John 5:6". */
  readonly ref: string;
  /** "5:6", the Lock Screen ring's figure. */
  readonly short: string;
  readonly book: BookCode;
  readonly chapter: number;
  readonly verse: number;
  readonly position: number;
  /** The verse before, the place, and the one after, BSB, for the large size (SX-02). */
  readonly verses: readonly SurfaceVerse[];
  readonly url: string;
}

/**
 * DR-07, SX-03, SX-04, SX-07, SX-08: the Today widget's reading for one day and part, BSB. It follows Settings ›
 * Daily psalms as Today does: the 1662 morning set until 17:00, then the evening's; One a day all day. Off and Daily
 * prayer have no psalms on Today's reading card, so the widget carries the day's verse, Today's headline, instead.
 */
export interface TodayData {
  /** "2026-11-01": Today's day (lib/today.ts dayOf), which turns at 03:00. */
  readonly date: string;
  readonly part: Part;
  /** "This morning", "This evening". */
  readonly overline: string;
  /** "Psalms 1–5", "Psalm 119:33–72", "Psalm 138"; the day's verse's reference, "Matthew 6:13". */
  readonly label: string;
  /** SX-03 small: the psalms' figures set large under their noun, "Psalms" over "1–5"; null for the day's verse. */
  readonly figure: { readonly over: string; readonly big: string } | null;
  /** Where Read and Listen begin. */
  readonly book: BookCode;
  readonly chapter: number;
  readonly verse: number;
  /** The chapters it covers, so its Listen shows Pause while any of them plays (SX-05). */
  readonly chapters: readonly number[];
  /** The BSB's title for a psalm read from verse 1, "Of David.", or null. */
  readonly titleLine: string | null;
  /** The first three verses, verse 1 of a psalm without its title. */
  readonly verses: readonly SurfaceVerse[];
  readonly url: string;
}

export type TodayReading = Pick<TodayData, "part" | "overline" | "label" | "figure" | "book" | "chapter" | "verse" | "chapters">;

/** What the Today widget, its Listen and Siri's "today's psalm" point at, for a day (lib/today.ts dayOf) and part. */
export function todayReading(day: Date, part: Part, choice: PsalterChoice): TodayReading {
  const overline = part === "morning" ? "This morning" : "This evening";
  const set = setForChoice(day, part, choice);
  const first = set?.[0];
  if (set !== null && first !== undefined) {
    const label = psalmsLabel(set);
    const over = set.length > 1 ? "Psalms" : "Psalm";
    return { part, overline, label, figure: { over, big: label.slice(over.length + 1) }, book: "PSA", chapter: first.psalm, verse: first.from ?? 1, chapters: set.map((r) => r.psalm) };
  }
  const ref = verseFor(day, part);
  const place = { book: ref.book, chapter: ref.chapter, verse: ref.verse };
  return { part, overline, label: verseLabel(place), figure: null, ...place, chapters: [place.chapter] };
}

/** What the Listen buttons and the Control Center toggle show (SX-05, SX-09). */
export interface ListeningData {
  readonly book: BookCode;
  readonly chapter: number;
  readonly verse: number;
  /** "John 1:5". */
  readonly ref: string;
  readonly playing: boolean;
}

// ---------------------------------------------------------------------------
// The listening Live Activity (SX-17–23)
// ---------------------------------------------------------------------------

/** Mirrors ReadingAttributes.ContentState (modules/yada-system/ios/ReadingActivity.swift). */
export interface ActivityState {
  /** The passage's name, or the chapter's where the book has none. */
  readonly title: string;
  /** "1:5". */
  readonly ref: string;
  /** SX-22's overline in StandBy, where the book is not on screen: "John 1:5". */
  readonly reference: string;
  /** The verse being read, in the text being heard (one of the four open texts), or "" while the name is said. */
  readonly verse: string;
  /** SX-19: "John, chapter 2" while the chapter's name is said; else null. */
  readonly spoken: string | null;
  /** SX-17, SX-18: "Stops after 1:18", "Repeats 1:1–18", or null. */
  readonly line: string | null;
  readonly lineGlyph: "stop" | "repeat" | null;
  /** Each passage's fill, 0 to 1, in order (AU-04's segments). */
  readonly segments: readonly number[];
  /** The playing passage's fill, the Island's ring. */
  readonly ring: number;
  readonly playing: boolean;
}

export interface ActivityInput {
  readonly book: BookCode;
  readonly chapter: number;
  readonly verse: number;
  readonly text: string;
  readonly translation: string;
  readonly titling: boolean;
  readonly playing: boolean;
  /** The chapter's passages as segments; one segment where the book has none. */
  readonly segments: readonly Segment[];
  /** The playing passage's name, or null. */
  readonly passage: string | null;
  readonly line: string | null;
  readonly stop: Stop | null;
  readonly repeat: Repeat | null;
}

export function activityState(a: ActivityInput): ActivityState {
  const fills = a.segments.map((s) => (a.titling ? 0 : segmentFill(s, a.verse)));
  const current = a.segments.findIndex((s) => a.verse >= s.from && a.verse <= s.to);
  return {
    title: a.passage ?? chapterTitle(a.book, a.chapter),
    ref: `${a.chapter}:${a.verse}`,
    reference: verseLabel({ book: a.book, chapter: a.chapter, verse: a.verse }),
    verse: a.titling ? "" : surfaceText(a.translation, a.text),
    spoken: a.titling ? spokenName(a.book, a.chapter) : null,
    line: a.line,
    lineGlyph: a.stop !== null ? "stop" : a.repeat !== null ? "repeat" : null,
    segments: fills,
    ring: current < 0 ? 0 : (fills[current] ?? 0),
    playing: a.playing,
  };
}

/** SX-19's line: the chapter's name as it is said, written with figures ("John, chapter 2", "Psalm 23"). */
export function spokenName(book: BookCode, chapter: number): string {
  return book === "PSA" ? `Psalm ${chapter}` : `${BOOK_CODES[book].name}, chapter ${chapter}`;
}

/**
 * SX-23: a stop that fires leaves the Live Activity paused on "Stopped after 1:18". data/audio.ts advance()
 * fires one as two updates: the stop goes back to Off while still playing, then the reading pauses. A stop
 * cleared by hand leaves it playing, and the next update disarms the watch.
 */
export interface StopWatch {
  readonly stop: Stop | null;
  readonly playing: boolean;
  readonly armed: boolean;
}

export function watchStop(prev: StopWatch, next: { readonly stop: Stop | null; readonly playing: boolean }): { fired: boolean; watch: StopWatch } {
  const cleared = prev.stop !== null && next.stop === null;
  const paused = prev.playing && !next.playing;
  return { fired: paused && (cleared || prev.armed), watch: { ...next, armed: cleared && next.playing } };
}

/** SX-23: the verse a stop came after, and the verse the place then moved on to (null until it has). */
export interface StopHold {
  readonly ord: number;
  readonly landed: number | null;
}

/**
 * Whether "Stopped after 1:18" still holds: until the reading plays or ends, or the reader moves the place anywhere
 * but where the stop moved it on to (1:19, or the next chapter's first verse).
 */
export function holdAfterStop(hold: StopHold | null, now: { readonly playing: boolean; readonly ord: number | null }): StopHold | null {
  if (hold === null || now.playing || now.ord === null) return null;
  if (now.ord === hold.ord) return hold;
  if (hold.landed === null) return { ...hold, landed: now.ord };
  return now.ord === hold.landed ? hold : null;
}

// ---------------------------------------------------------------------------
// The reminder's long-press (SX-14), read by targets/notification
// ---------------------------------------------------------------------------

/** What the notification content extension draws: overline, the name, the reference, two verses, BSB. */
export interface RichReminder {
  /** "Next in John", "A passage for today", "M’Cheyne · Reading 2". */
  readonly overline: string;
  /** "The authority of the Son", "Psalm 138". */
  readonly title: string;
  /** The psalm's BSB title, "Of David.", or null. */
  readonly titleLine: string | null;
  /** "John 5:16–47 · BSB". */
  readonly ref: string;
  readonly verses: readonly SurfaceVerse[];
}

/** One scheduled reminder, as modules/yada-system scheduleReminder takes it. */
export interface ReminderRequest {
  readonly id: string;
  /** Milliseconds since 1970. */
  readonly at: number;
  readonly title: string;
  readonly body: string;
  readonly data: { readonly target: unknown; readonly rich: RichReminder | null };
}

/** SX-14's two verses: the first two of `verses`, verse 1 of a psalm without its title (decision 1). */
export function richVerses(book: BookCode, verses: ReadonlyArray<{ verse: number; text: string }>): { titleLine: string | null; verses: SurfaceVerse[] } {
  const two = verses.slice(0, 2);
  const first = two[0];
  const split = first === undefined ? { title: null, body: "" } : psalmTitleLine(book, first.verse, first.text);
  return {
    titleLine: split.title,
    verses: two.map((v, i) => ({ n: v.verse, text: surfaceText("BSB", i === 0 ? split.body : v.text) })),
  };
}

// ---------------------------------------------------------------------------
// The Apple Watch (AW-01, AW-03): sent over WatchConnectivity (modules/yada-system setWatchData), decoded by
// targets/watch-widget/WatchData.swift `WatchPart`
// ---------------------------------------------------------------------------

/** One morning or evening on the watch: the day's verse and that part's psalms. */
export interface WatchPart {
  /** When the part begins and ends, milliseconds since 1970 (lib/today.ts partSpan). */
  readonly from: number;
  readonly until: number;
  /** "Today" or "This evening", as DR-16 labels the day's verse. */
  readonly when: string;
  readonly verse: {
    readonly text: string;
    /** "Psalm 1:3". */
    readonly ref: string;
    /** Breathe the verse's two halves (AW-03), or null where the verse has no break of its own (lib/sit.ts). */
    readonly breathe: readonly [string, string] | null;
  } | null;
  /** "This morning", "Psalms 1–5"; null when Settings › Daily psalms is Off or Daily prayer. */
  readonly psalms: { readonly when: string; readonly label: string } | null;
}

/** The watch shows the BSB whatever the reader reads (rule 9), as the widgets do. */
export function watchPart(day: Date, part: Part, verse: { text: string; ref: string } | null, set: PsalmSet | null): WatchPart {
  const span = partSpan(day, part);
  const text = verse === null ? "" : surfaceText("BSB", verse.text);
  return {
    from: span.from.getTime(),
    until: span.until.getTime(),
    when: whenLabel(day, part, day),
    verse: verse === null || text === "" ? null : { text, ref: verse.ref, breathe: breathSplit(text) },
    psalms: set === null ? null : { when: part === "morning" ? "This morning" : "This evening", label: psalmsLabel(set) },
  };
}
