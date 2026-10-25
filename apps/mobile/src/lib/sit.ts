/**
 * Sit with a verse (SW-01 to SW-06, Build 12) and Silence on its own (PR-06). Pure, so it is tested.
 *
 * Breathe the verse splits a verse only where its own words break. PR-04 draws Psalm 46:10 as "Be still / and know that
 * I am God": a breath is short, so the verse's first clause (to its semicolon or colon) splits at its own comma when both
 * halves are whole phrases; otherwise the verse splits at the semicolon, colon or em dash itself. A verse with no such
 * break, or one that would leave a scrap, skips the step: never a split made up mid-phrase.
 */

export const SETTLE = { inSeconds: 4, outSeconds: 6, rounds: 6 } as const;
export const SILENCE_MINUTES = [3, 5, 10, 20] as const;
export const DEFAULT_SILENCE = 5;
/**
 * Build 12 (SW-01 to SW-06, John 24 Oct 2026): one session in four parts, chosen by length alone. It replaces the page
 * of four named steps (Settle, Breathe the verse, Sit with it, Silence), which read as a menu of tools.
 */
export type SessionPart = "breathe" | "hear" | "quiet" | "again";
export const SESSION_PARTS: readonly SessionPart[] = ["breathe", "hear", "quiet", "again"];
/** For VoiceOver and the progress bar's label: the parts' names are not printed (SW-03 to SW-05). */
export const PART_NAMES: Record<SessionPart, string> = { breathe: "Breathe", hear: "Hear it read", quiet: "Quiet", again: "Hear it again" };
/** Decision 1 (John, 24 Oct 2026): 5, 10 and 15 minutes, 5 first. */
export const SESSION_MINUTES = [5, 10, 15] as const;
export type SessionMinutes = (typeof SESSION_MINUTES)[number];

export function breathSeconds(): number {
  return (SETTLE.inSeconds + SETTLE.outSeconds) * SETTLE.rounds;
}

/** How long one unhurried reading takes, about two words a second, never under 8 s; the voice itself decides. */
export function readSeconds(verse: string): number {
  return Math.max(8, Math.round(words(verse) / 2));
}

/** The length sets the quiet: what is left of it after the breathing and the two readings, at least a minute. */
export function quietSeconds(minutes: SessionMinutes, verse: string): number {
  return Math.max(60, minutes * 60 - breathSeconds() - 2 * readSeconds(verse));
}

/**
 * Where the breathing is `second` seconds in: in-breath or out, the whole seconds left of it (SW-03 counts down inside
 * the orb), and which round. Past the end it holds on the last out-breath.
 */
export function breathAt(second: number): { phase: 0 | 1; left: number; round: number } {
  const cycle = SETTLE.inSeconds + SETTLE.outSeconds;
  const s = Math.min(Math.max(0, Math.floor(second)), breathSeconds() - 1);
  const round = Math.floor(s / cycle);
  const into = s % cycle;
  return into < SETTLE.inSeconds ? { phase: 0, left: SETTLE.inSeconds - into, round } : { phase: 1, left: cycle - into, round };
}

/** The last rounds breathe the verse's own halves when it splits: Breathe the verse folds into the breathing. */
export const VERSE_ROUNDS = 3;

/** SW-05's time left: "2:14". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** What VoiceOver hears over the orb (SW-03): "Breathe in, 3 seconds. Then out for 6." */
export function breathAnnouncement(phase: 0 | 1, left: number): string {
  const now = phase === 0 ? "Breathe in" : "Breathe out";
  const then = phase === 0 ? `out for ${SETTLE.outSeconds}` : `in for ${SETTLE.inSeconds}`;
  return `${now}, ${left} ${left === 1 ? "second" : "seconds"}. Then ${then}.`;
}

const words = (s: string): number => s.split(/\s+/).filter((w) => w !== "").length;

/** Longer than this and the twice-read verse crowds out the quiet: a passage for reading, not sitting with. */
export const SIT_WORDS = 70;

/** Whether Sit with this is offered for these words: anything up to SIT_WORDS. */
export function sittable(text: string): boolean {
  const n = words(text);
  return n > 0 && n <= SIT_WORDS;
}

/** "I said", "Jesus answered": a speech tag is no breath of its own (Jonah 2:4 breathed "I said" in, Sit audit 24 Oct 2026). */
const SPEECH_TAG = /\b(said|says|answered|replied|cried|asked|prayed|spoke|declared)$/iu;

export function breathSplit(verse: string): [string, string] | null {
  const clauseEnd = /[;:]\s/u.exec(verse);
  if (clauseEnd !== null) {
    const clause = verse.slice(0, clauseEnd.index);
    const comma = clause.indexOf(", ");
    if (comma !== -1) {
      const a = clause.slice(0, comma).trim();
      const b = clause.slice(comma + 2).trim();
      if (words(a) >= 2 && words(b) >= 2 && !SPEECH_TAG.test(a)) return [a, b];
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
