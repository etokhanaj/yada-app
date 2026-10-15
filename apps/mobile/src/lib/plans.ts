/**
 * Reading plans with no dates (build plan Phase 5; canvas RP-01–04, DN-03): John passage by passage, and
 * M'Cheyne's 1842 Calendar, four portions a reading (data/plans/mcheyne.json, built by
 * scripts/plans/build_mcheyne.py from a pinned copy and checked against a second lineage).
 *
 * Nothing here knows a date. The next portion follows the last one finished, so a reader back after a gap
 * picks up at the next chapter with nothing to catch up (RP-03); a portion read out of order counts, and
 * the plan carries on after it.
 */

import { BOOK_CODES, type BookCode } from "@yada/schema";

import MCHEYNE from "../data/plans/mcheyne.json";

export interface Segment {
  readonly b: BookCode;
  readonly c: number;
  readonly vs?: number;
  readonly ve?: number;
}
/** One portion of a reading: "Genesis 9, 10", "Psalms 119:1–24". */
export type Portion = readonly Segment[];
export type Reading = readonly Portion[];

export const MCHEYNE_READINGS = MCHEYNE.readings as unknown as readonly Reading[];
export const MCHEYNE_THREAD = "plan-mcheyne";
export const MCHEYNE_TOTAL = MCHEYNE_READINGS.length;

/** A finished portion's thread_progress row, which syncs as John's passages do. */
export function portionThread(reading: number, portion: number): string {
  return `${MCHEYNE_THREAD}/read/${reading}.${portion}`;
}

export function portionOfThread(thread: string): { reading: number; portion: number } | null {
  const m = /^plan-mcheyne\/read\/(\d+)\.(\d+)$/.exec(thread);
  return m === null ? null : { reading: Number(m[1]), portion: Number(m[2]) };
}

/** "Genesis 9, 10"; "Exodus 11, 12:1–21"; "Psalms 119:1–24"; a book named once. */
export function portionLabel(portion: Portion): string {
  const first = portion[0];
  if (first === undefined) return "";
  const name = BOOK_CODES[first.b].name;
  const parts = portion.map((s, i) => {
    const range = s.vs === undefined ? `${s.c}` : s.vs === s.ve ? `${s.c}:${s.vs}` : `${s.c}:${s.vs}–${s.ve}`;
    return i > 0 && s.b !== portion[i - 1]?.b ? `${BOOK_CODES[s.b].name} ${range}` : range;
  });
  return `${name} ${parts.join(", ")}`;
}

/** VoiceOver: "Psalms 119, verses 1 to 24". */
export function portionSpoken(portion: Portion): string {
  return portionLabel(portion).replace(/(\d+):(\d+)–(\d+)/g, "$1, verses $2 to $3").replace(/(\d+):(\d+)/g, "$1, verse $2");
}

export type PortionKey = `${number}.${number}`;
export const keyOf = (reading: number, portion: number): PortionKey => `${reading}.${portion}`;

export interface PlanProgress {
  /** Finished portions. */
  readonly read: ReadonlySet<PortionKey>;
  /** The portion finished last, or null before any. */
  readonly last: { reading: number; portion: number } | null;
}

/**
 * The next portion: after the one finished last, the first not yet read, going on through the year and
 * round to the start. Null once every portion is read (DN-03).
 */
export function nextPortion(p: PlanProgress, readings: readonly Reading[] = MCHEYNE_READINGS): { reading: number; portion: number } | null {
  const order: Array<{ reading: number; portion: number }> = readings.flatMap((r, ri) => r.map((_, pi) => ({ reading: ri, portion: pi })));
  const from = p.last === null ? 0 : order.findIndex((o) => o.reading === p.last?.reading && o.portion === p.last.portion) + 1;
  for (let k = 0; k < order.length; k++) {
    const o = order[(from + k) % order.length];
    if (o !== undefined && !p.read.has(keyOf(o.reading, o.portion))) return o;
  }
  return null;
}

/** Readings whose four portions are all read, latest first (RP-03's "Read"). */
export function readingsDone(p: PlanProgress, readings: readonly Reading[] = MCHEYNE_READINGS): number[] {
  return readings.flatMap((r, ri) => (r.every((_, pi) => p.read.has(keyOf(ri, pi))) ? [ri] : [])).reverse();
}

/** The portions of `reading` that open in this chapter: what reaching its end finishes. */
export function portionsInChapter(reading: Reading, book: BookCode, chapter: number): number[] {
  return reading.flatMap((portion, pi) => (portion.some((s) => s.b === book && s.c === chapter) ? [pi] : []));
}
