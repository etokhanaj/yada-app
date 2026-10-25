/**
 * The day's verse (DR-16, DR-17; Build 12 VF-30, approved by John 25 Oct 2026): a tap on Today's picture or verse fills
 * the screen with them. "Today's verse · Jonah 2:4" over the verse large in Literata, and at the foot the row Today has:
 * Sit, Listen, Share, More (Read the chapter, Compare translations, Copy, About this picture). × closes it; Earlier days
 * is a pill at the top, as YouVersion's Verse of the Day has it. Opened for an earlier day from Earlier days (DR-19).
 *
 * The morning's or the evening's picture runs edge to edge under the design system's fade, darker under the words;
 * with no picture the ground is the deep forest, never blank (RT-08).
 */

import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { readerHref } from "../components/navigation";
import { FillPicture } from "../components/FillPicture";
import { GlassButton } from "../components/Glass";
import { Icon } from "../components/Icon";
import { Chrome } from "../components/Type";
import { VerseActions } from "../components/VerseActions";
import { useCore, useQuery } from "../data/AppData";
import { listen } from "../data/audio";
import { pictureFor } from "../data/pictures";
import { dayVerse } from "../data/today";
import { BRAND, ON_PICTURE } from "../design/palette";
import { FONTS, useLayout } from "../design/tokens";
import { chapterTitle } from "../lib/reader";
import { dayOf, dayParam, parseDayParam, type Part, partOf, pictureDay, whenLabel } from "../lib/today";
import { useAccessibility } from "../state/accessibility";
import { useSettings } from "../state/settings";

export default function DayVerse() {
  const params = useLocalSearchParams<{ day?: string; part?: string }>();
  const core = useCore();
  const insets = useSafeAreaInsets();
  const { gutter, ax } = useLayout();
  const solid = useAccessibility((s) => s.reduceTransparency);
  const translation = useSettings((s) => s.translation);
  const [now] = useState(() => new Date());
  const today = dayOf(now);
  const day = parseDayParam(params.day) ?? today;
  const part: Part = params.part === "evening" || params.part === "morning" ? params.part : partOf(now);
  const { data: verse } = useQuery(() => dayVerse(core, translation, day, part), [dayParam(day), part, translation]);
  const picture = pictureFor(day, part);
  const when = whenLabel(day, part, today);

  // Pages open from Today, not over this full screen: it closes first, as × would (a page pushed over a
  // full-screen modal opens behind it).
  const leaveFor = (go: () => void) => {
    router.back();
    go();
  };
  const share = () =>
    verse != null &&
    router.push({
      pathname: "/share-image",
      params: { verse: `${verse.place.book}.${verse.place.chapter}.${verse.place.verse}`, translation, ground: picture === undefined ? "dark" : part === "evening" ? "evening" : "picture", day: String(pictureDay(day)) },
    });
  const menu = (event: string) => {
    if (verse == null) return;
    if (event === "read") leaveFor(() => router.push(readerHref({ ...verse.place, select: true, back: "Today" })));
    else if (event === "compare") router.push({ pathname: "/evidence/translations", params: { ref: `${verse.place.book}.${verse.place.chapter}.${verse.place.verse}` } });
    else if (event === "copy") void Clipboard.setStringAsync(`“${verse.text}” ${verse.ref}${verse.bsb ? " BSB" : ""}`).then(() => AccessibilityInfo.announceForAccessibility("Copied"));
    else if (event === "about") router.push({ pathname: "/picture", params: { day: dayParam(day), part } });
  };

  return (
    <View style={[styles.root, { backgroundColor: BRAND.night }]} testID="day-verse">
      <StatusBar style="light" />
      {picture !== undefined ? <FillPicture source={picture.image} alt={picture.alt} /> : null}
      {/* Under Reduce Transparency the fade runs darker still, at least 86% under the words (design system). */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage: solid
              ? "linear-gradient(rgba(14,14,12,0.7), rgba(14,14,12,0.9) 45%, rgba(14,14,12,0.95))"
              : "linear-gradient(rgba(8,12,10,0.45), rgba(8,12,10,0.15) 35%, rgba(8,12,10,0.8))",
          },
        ]}
      />
      <View style={[styles.top, { paddingTop: insets.top + 4, paddingHorizontal: gutter - 8 }]}>
        <GlassButton onPicture onPress={() => router.back()} accessibilityLabel="Close, back to Today" testID="day-verse-close">
          <Icon name="close" size={20} tone="white" maxScale={1} />
        </GlassButton>
        <GlassButton onPicture shape="capsule" onPress={() => leaveFor(() => router.push("/earlier"))} style={styles.earlier} testID="day-verse-earlier">
          <Chrome style={{ color: ON_PICTURE.text, fontWeight: "600" }}>Earlier days</Chrome>
        </GlassButton>
      </View>

      <View style={[styles.words, { paddingHorizontal: gutter }]}>
        {verse == null ? null : (
          <>
            <Chrome step="note" style={styles.when}>{`${dayParam(day) === dayParam(today) ? "Today’s verse" : when} · ${verse.ref}${verse.bsb ? " · BSB" : ""}`}</Chrome>
            <Text style={[styles.verse, ax ? { fontSize: 34, lineHeight: 46 } : null]} maxFontSizeMultiplier={1.8}>
              {verse.text}
            </Text>
          </>
        )}
      </View>

      <View style={{ paddingBottom: insets.bottom + 18, paddingHorizontal: gutter }}>
        {verse == null ? null : (
          // VF-30: the row Today's verse has (TD-30), so the verse does the same things wherever it is large.
          <VerseActions
            onPicture
            actions={[
              {
                icon: "sit",
                title: "Sit",
                label: `Sit with ${verse.ref}`,
                onPress: () => leaveFor(() => router.push({ pathname: "/sit", params: { text: verse.text, ref: verse.ref, bsb: verse.bsb ? "1" : "", place: `${verse.place.book}.${verse.place.chapter}.${verse.place.verse}`, why: when } })),
                testID: "day-verse-sit",
              },
              { icon: "play", title: "Listen", label: `Listen from ${verse.ref}`, onPress: () => void listen(verse.place.book, verse.place.chapter, verse.place.verse), testID: "day-verse-listen" },
              { icon: "share", title: "Share", label: `Share ${verse.ref} as an image`, onPress: share, testID: "day-verse-share" },
            ]}
            more={{
              actions: [
                { id: "read", title: `Read ${chapterTitle(verse.place.book, verse.place.chapter)}` },
                { id: "compare", title: "Compare translations" },
                { id: "copy", title: "Copy" },
                ...(picture === undefined ? [] : [{ id: "about", title: "About this picture" }]),
              ],
              onChoose: menu,
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  earlier: { minHeight: 44, paddingHorizontal: 16, justifyContent: "center" },
  words: { flex: 1, justifyContent: "flex-end", paddingBottom: 24, rowGap: 14 },
  when: { color: ON_PICTURE.strong, fontWeight: "600" },
  verse: { fontFamily: FONTS.scripture, fontSize: 30, lineHeight: 39, letterSpacing: -0.4, color: ON_PICTURE.text },
});
