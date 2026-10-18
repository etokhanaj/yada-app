/**
 * "‹ Back to reading" must land on the exact reading position, from however
 * deep the reader went: Understand → Why → word card → occurrences.
 *
 * The reader screen is never unmounted while those sheets sit over it, so the
 * position is preserved structurally (0A rubric item 6) — returning is a
 * matter of popping exactly the sheets on top of the stack, and nothing else.
 */

/** Routes presented as sheets over whatever screen opened them. */
export const SHEET_ROUTES: ReadonlySet<string> = new Set([
  // Each is a route group with its own stack (brief §1: never more than two sheets).
  "understand",
  // The passage guide (PG-02): depth 1 like Understand, with its own stack.
  "guide",
  "evidence",
  "type-settings",
  "contents",
  // Opened over Contents (MT-01), so Back to reading pops both.
  "translations",
]);

/** How many sheets sit on top of the stack; popping them reveals the screen beneath, untouched. */
export function trailingSheets(routeNames: readonly string[], sheets: ReadonlySet<string> = SHEET_ROUTES): number {
  let count = 0;
  for (let i = routeNames.length - 1; i >= 0; i--) {
    if (!sheets.has(routeNames[i] ?? "")) break;
    count++;
  }
  return count;
}

/**
 * DN-06: ‹ inside a sheet names where it goes back to when that is a verse or passage, as "‹ 14:34", so three
 * pushes never feel lost. The page title "1 Corinthians 14:34" gives "14:34"; any other title gives null, and ‹
 * stays the round glyph with the name in its VoiceOver label.
 */
export function backPill(title: string | null): string | null {
  if (title === null) return null;
  return /\s(\d{1,3}:\d{1,3}(?:[–-]\d{1,3}(?::\d{1,3})?)?)$/u.exec(title)?.[1] ?? null;
}

/**
 * Leaving to read somewhere else closes Search too. Back to reading does not:
 * a sheet opened from Search returns to it (Search is not in SHEET_ROUTES).
 */
export const LEAVE_ROUTES: ReadonlySet<string> = new Set([...SHEET_ROUTES, "search"]);
