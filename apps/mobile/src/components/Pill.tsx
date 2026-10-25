/**
 * The pill button (design system: "The primary action: an ink pill"; "A secondary action: a card-filled pill").
 * One component for what Share as an image, Ask for prayer and the iCloud sheet each drew with their own helper
 * (design-system pass, 18 Oct 2026). `grow` shares a row; at AX sizes a pill takes the full width.
 */

import { Pressable, StyleSheet } from "react-native";

import { BRAND, ON_PICTURE } from "../design/palette";
import { useLayout, usePalette } from "../design/tokens";
import { Icon, type IconName } from "./Icon";
import { Chrome } from "./Type";

export function Pill({
  title,
  onPress,
  primary = false,
  accent = false,
  stretch = false,
  grow = false,
  disabled = false,
  small = false,
  onPicture = false,
  icon,
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
  /** A row's one action (Build 12: "Pray", "Sit"): 36 pt tall inside a 44 pt target, at its own width even at AX. */
  small?: boolean;
  /** The one action over a picture (SW-01's Begin, SW-06 on the session's ground): white with ink words. */
  onPicture?: boolean;
  /** A glyph before the title (EM-01's "+ Add someone"). */
  icon?: IconName;
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
      hitSlop={small ? 4 : undefined}
      style={({ pressed }) => [
        styles.pill,
        small ? styles.small : null,
        { minHeight: small ? 36 : pill, backgroundColor: disabled ? palette.card : onPicture ? ON_PICTURE.text : accent ? palette.accent : primary ? palette.ink : palette.card, opacity: pressed ? 0.8 : 1 },
        small ? null : ax || stretch ? styles.wide : grow ? styles.grow : null,
      ]}
      testID={testID}
    >
      {/* Disabled: the same pill on card with muted text (design system), never grey with white. */}
      {icon !== undefined ? <Icon name={icon} size={18} color={onPicture ? BRAND.ink : primary || accent ? palette.paper : palette.ink} /> : null}
      <Chrome style={{ fontWeight: "600", color: disabled ? palette.mutedInk : onPicture ? BRAND.ink : primary || accent ? palette.paper : palette.ink }}>{title}</Chrome>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", columnGap: 6, borderRadius: 999, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  small: { paddingHorizontal: 16, marginVertical: 4 },
  grow: { flex: 1 },
  wide: { alignSelf: "stretch" },
});
