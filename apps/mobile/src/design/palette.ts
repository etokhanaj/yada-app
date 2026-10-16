/**
 * Colour, v2 with the brand kit (brief §8.15, brand/README.md: chalk and
 * forest, chartreuse as the dark accent and the difference highlighter).
 * Values from style-v2.css on the v2 canvas
 * (https://claude.ai/artifact/JATNjDweJajrjgGfP51Soc).
 *
 * Pure data, no React Native, so the contrast tests can import it.
 *
 * Primary actions are ink, not navy: Mobbin's reading apps never fill a primary
 * button with a brand colour (Deepstash, Apple Books — v2-review S4). The
 * accent (forest; chartreuse in dark) is kept for the selection bar and links.
 * Chartreuse is never text on chalk (1.19:1, brand/README.md). Selection is a
 * quiet tint of the accent (Matter, Fable — S3); translation differences get
 * chartreuse as a highlighter so "selected" and "differs" never look alike (S5). No state is carried by
 * colour alone: every wash pairs with a bar, underline or glyph (brief §3).
 */

export interface Palette {
  readonly paper: string;
  readonly ink: string;
  readonly mutedInk: string;
  readonly divider: string;
  readonly accent: string;
  /** Selection wash, always paired with the 3 pt accent bar. */
  readonly selection: string;
  /** Translation-difference wash, always paired with a mutedInk underline. */
  readonly highlight: string;
  /** Capsule and circle buttons on paper or sheet. Translucent ink. */
  readonly fill: string;
  /** Glass controls over scrolling text; drawn over a blur. */
  readonly glass: string;
  /**
   * Glass drawn solid under Reduce Transparency (Glass.tsx, the reader's
   * collapsed header line): no blur or translucency, the same hairline edge.
   * Chalk in light; in dark the sheet ground, a step above paper, so the
   * control still reads as raised.
   */
  readonly glassSolid: string;
  /** Hairline edge of glass and raised surfaces. */
  readonly edge: string;
  /** Raised sheet ground. */
  readonly sheet: string;
  readonly scrim: string;
  /** Build 7 cards (CLAUDE.md "cards used right"): one soft fill, no shadow. */
  readonly card: string;
}

// Build 7, "we go white" (John, 15 Oct 2026; docs/redesign/polish-2026-10-15.md): white ground and neutral greys;
// forest stays the accent, chartreuse dark mode's. Values match style-v2.css's system polish block.
const LIGHT: Palette = {
  paper: "#FFFFFF",
  ink: "#111311",
  mutedInk: "#686B69",
  divider: "#E9E9E7",
  accent: "#183F35",
  selection: "#EEF3E4",
  highlight: "#DBEC9A",
  fill: "rgba(17,19,17,0.05)",
  glass: "rgba(255,255,255,0.9)",
  glassSolid: "#F2F2F0",
  edge: "rgba(0,0,0,0.08)",
  sheet: "#FFFFFF",
  scrim: "rgba(0,0,0,0.28)",
  card: "#F4F4F2",
};

const DARK: Palette = {
  paper: "#0B0C0B",
  ink: "#F4F5F2",
  mutedInk: "#9C9F9B",
  divider: "#262826",
  accent: "#DBEC9A",
  selection: "#1C2418",
  highlight: "#3B4A22",
  fill: "rgba(244,245,242,0.08)",
  glass: "rgba(32,34,32,0.86)",
  glassSolid: "#161716",
  edge: "rgba(255,255,255,0.1)",
  sheet: "#161716",
  scrim: "rgba(0,0,0,0.6)",
  card: "#171917",
};

/**
 * Increase Contrast (iOS "darker system colours", brief §3): mutedInk and
 * divider swap, and surfaces get firmer edges (canvas E-06).
 */
const LIGHT_IC: Palette = {
  ...LIGHT,
  mutedInk: "#4A4D4B",
  divider: "#8A8D8B",
  edge: "rgba(0,0,0,0.35)",
  fill: "rgba(17,19,17,0.1)",
};

const DARK_IC: Palette = {
  ...DARK,
  mutedInk: "#BDC0BC",
  divider: "#6A6D69",
  edge: "rgba(255,255,255,0.3)",
  fill: "rgba(244,245,242,0.14)",
};

export const PALETTES = { light: LIGHT, dark: DARK, lightIC: LIGHT_IC, darkIC: DARK_IC } as const;

export function paletteFor(dark: boolean, increaseContrast: boolean): Palette {
  if (dark) return increaseContrast ? DARK_IC : DARK;
  return increaseContrast ? LIGHT_IC : LIGHT;
}
