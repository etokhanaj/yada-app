/**
 * Glass controls over scrolling text: translucent, blurred, hairline edge,
 * soft shadow (Apple Books reader chrome,
 * https://mobbin.com/screens/d6766fdb-6038-4359-99d3-adf6a50ca363; v2-review W2).
 *
 * A 44 pt circle for a glyph (`Aa`, search) or a capsule for a label (`‹ Home`).
 * At accessibility sizes a circle grows into a capsule around its text instead
 * of clipping it (canvas `.ax5 .hb-aa`). Reduce Transparency draws it solid.
 *
 * Blur over 120 Hz scrolling text is the build plan's named risk; if it drops
 * frames, draw these solid as Reduce Transparency does.
 */

import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import { Pressable, type PressableProps, StyleSheet, View, type ViewStyle } from "react-native";

import { LAYOUT, useIsDark, useLayout, usePalette } from "../design/tokens";
import { useAccessibility } from "../state/accessibility";

function GlassSurface({ children }: { children: ReactNode }) {
  const palette = usePalette();
  const isDark = useIsDark();
  const reduceTransparency = useAccessibility((s) => s.reduceTransparency);
  return (
    // Shadow on the outer view, clip on the inner: a clipped view drops its shadow.
    <View style={[styles.shadow, { shadowOpacity: isDark ? 0 : 0.06 }]}>
      <View
        style={[
          styles.clip,
          // Reduce Transparency: no blur, a solid ground (palette.glassSolid), the hairline edge kept
          // so the control still has a boundary where the solid matches the paper behind it.
          { borderColor: palette.edge, backgroundColor: reduceTransparency ? palette.glassSolid : "transparent" },
        ]}
      >
        {reduceTransparency ? null : (
          <>
            <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.glass }]} />
          </>
        )}
        {children}
      </View>
    </View>
  );
}

export function GlassButton({
  children,
  shape = "circle",
  style,
  ...rest
}: Omit<PressableProps, "children" | "style"> & {
  children: ReactNode;
  shape?: "circle" | "capsule";
  style?: ViewStyle;
}) {
  const palette = usePalette();
  const { ax, control } = useLayout();
  const circle = shape === "circle" && !ax;
  return (
    <Pressable accessibilityRole="button" {...rest} style={style}>
      {({ pressed }) => (
        <GlassSurface>
          <View
            style={[
              styles.content,
              circle
                ? { width: control, height: control }
                : { minHeight: control, minWidth: control, paddingHorizontal: ax ? 20 : 14, paddingVertical: ax ? 6 : 0 },
              pressed ? { backgroundColor: palette.fill } : null,
            ]}
          >
            {children}
          </View>
        </GlassSurface>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 7,
  },
  clip: {
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: LAYOUT.minTarget,
  },
});
