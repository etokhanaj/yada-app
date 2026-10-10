/**
 * The selection's actions, docked to the bottom (decision 2; canvas J01-02,
 * J01-15, E-02, M-01). Replaces the floating SelectionPill, which covered the
 * verse it acted on (0A).
 *
 * `Understand 14:34` in ink on its own row — Mobbin's reading apps fill the
 * primary action with ink, not a brand colour (Deepstash,
 * https://mobbin.com/screens/780e563b-579c-4bf4-a941-4c4a550e3628) — then
 * `α Original` · `Compare` · `⋯` as equal capsules. `⋯` is the native iOS
 * menu (Apple Books, https://mobbin.com/screens/fda02365-2264-4eff-a55e-7850616e58bf).
 * At AX sizes, two rows only, so the bar never covers the verse (amendment 4).
 *
 * Paper ground, hairline top, no shadow. To VoiceOver it comes after the
 * verses and appearing does not move focus (brief §5).
 */

import { MenuView } from "@react-native-menu/menu";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONTS, SPRING, useLayout, usePalette } from "../design/tokens";
import { useReduceMotion } from "../lib/motion";
import { type BarItem, barItems, moreActions } from "../lib/reader";
import { Icon } from "./Icon";
import { Chrome } from "./Type";

/** Native menu glyphs are SF Symbols: UIMenu takes system images only. */
const MENU_IMAGES: Readonly<Record<string, string>> = {
  Original: "character",
  Compare: "rectangle.split.2x1",
  Copy: "doc.on.doc",
  Share: "square.and.arrow.up",
  Bookmark: "bookmark",
  "Remove bookmark": "bookmark.slash",
};

export function ActionBar({
  verseLabel,
  hasEntry,
  bookmarked,
  script,
  onUnderstand,
  onOriginal,
  onCompare,
  onMenu,
  onHeight,
}: {
  /** "14:34" or "14:34–35". */
  verseLabel: string;
  hasEntry: boolean;
  bookmarked: boolean;
  script: "greek" | "hebrew";
  onUnderstand: () => void;
  onOriginal: () => void;
  onCompare: () => void;
  /** Copy, Share, Bookmark / Remove bookmark (and Original, Compare at AX sizes). */
  onMenu: (action: string) => void;
  onHeight: (height: number) => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { ax, pill } = useLayout();
  const reduceMotion = useReduceMotion();
  const items = barItems(hasEntry, ax);
  const menu = moreActions(hasEntry, ax, bookmarked);

  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    // Critically damped: overshoot on something that merely appeared reads as decoration.
    if (!reduceMotion) Animated.spring(enter, { toValue: 1, ...SPRING.standard, useNativeDriver: true }).start();
  }, [enter, reduceMotion]);

  const originalName = script === "hebrew" ? "Original Hebrew" : "Original Greek";

  const button = (item: BarItem) => {
    if (item === "understand") {
      return (
        <Capsule
          key={item}
          primary
          wide
          height={pill}
          onPress={onUnderstand}
          label={`Understand verse ${verseLabel.split(":")[1] ?? verseLabel}`}
          testID="bar-understand"
        >
          <Chrome tone="paper" style={{ fontWeight: "600" }}>
            Understand {verseLabel}
          </Chrome>
        </Capsule>
      );
    }
    if (item === "original") {
      return (
        <Capsule key={item} wide={ax} height={pill} onPress={onOriginal} label={originalName} testID="bar-original">
          {ax ? null : (
            <Chrome
              tone="ink"
              style={{ fontFamily: script === "hebrew" ? FONTS.hebrew : FONTS.greek, fontSize: 21, lineHeight: 24, marginTop: -2 }}
              maxFontSizeMultiplier={1.4}
            >
              {script === "hebrew" ? "א" : "α"}
            </Chrome>
          )}
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            Original
          </Chrome>
        </Capsule>
      );
    }
    if (item === "compare") {
      return (
        <Capsule key={item} height={pill} onPress={onCompare} label="Compare translations" testID="bar-compare">
          <Icon name="compare" size={16} />
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            Compare
          </Chrome>
        </Capsule>
      );
    }
    return (
      <MenuView
        key={item}
        style={ax ? styles.wide : styles.cell}
        shouldOpenOnLongPress={false}
        actions={menu.map((title) => ({ id: title.toLowerCase(), title, image: MENU_IMAGES[title] }))}
        onPressAction={({ nativeEvent }) => onMenu(nativeEvent.event)}
        testID="bar-more"
      >
        {/* The menu is a UIButton; a child that took the touch would keep it from opening.
            VoiceOver still focuses the child, and its activation tap falls through. */}
        <View
          pointerEvents="none"
          accessible
          accessibilityRole="button"
          accessibilityLabel="More actions"
          style={[styles.capsule, { height: ax ? undefined : pill, minHeight: pill, backgroundColor: palette.fill }, ax ? styles.list : null]}
        >
          {ax ? (
            <Chrome tone="ink" style={{ fontWeight: "500", flex: 1 }}>
              More
            </Chrome>
          ) : null}
          <Icon name="more" size={22} />
        </View>
      </MenuView>
    );
  };

  const [first, ...rest] = items;
  return (
    <Animated.View
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
      style={[
        styles.bar,
        {
          backgroundColor: palette.paper,
          boxShadow: `0 -1px 0 ${palette.divider}`,
          paddingBottom: Math.max(insets.bottom, 12),
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
      testID="action-bar"
    >
      {ax ? (
        <View style={{ rowGap: 8 }}>{items.map(button)}</View>
      ) : hasEntry && first !== undefined ? (
        <View style={{ rowGap: 8 }}>
          {button(first)}
          <View style={styles.row}>{rest.map(button)}</View>
        </View>
      ) : (
        <View style={styles.row}>{items.map(button)}</View>
      )}
    </Animated.View>
  );
}

function Capsule({
  children,
  primary = false,
  wide = false,
  height,
  onPress,
  label,
  testID,
}: {
  children: React.ReactNode;
  primary?: boolean;
  wide?: boolean;
  height: number;
  onPress: () => void;
  label: string;
  testID: string;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        styles.capsule,
        wide ? styles.wide : styles.cell,
        ax ? styles.list : { height },
        { minHeight: height, backgroundColor: primary ? palette.ink : palette.fill },
        pressed ? { opacity: 0.72 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    columnGap: 8,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  wide: {
    alignSelf: "stretch",
  },
  capsule: {
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
  },
  list: {
    justifyContent: "flex-start",
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
});
