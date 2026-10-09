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
  "understand",
  "original",
  "compare",
  "why",
  "word",
  "occurrences",
  "type-settings",
]);

/** How many sheets sit on top of the stack; popping them reveals the screen beneath, untouched. */
export function trailingSheets(routeNames: readonly string[]): number {
  let count = 0;
  for (let i = routeNames.length - 1; i >= 0; i--) {
    if (!SHEET_ROUTES.has(routeNames[i] ?? "")) break;
    count++;
  }
  return count;
}
