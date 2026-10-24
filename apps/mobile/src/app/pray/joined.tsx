/**
 * Joining a circle (PC-07, Build 11 canvas): shown once, after an invitation is opened. The circle's people in its
 * ring with the one who invited you marked, then what you'll see and what they'll see.
 *
 * Departure from PC-07: the frame has "Join" and "Not now", but iOS has already accepted the share by the time Yada
 * opens, so the choices are Open and Leave (Leave confirmed, as on the circle page, PC-06).
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type CircleMember, circlesCloud } from "../../../modules/yada-pray";
import { GlassButton } from "../../components/Glass";
import { Icon } from "../../components/Icon";
import { Pill } from "../../components/Pill";
import { Fact } from "../../components/pray/Fact";
import { Ring } from "../../components/pray/Places";
import { Chrome } from "../../components/Type";
import { BRAND, ON_PICTURE } from "../../design/palette";
import { FONTS, useIsDark, useLayout } from "../../design/tokens";
import { circleParams } from "../../lib/pray";

export default function Joined() {
  const params = useLocalSearchParams<{ id?: string; owner?: string; name?: string; owned?: string; people?: string }>();
  const { id = "", owner = "", name = "Circle" } = params;
  const insets = useSafeAreaInsets();
  const { gutter } = useLayout();
  const dark = useIsDark();
  const [members, setMembers] = useState<CircleMember[]>([]);
  useEffect(() => void circlesCloud?.members(id, owner).then(setMembers).catch(() => setMembers([])), [id, owner]);

  const inviter = members.find((m) => m.creator);
  const open = () => {
    router.back();
    router.push({ pathname: "/pray/circle", params: circleParams({ id, owner, name, owned: false, people: members.length }) });
  };
  const leave = () =>
    Alert.alert(`Leave ${name}?`, `You stop seeing its requests.${inviter !== undefined && inviter.name !== "" ? ` ${inviter.name} can invite you again.` : ""}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () =>
          void circlesCloud
            ?.leave(id, owner)
            .then(() => router.back())
            .catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t reach the circle. Try again.")),
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: dark ? BRAND.forestCardDark : BRAND.forest }} testID="circle-joined">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20, paddingHorizontal: gutter }}>
        <View style={{ alignItems: "flex-end" }}>
          <GlassButton onPicture onPress={() => router.back()} accessibilityLabel="Close">
            <Icon name="close" size={20} tone="white" />
          </GlassButton>
        </View>
        <View style={{ alignItems: "center", marginTop: 6 }}>
          <Ring members={members.filter((m) => m.joined)} size={230} highlight={inviter?.id} />
        </View>
        {inviter !== undefined && inviter.name !== "" ? (
          <Chrome step="note" style={{ color: BRAND.chartreuse, fontWeight: "600", textAlign: "center", marginTop: 4 }}>{`${inviter.name} invited you`}</Chrome>
        ) : null}
        <Chrome accessibilityRole="header" style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400", textAlign: "center", marginTop: 6 }} size={40}>
          {name}
        </Chrome>
        <View style={styles.facts}>
          <Fact icon="eye" title="You’ll see" line="What people here ask, and how many prayed. Never who." onDark />
          <Fact icon="lock" title="They’ll see" line="Only what you ask here. Never your list." onDark />
        </View>
        <View style={styles.actions}>
          <Pill title={`Open ${name}`} onPress={open} primary testID="joined-open" />
          <Pill title="Leave" onPress={leave} testID="joined-leave" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { rowGap: 14, marginTop: 24 },
  actions: { marginTop: "auto", paddingTop: 28, rowGap: 10 },
});
