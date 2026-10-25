/**
 * Sit with a verse, its setup (SW-01; Build 12, John 24 Oct 2026: "the sit with a verse seems a bit much… take your time
 * with it as an expert"). One screen, one choice: the verse on the day's picture with Change, how long (5, 10 or 15 min,
 * decision 1), rain, Begin. It replaces the page of four named steps, which read as a menu of tools. Every door opens
 * it with a verse: Pray's tile and Today with the day's, a mood's passage, the reader's ⋯. Under a licensed translation
 * the verse is the BSB's and says so (rule 9).
 *
 * Refs: Jomo, setup with Start docked (mobbin.com/screens/6e83d8d7-db3c-47c1-bd87-e44513a34f29).
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassButton } from "../../components/Glass";
import { Icon } from "../../components/Icon";
import { PictureGround } from "../../components/PictureGround";
import { Pill } from "../../components/Pill";
import { Segmented } from "../../components/Segmented";
import { Chrome } from "../../components/Type";
import { setAmbient, useAmbient } from "../../data/ambient";
import { ON_PICTURE } from "../../design/palette";
import { FONTS, useLayout } from "../../design/tokens";
import { SESSION_MINUTES, type SessionMinutes } from "../../lib/sit";
import { type SitVerse, useSitChoice } from "../../state/sit";

const LENGTHS = SESSION_MINUTES.map((m) => ({ value: String(m) as `${SessionMinutes}`, label: `${m} min` }));

export default function SitSetup() {
  const params = useLocalSearchParams<{ text?: string; ref?: string; bsb?: string; place?: string; why?: string }>();
  const insets = useSafeAreaInsets();
  const { gutter, ax } = useLayout();
  const [verse, setVerse] = useState<SitVerse & { why: string | null }>({
    text: params.text ?? "",
    ref: params.ref ?? "",
    bsb: params.bsb === "1",
    place: params.place ?? "",
    why: params.why ?? null,
  });
  const [minutes, setMinutes] = useState<`${SessionMinutes}`>("5");
  const rain = useAmbient((s) => s.on);

  // Choose a verse (SW-02) hands its choice back through the store; the setup takes it and clears it.
  useEffect(() => {
    useSitChoice.getState().clear();
    return useSitChoice.subscribe((s) => {
      if (s.chosen === null) return;
      setVerse({ ...s.chosen, why: null });
      s.clear();
    });
  }, []);
  // Rain stops when Sit closes, not between its screens.
  useEffect(() => () => void setAmbient(false), []);

  const refLine = [verse.why, verse.ref, verse.bsb ? "BSB" : null].filter((x) => x !== null && x !== "").join(" · ");
  const begin = () =>
    router.push({
      pathname: "/sit/session",
      params: { text: verse.text, ref: verse.ref, bsb: verse.bsb ? "1" : "", place: verse.place, minutes },
    });

  return (
    <View style={styles.screen} testID="sit">
      <PictureGround />
      <View style={[styles.bar, { paddingTop: insets.top + 4, paddingHorizontal: gutter - 8 }]}>
        <GlassButton onPicture onPress={() => router.back()} accessibilityLabel="Close" testID="sit-close">
          <Icon name="close" size={20} tone="white" />
        </GlassButton>
        {/* AS-01: rain is a switch, so it says when it is on; tapped again it stops. */}
        <GlassButton
          onPicture
          shape="capsule"
          onPress={() => void setAmbient(!rain)}
          accessibilityRole="switch"
          accessibilityState={{ checked: rain }}
          accessibilityLabel="The sound of rain"
          testID="sit-rain"
        >
          <View style={styles.rain}>
            <Icon name="cloud" size={20} tone="white" />
            <Chrome style={{ color: ON_PICTURE.text, fontWeight: "600" }}>{rain ? "Rain on" : "Rain"}</Chrome>
          </View>
        </GlassButton>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <Chrome step="note" style={{ color: ON_PICTURE.muted, fontWeight: "600" }}>
          Sit with a verse
        </Chrome>
        <Chrome
          style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400", letterSpacing: -0.4 }}
          size={30}
          maxFontSizeMultiplier={1.27}
          accessibilityLabel={`${verse.text} ${verse.ref}`}
          testID="sit-verse"
        >
          {verse.text}
        </Chrome>
        <View style={styles.refRow}>
          <Chrome style={{ color: ON_PICTURE.strong, fontWeight: "600", flexShrink: 1 }}>{refLine}</Chrome>
          <GlassButton onPicture shape="capsule" onPress={() => router.push("/sit/choose")} accessibilityLabel="Change, choose another verse" testID="sit-change">
            <Chrome style={{ color: ON_PICTURE.text, fontWeight: "600" }}>Change</Chrome>
          </GlassButton>
        </View>
      </ScrollView>

      <View style={[styles.foot, { paddingHorizontal: gutter, paddingBottom: insets.bottom + 16 }]}>
        <Segmented onPicture options={LENGTHS} value={minutes} onChange={setMinutes} label="How long" testID="sit-length" />
        {ax ? null : (
          <Chrome step="note" style={{ color: ON_PICTURE.strong, textAlign: "center" }}>
            Breathe, hear it read twice, then stay with it in quiet
          </Chrome>
        )}
        <Pill title="Begin" onPicture stretch onPress={begin} label={`Begin, ${minutes} minutes`} testID="sit-begin" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rain: { flexDirection: "row", alignItems: "center", columnGap: 6 },
  body: { flexGrow: 1, justifyContent: "center", rowGap: 14, paddingVertical: 24 },
  refRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  foot: { rowGap: 14 },
});
