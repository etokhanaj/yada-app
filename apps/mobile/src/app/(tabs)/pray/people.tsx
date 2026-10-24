/**
 * A circle's people (PC-08, Build 11 canvas): who is in, and who is invited and has not joined yet, as an open place;
 * only the circle's creator removes anyone, from ⋯. No join dates: the share does not record them (rule 4's spirit:
 * never show what the data does not hold).
 */

import { MenuView } from "@react-native-menu/menu";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { AccessibilityInfo, Alert, StyleSheet, View } from "react-native";

import { type CircleMember, circlesCloud } from "../../../../modules/yada-pray";
import { Icon } from "../../../components/Icon";
import { PageScreen } from "../../../components/Page";
import { Pill } from "../../../components/Pill";
import { Avatar } from "../../../components/pray/Avatar";
import { Chrome } from "../../../components/Type";
import { useLayout, usePalette } from "../../../design/tokens";
import { CIRCLE_MAX } from "../../../lib/pray";

export default function People() {
  const { id = "", owner = "", name = "Circle", owned = "" } = useLocalSearchParams<{ id?: string; owner?: string; name?: string; owned?: string }>();
  const palette = usePalette();
  const { ax } = useLayout();
  const [members, setMembers] = useState<CircleMember[]>([]);
  const creator = owned !== "";
  const failed = () => AccessibilityInfo.announceForAccessibility("Couldn’t reach the circle. Try again.");
  const reload = useCallback(() => void circlesCloud?.members(id, owner).then(setMembers).catch(failed), [id, owner]);
  useFocusEffect(reload);

  const remove = (m: CircleMember) =>
    Alert.alert(`Remove ${m.name === "" ? "this person" : m.name}?`, "They stop seeing the circle’s requests. You can invite them again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void circlesCloud?.removeMember(id, m.id).then(reload).catch(failed) },
    ]);
  const invite = () => void circlesCloud?.invite(id).then(reload).catch(failed);
  const joined = members.filter((m) => m.joined).length;
  const size = ax ? 56 : 44;

  return (
    <PageScreen title="People" back={name} subtitle={`${joined} of ${CIRCLE_MAX}`} testID="circle-people">
      {members.map((m, i) => {
        const label = m.me ? `${m.name === "" ? "You" : `${m.name} (you)`}` : m.name === "" ? "Someone" : m.name;
        const line = m.creator ? "Started the circle" : m.joined ? "Joined" : "Invited · not joined yet";
        return (
          <View key={m.id} style={[styles.row, i === 0 ? null : { borderTopColor: palette.divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Avatar id={m.id} name={m.name} size={size} open={!m.joined} />
            <View style={{ flex: 1 }} accessible accessibilityLabel={`${label}. ${line}`}>
              <Chrome tone="ink" style={{ fontWeight: "600" }}>
                {label}
              </Chrome>
              <Chrome step="note" tone="muted">
                {line}
              </Chrome>
            </View>
            {creator && !m.me ? (
              <MenuView shouldOpenOnLongPress={false} actions={[{ id: "remove", title: "Remove", attributes: { destructive: true } }]} onPressAction={() => remove(m)}>
                <View style={styles.more} accessible accessibilityRole="button" accessibilityLabel={`More for ${label}: remove`}>
                  <Icon name="more" size={20} tone="muted" />
                </View>
              </MenuView>
            ) : null}
          </View>
        );
      })}
      {creator && members.length < CIRCLE_MAX ? (
        <View style={{ marginTop: 18 }}>
          <Pill title="Invite" onPress={invite} testID="people-invite" />
        </View>
      ) : null}
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", columnGap: 14, paddingVertical: 12 },
  more: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
