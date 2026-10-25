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

import type { HighlightColor } from "../lib/highlights";

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
  /** Build 7 cards (CLAUDE.md "cards used right"): one soft fill, no shadow. */
  readonly card: string;
  /**
   * The reader's own highlights (PS-02): soft washes behind the verse, never alone (the verse number in ink and
   * "highlighted yellow" to VoiceOver carry it too). Values from the canvas's --hy, --hg, --hb, --hp.
   */
  readonly highlights: Readonly<Record<HighlightColor, string>>;
  /** The same colours saturated, for the bar's dots and Saved's 6 pt bar beside each excerpt (PS-01, PS-04). */
  readonly swatches: Readonly<Record<HighlightColor, string>>;
  /**
   * Build 12 (design-system.md § Build 12 additions): four soft grounds for things of one kind side by side (Pray's
   * ways to pray, Search's ways in, Bible prayers' needs). The name on them stays in ink; the tint never carries a
   * meaning of its own.
   */
  readonly tints: Readonly<Record<Tint, string>>;
  /** A raised card's ground (something a person wrote: a prayer request), with `raisedShadow` under it. */
  readonly raised: string;
  /** The raised card's soft shadow, as a boxShadow; in dark a hairline ring, since a shadow can't show on near-black. */
  readonly raisedShadow: string;
}

export type Tint = "forest" | "sand" | "sky" | "clay";

const SWATCHES = { yellow: "#E6C93A", green: "#69B24E", blue: "#4C93D6", pink: "#D96A9A" } as const;

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
  card: "#F4F4F2",
  highlights: { yellow: "#FBEFA6", green: "#D6F0C8", blue: "#CFE5F8", pink: "#F7D7E5" },
  swatches: SWATCHES,
  tints: { forest: "#E3ECE5", sand: "#F3EDE2", sky: "#E4EDF4", clay: "#F4E6E0" },
  raised: "#FFFFFF",
  raisedShadow: "0 1px 2px rgba(17,19,17,0.06), 0 6px 20px rgba(17,19,17,0.07)",
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
  card: "#171917",
  // Deeper and less green than build 10's (yellow was olive #4B4420): the verses still to come during read-along are
  // muted ink, and on the old washes they fell to 3.6:1 (John, 19 Oct 2026). Each now keeps muted text at 4.5:1.
  highlights: { yellow: "#3E3418", green: "#1F3B24", blue: "#1C3348", pink: "#45263A" },
  swatches: SWATCHES,
  tints: { forest: "#16241E", sand: "#221F19", sky: "#17202A", clay: "#261B17" },
  raised: "#171917",
  raisedShadow: "0 0 0 1px #262826",
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

/**
 * White on the day's picture and on the forest and night grounds (Build 11 colour pass, docs/colour-rules.md): seven
 * screens had drawn their own alphas, 0.75 to 0.92. Text is `strong` or `muted`; glass circles, marks and tracks
 * each have one value.
 */
export const ON_PICTURE = {
  text: "#FFFFFF",
  strong: "rgba(255,255,255,0.9)",
  muted: "rgba(255,255,255,0.78)",
  glass: "rgba(255,255,255,0.18)",
  glassSolid: "rgba(255,255,255,0.28)",
  mark: "rgba(255,255,255,0.35)",
  track: "rgba(255,255,255,0.22)",
  // The lamp's disc under Reduce Transparency, where the glass is drawn solid.
  disc: "rgba(0,0,0,0.55)",
} as const;

/**
 * Build 12's scrims over a picture (canvas `.scrim`): Sit's setup keeps the picture and darkens the top and the foot,
 * where the words and the controls sit; the session darkens the blurred picture evenly, so white words read on any day.
 */
export const SCRIM = {
  setup: "linear-gradient(rgba(8,12,10,0.55), rgba(8,12,10,0.35) 40%, rgba(8,12,10,0.8))",
  deep: "rgba(8,12,10,0.62)",
} as const;

/**
 * Yada's brand grounds, the same in both appearances: the forest card (DO-01, the calm close), its night (Return,
 * the launch, a full-screen verse with no picture, RT-08: "the deep forest, never blank") and the chartreuse kicker.
 */
export const BRAND = {
  forest: "#183F35",
  forestDark: "#0F2A23",
  night: "#0E1814",
  chartreuse: "#DBEC9A",
  // Text on chartreuse (the lit lamp's count) and on the night ground (Sit with this).
  ink: "#111311",
  onNight: "#F2F4EF",
} as const;

/** Something new (a circle's "1 new"): lime with ink words, never red (Build 12). */
export const BADGE = { ground: BRAND.chartreuse, ink: BRAND.ink } as const;

/**
 * Sit's breathing orb (SW-03, John 24 Oct 2026: "this screen can be better"): one soft lime, pale at the centre, so the
 * seconds inside it read in ink (13:1) on any day's picture. The one source of these colours; only the orb uses them.
 */
export const ORB_LIGHT = { centre: "#F3F8DD", middle: "#E3EFB5", edge: "#CFE291" } as const;

/**
 * People's avatar hues (docs/colour-rules.md, John 18 Oct 2026): one hue per person, from their id, the same on every
 * screen. Deep with white initials on light surfaces; pale with ink initials on dark and forest ones. Never green,
 * which is the place (a circle's band and cover), never a person.
 */
export const AVATAR_HUES = {
  lime: { deep: "#4F6B12", pale: "#DBEC9A" },
  amber: { deep: "#7E5D1E", pale: "#EBD9AE" },
  clay: { deep: "#9A4A30", pale: "#E8B49C" },
  sky: { deep: "#2F6494", pale: "#B4CDE6" },
  rose: { deep: "#954058", pale: "#EBBDC6" },
  lilac: { deep: "#62509A", pale: "#D2C6EC" },
} as const;
export type AvatarHue = keyof typeof AVATAR_HUES;
export const AVATAR_INK = { onDeep: "#FFFFFF", onPale: "#16231E" } as const;
/** An open place in a circle (PC-05, PC-08): a ring with nothing in it. */
export const AVATAR_SLOT = { onLight: "rgba(22,35,30,0.28)", onDark: "rgba(242,245,234,0.4)" } as const;

/** Colours iOS draws itself in a native menu: a destructive item's red title, and a plain item's icon. */
export const SYSTEM = {
  red: { light: "#FF3B30", dark: "#FF453A" },
  menuIcon: "#000000",
} as const;
