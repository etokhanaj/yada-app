/**
 * The pill button (design system: "The primary action: an ink pill"; "A secondary action: a card-filled pill").
 * One component for what Share as an image, Ask for prayer and the iCloud sheet each drew with their own helper
 * (design-system pass, 18 Oct 2026). `grow` shares a row; at AX sizes a pill takes the full width.
 */

import { Pressable, StyleSheet } from "react-native";

import { useLayout, usePalette } from "../design/tokens";
import { Chrome } from "./Type";

export function Pill({
  title,
  onPress,
  primary = false,
  accent = false,
  stretch = false,
  grow = false,
  disabled = false,
  label,
  testID,
}: {
  title: string;
  onPress: () => void;
  primary?: boolean;
  /** The accent fill, for the one forward action on a page (SC-06's Start, VM-02's Open in Bible). */
  accent?: boolean;
  /** Full width (VM-02's Open in Bible). */
  stretch?: boolean;
  grow?: boolean;
  disabled?: boolean;
  /** For VoiceOver, when the title alone does not say where it goes. */
  label?: string;
  testID?: string;
}) {
  const palette = usePalette();
  const { ax, pill } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.pill,
        { minHeight: pill, backgroundColor: disabled ? palette.card : accent ? palette.accent : primary ? palette.ink : palette.card, opacity: pressed ? 0.8 : 1 },
        ax || stretch ? styles.wide : grow ? styles.grow : null,
      ]}
      testID={testID}
    >
      {/* Disabled: the same pill on card with muted text (design system), never grey with white. */}
      <Chrome style={{ fontWeight: "600", color: disabled ? palette.mutedInk : primary || accent ? palette.paper : palette.ink }}>{title}</Chrome>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 999, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1 },
  wide: { alignSelf: "stretch" },
});
