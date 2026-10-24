/**
 * Before the first Pray together (PC-15, Build 11 canvas): what it is, that FaceTime carries it, that nothing is
 * recorded; Start in FaceTime. Shown once per person; after that, Pray together starts at once.
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { InteractionManager, StyleSheet, View } from "react-native";

import { type CircleMember, circlesCloud } from "../../../modules/yada-pray";
import { Pill } from "../../components/Pill";
import { Fact } from "../../components/pray/Fact";
import { Ring } from "../../components/pray/Places";
import { SheetScreen } from "../../components/Sheet";
import { Prose } from "../../components/Type";
import { useAppData } from "../../data/AppData";
import { startTogether, TOGETHER_SEEN } from "../../data/together";
import { saveSetting } from "../../data/user";
import { BRAND } from "../../design/palette";
import { useIsDark } from "../../design/tokens";

export default function TogetherStart() {
  const { id = "", owner = "", name = "Circle" } = useLocalSearchParams<{ id?: string; owner?: string; name?: string }>();
  const { user } = useAppData();
  const dark = useIsDark();
  const [members, setMembers] = useState<CircleMember[]>([]);
  useEffect(() => void circlesCloud?.members(id, owner).then(setMembers).catch(() => setMembers([])), [id, owner]);

  // This sheet closes first: FaceTime's picker is presented over whatever is on top, and closing this sheet after
  // took the picker down with it (code review, 18 Oct 2026).
  const start = async () => {
    await saveSetting(user, TOGETHER_SEEN, "1").catch(() => undefined);
    router.back();
    InteractionManager.runAfterInteractions(() => startTogether(id, name));
  };

  return (
    <SheetScreen title="Pray together" backLabel={null} noBack footer={false} closeLabel="Not now" testID="together-start">
      <View style={[styles.ring, { backgroundColor: dark ? BRAND.forestCardDark : BRAND.forest }]}>
        <Ring members={members.filter((m) => m.joined)} size={190} />
      </View>
      <Prose step="scripture" style={{ marginTop: 18 }}>
        Pray together, out loud.
      </Prose>
      <View style={styles.facts}>
        <Fact icon="phone" title="A FaceTime audio call" line={`You ring people from ${name}.`} />
        <Fact icon="eye" title="The same request on every screen" line="Everyone on the call sees it. Next moves everyone on." />
        <Fact icon="lock" title="Nothing is recorded" line="Yada never hears the call." />
      </View>
      <View style={{ marginTop: 22 }}>
        <Pill title="Start in FaceTime" onPress={() => void start()} primary testID="together-start-go" />
      </View>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  ring: { borderRadius: 26, height: 210, alignItems: "center", justifyContent: "center" },
  facts: { rowGap: 14, marginTop: 16 },
});
