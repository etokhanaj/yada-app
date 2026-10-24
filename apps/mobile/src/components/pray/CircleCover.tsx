/**
 * A circle as a portrait cover (PC-01), as the translations are covers (MT-02): the circle's tone from its id, a few of
 * its people, its name in Literata, how many, and the newest request's opening words in italic. Refs: Orb Social's club
 * covers (mobbin.com/screens/9893a62e-4374-42ba-849b-166267debd25). At AX sizes the covers stack full width.
 */

import { Pressable, StyleSheet, View } from "react-native";

import type { Circle, CircleMember } from "../../../modules/yada-pray";
import { BRAND, CIRCLE_TONES, ON_PICTURE } from "../../design/palette";
import { FONTS, useLayout, usePalette } from "../../design/tokens";
import { hashIndex, peopleLine } from "../../lib/pray";
import { Icon } from "../Icon";
import { Chrome } from "../Type";
import { Avatar } from "./Avatar";

export function circleTone(id: string): string {
  return CIRCLE_TONES[hashIndex(id, CIRCLE_TONES.length)] ?? CIRCLE_TONES[0];
}

/**
 * A circle as a cover (PC-01; PT-34, 24 Oct 2026): who is in, its name and size. The newest request's words left the
 * cover, which made it too tall on the Pray tab; a lime "N new" says when there are requests you haven't prayed.
 */
export function CircleCover({ circle, members, fresh, onPress }: { circle: Circle; members: readonly CircleMember[]; fresh: number; onPress: () => void }) {
  const { ax } = useLayout();
  const label = [circle.name, peopleLine(circle.people), fresh > 0 ? `${fresh} new` : null].filter((x) => x !== null).join(". ");
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.cover, ax ? styles.wide : null, { backgroundColor: circleTone(circle.id) }]}>
      <View style={styles.avatars}>
        {members.slice(0, 3).map((m, i) => (
          <View key={m.id} style={i === 0 ? null : { marginLeft: -8 }}>
            <Avatar id={m.id} name={m.name} onDark />
          </View>
        ))}
      </View>
      <View>
        <Chrome style={[styles.name, { color: ON_PICTURE.text, fontFamily: FONTS.scripture }]} size={20} numberOfLines={2}>
          {circle.name}
        </Chrome>
        <View style={styles.meta}>
          {fresh > 0 ? (
            <View style={[styles.fresh, { backgroundColor: BRAND.chartreuse }]}>
              <Chrome step="note" style={{ color: BRAND.ink, fontWeight: "600" }} size={12}>{`${fresh} new`}</Chrome>
            </View>
          ) : null}
          <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
            {peopleLine(circle.people)}
          </Chrome>
        </View>
      </View>
    </Pressable>
  );
}

/** The last cover: start one. */
export function NewCircleCover({ onPress }: { onPress: () => void }) {
  const { ax } = useLayout();
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="New circle. Pray with people you invite" style={[styles.cover, styles.newCover, { borderColor: palette.divider }, ax ? styles.wide : null]} testID="pray-new-circle">
      {({ pressed }) => (
        <View style={{ rowGap: 8, opacity: pressed ? 0.6 : 1 }}>
          {/* PC-12: the + sits in a 44 pt filled disc, the tap target the frame draws. */}
          <View style={[styles.plus, { backgroundColor: palette.fill }]}>
            <Icon name="plus" size={22} />
          </View>
          <Chrome tone="ink" style={{ fontFamily: FONTS.scripture }} size={20}>
            New circle
          </Chrome>
          <Chrome step="note" tone="muted">
            Up to 12 people
          </Chrome>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: { width: 150, minHeight: 132, borderRadius: 20, padding: 14, justifyContent: "space-between" },
  wide: { width: "100%", minHeight: 132 },
  meta: { flexDirection: "row", alignItems: "center", columnGap: 6, marginTop: 4 },
  fresh: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  newCover: { justifyContent: "center", borderWidth: 1.5 },
  plus: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatars: { flexDirection: "row" },
  name: { fontWeight: "400", letterSpacing: -0.3 },
});
