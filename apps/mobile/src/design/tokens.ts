/**
 * Design tokens, starting values from the design brief. Not final — these exist
 * so the spike and Figma can be compared against the same numbers.
 *
 * Five colour tokens and no more. Claim categories are deliberately NOT
 * colour-coded: colour-coding text against debated reads as grading theology.
 */

import { PixelRatio, useColorScheme } from "react-native";

export const FONTS = {
  scripture: "Literata",
  greek: "GentiumPlus",
  hebrew: "NotoSerifHebrew",
} as const;

const LIGHT = {
  paper: "#FBF9F5",
  ink: "#1A1714",
  mutedInk: "#6B635A",
  divider: "#E4DED4",
  accent: "#1F3A5F",
  selection: "#EFEADF",
} as const;

const DARK = {
  paper: "#14120F",
  ink: "#EDE7DD",
  mutedInk: "#9A9086",
  divider: "#2C2823",
  accent: "#9BB8DE",
  selection: "#22201B",
} as const;

export type Palette = typeof LIGHT;

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}

/**
 * React Native scales `fontSize` with Dynamic Type but leaves an explicit
 * `lineHeight` untouched, so hardcoded leading collapses at accessibility
 * sizes. Every lineHeight in this app goes through here.
 */
export function leading(fontSize: number, ratio: number): number {
  return Math.round(fontSize * ratio * PixelRatio.getFontScale());
}

export const TYPE = {
  scripture: { size: 21, ratio: 1.5 },
  original: { size: 22, ratio: 1.7 },
  explanation: { size: 17, ratio: 1.45 },
  claim: { size: 16, ratio: 1.4 },
  meta: { size: 12, ratio: 1.3 },
} as const;

export const SPACE = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** Tracked-out uppercase, the only styling claim labels ever get. */
export const METADATA_LABEL = {
  fontSize: TYPE.meta.size,
  letterSpacing: 1.1,
  textTransform: "uppercase",
} as const;
