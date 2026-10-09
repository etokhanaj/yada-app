/**
 * The contextual actions for selected verses: Understand · Original · Compare · ⋯
 *
 * Anchored to the selection, the reading-app convention (Apple Books, Fable,
 * Pocket, Matter — e.g. https://mobbin.com/screens/37c599ad-b4f0-469e-825e-6e2e972b6953),
 * not pinned to the screen edge. Secondary actions sit behind ⋯ the way
 * Medium's selection menu does (https://mobbin.com/screens/b14f7259-5a06-4b23-aee7-d6a3d789b27a),
 * because the brief replaces Share-first with Understand-first.
 *
 * Fixes the 0A AX3 failure: shape and placement come from lib/pill.ts —
 * a vertical list once the labels no longer fit on a line, and always beside
 * the selection rather than on top of it.
 */

import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { SPACE, SPRING, useIsDark, usePalette } from "../design/tokens";
import { pillShape, placePill } from "../lib/pill";
import { Chrome } from "./Type";

export interface SelectionRect {
  readonly top: number;
  readonly bottom: number;
}

export function SelectionPill({
  rect,
  minTop,
  maxBottom,
  onUnderstand,
  onOriginal,
  onCompare,
  onMore,
}: {
  rect: SelectionRect;
  minTop: number;
  maxBottom: number;
  onUnderstand: () => void;
  onOriginal: () => void;
  onCompare: () => void;
  onMore: () => void;
}) {
  const palette = usePalette();
  const isDark = useIsDark();
  const { width, fontScale } = useWindowDimensions();
  const shape = pillShape(fontScale, width - SPACE.md * 2);
  const [height, setHeight] = useState<number | null>(null);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Critically damped: overshoot on something that merely appeared reads as decoration.
    Animated.spring(enter, { toValue: 1, ...SPRING.standard, useNativeDriver: true }).start();
  }, [enter]);

  const top = height === null ? -1000 : placePill(rect.top, rect.bottom, height, minTop, maxBottom).top;
  const separator =
    shape === "row" ? (
      <View style={[styles.rowSeparator, { backgroundColor: palette.divider }]} />
    ) : (
      <View style={[styles.columnSeparator, { backgroundColor: palette.divider }]} />
    );

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          top,
          opacity: height === null ? 0 : enter,
          transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
        },
      ]}
    >
      <View
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        style={[
          shape === "row" ? styles.row : styles.column,
          { backgroundColor: palette.paper, borderColor: palette.divider, shadowOpacity: isDark ? 0.5 : 0.14 },
        ]}
        accessibilityRole="menu"
        testID="selection-pill"
      >
        <Action label="Understand" dominant onPress={onUnderstand} shape={shape} />
        {separator}
        <Action label="Original" onPress={onOriginal} shape={shape} />
        {separator}
        <Action label="Compare" onPress={onCompare} shape={shape} />
        {separator}
        <Action label="⋯" accessibilityLabel="More: copy, share, bookmark" onPress={onMore} shape={shape} />
      </View>
    </Animated.View>
  );
}

function Action({
  label,
  dominant = false,
  onPress,
  shape,
  accessibilityLabel,
}: {
  label: string;
  dominant?: boolean;
  onPress: () => void;
  shape: "row" | "column";
  accessibilityLabel?: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        shape === "row" ? styles.rowAction : styles.columnAction,
        // Feedback on press-in, not on release.
        pressed ? { backgroundColor: palette.selection } : null,
      ]}
      accessibilityRole="menuitem"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={`pill-${label === "⋯" ? "more" : label.toLowerCase()}`}
    >
      <Chrome size={16} tone={dominant ? "accent" : "muted"} style={dominant ? { fontWeight: "600" } : null}>
        {label}
      </Chrome>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: SPACE.md,
    right: SPACE.md,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACE.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  column: {
    alignSelf: "stretch",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "visible",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  rowAction: {
    paddingHorizontal: 14,
    paddingVertical: SPACE.sm + 2,
    borderRadius: 23,
  },
  columnAction: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
  },
  rowSeparator: {
    width: StyleSheet.hairlineWidth,
    height: 20,
  },
  columnSeparator: {
    height: StyleSheet.hairlineWidth,
  },
});
