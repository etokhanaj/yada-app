/**
 * The reader's floating header (canvas J01-01, E-01, D-05).
 *
 * Glass controls with the text scrolling under them, no bar and no rule: a
 * paper fade instead (Apple Books reader chrome,
 * https://mobbin.com/screens/d6766fdb-6038-4359-99d3-adf6a50ca363). `‹ Home`,
 * or the return chip after a jump, then one centred title target — book and
 * chapter, the translation small beneath — that opens Contents (amendment 13),
 * then `Aa`. The title is centred on the screen, not between the buttons: both
 * sides take the wider one's width (v2-review: 0 pt offset).
 *
 * While reading it steps back to one 13 pt line under the island (D-05,
 * YouVersion's scroll state); scrolling up or tapping the line restores it.
 * From AX3 the controls take one row and the title wraps on the next.
 */

import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { transparent } from "../design/contrast";
import { useAXLevel, usePalette } from "../design/tokens";
import { useReduceMotion } from "../lib/motion";
import { useAccessibility } from "../state/accessibility";
import { GlassButton } from "./Glass";
import { Icon } from "./Icon";
import { Chrome } from "./Type";


const FADE = 22;

export function ReaderHeader({
  title,
  translation,
  back,
  collapsed,
  onBack,
  onContents,
  onType,
  onExpand,
  onHeight,
}: {
  title: string;
  translation: string;
  /** null = `‹ Bible`, the tab under the reader (IA v4, build 7). */
  back: { label: string; accessibility: string } | null;
  collapsed: boolean;
  onBack: () => void;
  onContents: () => void;
  onType: () => void;
  onExpand: () => void;
  /** Height of the full header, fade excluded: where the text starts. */
  onHeight: (height: number) => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const ax = useAXLevel();
  const reduceMotion = useReduceMotion();
  const reduceTransparency = useAccessibility((s) => s.reduceTransparency);
  const twoRows = ax >= 3;
  const [sides, setSides] = useState({ left: 0, right: 0 });
  const [titleWidth, setTitleWidth] = useState(0);
  const { width } = useWindowDimensions();
  // True centre while the title fits between equal sides; with a long return
  // chip the title moves off centre rather than truncating (canvas E-01).
  const balanced = Math.max(sides.left, sides.right);
  const room = width - 24 - 12 - balanced * 2;
  const centred = titleWidth <= room;

  const shown = useRef(new Animated.Value(collapsed ? 0 : 1)).current;
  useEffect(() => {
    // D-05: the controls fade over 0.2 s; under Reduce Motion they swap.
    if (reduceMotion) shown.setValue(collapsed ? 0 : 1);
    else Animated.timing(shown, { toValue: collapsed ? 0 : 1, duration: 200, useNativeDriver: true }).start();
  }, [collapsed, reduceMotion, shown]);

  const fade = { height: FADE, experimental_backgroundImage: `linear-gradient(${palette.paper}, ${transparent(palette.paper)})` };

  const backButton = (
    <GlassButton
      shape="capsule"
      onPress={onBack}
      accessibilityLabel={back === null ? "Bible" : `Back to ${back.accessibility}`}
      testID="reader-back"
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        setSides((s) => (s.left === w ? s : { ...s, left: w }));
      }}
    >
      <Icon name="back" size={18} tone="muted" />
      <Chrome tone="ink" size={16} numberOfLines={1} style={{ fontWeight: "500", marginRight: 2 }}>
        {back === null ? "Bible" : back.label}
      </Chrome>
    </GlassButton>
  );

  const typeButton = (
    <GlassButton
      onPress={onType}
      accessibilityLabel="Text size and appearance"
      testID="reader-type"
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        setSides((s) => (s.right === w ? s : { ...s, right: w }));
      }}
    >
      <Chrome tone="ink" style={{ fontWeight: "500" }}>
        Aa
      </Chrome>
    </GlassButton>
  );

  const titleButton = (
    <Pressable
      onPress={onContents}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${translation}`}
      accessibilityHint="Opens books, chapters and translations"
      testID="reader-contents"
      style={({ pressed }) => [twoRows ? styles.titleRows : styles.title, pressed ? { opacity: 0.6 } : null]}
    >
      <Chrome step="sheetTitle" tone="ink" numberOfLines={twoRows ? undefined : 1}>
        {title}
      </Chrome>
      {twoRows ? null : (
        // Measured once at its natural width, never seen or read.
        <Chrome
          step="sheetTitle"
          style={styles.measure}
          onTextLayout={(e) => setTitleWidth(Math.ceil(e.nativeEvent.lines[0]?.width ?? 0))}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {title}
        </Chrome>
      )}
      <View style={styles.translation}>
        <Chrome step="note" tone="muted" style={{ fontWeight: "500", fontSize: twoRows ? 13 : 12 }} maxFontSizeMultiplier={twoRows ? 2.2 : 1.6}>
          {translation}
        </Chrome>
        <Icon name="down" size={10} tone="muted" strokeWidth={2.5} maxScale={1.6} />
      </View>
    </Pressable>
  );

  return (
    <View
      pointerEvents="box-none"
      style={styles.wrap}
      onLayout={(e) => onHeight(e.nativeEvent.layout.height - FADE)}
    >
      <Animated.View
        style={{ opacity: shown }}
        pointerEvents={collapsed ? "none" : "auto"}
        accessibilityElementsHidden={collapsed}
        importantForAccessibility={collapsed ? "no-hide-descendants" : "auto"}
      >
        <View style={{ paddingTop: insets.top + 4, backgroundColor: palette.paper }}>
          {twoRows ? (
            <>
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                {backButton}
                {typeButton}
              </View>
              <View style={styles.row2}>{titleButton}</View>
            </>
          ) : (
            <View style={styles.row}>
              <View style={[styles.side, { minWidth: centred ? balanced : 0 }]}>{backButton}</View>
              {titleButton}
              <View style={[styles.side, { minWidth: centred ? balanced : 0, alignItems: "flex-end" }]}>{typeButton}</View>
            </View>
          )}
        </View>
        <View style={fade} />
      </Animated.View>

      <Animated.View
        style={[StyleSheet.absoluteFill, { bottom: undefined, opacity: Animated.subtract(1, shown) }]}
        pointerEvents={collapsed ? "auto" : "none"}
        accessibilityElementsHidden={!collapsed}
        importantForAccessibility={collapsed ? "auto" : "no-hide-descendants"}
      >
        {/* Reduce Transparency: the line sits on solid glass with a hairline edge instead of
            fading into the text, so nothing shows through it (as Glass.tsx draws the controls). */}
        <View
          style={
            reduceTransparency
              ? { paddingTop: insets.top, backgroundColor: palette.glassSolid, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.edge }
              : { paddingTop: insets.top, backgroundColor: palette.paper }
          }
        >
          <Pressable
            onPress={onExpand}
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${translation}`}
            accessibilityHint="Shows the reading controls"
            testID="reader-mini"
            style={styles.mini}
          >
            <Chrome step="note" tone="muted" style={{ fontWeight: "600" }} maxFontSizeMultiplier={2.2}>
              {title} · {translation}
            </Chrome>
          </Pressable>
        </View>
        {reduceTransparency ? null : <View style={fade} />}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    columnGap: 6,
  },
  row2: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  side: {
    flexShrink: 0,
  },
  title: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRows: {
    minHeight: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  translation: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 2,
  },
  measure: {
    position: "absolute",
    opacity: 0,
    left: 0,
    top: 0,
    width: 1000,
    textAlign: "left",
    alignSelf: "flex-start",
  },
  mini: {
    minHeight: 44,
    alignSelf: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
});
