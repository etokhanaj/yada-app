/**
 * Joining a circle (Build 12 PC-34, approved by John 25 Oct 2026; PC-07 before it): shown once, after an invitation is
 * opened. The circle's picture, its people with the one who invited you ringed, "Sam invited you to Home group", one
 * line on what you'll see and what they'll see, and Open. Leave is on the circle's own ⋯, as for any circle: one
 * thing to do here.
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type CircleMember, circlesCloud } from "../../../modules/yada-pray";
import { GlassButton } from "../../components/Glass";
import { Icon } from "../../components/Icon";
import { PictureGround } from "../../components/PictureGround";
import { Pill } from "../../components/Pill";
import { Avatar } from "../../components/pray/Avatar";
import { Chrome } from "../../components/Type";
import { ON_PICTURE } from "../../design/palette";
import { FONTS, useLayout } from "../../design/tokens";
import { circleParams, circlePicture } from "../../lib/pray";

export default function Joined() {
  const params = useLocalSearchParams<{ id?: string; owner?: string; name?: string; owned?: string; people?: string; picture?: string }>();
  const { id = "", owner = "", name = "Circle" } = params;
  const picture = Number(params.picture) || circlePicture({ id });
  const insets = useSafeAreaInsets();
  const { gutter } = useLayout();
  const [members, setMembers] = useState<CircleMember[]>([]);
  useEffect(() => void circlesCloud?.members(id, owner).then(setMembers).catch(() => setMembers([])), [id, owner]);

  const inviter = members.find((m) => m.creator);
  const joined = members.filter((m) => m.joined);
  const open = () => {
    router.back();
    router.push({ pathname: "/pray/circle", params: circleParams({ id, owner, name, owned: false, people: joined.length, picture }) });
  };

  return (
    <View style={styles.root} testID="circle-joined">
      <PictureGround day={picture} />
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: gutter - 8, alignItems: "flex-end" }}>
        <GlassButton onPicture onPress={() => router.back()} accessibilityLabel="Close">
          <Icon name="close" size={20} tone="white" />
        </GlassButton>
      </View>
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        <View style={styles.faces} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {joined.slice(0, 5).map((m, i) => (
            <View key={m.id} style={i === 0 ? null : { marginLeft: -8 }}>
              <Avatar id={m.id} name={m.name} size={40} onDark ring={m.id === inviter?.id} />
            </View>
          ))}
        </View>
        <Chrome accessibilityRole="header" style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400" }} size={32}>
          {inviter !== undefined && inviter.name !== "" ? `${inviter.name} invited you to ${name}` : `You’re in ${name}`}
        </Chrome>
        <Chrome style={{ color: ON_PICTURE.strong, lineHeight: 24 }}>You’ll see what people here ask, and how many prayed, never who. They see only what you ask here.</Chrome>
      </View>
      <View style={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 16 }}>
        <Pill title={`Open ${name}`} onPicture stretch onPress={open} testID="joined-open" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, justifyContent: "flex-end", rowGap: 12, paddingBottom: 20 },
  faces: { flexDirection: "row", alignItems: "center" },
});
