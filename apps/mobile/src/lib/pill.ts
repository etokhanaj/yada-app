/**
 * Where the selection actions go, and in what shape.
 *
 * 0A found two faults (docs/0a-findings.md, "Also found"): at AX3 the
 * horizontal pill overflowed the screen — Understand clipped at both ends,
 * Compare cut off — and even at the default size it was placed from the tap
 * point, so it covered the verse it acted on.
 *
 * Shape: horizontal while the labels fit on one line; otherwise a vertical
 * list, which is what iOS's own edit menu becomes at accessibility sizes.
 * Placement: above the selected verses when there is room, below them when
 * not, and only over them when the selection fills the screen.
 */

export const PILL_ACTIONS = ["Understand", "Original", "Compare", "⋯"] as const;

const LABEL_SIZE = 16;
/** Average advance of the system font, as a fraction of its size. Generous on purpose. */
const CHAR_WIDTH = 0.58;
const ACTION_PADDING = 28;
const PILL_INSET = 8;

export function estimatedPillWidth(fontScale: number): number {
  const text = PILL_ACTIONS.reduce((sum, label) => sum + label.length, 0) * CHAR_WIDTH * LABEL_SIZE * fontScale;
  return text + PILL_ACTIONS.length * ACTION_PADDING + PILL_INSET;
}

export type PillShape = "row" | "column";

export function pillShape(fontScale: number, availableWidth: number): PillShape {
  return estimatedPillWidth(fontScale) <= availableWidth ? "row" : "column";
}

export interface Placement {
  readonly top: number;
  /** Whether it had to sit over the selection because neither side had room. */
  readonly overlaps: boolean;
}

/**
 * `selectionTop`/`selectionBottom` are window coordinates of the selected rows;
 * `minTop`/`maxBottom` bound the usable area (below the header, above the home
 * indicator).
 */
export function placePill(
  selectionTop: number,
  selectionBottom: number,
  pillHeight: number,
  minTop: number,
  maxBottom: number,
  gap = 10,
): Placement {
  const above = selectionTop - gap - pillHeight;
  if (above >= minTop) return { top: above, overlaps: false };
  const below = selectionBottom + gap;
  if (below + pillHeight <= maxBottom) return { top: below, overlaps: false };
  return { top: Math.max(minTop, maxBottom - pillHeight), overlaps: true };
}
