/**
 * Type, v2. Pure, no React Native, so the AX rules can be tested.
 *
 * Sizes, leading and AX5 targets are style-v2.css's (the canvas is the spec
 * where brief §8 is silent). `ax5` is the size each token should reach at the
 * largest accessibility text size; `maxFontSizeMultiplier` is derived from it,
 * so Dynamic Type grows every token to its AX5 size and no further (brief §3:
 * AX5 sizes match iOS's own text styles at AX5).
 */

export const FONTS = {
  scripture: "Literata",
  // Amendment 12: a psalm's title is italic. Only the upright Literata was bundled, so the
  // italic was a synthetic slant; the real Literata Italic is bundled under this name.
  scriptureItalic: "LiterataItalic",
  greek: "GentiumPlus",
  hebrew: "NotoSerifHebrew",
} as const;

export interface TypeSpec {
  /** undefined = the system font (SF Pro). */
  readonly font: string | undefined;
  readonly size: number;
  readonly ratio: number;
  readonly tracking: number;
  /** Multiplied by the reader's Aa step. */
  readonly step: boolean;
  readonly ax5: number;
  readonly weight?: "500" | "600";
}

export const TYPE = {
  display: { font: FONTS.scripture, size: 34, ratio: 1.1, tracking: -0.6, step: false, ax5: 60, weight: "600" },
  scripture: { font: FONTS.scripture, size: 21, ratio: 1.6, tracking: -0.1, step: true, ax5: 52 },
  verseNumber: { font: undefined, size: 12, ratio: 1.3, tracking: 0, step: true, ax5: 33, weight: "600" },
  original: { font: FONTS.greek, size: 24, ratio: 1.85, tracking: 0, step: true, ax5: 60 },
  headword: { font: FONTS.greek, size: 40, ratio: 1.15, tracking: -0.6, step: true, ax5: 58 },
  // Amendment 5: explanations in Literata (Matter's explainer sheet, v2-review W4).
  explanation: { font: FONTS.scripture, size: 17, ratio: 1.6, tracking: -0.1, step: true, ax5: 53 },
  claim: { font: undefined, size: 16, ratio: 1.45, tracking: 0, step: true, ax5: 50 },
  sheetTitle: { font: undefined, size: 17, ratio: 1.25, tracking: 0, step: false, ax5: 34, weight: "600" },
  chrome: { font: undefined, size: 17, ratio: 1.25, tracking: 0, step: false, ax5: 34, weight: "500" },
  note: { font: undefined, size: 13, ratio: 1.4, tracking: 0, step: false, ax5: 40 },
  /** Section labels: sentence case, semibold, untracked (canvas `.lbl`). */
  label: { font: undefined, size: 13, ratio: 1.3, tracking: 0, step: false, ax5: 37, weight: "600" },
} as const satisfies Record<string, TypeSpec>;

export type TypeStep = keyof typeof TYPE;

/**
 * iOS body sizes per content-size category divided by 17 (Large). RN's
 * fontScale is that ratio. AX1 starts at 28 pt.
 */
const AX_SCALES = [28 / 17, 33 / 17, 40 / 17, 47 / 17, 53 / 17] as const;
const EPSILON = 0.02;

/** 0 below the accessibility sizes, 1–5 for AX1–AX5. */
export function axLevel(fontScale: number): number {
  let level = 0;
  AX_SCALES.forEach((scale, i) => {
    if (fontScale >= scale - EPSILON) level = i + 1;
  });
  return level;
}

/**
 * The Aa step and Dynamic Type never compound (brief §3, audit 28–31): from
 * AX1 the in-app step is fixed at default.
 */
export function effectiveTextScale(textScale: number, fontScale: number): number {
  return axLevel(fontScale) >= 1 ? 1 : textScale;
}

export interface ScaledType {
  readonly fontFamily: string | undefined;
  readonly size: number;
  readonly lineHeight: number;
  readonly tracking: number;
  readonly weight: "400" | "500" | "600";
  readonly maxFontSizeMultiplier: number;
}

/**
 * Leading is a ratio of the unscaled size and nothing else: on RN 0.86 an
 * explicit lineHeight is scaled by Dynamic Type along with fontSize, so
 * multiplying it by the font scale yourself double-scales it (0A: leading
 * ~4.8x the size at AX5).
 */
export function leading(fontSize: number, ratio: number): number {
  return Math.round(fontSize * ratio);
}

export function scaledType(step: TypeStep, textScale: number, fontScale: number): ScaledType {
  const spec: TypeSpec = TYPE[step];
  const size = spec.step ? Math.round(spec.size * effectiveTextScale(textScale, fontScale)) : spec.size;
  return {
    fontFamily: spec.font,
    size,
    lineHeight: leading(size, spec.ratio),
    tracking: spec.tracking,
    weight: spec.weight ?? "400",
    // Relative to the stepped size, so a larger Aa step still lands on the AX5 size.
    maxFontSizeMultiplier: Math.round((spec.ax5 / size) * 100) / 100,
  };
}
