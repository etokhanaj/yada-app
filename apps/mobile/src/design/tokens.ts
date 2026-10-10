/**
 * Design tokens, v2: the hooks screens use. The values live in palette.ts and
 * type.ts (pure, tested); this file binds them to the reader's settings, the
 * system appearance, Dynamic Type and Increase Contrast.
 *
 * Claim categories are deliberately NOT colour-coded: colour-coding text
 * against debated reads as grading theology.
 */

import { useColorScheme, useWindowDimensions } from "react-native";

import { useAccessibility } from "../state/accessibility";
import { useSettings } from "../state/settings";
import { type Palette, paletteFor } from "./palette";
import { axLevel, type ScaledType, scaledType, type TypeStep } from "./type";

export type { Palette } from "./palette";
export { FONTS, leading, TYPE, type ScaledType, type TypeStep } from "./type";

/**
 * The reader's appearance choice wins over the system's. The root layout also
 * pushes the choice into Appearance.setColorScheme so native sheets, the
 * keyboard and the status bar agree; reading the setting here as well means a
 * screen never renders one frame in the wrong palette while that propagates.
 */
export function useIsDark(): boolean {
  const system = useColorScheme();
  const appearance = useSettings((s) => s.appearance);
  return appearance === "system" ? system === "dark" : appearance === "dark";
}

export function usePalette(): Palette {
  const dark = useIsDark();
  const increaseContrast = useAccessibility((s) => s.increaseContrast);
  return paletteFor(dark, increaseContrast);
}

export function useType(step: TypeStep): ScaledType {
  const textScale = useSettings((s) => s.textScale);
  const { fontScale } = useWindowDimensions();
  return scaledType(step, textScale, fontScale);
}

/** 0 below the accessibility sizes, 1–5 for AX1–AX5. Layouts switch on this. */
export function useAXLevel(): number {
  return axLevel(useWindowDimensions().fontScale);
}

export const SPACE = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Layout tokens from brief §3, values from style-v2.css. Index by `ax ? 1 : 0`. */
export const LAYOUT = {
  gutter: [24, 16],
  sectionGap: [28, 24],
  /** Action-bar capsules and primary buttons. */
  pill: [48, 64],
  /** Round sheet and header controls. */
  control: [44, 64],
  backToReading: 52,
  minTarget: 44,
} as const;

export function useLayout() {
  const ax = useAXLevel() >= 1 ? 1 : 0;
  return {
    ax: ax === 1,
    gutter: LAYOUT.gutter[ax],
    sectionGap: LAYOUT.sectionGap[ax],
    pill: LAYOUT.pill[ax],
    control: LAYOUT.control[ax],
  };
}

export { SHEET_MEDIUM } from "./sheet";

export const RADIUS = {
  /** Selection wash and Here / Next rows. */
  wash: 14,
} as const;

/**
 * Springs, not durations. Apple's two parameters map onto RN's physics triplet:
 * critically damped (no overshoot) is the default for anything that simply
 * appears; a little overshoot is reserved for motion the user's own gesture
 * set going.
 */
export const SPRING = {
  /** damping ratio 1.0, response ~0.35s */
  standard: { stiffness: 260, damping: 32, mass: 1 },
  /** damping ratio ~0.8, response ~0.35s — momentum only */
  momentum: { stiffness: 260, damping: 26, mass: 1 },
} as const;

/**
 * English prose that embeds Hebrew or Greek words MUST pin its base direction.
 *
 * The Unicode Bidi Algorithm derives a paragraph's direction from its first
 * strong character, so an English sentence that opens with a Hebrew word — very
 * common in a morphology claim, e.g. "בָּרָא is a Qal perfect" — is laid out
 * right-to-left: the leading word jumps to the right edge and the full stop
 * lands at the start of the next line. Claims that happen to open with an
 * English word render correctly, which makes the bug look intermittent.
 *
 * Applied to every Text that can contain an original-language word.
 */
export const LTR_PROSE = { writingDirection: "ltr" } as const;
