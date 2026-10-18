/**
 * Window-size layout, kept free of React Native so the thresholds are tested (wide.test.ts); tokens.ts binds them to
 * the window in useLayout().
 */

/**
 * Regular-width windows (canvas TB-01–03, DU-01–02; build 10). Read from the window's size, never the device, so
 * iPad split view and an open Duo's span lay out by the room they have, and a narrow split falls back to the iPhone's.
 */
export const WIDE = {
  /** At or above this width a window is regular: iPad mini portrait is 744, a half split in landscape at most 678. */
  regular: 700,
  /** TB-01's `.sbar2`: 250 on an iPad in landscape; DU-01's `.sbar2.duo`: 200 on an open Duo, under 1000 wide. */
  sidebar: [250, 200],
  /** TB-02's `.rcol`: Scripture's measure, about 70 characters at the default size. */
  measure: 620,
  /** A page's rows and cards: TB-03 landscape's content column beside the sidebar. */
  page: 880,
  /** A sheet's body when the system draws the sheet wide (an open Duo): Understand's own width on the canvas. */
  sheet: 680,
  /** TB-01's `.wpg`: the regular page's side margin. */
  gutter: 36,
} as const;

/**
 * Where the tabs go. `bottom`: the iPhone's bar (IA-15). `top`: iPadOS's tabs at the top, a regular window taller than
 * wide (TB-01 and TB-03 portrait). `side`: the sidebar, a regular window wider than tall (TB-01 and TB-03 landscape,
 * DU-01 open). Pure, so the thresholds are tested.
 */
export type TabPlacement = "bottom" | "top" | "side";

export function tabPlacementFor(width: number, height: number): TabPlacement {
  if (width < WIDE.regular) return "bottom";
  return width > height ? "side" : "top";
}

/** The sidebar's width: TB-01's 250 on an iPad, DU-01's 200 on an open Duo, whose window is under 1000 wide. */
export function sidebarWidthFor(width: number): number {
  return width >= 1000 ? WIDE.sidebar[0] : WIDE.sidebar[1];
}
