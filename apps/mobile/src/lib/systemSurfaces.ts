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
import { chapterTitle } from "./reader";

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

/** SX-03, SX-04, SX-07, SX-08: one day's psalm, BSB. */
export interface TodayData {
  readonly date: string;
  readonly psalm: number;
  /** The BSB's title for the psalm, "Of David.", or null. */
  readonly titleLine: string | null;
  /** The first three verses, verse 1 without its title. */
  readonly verses: readonly SurfaceVerse[];
  readonly url: string;
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
 * Decision 7 (build-6-decisions.md): a stop that fires ends the Live Activity at once. data/audio.ts advance()
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
