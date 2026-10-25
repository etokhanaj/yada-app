/**
 * Pray together's shared place (Build 12 PC-36 to PC-38; John, 25 Oct 2026: "assumes there will always be a
 * prayer"). SharePlay carries one number between the phones (YadaTogetherModule.swift `step`), so what the circle is
 * praying and where it is are packed into it: what (choosing, the circle's requests, going round, today's verse, a
 * Bible prayer, the end), which Bible prayer, and the step. Every phone works out the same steps from the same data:
 * the requests in the circle's order, the people here by id, the verses in Bible order. Pure, so it is tested.
 */

export type TogetherMode = "choose" | "requests" | "round" | "verse" | "prayer" | "end";

const CODES: Record<TogetherMode, number> = { choose: 0, requests: 1, round: 2, verse: 3, prayer: 4, end: 9 };
const MODES = Object.fromEntries(Object.entries(CODES).map(([k, v]) => [v, k])) as Record<number, TogetherMode>;

export interface TogetherPlace {
  readonly mode: TogetherMode;
  /** Which Bible prayer, by its place in the list; 0 otherwise. */
  readonly choice: number;
  readonly index: number;
}

export function packPlace(p: TogetherPlace): number {
  return CODES[p.mode] * 1_000_000 + p.choice * 1000 + p.index;
}

/** A number from a phone on Build 11 (a plain request index) reads as the requests at that index. */
export function unpackPlace(n: number): TogetherPlace {
  if (!Number.isInteger(n) || n < 0) return { mode: "choose", choice: 0, index: 0 };
  if (n < 1000) return n === 0 ? { mode: "choose", choice: 0, index: 0 } : { mode: "requests", choice: 0, index: n };
  return { mode: MODES[Math.floor(n / 1_000_000)] ?? "choose", choice: Math.floor((n % 1_000_000) / 1000), index: n % 1000 };
}

/** Going round: everyone here, in the same order on every phone. */
export function roundOrder(here: readonly string[]): string[] {
  return [...new Set(here)].sort();
}

/** The place after this one: the next step, or the end after the last. */
export function nextPlace(p: TogetherPlace, steps: number): TogetherPlace {
  return p.index + 1 < steps ? { ...p, index: p.index + 1 } : { mode: "end", choice: 0, index: 0 };
}
