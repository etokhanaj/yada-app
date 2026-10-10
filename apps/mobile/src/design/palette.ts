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
  /** Hairline edge of glass and raised surfaces. */
  readonly edge: string;
  /** Raised sheet ground. */
  readonly sheet: string;
  readonly scrim: string;
}

const LIGHT: Palette = {
  paper: "#F7F8F0",
  ink: "#16231E",
  mutedInk: "#526D63",
  divider: "#DFE5D7",
  accent: "#183F35",
  selection: "#E7EED8",
  highlight: "#DBEC9A",
  fill: "rgba(22,35,30,0.06)",
  glass: "rgba(255,255,255,0.74)",
  edge: "rgba(22,35,30,0.1)",
  sheet: "#FFFFFF",
  scrim: "rgba(22,35,30,0.26)",
};

const DARK: Palette = {
  paper: "#0E1814",
  ink: "#ECF0E4",
  mutedInk: "#9AAFA4",
  divider: "#22332C",
  accent: "#DBEC9A",
  selection: "#1A2D25",
  highlight: "#3B4A22",
  fill: "rgba(236,240,228,0.09)",
  glass: "rgba(30,45,38,0.74)",
  edge: "rgba(255,255,255,0.09)",
  sheet: "#16231E",
  scrim: "rgba(0,0,0,0.55)",
};

/**
 * Increase Contrast (iOS "darker system colours", brief §3): mutedInk and
 * divider swap, and surfaces get firmer edges (canvas E-06).
 */
const LIGHT_IC: Palette = {
  ...LIGHT,
  mutedInk: "#3F584F",
  divider: "#7E9187",
  edge: "rgba(22,35,30,0.35)",
  fill: "rgba(22,35,30,0.1)",
};

const DARK_IC: Palette = {
  ...DARK,
  mutedInk: "#B5C6BC",
  divider: "#5E7369",
  edge: "rgba(255,255,255,0.3)",
  fill: "rgba(236,240,228,0.14)",
};

export const PALETTES = { light: LIGHT, dark: DARK, lightIC: LIGHT_IC, darkIC: DARK_IC } as const;

export function paletteFor(dark: boolean, increaseContrast: boolean): Palette {
  if (dark) return increaseContrast ? DARK_IC : DARK;
  return increaseContrast ? LIGHT_IC : LIGHT;
}
