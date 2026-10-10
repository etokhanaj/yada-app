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
  "evidence",
  "type-settings",
  "contents",
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
 * Leaving to read somewhere else closes Search too. Back to reading does not:
 * a sheet opened from Search returns to it (Search is not in SHEET_ROUTES).
 */
export const LEAVE_ROUTES: ReadonlySet<string> = new Set([...SHEET_ROUTES, "search"]);
