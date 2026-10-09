/**
 * Design tokens, starting values from the design brief. Not final — these exist
 * so the spike and Figma can be compared against the same numbers.
 *
 * Five colour tokens and no more. Claim categories are deliberately NOT
 * colour-coded: colour-coding text against debated reads as grading theology.
 */

import { useColorScheme } from "react-native";

import { useSettings } from "../state/settings";

export const FONTS = {
  scripture: "Literata",
  greek: "GentiumPlus",
  hebrew: "NotoSerifHebrew",
} as const;

/** Five semantic colour tokens and no more, plus the selection wash. */
export interface Palette {
  readonly paper: string;
  readonly ink: string;
  readonly mutedInk: string;
  readonly divider: string;
  readonly accent: string;
  readonly selection: string;
}

const LIGHT: Palette = {
  paper: "#FBF9F5",
  ink: "#1A1714",
  mutedInk: "#6B635A",
  divider: "#E4DED4",
  accent: "#1F3A5F",
  selection: "#ECE6D9",
};

const DARK: Palette = {
  paper: "#14120F",
  ink: "#EDE7DD",
  mutedInk: "#9A9086",
  divider: "#2C2823",
  accent: "#9BB8DE",
  selection: "#252118",
};

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
  return useIsDark() ? DARK : LIGHT;
}

/**
 * Leading is expressed as a ratio of the unscaled font size and nothing else.
 *
 * Measured on RN 0.86 (New Architecture): an explicit `lineHeight` is scaled by
 * Dynamic Type along with `fontSize`, so the old advice to multiply it by
 * `PixelRatio.getFontScale()` yourself double-scales it. At AX5 that produced
 * leading roughly 4.8x the font size — text marooned in whitespace — and, when
 * the setting changed on a mounted screen, a stale scale factor that clipped
 * glyphs instead. Ratio only; let the platform do the scaling.
 */
export function leading(fontSize: number, ratio: number): number {
  return Math.round(fontSize * ratio);
}

/**
 * Tracking is size-specific: large text reads too loose as it grows and wants
 * negative tracking, small text wants a little positive. One fixed value would
 * be wrong somewhere, so every step carries its own.
 */
export const TYPE = {
  chapterHead: { size: 14, ratio: 1.3, tracking: 1.8 },
  scripture: { size: 21, ratio: 1.55, tracking: -0.1 },
  original: { size: 24, ratio: 1.85, tracking: 0 },
  headword: { size: 32, ratio: 1.15, tracking: -0.6 },
  explanation: { size: 17, ratio: 1.5, tracking: -0.05 },
  claim: { size: 16, ratio: 1.45, tracking: 0 },
  meta: { size: 12, ratio: 1.3, tracking: 1.1 },
  /** Small prose — glosses, notes, captions. Untracked: the tracking above is for capitals. */
  note: { size: 13, ratio: 1.4, tracking: 0 },
} as const;

export type TypeStep = keyof typeof TYPE;

export interface ScaledType {
  readonly size: number;
  readonly lineHeight: number;
  readonly tracking: number;
}

/**
 * The reader's own text-size step multiplies the design sizes; Dynamic Type
 * then scales the result natively (PRD §8.8 wants both). Scripture, original
 * language and explanation follow the step; metadata labels and chrome stay
 * put so the page keeps its proportions.
 */
const FOLLOWS_TEXT_SIZE: ReadonlySet<TypeStep> = new Set(["scripture", "original", "explanation", "claim", "headword"]);

export function scaledType(step: TypeStep, textScale: number): ScaledType {
  const spec = TYPE[step];
  const size = FOLLOWS_TEXT_SIZE.has(step) ? Math.round(spec.size * textScale) : spec.size;
  return { size, lineHeight: leading(size, spec.ratio), tracking: spec.tracking };
}

export function useType(step: TypeStep): ScaledType {
  const textScale = useSettings((s) => s.textScale);
  return scaledType(step, textScale);
}

export const SPACE = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
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

/** Tracked-out uppercase, the only styling claim labels ever get. */
export const METADATA_LABEL = {
  fontSize: TYPE.meta.size,
  letterSpacing: TYPE.meta.tracking,
  textTransform: "uppercase",
} as const;
