/**
 * The contextual action pill.
 *
 * Anchored to the selection rather than pinned to the bottom of the screen:
 * that is the reading-app convention (Apple Books, Fable, Pocket, Matter) and
 * it keeps the relationship between the tapped verse and its actions obvious.
 * A bar pinned to the screen edge is the YouVersion pattern, and it severs that
 * relationship.
 *
 * Understand is dominant. The other actions are present but quiet — the brief
 * cuts the action count and replaces Share-first with Understand-first.
 */

import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { SPACE, SPRING, TYPE, useIsDark, usePalette } from "../design/tokens";

const PILL_HEIGHT = 46;

export function SelectionPill({
  label,
  anchorY,
  onUnderstand,
}: {
  label: string;
  /** Screen y of the tap that made the selection. */
  anchorY: number;
  onUnderstand: () => void;
}) {
  const palette = usePalette();
  const isDark = useIsDark();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // The pill did not arrive from a throw, so it is critically damped:
    // overshoot on something that merely appeared reads as decoration.
    Animated.spring(enter, {
      toValue: 1,
      ...SPRING.standard,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  // Sit above the tap, clamped into the safe reading area.
  const top = Math.max(70, Math.min(anchorY - PILL_HEIGHT - 22, 700));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          top,
          opacity: enter,
          transform: [
            {
              scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }),
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: palette.paper,
            borderColor: palette.divider,
            shadowOpacity: isDark ? 0.5 : 0.16,
          },
        ]}
      >
        <Action label={`Understand ${label}`} dominant onPress={onUnderstand} />
        <View style={[styles.separator, { backgroundColor: palette.divider }]} />
        <Action label="Original" />
        <View style={[styles.separator, { backgroundColor: palette.divider }]} />
        <Action label="Compare" />
      </View>
    </Animated.View>
  );
}

function Action({
  label,
  dominant = false,
  onPress,
}: {
  label: string;
  dominant?: boolean;
  onPress?: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        // Feedback on press-in, not on release. Waiting for touch-up feels dead.
        pressed ? { backgroundColor: palette.selection } : null,
      ]}
      accessibilityRole="button"
    >
      <Text
        style={{
          fontSize: TYPE.claim.size,
          color: dominant ? palette.accent : palette.mutedInk,
          fontWeight: dominant ? "600" : "400",
        }}
      >
        {label}
      </Text>
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
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACE.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
  action: {
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm + 2,
    borderRadius: PILL_HEIGHT / 2,
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    height: 20,
  },
});
