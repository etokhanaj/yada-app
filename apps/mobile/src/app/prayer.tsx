/**
 * A Bible prayer, to pray (PT-43, PT-44, FL-02; Build 12 BP-31, approved by John 24 Oct 2026). One verse at a time on
 * the prayer's own picture, blurred as Sit with a verse is: × and a segment per verse at the top, the prayer's title
 * over the verse large in Literata and its reference, then Listen (Heart, from this verse) and Next; the last verse's
 * Next is Amen, which counts the day. It replaces the page that showed the whole prayer first, with its Read button:
 * the frame starts praying at once and has no way to the reader.
 *
 * Text is never trimmed: where a prayer's first verse only introduces it (Matthew 6:9), the verse is shown whole (rule 4;
 * PR-08). BSB only, like the moments: a licensed text never reaches this page (rule 9).
 */

import { BOOK_CODES } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassButton } from "../components/Glass";
import { Icon } from "../components/Icon";
import { PictureGround } from "../components/PictureGround";
import { Pill } from "../components/Pill";
import { StepSegments } from "../components/StepSegments";
import { Chrome } from "../components/Type";
import { useAppData, useCore } from "../data/AppData";
import { listen } from "../data/audio";
import { PRAYERS_OF_THE_BIBLE, prayerPicture } from "../data/prayersOfTheBible";
import { getChapter, type VerseText } from "../data/queries";
import { countDay } from "../data/user";
import { ON_PICTURE } from "../design/palette";
import { FONTS, useLayout } from "../design/tokens";

export default function Prayer() {
  const { i = "0" } = useLocalSearchParams<{ i?: string }>();
  const prayer = PRAYERS_OF_THE_BIBLE[Number(i)];
  const core = useCore();
  const { user } = useAppData();
  const insets = useSafeAreaInsets();
  const { gutter, ax, pill } = useLayout();
  const [verses, setVerses] = useState<VerseText[]>([]);
  const [step, setStep] = useState<number | "amen">(0);

  useEffect(() => {
    if (prayer === undefined) return;
    void getChapter(core, prayer.book, prayer.chapter, "BSB")
      .then((all) => setVerses(all.filter((v) => v.verse >= prayer.from && v.verse <= prayer.to)))
      .catch(() => setVerses([]));
  }, [core, prayer]);

  if (prayer === undefined) return null;
  const book = prayer.book === "PSA" ? "Psalm" : BOOK_CODES[prayer.book].name;
  const at = step === "amen" ? verses.length : step;
  const v = verses[at];
  const last = at + 1 >= verses.length;
  const next = () => {
    if (step === "amen") return;
    if (!last) return setStep(at + 1);
    setStep("amen");
    void countDay(user).catch(() => undefined);
  };

  return (
    <View style={styles.root} testID={step === "amen" ? "prayer-amen" : "prayer"}>
      <PictureGround blurred day={prayerPicture(prayer)} />
      <View style={[styles.top, { paddingTop: insets.top + 4, paddingHorizontal: gutter - 8 }]}>
        <GlassButton onPicture onPress={() => router.back()} accessibilityLabel="End, back to Bible prayers" testID="prayer-close">
          <Icon name="close" size={20} tone="white" />
        </GlassButton>
        {step === "amen" || verses.length < 2 ? (
          <View style={{ flex: 1 }} />
        ) : (
          <StepSegments count={verses.length} fill={(n) => (n <= at ? 1 : 0)} label={`Verse ${at + 1} of ${verses.length}`} />
        )}
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        {step === "amen" ? (
          <View style={{ rowGap: 8 }}>
            <Chrome style={styles.amen} size={40} maxFontSizeMultiplier={1.4} accessibilityRole="header">
              Amen
            </Chrome>
            <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
              {prayer.title}
            </Chrome>
          </View>
        ) : (
          <View style={{ rowGap: 12 }}>
            <Chrome step="note" style={{ color: ON_PICTURE.strong, fontWeight: "600" }} accessibilityRole="header">
              {prayer.title}
            </Chrome>
            <Text style={styles.verse} maxFontSizeMultiplier={1.4} accessibilityLiveRegion="polite">
              {v?.text ?? ""}
            </Text>
            <Chrome step="note" style={{ color: ON_PICTURE.muted }}>{`${book} ${prayer.chapter}:${v?.verse ?? prayer.from}`}</Chrome>
          </View>
        )}
      </ScrollView>

      <View style={[styles.foot, { paddingHorizontal: gutter, paddingBottom: insets.bottom + 16 }, ax ? { flexDirection: "column" } : null]}>
        {step === "amen" ? (
          <Pill title="Done" onPicture stretch onPress={() => router.back()} testID="prayer-done" />
        ) : (
          <>
            <GlassButton
              onPicture
              shape="capsule"
              onPress={() => void listen(prayer.book, prayer.chapter, v?.verse ?? prayer.from)}
              accessibilityLabel={`Listen from ${book} ${prayer.chapter}:${v?.verse ?? prayer.from}`}
              style={ax ? { ...styles.listen, minHeight: pill } : { ...styles.listen, minHeight: pill, flex: 1 }}
              testID="prayer-listen"
            >
              <View style={styles.listenRow}>
                <Icon name="play" size={18} tone="white" />
                <Chrome style={{ color: ON_PICTURE.text, fontWeight: "600" }}>Listen</Chrome>
              </View>
            </GlassButton>
            <View style={ax ? null : { flex: 1 }}>
              <Pill title={last ? "Amen" : "Next"} onPicture stretch disabled={v === undefined} label={last ? "Amen, the end of the prayer" : "Next verse"} onPress={next} testID="prayer-next" />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", columnGap: 14 },
  body: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
  verse: { color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontSize: 30, lineHeight: 40, letterSpacing: -0.3 },
  amen: { color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400" },
  foot: { flexDirection: "row", alignItems: "center", columnGap: 8, rowGap: 8 },
  listen: { justifyContent: "center" },
  listenRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 6 },
});
