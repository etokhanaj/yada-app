/**
 * The reader's floating header (canvas J01-01, E-01, D-05).
 *
 * Glass controls with the text scrolling under them, no bar and no rule: a
 * paper fade instead (Apple Books reader chrome,
 * https://mobbin.com/screens/d6766fdb-6038-4359-99d3-adf6a50ca363). `‹ Bible`,
 * or the return chip after a jump, then the chapter and the version as one split
 * control (RD-30): `John 2` opens the book's chapters (CH-30), `WEB` the
 * translations, each its own sheet. Then `Aa`. The control is centred on the
 * screen, not between the buttons: both sides take the wider one's width
 * (v2-review: 0 pt offset). Under it a hairline of how far through the chapter
 * the reader is (RD-30), in the accent on a fill track.
 *
 * While reading it steps back to one 13 pt line under the island (D-05,
 * YouVersion's scroll state), the hairline still under it; scrolling up or
 * tapping the line restores it. From AX3 the controls take one row and the
 * split control the next, and `‹` drops its word (RD-30 AX5).
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
  progress,
  onBack,
  onChapters,
  onTranslations,
  onType,
  onExpand,
  onHeight,
}: {
  title: string;
  translation: string;
  /** null = `‹ Bible`, the tab under the reader (IA v4, build 7). */
  back: { label: string; accessibility: string } | null;
  collapsed: boolean;
  /** 0 to 1, how far through the chapter: an Animated.Value the reader sets as it scrolls, so a scroll never re-renders the screen. */
  progress: Animated.Value;
  onBack: () => void;
  onChapters: () => void;
  onTranslations: () => void;
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
      {twoRows && back === null ? null : (
        <Chrome tone="ink" size={16} numberOfLines={1} style={{ fontWeight: "500", marginRight: 2 }}>
          {back === null ? "Bible" : back.label}
        </Chrome>
      )}
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

  const half = (text: string, label: string, hint: string, onPress: () => void, testID: string) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      testID={testID}
      style={({ pressed }) => [styles.half, pressed ? { opacity: 0.6 } : null]}
    >
      <Chrome tone="ink" numberOfLines={1} style={{ fontWeight: "600" }} maxFontSizeMultiplier={2.2}>
        {text}
      </Chrome>
    </Pressable>
  );

  const split = (
    <View
      style={[styles.split, { backgroundColor: palette.fill }]}
      onLayout={(e) => {
        const w = Math.ceil(e.nativeEvent.layout.width);
        setTitleWidth((t) => (t === w ? t : w));
      }}
    >
      {half(title, title, "Opens the book's chapters", onChapters, "reader-contents")}
      <View style={[styles.splitRule, { backgroundColor: palette.divider }]} />
      {half(translation, `Translation, ${translation}`, "Opens the translations", onTranslations, "reader-translation")}
    </View>
  );

  const track = (
    <View style={[styles.track, { backgroundColor: palette.fill }]} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={[
          styles.progress,
          { backgroundColor: palette.accent, transform: [{ scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }) }] },
        ]}
      />
    </View>
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
              <View style={styles.row2}>{split}</View>
            </>
          ) : (
            <View style={styles.row}>
              <View style={[styles.side, { minWidth: centred ? balanced : 0 }]}>{backButton}</View>
              <View style={styles.middle}>{split}</View>
              <View style={[styles.side, { minWidth: centred ? balanced : 0, alignItems: "flex-end" }]}>{typeButton}</View>
            </View>
          )}
          {track}
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
          {track}
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
  middle: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  split: {
    flexDirection: "row",
    alignItems: "stretch",
    maxWidth: "100%",
    borderRadius: 22,
    overflow: "hidden",
  },
  half: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
    flexShrink: 1,
  },
  splitRule: {
    width: StyleSheet.hairlineWidth,
  },
  track: {
    height: 2,
    borderRadius: 1,
    marginTop: 8,
    marginHorizontal: 16,
    overflow: "hidden",
  },
  // Scaled from its left edge: the bar is drawn full width and shrunk, so it moves on the native driver.
  progress: {
    height: 2,
    width: "100%",
    transformOrigin: "left",
  },
  mini: {
    minHeight: 44,
    alignSelf: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
});
