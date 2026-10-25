/**
 * The only Text components the app uses. Rules fixed here, once, instead of in
 * every screen:
 *
 * 1. Bidi (0A finding 1). English prose that embeds a Hebrew or Greek word is
 *    laid out right-to-left when the sentence opens with that word. `Prose`,
 *    `Label` and `Chrome` pin LTR; `Original` sets per-Text `writingDirection`
 *    for Hebrew. Nothing touches the global RTL switch.
 *
 * 2. Live Dynamic Type change (0A finding 3). Every text node is keyed on the
 *    current font scale, so a change remounts it and it is measured fresh.
 *
 * 3. Growth caps (brief §3). Each token carries `maxFontSizeMultiplier` so it
 *    reaches its AX5 size and stops; the Aa step is fixed at default from AX1
 *    so the two never compound.
 *
 * 4. Language (brief §5). Greek and Hebrew runs inside English are split out
 *    and set in their own face (Hebrew always Noto Serif Hebrew). RN 0.86
 *    applies `accessibilityLanguage` per Text view, not per nested span
 *    (RCTParagraphComponentAccessibilityProvider), so text that is wholly one
 *    script carries `el` / `he` on its view, and embedded words rely on
 *    VoiceOver's script detection.
 */

import { Children, type ReactNode } from "react";
import { Pressable, type StyleProp, StyleSheet, Text, type TextProps, type TextStyle, useWindowDimensions, View } from "react-native";

import { type ScriptRun, splitScriptRuns } from "../design/lang";
import { FONTS, LTR_PROSE, TYPE, type TypeStep, usePalette, useType } from "../design/tokens";
import { Icon } from "./Icon";

type Tone = "ink" | "muted" | "accent" | "paper";

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
  if (tone === "muted") return palette.mutedInk;
  if (tone === "accent") return palette.accent;
  if (tone === "paper") return palette.paper;
  return palette.ink;
}

function useTypeStyle(step: TypeStep, tone: Tone): { style: TextStyle; maxFontSizeMultiplier: number } {
  const t = useType(step);
  const color = useTone(tone);
  return {
    style: {
      fontFamily: t.fontFamily,
      fontSize: t.size,
      lineHeight: t.lineHeight,
      letterSpacing: t.tracking,
      fontWeight: t.weight,
      color,
    },
    maxFontSizeMultiplier: t.maxFontSizeMultiplier,
  };
}

/** The single language of a text that is wholly Greek or Hebrew, else undefined. */
export function languageOf(text: string): "el" | "he" | undefined {
  const strong = splitScriptRuns(text).filter((r) => r.text.trim() !== "");
  const first = strong[0];
  if (first === undefined || first.lang === null) return undefined;
  return strong.every((r) => r.lang === first.lang) ? first.lang : undefined;
}

function runStyle(run: ScriptRun, greekFace: boolean): TextStyle | null {
  if (run.lang === "he") return { fontFamily: FONTS.hebrew };
  if (run.lang === "el" && greekFace) return { fontFamily: FONTS.greek };
  return null;
}

/**
 * Splits string children into script runs. Non-string children pass through
 * untouched, so callers can still nest their own spans.
 */
function withScriptRuns(children: ReactNode, greekFace: boolean): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    const runs = splitScriptRuns(child);
    if (runs.every((r) => r.lang === null)) return child;
    return runs.map((run, i) => {
      const style = runStyle(run, greekFace);
      return style === null ? run.text : (
        <Text key={i} style={style}>
          {run.text}
        </Text>
      );
    });
  });
}

function plainText(children: ReactNode): string {
  let out = "";
  Children.forEach(children, (c) => {
    if (typeof c === "string" || typeof c === "number") out += String(c);
  });
  return out;
}

/** Bible text in the reader's translation. English, so LTR. */
export function Scripture({ children, tone = "ink", step = "scripture", style, ...rest }: BaseProps & { step?: TypeStep }) {
  const key = useFontScaleKey();
  const t = useTypeStyle(step, tone);
  return (
    <Text key={key} maxFontSizeMultiplier={t.maxFontSizeMultiplier} {...rest} style={[LTR_PROSE, t.style, style]}>
      {children}
    </Text>
  );
}

/**
 * Explanation, claims, notes. LTR pinned because any of it may embed Hebrew;
 * Greek and Hebrew runs get their own face.
 */
export function Prose({ children, tone = "ink", step = "explanation", style, ...rest }: BaseProps & { step?: TypeStep }) {
  const key = useFontScaleKey();
  const t = useTypeStyle(step, tone);
  const whole = languageOf(plainText(children));
  return (
    <Text
      key={key}
      maxFontSizeMultiplier={t.maxFontSizeMultiplier}
      accessibilityLanguage={whole}
      {...rest}
      style={[LTR_PROSE, t.style, style]}
    >
      {/* Greek inside system-font text takes Gentium (canvas J01-09); Literata has its own Greek. */}
      {withScriptRuns(children, TYPE[step].font === undefined)}
    </Text>
  );
}

/** Section label: sentence case, semibold, untracked (canvas `.lbl`). A heading to VoiceOver. */
export function Label({ children, tone = "muted", style, ...rest }: BaseProps) {
  const key = useFontScaleKey();
  const t = useTypeStyle("label", tone);
  return (
    <Text
      key={key}
      accessibilityRole="header"
      maxFontSizeMultiplier={t.maxFontSizeMultiplier}
      {...rest}
      style={[LTR_PROSE, t.style, style]}
    >
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
  const t = useTypeStyle(step, tone);
  return (
    <Text
      key={key}
      maxFontSizeMultiplier={t.maxFontSizeMultiplier}
      accessibilityLanguage={script === "hebrew" ? "he" : "el"}
      {...rest}
      style={[
        t.style,
        {
          fontFamily: script === "hebrew" ? FONTS.hebrew : FONTS.greek,
          fontWeight: "400",
          writingDirection: script === "hebrew" ? "rtl" : "ltr",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * Chrome: header controls, buttons, row titles, sheet titles. System font,
 * capped at 2× so controls never take a third of the screen at AX5.
 */
export function Chrome({
  children,
  tone = "accent",
  step = "chrome",
  size,
  style,
  ...rest
}: BaseProps & { step?: "chrome" | "sheetTitle" | "note" | "label"; size?: number }) {
  const key = useFontScaleKey();
  const t = useTypeStyle(step, tone);
  return (
    <Text
      key={key}
      maxFontSizeMultiplier={t.maxFontSizeMultiplier}
      {...rest}
      style={[LTR_PROSE, t.style, size === undefined ? null : { fontSize: size, lineHeight: Math.round(size * 1.25) }, style]}
    >
      {children}
    </Text>
  );
}

/**
 * Build 7: a section's title, bold sans in ink, 22 pt on a page and 20 in a sheet (polish-2026-10-15.md). Build 12
 * adds `link`, "See all ›" on the right, the one way from a section to its whole list (YouVersion's sections), in
 * place of each screen's own "All" link.
 */
export function SectionTitle({
  children,
  style,
  inSheet = false,
  link,
  ...rest
}: BaseProps & { inSheet?: boolean; link?: { title?: string; label: string; onPress: () => void; testID?: string } }) {
  const key = useFontScaleKey();
  const t = useTypeStyle("sectionTitle", "ink");
  const sheetSize = inSheet ? { fontSize: t.style.fontSize === undefined ? 20 : (t.style.fontSize * 20) / 22, lineHeight: t.style.lineHeight === undefined ? 24 : (t.style.lineHeight * 20) / 22 } : null;
  if (link === undefined)
    return (
      <Text key={key} accessibilityRole="header" maxFontSizeMultiplier={t.maxFontSizeMultiplier} {...rest} style={[LTR_PROSE, t.style, sheetSize, style]}>
        {children}
      </Text>
    );
  return (
    <View style={[styles.head, style]}>
      <Text key={key} accessibilityRole="header" maxFontSizeMultiplier={t.maxFontSizeMultiplier} {...rest} style={[LTR_PROSE, t.style, sheetSize, { flexShrink: 1 }]}>
        {children}
      </Text>
      <Pressable onPress={link.onPress} accessibilityRole="button" accessibilityLabel={link.label} hitSlop={8} style={styles.link} testID={link.testID}>
        <Chrome tone="accent" style={{ fontWeight: "600" }}>
          {link.title ?? "See all"}
        </Chrome>
        <Icon name="forward" size={16} tone="accent" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", columnGap: 12, flexWrap: "wrap" },
  link: { flexDirection: "row", alignItems: "center", columnGap: 2, minHeight: 44 },
});
