/**
 * The day's verse (DR-16, DR-17): a tap on Today's picture or verse fills the screen with them. "Today · Psalm 1:3"
 * over the verse in Literata, and at the foot Read, Listen and Share; no counts. × closes it; ⋯ holds Read the
 * chapter, Compare translations, Share as an image, Earlier days and About this picture. Opened for an earlier day from
 * Earlier days (DR-19). Before the change, the picture opened the reader at the verse (frame inventory, 18 Oct 2026).
 *
 * The morning's or the evening's picture runs edge to edge under the design system's fade, darker under the words;
 * with no picture the ground is the deep forest, never blank (RT-08).
 */

import { MenuView } from "@react-native-menu/menu";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { readerHref } from "../components/navigation";
import { Icon, type IconName } from "../components/Icon";
import { MediaIcon } from "../components/audio/MediaIcon";
import { Chrome } from "../components/Type";
import { useCore, useQuery } from "../data/AppData";
import { listen } from "../data/audio";
import { pictureFor } from "../data/pictures";
import { dayVerse } from "../data/today";
import { BRAND, ON_PICTURE, SYSTEM } from "../design/palette";
import { FONTS, useLayout } from "../design/tokens";
import { chapterTitle } from "../lib/reader";
import { dayOf, dayParam, parseDayParam, type Part, partOf, pictureDay, whenLabel } from "../lib/today";
import { useAccessibility } from "../state/accessibility";
import { useSettings } from "../state/settings";
import { FillPicture } from "../components/FillPicture";

const WHITE = ON_PICTURE.text;

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
  const read = () => verse != null && leaveFor(() => router.push(readerHref({ ...verse.place, select: true, back: "Today" })));
  const share = () =>
    verse != null &&
    router.push({
      pathname: "/share-image",
      params: { verse: `${verse.place.book}.${verse.place.chapter}.${verse.place.verse}`, translation, ground: picture === undefined ? "dark" : part === "evening" ? "evening" : "picture", day: String(pictureDay(day)) },
    });
  const menu = (event: string) => {
    if (verse == null) return;
    if (event === "read") leaveFor(() => router.push(readerHref({ book: verse.place.book, chapter: verse.place.chapter, verse: 1, back: "Today" })));
    else if (event === "compare") router.push({ pathname: "/evidence/translations", params: { ref: `${verse.place.book}.${verse.place.chapter}.${verse.place.verse}` } });
    else if (event === "image") share();
    else if (event === "earlier") leaveFor(() => router.push("/earlier"));
    else if (event === "about") router.push({ pathname: "/picture", params: { day: dayParam(day), part } });
  };

  const round = (child: React.ReactNode) => (
    <View style={[styles.round, { backgroundColor: solid ? ON_PICTURE.glassSolid : ON_PICTURE.glass }]}>{child}</View>
  );
  const action = (label: string, glyph: React.ReactNode, onPress: () => void, testID: string, a11y: string) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={styles.action} testID={testID}>
      {glyph}
      <Text style={[styles.actionText, ax ? { fontSize: 17 } : null]} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
    </Pressable>
  );
  const icon = (name: IconName) => <Icon name={name} size={18} tone="white" maxScale={1.4} />;

  return (
    <View style={[styles.root, { backgroundColor: BRAND.night }]} testID="day-verse">
      <StatusBar style="light" />
      {picture !== undefined ? (
        <FillPicture source={picture.image} alt={picture.alt} />
      ) : null}
      {/* Under Reduce Transparency the fade runs darker still, at least 86% under the words (design system). */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage: solid
              ? "linear-gradient(rgba(14,14,12,0.7), rgba(14,14,12,0.9) 45%, rgba(14,14,12,0.95))"
              : "linear-gradient(rgba(14,14,12,0.35), rgba(14,14,12,0.2) 25%, rgba(14,14,12,0.75) 55%, rgba(14,14,12,0.92))",
          },
        ]}
      />
      <View style={[styles.top, { paddingTop: insets.top + 6, paddingHorizontal: gutter }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close, back to Today" hitSlop={4} testID="day-verse-close">
          {round(<Icon name="close" size={20} tone="white" maxScale={1} />)}
        </Pressable>
        <MenuView
          shouldOpenOnLongPress={false}
          actions={[
            // imageColor always set: without it @react-native-menu draws the glyph transparent (index.tsx, 10 Oct 2026).
            { id: "read", title: verse == null ? "Read" : `Read ${chapterTitle(verse.place.book, verse.place.chapter)}`, image: "book", imageColor: SYSTEM.menuIcon },
            { id: "compare", title: "Compare translations", image: "rectangle.split.2x1", imageColor: SYSTEM.menuIcon },
            { id: "image", title: "Share as an image", image: "photo", imageColor: SYSTEM.menuIcon },
            { id: "earlier", title: "Earlier days", image: "calendar", imageColor: SYSTEM.menuIcon },
            ...(picture === undefined ? [] : [{ id: "about", title: "About this picture", image: "info.circle", imageColor: SYSTEM.menuIcon }]),
          ]}
          onPressAction={({ nativeEvent }) => menu(nativeEvent.event)}
          testID="day-verse-more"
        >
          <View pointerEvents="none" accessible accessibilityRole="button" accessibilityLabel="More: read the chapter, compare, share as an image, earlier days, about this picture">
            {round(<Icon name="more" size={20} tone="white" maxScale={1} />)}
          </View>
        </MenuView>
      </View>

      <View style={[styles.words, { paddingHorizontal: gutter }]}>
        {verse == null ? null : (
          <>
            <Chrome step="note" style={styles.when}>{`${when} · ${verse.ref}${verse.bsb ? " · BSB" : ""}`}</Chrome>
            <Text style={[styles.verse, ax ? { fontSize: 34, lineHeight: 46 } : null]} maxFontSizeMultiplier={1.8}>
              {verse.text}
            </Text>
          </>
        )}
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 18, paddingHorizontal: gutter }]}>
        {action("Read", <BookGlyph />, read, "day-verse-read", verse == null ? "Read" : `Read ${verse.ref}`)}
        {action("Listen", <MediaIcon name="play" size={18} tone="white" maxScale={1.4} />, () => verse != null && void listen(verse.place.book, verse.place.chapter, verse.place.verse), "day-verse-listen", "Listen from this verse")}
        {action("Share", icon("share"), share, "day-verse-share", "Share as an image")}
      </View>
    </View>
  );
}

/** The canvas's open book (DR-16's Read), as the tab bar's Bible draws it. */
function BookGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={WHITE} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
      <Path d="M12 6c-2-1.4-5-2-8-1.6v13c3-.4 6 .2 8 1.6 2-1.4 5-2 8-1.6v-13c-3-.4-6 .2-8 1.6zM12 6v13" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: "row", justifyContent: "space-between" },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  words: { flex: 1, justifyContent: "flex-end", paddingBottom: 28, rowGap: 10 },
  when: { color: WHITE, fontWeight: "600", opacity: 0.92 },
  verse: { fontFamily: FONTS.scripture, fontSize: 24, lineHeight: 34, color: WHITE },
  actions: { flexDirection: "row", justifyContent: "space-around" },
  action: { minWidth: 72, minHeight: 56, alignItems: "center", justifyContent: "center", rowGap: 4 },
  actionText: { color: WHITE, fontSize: 13, fontWeight: "600" },
});
