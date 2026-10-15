/**
 * The read-along's rules, pure so they can be tested: which translations may be read aloud,
 * the speeds, what follows a verse, the progress segments and the bars while audio plays.
 */

import { BOOK_CODES, type BookCode } from "@yada/schema";

/**
 * Read aloud: the four built-in texts only (BSB, WEB, KJV public domain; LSV CC BY-SA 4.0).
 * Licensed versions (NIV, NKJV, NLT, MSG via API.Bible) are display-only (CLAUDE.md rule 9) and no
 * licence file grants audio, so they are never spoken. Downloads (ASV, YLT, MSB, JPS) are left
 * out until each one's licence file has been read for audio (CLAUDE.md rule 3).
 */
const SPEAKABLE: ReadonlySet<string> = new Set(["BSB", "WEB", "KJV", "LSV"]);

export function canSpeak(translation: string): boolean {
  return SPEAKABLE.has(translation);
}

/** Speed choices, persisted per device (coordinator, 11 Oct 2026). */
export const SPEEDS = [0.8, 1, 1.25, 1.5] as const;

export type Speed = (typeof SPEEDS)[number];

export function isSpeed(value: number): value is Speed {
  return (SPEEDS as readonly number[]).includes(value);
}

/** "1×", "0.8×", "1.25×": the multiplication sign, as the frame draws it. */
export function speedLabel(speed: number): string {
  return `${speed}×`;
}

/** VoiceOver reads "×" as "multiplied by"; the frame's label is "Speed, 1 times" (AU-06). */
export function speedAccessibilityLabel(speed: number): string {
  return `Speed, ${speed} times`;
}

/**
 * AVSpeechUtterance's rate for each speed, measured rather than computed (docs/research/
 * speech-cadence.md). The scale is far from linear: below the default 0.5 the compact voice
 * slows in coarse steps (0.46–0.5 sound the same; 0.2 is still 0.79× as fast), and above it
 * the voice speeds up steeply (0.6 is 1.6×). Each rate was chosen so the words of John 1:1–2
 * and Genesis 4:23 take 1/speed as long as at 1×.
 *
 * 1× is 0.44, a step under the default: about 9% slower than the voice's own pace, as long-form
 * narration runs slower than speech (150–160 words a minute against the voice's 217 here). It
 * sits inside the step, since 0.45 is the step's edge. Rests (cadence.ts) are scaled apart.
 */
const RATES: Readonly<Record<Speed, number>> = { 0.8: 0.25, 1: 0.44, 1.25: 0.525, 1.5: 0.56 };

export function rateFor(speed: number): number {
  return isSpeed(speed) ? RATES[speed] : RATES[1];
}

export type AfterVerse =
  | { readonly kind: "verse"; readonly index: number }
  | { readonly kind: "chapter"; readonly chapter: number }
  | { readonly kind: "finished" };

/**
 * What plays when a verse ends: the next verse, else the next chapter of the same book, else
 * nothing. The end of a book stops on its last verse (coordinator, 11 Oct 2026): a reader who
 * fell asleep in Malachi should not wake in Matthew.
 */
export function afterVerse(index: number, count: number, book: BookCode, chapter: number): AfterVerse {
  if (index + 1 < count) return { kind: "verse", index: index + 1 };
  if (chapter < BOOK_CODES[book].chapters) return { kind: "chapter", chapter: chapter + 1 };
  return { kind: "finished" };
}

export interface Segment {
  /** First and last verse of the chapter this segment covers. */
  readonly from: number;
  readonly to: number;
}

/**
 * The progress bar split at the chapter's passages (AU-04: John 1 in three, 1–18, 19–34, 35–51).
 * Passages are clipped to the chapter; verses no passage covers join the segment before them,
 * and a chapter with no passages is one segment.
 */
export function progressSegments(
  pericopes: ReadonlyArray<{ readonly start_ord: number; readonly end_ord: number }>,
  chapterStartOrd: number,
  lastVerse: number,
): Segment[] {
  const firstOrd = chapterStartOrd;
  const lastOrd = chapterStartOrd + lastVerse - 1;
  const starts = pericopes
    .filter((p) => p.start_ord <= lastOrd && p.end_ord >= firstOrd)
    .map((p) => Math.max(1, p.start_ord - firstOrd + 1))
    .sort((a, b) => a - b);
  const unique = [...new Set([1, ...starts])];
  return unique.map((from, i) => ({ from, to: (unique[i + 1] ?? lastVerse + 1) - 1 }));
}

/** How full each segment is with `verse` playing: verse 5 of 1–18 fills 5/18 (the frame's rule). */
export function segmentFill(segment: Segment, verse: number): number {
  const length = segment.to - segment.from + 1;
  return Math.min(1, Math.max(0, (verse - segment.from + 1) / length));
}

/** Lock screen and Control Center: "John 1 · BSB" over "Verse 5". */
export function nowPlayingFor(chapterTitle: string, translation: string, verse: number): { title: string; artist: string } {
  return { title: `${chapterTitle} · ${translation}`, artist: `Verse ${verse}` };
}

/** The playing line's top, as a share of the lyrics' height (refs_au, AU-04/05, AX5 too). */
const FOLLOW = 0.3;
/** The lyrics fade in over their top 14% and out over their bottom 18% (canvas `.lyr` mask). */
export const FADE_TOP = 0.14;
export const FADE_BOTTOM = 0.18;

/**
 * Where to scroll so a line starting at `y`, `height` tall, sits 30% down. A line too tall to
 * finish above the bottom fade from there (one verse at AX5) starts just below the top fade
 * instead, so its first words are never lost under it.
 */
export function followOffset(y: number, height: number, viewport: number): number {
  const lead = height > viewport * (1 - FOLLOW - FADE_BOTTOM) ? viewport * FADE_TOP : viewport * FOLLOW;
  return Math.max(0, y - lead);
}
