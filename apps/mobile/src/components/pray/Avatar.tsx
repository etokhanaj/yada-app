/**
 * A person's initial (PC-01, PC-05, PC-07, PC-08, PC-16). One hue per person from their id, the same on every screen
 * and phone; deep with white initials on light surfaces, pale with ink initials on dark and forest ones
 * (docs/colour-rules.md; Telegram, Mesh, monday.com). Never green: green is the place, not a person. The one who
 * matters here (who invited you, who is speaking) gets a chartreuse ring, never a new colour. With no name shared, a
 * person icon, not an invented letter. Decorative: VoiceOver reads the name beside it.
 */

import { StyleSheet, View } from "react-native";

import { AVATAR_HUES, AVATAR_INK, AVATAR_SLOT, type AvatarHue, BRAND } from "../../design/palette";
import { useIsDark } from "../../design/tokens";
import { hashIndex, initialOf } from "../../lib/pray";
import { Icon } from "../Icon";
import { Chrome } from "../Type";

const HUES = Object.keys(AVATAR_HUES) as AvatarHue[];

export function hueFor(id: string): AvatarHue {
  return HUES[hashIndex(id, HUES.length)] ?? "lime";
}

export function Avatar({ id, name, size = 30, onDark, ring = false, open = false }: { id: string; name: string; size?: number; onDark?: boolean; ring?: boolean; open?: boolean }) {
  const dark = useIsDark();
  const pale = onDark ?? dark;
  if (open) return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.disc, { width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: pale ? AVATAR_SLOT.onDark : AVATAR_SLOT.onLight }]} />;
  const hue = AVATAR_HUES[hueFor(id)];
  const ground = pale ? hue.pale : hue.deep;
  const ink = pale ? AVATAR_INK.onPale : AVATAR_INK.onDeep;
  const letter = initialOf(name);
  const disc = (
    <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: ground }]}>
      {letter === null ? <Icon name="people" size={Math.round(size * 0.5)} color={ink} /> : <Chrome style={{ color: ink, fontWeight: "700", fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.5) }}>{letter}</Chrome>}
    </View>
  );
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={ring ? [styles.ring, { borderRadius: size / 2 + 4, borderColor: BRAND.chartreuse }] : null}>
      {disc}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: "center", justifyContent: "center" },
  ring: { padding: 2, borderWidth: 2.5 },
});
