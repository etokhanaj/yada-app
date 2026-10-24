/**
 * Sit with this (PR-02–06; build 7 plan §2 row 18). Pure, so it is tested.
 *
 * Breathe the verse splits a verse only where its own words break. PR-04 draws Psalm 46:10 as "Be still / and know that
 * I am God": a breath is short, so the verse's first clause (to its semicolon or colon) splits at its own comma when both
 * halves are whole phrases; otherwise the verse splits at the semicolon, colon or em dash itself. A verse with no such
 * break, or one that would leave a scrap, skips the step: never a split made up mid-phrase.
 */

export const SETTLE = { inSeconds: 4, outSeconds: 6, rounds: 6 } as const;
export const SILENCE_MINUTES = [3, 5, 10, 20] as const;
export const DEFAULT_SILENCE = 5;
/** Sit with it: the first reading, the silence between, the second (PR-05). The readings run as long as the voice takes. */
export const SIT_SILENCE_SECONDS = 20;

export type Step = "settle" | "breathe" | "sit" | "silence";

export const STEP_TITLES: Record<Step, string> = { settle: "Settle", breathe: "Breathe the verse", sit: "Sit with it", silence: "Silence" };

/**
 * Settle and Breathe the verse's way on (BR-01 to BR-04): in a run, Next names the step it goes to; chosen alone, it
 * reads Done and goes back to the list (null).
 */
export function moveOnFrom(steps: readonly Step[], step: Step, all: boolean): { next: Step | null; label: string; accessibilityLabel: string } {
  const next = all ? (steps[steps.indexOf(step) + 1] ?? null) : null;
  return next === null
    ? { next, label: "Done", accessibilityLabel: "Done, back to Sit with this" }
    : { next, label: STEP_TITLES[next], accessibilityLabel: `Next, ${STEP_TITLES[next]}` };
}

/** One line under each step on the first page (PR-02): what it is and how long, from the real timings. */
export function stepLine(step: Step): string {
  if (step === "settle") return `Breathe, about ${Math.round(breathSeconds() / 60)} min`;
  if (step === "breathe") return "Half on the in-breath, half on the out";
  if (step === "sit") return "Read slowly, twice";
  return `${SILENCE_MINUTES.slice(0, -1).join(", ")} or ${SILENCE_MINUTES[SILENCE_MINUTES.length - 1]} min`;
}

export function breathSeconds(): number {
  return (SETTLE.inSeconds + SETTLE.outSeconds) * SETTLE.rounds;
}

/** "Begin · about 9 min" (PR-02): every step in order, Silence at its default, a reading at an unhurried pace. */
export function aboutMinutes(steps: readonly Step[], verse: string): number {
  const readSeconds = Math.max(8, words(verse) / 2);
  const seconds = steps.reduce(
    (sum, s) => sum + (s === "settle" || s === "breathe" ? breathSeconds() : s === "sit" ? readSeconds * 2 + SIT_SILENCE_SECONDS : DEFAULT_SILENCE * 60),
    0,
  );
  return Math.max(1, Math.round(seconds / 60));
}

const words = (s: string): number => s.split(/\s+/).filter((w) => w !== "").length;

export function breathSplit(verse: string): [string, string] | null {
  const clauseEnd = /[;:]\s/u.exec(verse);
  if (clauseEnd !== null) {
    const clause = verse.slice(0, clauseEnd.index);
    const comma = clause.indexOf(", ");
    if (comma !== -1) {
      const a = clause.slice(0, comma).trim();
      const b = clause.slice(comma + 2).trim();
      if (words(a) >= 2 && words(b) >= 2) return [a, b];
    }
  }
  for (const mark of [/;\s/u, /:\s/u, /\s—\s?|—/u]) {
    const m = mark.exec(verse);
    if (m === null) continue;
    const a = verse.slice(0, m.index + (m[0].startsWith(";") || m[0].startsWith(":") ? 1 : 0)).trim();
    const b = verse.slice(m.index + m[0].length).trim();
    if (words(a) >= 3 && words(b) >= 3) return [a, b];
  }
  return null;
}

export interface WordSpan {
  readonly start: number;
  readonly end: number;
}

/** Each word's place in the text, so the word the voice is saying can be marked (PR-05's read-along). */
export function wordSpans(text: string): WordSpan[] {
  return [...text.matchAll(/\S+/gu)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
}

/** The word a spoken location falls in, or the one it falls just before. */
export function wordAtLocation(spans: readonly WordSpan[], location: number): number | null {
  const i = spans.findIndex((w) => location < w.end);
  return i === -1 ? null : i;
}

/** "4 min left" while Silence runs (PR-06); the last minute says "Less than a minute". */
export function timeLeft(msLeft: number): string {
  const minutes = Math.ceil(msLeft / 60_000);
  return minutes <= 1 ? "Less than a minute" : `${minutes} min left`;
}
