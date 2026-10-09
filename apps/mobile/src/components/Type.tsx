/**
 * The only Text components the app uses. Two 0A bugs are fixed here, once,
 * instead of in every screen.
 *
 * 1. Bidi (0A finding 1). English prose that embeds a Hebrew or Greek word is
 *    laid out right-to-left when the sentence opens with that word, throwing
 *    the word to the far edge and the full stop onto the next line. `Prose`
 *    and `Label` pin LTR; `Original` sets per-Text `writingDirection` for
 *    Hebrew. Nothing touches the global RTL switch. A screen cannot forget
 *    the rule because no screen styles a raw <Text> for content.
 *
 * 2. Live Dynamic Type change (0A finding 3). Changing the system text size
 *    while Yada is running left line boxes measured at the old size under
 *    glyphs drawn at the new one: text sliced mid-word, lines overlapping,
 *    until a relaunch. Every text node here is keyed on the current font
 *    scale, so a change remounts it and it is measured fresh. Scroll position
 *    survives because only the text nodes remount, not the lists that hold
 *    them. `leading()` stays ratio-only (never multiplied by the font scale).
 */

import type { ReactNode } from "react";
import { type StyleProp, Text, type TextProps, type TextStyle, useWindowDimensions } from "react-native";

import { FONTS, LTR_PROSE, METADATA_LABEL, type TypeStep, usePalette, useType } from "../design/tokens";

type Tone = "ink" | "muted" | "accent";

interface BaseProps extends Omit<TextProps, "style"> {
  readonly children?: ReactNode;
  readonly tone?: Tone;
  readonly style?: StyleProp<TextStyle>;
}

/** Changes whenever Dynamic Type does; used as a React key to force a fresh measure. */
export function useFontScaleKey(): string {
  return useWindowDimensions().fontScale.toFixed(3);
}

function useTone(tone: Tone): string {
  const palette = usePalette();
  return tone === "muted" ? palette.mutedInk : tone === "accent" ? palette.accent : palette.ink;
}

/** Bible text in the reader's translation. English, so LTR. */
export function Scripture({ children, tone = "ink", step = "scripture", style, ...rest }: BaseProps & { step?: TypeStep }) {
  const key = useFontScaleKey();
  const t = useType(step);
  const color = useTone(tone);
  return (
    <Text
      key={key}
      {...rest}
      style={[
        LTR_PROSE,
        { fontFamily: FONTS.scripture, fontSize: t.size, lineHeight: t.lineHeight, letterSpacing: t.tracking, color },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Explanation, claims, notes: system font, LTR pinned because any of it may embed Hebrew. */
export function Prose({ children, tone = "ink", step = "explanation", style, ...rest }: BaseProps & { step?: TypeStep }) {
  const key = useFontScaleKey();
  const t = useType(step);
  const color = useTone(tone);
  return (
    <Text
      key={key}
      {...rest}
      style={[LTR_PROSE, { fontSize: t.size, lineHeight: t.lineHeight, letterSpacing: t.tracking, color }, style]}
    >
      {children}
    </Text>
  );
}

/** Tiny tracked uppercase: the only styling a claim label or section head ever gets. */
export function Label({ children, tone = "muted", style, ...rest }: BaseProps) {
  const key = useFontScaleKey();
  const color = useTone(tone);
  return (
    <Text key={key} accessibilityRole="header" {...rest} style={[LTR_PROSE, METADATA_LABEL, { color }, style]}>
      {children}
    </Text>
  );
}

/**
 * Greek or Hebrew. Hebrew gets `writingDirection: "rtl"` on this Text only;
 * the row that lays Hebrew words out is reversed by its container.
 */
export function Original({
  children,
  script,
  tone = "ink",
  step = "original",
  style,
  ...rest
}: BaseProps & { script: "greek" | "hebrew"; step?: TypeStep }) {
  const key = useFontScaleKey();
  const t = useType(step);
  const color = useTone(tone);
  return (
    <Text
      key={key}
      {...rest}
      style={[
        {
          fontFamily: script === "hebrew" ? FONTS.hebrew : FONTS.greek,
          fontSize: t.size,
          lineHeight: t.lineHeight,
          letterSpacing: t.tracking,
          writingDirection: script === "hebrew" ? "rtl" : "ltr",
          color,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Quiet chrome text: header controls, links. LTR pinned. */
export function Chrome({ children, tone = "accent", size = 17, style, ...rest }: BaseProps & { size?: number }) {
  const key = useFontScaleKey();
  const color = useTone(tone);
  return (
    <Text key={key} {...rest} style={[LTR_PROSE, { fontSize: size, color }, style]}>
      {children}
    </Text>
  );
}
