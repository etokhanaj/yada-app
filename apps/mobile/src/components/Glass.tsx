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

import { ON_PICTURE } from "../design/palette";
import { LAYOUT, useIsDark, useLayout, usePalette } from "../design/tokens";
import { useAccessibility } from "../state/accessibility";

/**
 * The glass ground of a control: the header buttons, and the tab bar, its Search and the mini player above it (IA-15, IA-17).
 * `onPicture`: over a photo or a circle's tone, a thin white glass under white content, as the Build 11 frames draw it
 * (.p2gl); the paper glass with white on it read as nothing over Pray's picture (simulator QA, 18 Oct 2026).
 */
export function GlassSurface({ children, onPicture = false }: { children: ReactNode; onPicture?: boolean }) {
  const palette = usePalette();
  const isDark = useIsDark();
  const reduceTransparency = useAccessibility((s) => s.reduceTransparency);
  return (
    // Shadow on the outer view, clip on the inner: a clipped view drops its shadow.
    // A hairline and a barely-there lift, not a drop shadow (John, 24 Oct 2026: "the shadow here is too much").
    <View style={[styles.shadow, { shadowOpacity: isDark ? 0 : 0.05 }]}>
      <View
        style={[
          styles.clip,
          // Reduce Transparency: no blur, a solid ground (palette.glassSolid), the hairline edge kept
          // so the control still has a boundary where the solid matches the paper behind it.
          onPicture
            ? { borderColor: ON_PICTURE.mark, backgroundColor: reduceTransparency ? ON_PICTURE.disc : "transparent" }
            : { borderColor: palette.edge, backgroundColor: reduceTransparency ? palette.glassSolid : "transparent" },
        ]}
      >
        {reduceTransparency ? null : (
          <>
            <BlurView intensity={40} tint={onPicture ? "dark" : isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: onPicture ? ON_PICTURE.glass : palette.glass }]} />
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
  onPicture = false,
  style,
  ...rest
}: Omit<PressableProps, "children" | "style"> & {
  children: ReactNode;
  shape?: "circle" | "capsule";
  onPicture?: boolean;
  style?: ViewStyle;
}) {
  const palette = usePalette();
  const { ax, control } = useLayout();
  const circle = shape === "circle" && !ax;
  return (
    <Pressable accessibilityRole="button" {...rest} style={style}>
      {({ pressed }) => (
        <GlassSurface onPicture={onPicture}>
          <View
            style={[
              styles.content,
              circle
                ? { width: control, height: control }
                : { minHeight: control, minWidth: control, paddingHorizontal: ax ? 20 : 14, paddingVertical: ax ? 6 : 0 },
              pressed ? { backgroundColor: onPicture ? ON_PICTURE.glassSolid : palette.fill } : null,
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
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
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
