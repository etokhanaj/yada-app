/**
 * Sit with this (PR-02–06; build 7 plan §2 row 18). Pure, so it is tested.
 *
 * Breathe the verse splits a verse only where its own words break: at a semicolon or colon, else an em dash
 * (Psalm 46:10, "Be still, and know that I am God; / I will be exalted among the nations"). A verse with no such
 * break, or one that leaves a half under three words, skips the step: never a split made up mid-phrase (PR-04).
 */

export const SETTLE = { inSeconds: 4, outSeconds: 6, rounds: 4 } as const;
export const SILENCE_MINUTES = [3, 5, 10, 20] as const;

const words = (s: string): number => s.split(/\s+/).filter((w) => w !== "").length;

export function breathSplit(verse: string): [string, string] | null {
  for (const mark of [/;\s/, /:\s/, /\s—\s?|—/]) {
    const m = mark.exec(verse);
    if (m === null) continue;
    const a = verse.slice(0, m.index + (m[0].startsWith(";") || m[0].startsWith(":") ? 1 : 0)).trim();
    const b = verse.slice(m.index + m[0].length).trim();
    if (words(a) >= 3 && words(b) >= 3) return [a, b];
  }
  return null;
}
