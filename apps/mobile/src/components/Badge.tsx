/**
 * Build 12: the lime badge, for anything new ("1 new") or done ("Answered"). Lime is Yada's brand colour and reads with
 * ink in both themes, so it needs no dark variant. The words carry the meaning; the colour only draws the eye
 * (accessibility: no state by colour alone).
 */

import { StyleSheet, View } from "react-native";

import { BADGE } from "../design/palette";
import { useLayout } from "../design/tokens";
import { Icon, type IconName } from "./Icon";
import { Chrome } from "./Type";

export function Badge({ text, icon }: { text: string; icon?: IconName }) {
  const { ax } = useLayout();
  return (
    <View style={[styles.badge, ax ? styles.badgeAx : null, { backgroundColor: BADGE.ground }]}>
      {icon !== undefined ? <Icon name={icon} size={12} color={BADGE.ink} strokeWidth={2.5} /> : null}
      <Chrome step="note" style={{ color: BADGE.ink, fontWeight: "700" }} size={12}>
        {text}
      </Chrome>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", columnGap: 4, alignSelf: "flex-start", minHeight: 22, paddingHorizontal: 8, borderRadius: 11 },
  badgeAx: { minHeight: 30, borderRadius: 15 },
});
