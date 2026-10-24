/**
 * A Bible prayer, to pray (PT-43, PT-44, FL-02; approved by John 24 Oct 2026). A row on Bible prayers used to open the
 * reader, the same as any search result: you read about the prayer and nothing invited you to pray it. Here the
 * prayer stands alone on the calm ground Sit with this uses: its title, then the whole BSB text, centred. Pray it
 * slowly steps through it a verse at a time, at your own pace, to an Amen that counts the day; Listen reads it aloud;
 * Read opens the chapter for its context.
 *
 * Text is never trimmed: where a prayer's first verse only introduces it (Matthew 6:9), the verse is shown whole (rule 4;
 * PR-08). BSB only, like the moments: a licensed text never reaches this page (rule 9).
 */

import { BOOK_CODES } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MediaIcon } from "../components/audio/MediaIcon";
import { Icon } from "../components/Icon";
import { readerHref } from "../components/navigation";
import { Chrome } from "../components/Type";
import { useAppData, useCore } from "../data/AppData";
import { listen } from "../data/audio";
import { PRAYERS_OF_THE_BIBLE, prayerRef } from "../data/prayersOfTheBible";
import { getChapter, type VerseText } from "../data/queries";
import { countDay } from "../data/user";
import { BRAND, ON_PICTURE } from "../design/palette";
import { FONTS, useLayout } from "../design/tokens";

const NIGHT = BRAND.night;
const ON_NIGHT = BRAND.onNight;

export default function Prayer() {
  const { i = "0" } = useLocalSearchParams<{ i?: string }>();
  const prayer = PRAYERS_OF_THE_BIBLE[Number(i)];
  const core = useCore();
  const { user } = useAppData();
  const insets = useSafeAreaInsets();
  const { gutter } = useLayout();
  const [verses, setVerses] = useState<VerseText[]>([]);
  // null: the whole prayer; a number: praying it slowly, that verse; "amen": finished.
  const [step, setStep] = useState<number | "amen" | null>(null);

  useEffect(() => {
    if (prayer === undefined) return;
    void getChapter(core, prayer.book, prayer.chapter, "BSB")
      .then((all) =>
        setVerses(
          all.filter((v) => v.verse >= prayer.from && v.verse <= prayer.to),
        ),
      )
      .catch(() => setVerses([]));
  }, [core, prayer]);

  if (prayer === undefined) return null;
  const ref = prayerRef(prayer);
  // One verse of the Psalms is "Psalm", as the button shows it.
  const book = prayer.book === "PSA" ? "Psalm" : BOOK_CODES[prayer.book].name;
  const close = () => router.back();
  const next = () => {
    if (typeof step !== "number") return;
    if (step + 1 < verses.length) return setStep(step + 1);
    setStep("amen");
    void countDay(user).catch(() => undefined);
  };

  const top = (
    <View
      style={[
        styles.top,
        { paddingTop: insets.top + 6, paddingHorizontal: 16 },
      ]}
    >
      <StatusBar style="light" />
      <Pressable
        onPress={step === null ? close : () => setStep(null)}
        accessibilityRole="button"
        accessibilityLabel={
          step === null ? "Back to Bible prayers" : "End, back to the prayer"
        }
        style={styles.round}
        testID="prayer-close"
      >
        <Icon name={step === null ? "back" : "close"} size={20} tone="paper" />
      </Pressable>
      {typeof step === "number" ? (
        <Chrome
          step="note"
          style={styles.caption}
        >{`${prayer.title} · ${step + 1} of ${verses.length}`}</Chrome>
      ) : null}
      <View style={{ width: 44 }} />
    </View>
  );

  if (step === "amen")
    return (
      <View
        style={[styles.root, { paddingBottom: insets.bottom + 24 }]}
        testID="prayer-amen"
      >
        {top}
        <View style={styles.middle}>
          <Chrome style={styles.amen} size={40} accessibilityRole="header">
            Amen
          </Chrome>
          <Chrome
            step="note"
            style={{ color: ON_NIGHT, opacity: 0.7, marginTop: 8 }}
          >
            {prayer.title}
          </Chrome>
        </View>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          style={[styles.primary, { marginHorizontal: gutter }]}
          testID="prayer-done"
        >
          <Chrome style={styles.primaryText}>Done</Chrome>
        </Pressable>
      </View>
    );

  if (typeof step === "number") {
    const v = verses[step];
    return (
      <View
        style={[styles.root, { paddingBottom: insets.bottom + 24 }]}
        testID="prayer-slowly"
      >
        {top}
        <ScrollView
          contentContainerStyle={[
            styles.middleScroll,
            { paddingHorizontal: gutter },
          ]}
        >
          <Text
            style={styles.one}
            maxFontSizeMultiplier={1.6}
            accessibilityLiveRegion="polite"
          >
            {v?.text ?? ""}
          </Text>
          <Chrome
            step="note"
            style={{ color: ON_NIGHT, opacity: 0.7, marginTop: 14 }}
          >{`${book} ${prayer.chapter}:${v?.verse ?? prayer.from}`}</Chrome>
          {verses.length > 1 ? (
            <View style={styles.dots} accessibilityElementsHidden>
              {verses.map((x, n) => (
                <View
                  key={x.ord}
                  style={[styles.dot, n === step ? styles.dotOn : null]}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
        <Pressable
          onPress={next}
          accessibilityRole="button"
          accessibilityLabel={step + 1 < verses.length ? "Next verse" : "Amen"}
          style={[styles.primary, { marginHorizontal: gutter }]}
          testID="prayer-next"
        >
          <Chrome style={styles.primaryText}>
            {step + 1 < verses.length ? "Next" : "Amen"}
          </Chrome>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[styles.root, { paddingBottom: insets.bottom + 24 }]}
      testID="prayer"
    >
      {top}
      <ScrollView
        contentContainerStyle={[
          styles.middleScroll,
          { paddingHorizontal: gutter },
        ]}
      >
        <Chrome style={styles.title} size={30} accessibilityRole="header">
          {prayer.title}
        </Chrome>
        <Chrome
          step="note"
          style={{ color: ON_NIGHT, opacity: 0.75, marginTop: 4 }}
        >{`${ref} · BSB`}</Chrome>
        <Text
          style={styles.text}
          maxFontSizeMultiplier={1.6}
          accessibilityLabel={verses.map((v) => v.text).join(" ")}
        >
          {verses.map((v, n) => (
            <Text key={v.ord}>
              {n === 0 ? "" : " "}
              {verses.length > 1 ? (
                <Text style={styles.num}>{`${v.verse} `}</Text>
              ) : null}
              {v.text}
            </Text>
          ))}
        </Text>
      </ScrollView>
      <View style={{ paddingHorizontal: gutter, rowGap: 10 }}>
        <Pressable
          onPress={() => setStep(0)}
          disabled={verses.length === 0}
          accessibilityRole="button"
          style={styles.primary}
          testID="prayer-slowly-start"
        >
          <Chrome style={styles.primaryText}>Pray it slowly</Chrome>
        </Pressable>
        <View style={styles.row}>
          <Pressable
            onPress={() =>
              void listen(prayer.book, prayer.chapter, prayer.from)
            }
            accessibilityRole="button"
            accessibilityLabel="Listen"
            style={styles.secondary}
            testID="prayer-listen"
          >
            <MediaIcon name="play" size={16} tone="paper" />
            <Chrome style={styles.secondaryText}>Listen</Chrome>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push(
                readerHref({
                  book: prayer.book,
                  chapter: prayer.chapter,
                  verse: prayer.from,
                  to: prayer.to,
                  select: true,
                  back: "Prayer",
                }),
              )
            }
            accessibilityRole="button"
            accessibilityLabel={`Read ${book} ${prayer.chapter}`}
            style={styles.secondary}
            testID="prayer-read"
          >
            <Chrome
              style={styles.secondaryText}
              numberOfLines={1}
            >{`Read ${book} ${prayer.chapter}`}</Chrome>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ON_PICTURE.glass,
  },
  caption: {
    color: ON_NIGHT,
    opacity: 0.75,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  middle: { flex: 1, alignItems: "center", justifyContent: "center" },
  middleScroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  title: {
    color: ON_NIGHT,
    fontFamily: FONTS.scripture,
    fontWeight: "400",
    textAlign: "center",
  },
  text: {
    color: ON_NIGHT,
    fontFamily: FONTS.scripture,
    fontSize: 25,
    lineHeight: 36,
    textAlign: "center",
    marginTop: 22,
  },
  num: {
    fontFamily: "System",
    fontSize: 12,
    fontWeight: "600",
    color: ON_PICTURE.muted,
  },
  one: {
    color: ON_NIGHT,
    fontFamily: FONTS.scripture,
    fontSize: 30,
    lineHeight: 42,
    textAlign: "center",
  },
  amen: { color: ON_NIGHT, fontFamily: FONTS.scripture, fontWeight: "400" },
  dots: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 26,
    maxWidth: 260,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ON_PICTURE.track,
  },
  dotOn: { width: 18, backgroundColor: BRAND.chartreuse },
  primary: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: BRAND.chartreuse,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: BRAND.ink, fontWeight: "600" },
  row: { flexDirection: "row", columnGap: 10 },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: ON_PICTURE.glass,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 12,
  },
  secondaryText: { color: ON_NIGHT, fontWeight: "600" },
});
