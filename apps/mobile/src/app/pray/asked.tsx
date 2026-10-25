/**
 * Asked by one person (Build 12 AO-04, approved by John 25 Oct 2026): opened from the link in their message, once iOS
 * has accepted it. On a picture, blurred: who asked (the name iCloud shares for them) and when, the request large,
 * what they will see (that you prayed, nothing else about you), and Prayed. An ask that has ended says so.
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type CircleMember, type CircleRequest, circlesCloud } from "../../../modules/yada-pray";
import { GlassButton } from "../../components/Glass";
import { Icon } from "../../components/Icon";
import { PictureGround } from "../../components/PictureGround";
import { Pill } from "../../components/Pill";
import { Avatar } from "../../components/pray/Avatar";
import { Chrome } from "../../components/Type";
import { useAppData } from "../../data/AppData";
import { markPrayed } from "../../data/prayLocal";
import { countDay } from "../../data/user";
import { ON_PICTURE } from "../../design/palette";
import { FONTS, useLayout } from "../../design/tokens";
import { askedLine } from "../../lib/pray";

export default function Asked() {
  const { id = "", owner = "" } = useLocalSearchParams<{ id?: string; owner?: string }>();
  const { user } = useAppData();
  const insets = useSafeAreaInsets();
  const { gutter } = useLayout();
  const [request, setRequest] = useState<CircleRequest | null | undefined>(undefined);
  const [asker, setAsker] = useState<CircleMember | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (circlesCloud === null) return setRequest(null);
    void circlesCloud
      .requests(id, owner)
      .then((all) => setRequest(all[0] ?? null))
      .catch(() => setRequest(null));
    void circlesCloud
      .members(id, owner)
      .then((m) => setAsker(m.find((p) => p.creator) ?? null))
      .catch(() => setAsker(null));
  }, [id, owner]);

  const name = asker?.name ?? "";
  const pray = () => {
    if (request == null) return;
    void circlesCloud
      ?.prayed(id, owner, request.id)
      .then(() => {
        setDone(true);
        void markPrayed(user, request.id).catch(() => undefined);
        void countDay(user).catch(() => undefined);
        AccessibilityInfo.announceForAccessibility(name === "" ? "Prayed. They’ll see it." : `Prayed. ${name} will see it.`);
      })
      .catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t mark it prayed. Try again."));
  };

  return (
    <View style={styles.root} testID="pray-asked">
      <PictureGround blurred />
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: gutter - 8 }}>
        <GlassButton onPicture onPress={() => router.back()} accessibilityLabel="Close" testID="asked-close">
          <Icon name="close" size={20} tone="white" />
        </GlassButton>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.body, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        {request === undefined ? null : request === null ? (
          <Chrome style={styles.big} maxFontSizeMultiplier={1.4}>This request has ended.</Chrome>
        ) : (
          <>
            <View style={styles.who}>
              {asker === null ? null : <Avatar id={asker.id} name={asker.name} size={36} onDark />}
              <View>
                <Chrome style={{ color: ON_PICTURE.text, fontWeight: "600" }}>{name === "" ? "Someone asked you" : `${name} asked you`}</Chrome>
                <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
                  {`Asked ${(askedLine("", request.createdAt, Date.now()) ?? "").toLowerCase()}`}
                </Chrome>
              </View>
            </View>
            <Chrome style={styles.big} maxFontSizeMultiplier={1.4} accessibilityRole="header">
              {request.text}
            </Chrome>
            <Chrome step="note" style={{ color: ON_PICTURE.strong }}>
              {done ? (name === "" ? "They’ll see that you prayed." : `${name} will see that you prayed.`) : `${name === "" ? "They see" : `${name} sees`} that you prayed. Nothing else about you.`}
            </Chrome>
          </>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 16 }}>
        {request == null ? (
          <Pill title="Close" onPicture stretch onPress={() => router.back()} testID="asked-done" />
        ) : done ? (
          <Pill title="Done" onPicture stretch onPress={() => router.back()} testID="asked-done" />
        ) : (
          <Pill title="Prayed" icon="check" onPicture stretch onPress={pray} testID="asked-prayed" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flexGrow: 1, justifyContent: "center", rowGap: 16, paddingVertical: 16 },
  who: { flexDirection: "row", alignItems: "center", columnGap: 10 },
  big: { color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400", fontSize: 30, lineHeight: 39, letterSpacing: -0.3 },
});
