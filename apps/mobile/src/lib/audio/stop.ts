/**
 * Stop playing and Repeat (canvas LB-01–07; docs/build-6-decisions.md): what happens when a verse ends. Pure, so
 * data/audio.ts advance() asks it and the tests can too. In memory only: a closed app forgets both.
 *
 * A stop is a pause at a natural break, never mid-verse: the end of this passage, the end of this chapter, or the
 * end of the verse in which a timer runs out. The place then moves on, so Play carries on from the next verse.
 * A repeat loops the verse, the passage (back to the latest passage start at or before the verse) or the chapter.
 *
 * DR-08: listening to the day's psalms at night, the stop can be the end of the set, "End of this evening's psalms ·
 * After Psalm 8": the reading plays on through Psalms 6, 7 and 8 and pauses after the last verse of 8 (or after
 * 119:104, where the set is a section of Psalm 119).
 */

import { ordToParts } from "@yada/schema";

/** Where today's set of psalms ends, and which part of the day it is. */
export interface SetEnd {
  readonly part: "morning" | "evening";
  readonly psalm: number;
  /** The last verse, where the set ends inside Psalm 119; null for a whole psalm. */
  readonly to: number | null;
}

export type Stop =
  | { readonly kind: "passage" }
  | { readonly kind: "chapter" }
  | { readonly kind: "time"; readonly until: number }
  | ({ readonly kind: "set" } & SetEnd);

/** "Psalm 8", "119:104": where a set's stop falls, as the menu and the line write it. */
export function setEndLabel(end: SetEnd): string {
  return end.to === null ? `Psalm ${end.psalm}` : `${end.psalm}:${end.to}`;
}
export type Repeat = "verse" | "passage" | "chapter";

/** The timed choices, in minutes (LB-02). */
export const STOP_MINUTES = [15, 30, 60] as const;

export interface VerseEnd {
  /** The verse that just ended, in the chapter's verses. */
  readonly index: number;
  /** The chapter's verses, as ords. */
  readonly ords: readonly number[];
  /** The ords that open a passage in this book; null where the book has none. */
  readonly starts: ReadonlySet<number> | null;
  readonly stop: Stop | null;
  readonly repeat: Repeat | null;
  readonly now: number;
}

export type AfterVerse = { readonly kind: "next" } | { readonly kind: "loop"; readonly index: number } | { readonly kind: "stop" };

/** The first verse of the passage holding `index`, within this chapter (a passage begun in the last chapter loops from verse 1). */
export function passageStartIndex(index: number, ords: readonly number[], starts: ReadonlySet<number> | null): number {
  if (starts === null) return 0;
  for (let i = index; i >= 0; i--) if (starts.has(ords[i] ?? -1)) return i;
  return 0;
}

/** The last verse of the passage holding `index`, within this chapter. */
export function passageEndIndex(index: number, ords: readonly number[], starts: ReadonlySet<number> | null): number {
  if (starts === null) return ords.length - 1;
  for (let i = index + 1; i < ords.length; i++) if (starts.has(ords[i] ?? -1)) return i - 1;
  return ords.length - 1;
}

export function afterVerse(at: VerseEnd): AfterVerse {
  const chapterEnd = at.index + 1 >= at.ords.length;
  const passageEnd = chapterEnd || (at.starts?.has(at.ords[at.index + 1] ?? -1) ?? false);
  // A timer runs out at the end of the verse it falls in, whatever else is set.
  if (at.stop?.kind === "time" && at.now >= at.stop.until) return { kind: "stop" };
  // A break the reader asked to stop at wins over the loop that would carry past it: "End of this passage"
  // while the passage repeats is the end of this time through.
  if (at.stop?.kind === "passage" && passageEnd) return { kind: "stop" };
  if (at.stop?.kind === "chapter" && chapterEnd) return { kind: "stop" };
  if (at.stop?.kind === "set") {
    const p = ordToParts(at.ords[at.index] ?? 0);
    if (p.book === "PSA" && p.chapter === at.stop.psalm && (at.stop.to === null ? chapterEnd : p.verse >= at.stop.to)) return { kind: "stop" };
  }
  if (at.repeat === "verse") return { kind: "loop", index: at.index };
  if (at.repeat === "passage" && passageEnd) return { kind: "loop", index: passageStartIndex(at.index, at.ords, at.starts) };
  if (at.repeat === "chapter" && chapterEnd) return { kind: "loop", index: 0 };
  return { kind: "next" };
}

export type StopChoice = "set" | "passage" | "chapter" | `time:${(typeof STOP_MINUTES)[number]}`;

/**
 * The stops the menu offers: only breaks the loop will reach (LB-07; never offer what cannot happen). A book with no
 * passages has no passage stop (US-02). The end of today's psalms comes first while one of them plays (DR-08), and
 * never under a repeat, whose loop would never leave the psalm.
 */
export function stopChoices(repeat: Repeat | null, hasPassages: boolean, inSet = false): StopChoice[] {
  const times = STOP_MINUTES.map((m) => `time:${m}` as const);
  if (repeat === "verse") return times;
  if (repeat === "passage") return hasPassages ? ["passage", ...times] : times;
  return [...(inSet && repeat === null ? (["set"] as const) : []), ...(hasPassages ? (["passage"] as const) : []), "chapter", ...times];
}

/** A repeat chosen after a stop: the stop goes if the loop will never reach it. */
export function keepStop(stop: Stop | null, repeat: Repeat | null): Stop | null {
  if (stop === null || stop.kind === "time") return stop;
  if (stop.kind === "set" && repeat !== null) return null;
  if (repeat === "verse") return null;
  if (repeat === "passage" && stop.kind === "chapter") return null;
  return stop;
}

/** The repeats the menu offers; a book with no passages has no passage repeat. */
export function repeatChoices(hasPassages: boolean): Repeat[] {
  return hasPassages ? ["verse", "passage", "chapter"] : ["verse", "chapter"];
}

/** `set`: where today's psalms end, for "set"; without one, "set" falls back to the end of this psalm. */
export function stopFrom(choice: StopChoice, now: number, set: SetEnd | null = null): Stop {
  if (choice === "set") return set === null ? { kind: "chapter" } : { kind: "set", ...set };
  if (choice === "passage" || choice === "chapter") return { kind: choice };
  return { kind: "time", until: now + Number(choice.slice("time:".length)) * 60_000 };
}

/** Whole minutes left, rounded up, never below 1 while the timer runs. */
export function minutesLeft(stop: Stop, now: number): number {
  return stop.kind === "time" ? Math.max(1, Math.ceil((stop.until - now) / 60_000)) : 0;
}

export interface PlaceNames {
  readonly chapter: number;
  readonly verse: number;
  /** The playing passage's last verse, and its first (for Repeats 1:1–18). */
  readonly passageFirst: number;
  readonly passageLast: number;
  readonly chapterLast: number;
  /** "John 1". */
  readonly chapterTitle: string;
}

/** The player's one line under the progress (LB-03, LB-06): "Repeats 1:1–18 · Stops in 12 min". */
export function statusLine(stop: Stop | null, repeat: Repeat | null, place: PlaceNames, now: number): string | null {
  const c = place.chapter;
  const parts: string[] = [];
  if (repeat === "verse") parts.push(`Repeats ${c}:${place.verse}`);
  if (repeat === "passage") parts.push(`Repeats ${c}:${place.passageFirst}–${place.passageLast}`);
  if (repeat === "chapter") parts.push(`Repeats ${place.chapterTitle}`);
  if (stop?.kind === "passage") parts.push(`Stops after ${c}:${place.passageLast}`);
  if (stop?.kind === "chapter") parts.push(`Stops after ${c}:${place.chapterLast}`);
  if (stop?.kind === "time") parts.push(`Stops in ${minutesLeft(stop, now)} min`);
  if (stop?.kind === "set") parts.push(`Stops after ${setEndLabel(stop)}`);
  return parts.length === 0 ? null : parts.join(" · ");
}
