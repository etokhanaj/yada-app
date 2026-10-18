/**
 * Back after a month or more (canvas RT-01, RT-08; John approved 18 Oct 2026): the day's picture, "You were in Mark 4.",
 * one button, one quiet link. No count of days, no apology, no verse (a hard verse on a welcome screen: left out).
 *
 * Shown by Home on a plain app-icon open only (lib/lapse.ts showReturn); a notification, widget, Siri, Spotlight or link
 * never lands here (docs/build-10-ux-pass.md rule 1). A way out is always in the corner: someone who opened Yada to look
 * something up is never trapped (UX pass, RT-01 "no way out" fixed in the frames).
 *
 * Style after Oura "Big changes start small" (https://mobbin.com/screens/d3a8e68c-35c7-4f71-8727-508696a392c1) and Givingli
 * (https://mobbin.com/screens/96e3aabf-a01a-4e19-b8fc-0e7eee1a96c8): a full-bleed photograph, a large serif headline,
 * one pill. Rejected: Wolt's and Lovi's mascot, "You've been missed!" (guilt).
 *
 * RT-08: with no picture the screen is the brand's deep forest, never blank. The picture is decorative, so VoiceOver
 * reads the headline first (rule 10). Nothing here animates, so Reduce Motion needs no branch.
 */

import { parseVerseId } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "../components/Icon";
import { useLaunch } from "../components/LaunchOverlay";
import { readerHref } from "../components/navigation";
import { Chrome } from "../components/Type";
import { pictureFor } from "../data/pictures";
import { FONTS, useIsDark, useLayout } from "../design/tokens";
import { chapterTitle } from "../lib/reader";
import { dayOf, partOf } from "../lib/today";
import { BRAND } from "../design/palette";
import { useAccessibility } from "../state/accessibility";
import { FillPicture } from "../components/FillPicture";

/** Under the picture, the scrim's base (canvas .rtph); with no picture RT-08 is the brand forest (.rtph.nopic). */
const { night: NIGHT, forest: FOREST, forestDark: FOREST_DARK } = BRAND;

export default function ReturnScreen() {
  const { place } = useLocalSearchParams<{ place?: string }>();
  const at = place === undefined ? null : parseVerseId(place);
  const insets = useSafeAreaInsets();
  const dark = useIsDark();
  const { pill, control } = useLayout();
  // The overlay lifts when the first screen can draw; this one is the first screen.
  useEffect(() => useLaunch.getState().markReady(), []);
  const picture = pictureFor(dayOf(new Date()), partOf(new Date()));
  // Above the early return: a hook after it would run on some renders only (Rules of Hooks).
  const solid = useAccessibility((s) => s.reduceTransparency);

  if (at === null) {
    // Nothing to say "you were in" about (rule 3): never draw a half-empty welcome.
    return <Leave />;
  }
  const name = chapterTitle(at.book, at.chapter);
  // "Mark\u00a04", as the frame sets it: the number never sits alone on the last line.
  const headline = `You were in ${name.replace(/ (\d+)$/u, "\u00a0$1")}.`;
  const goClose = () => {
    router.dismissAll();
    router.navigate("/today");
  };
  const goOn = () =>
    // The same landing as Home's "Where you stopped": one verse above the place, the last one held for two seconds (MM-05).
    router.replace(readerHref({ book: at.book, chapter: at.chapter, verse: Math.max(1, at.verse - 1), resume: true, hold: at.verse }));

  return (
    <View style={[styles.root, picture === undefined ? { backgroundColor: dark ? FOREST_DARK : FOREST } : null]} testID="return">
      <StatusBar style="light" />
      {picture === undefined ? null : (
        <>
          <FillPicture source={picture.image} />
          <View
            pointerEvents="none"
            // At least 86% under the words (design system); under Reduce Transparency darker still (images audit, 18 Oct 2026).
            style={[
              StyleSheet.absoluteFill,
              {
                experimental_backgroundImage: solid
                  ? "linear-gradient(rgba(8,14,12,0.6), rgba(8,14,12,0.9) 45%, rgba(8,14,12,0.94))"
                  : "linear-gradient(rgba(8,14,12,0.18), rgba(8,14,12,0.4) 38%, rgba(8,14,12,0.88) 70%)",
              },
            ]}
          />
        </>
      )}
      <Pressable
        onPress={goClose}
        accessibilityRole="button"
        accessibilityLabel="Close, go to Today"
        style={[styles.close, { top: insets.top + 4, left: 16, width: control, height: control, borderRadius: control / 2 }]}
        testID="return-close"
      >
        <Icon name="close" size={20} tone="paper" />
      </Pressable>
      <ScrollView
        style={styles.body}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: 28, paddingTop: insets.top + control + 16 }}
        bounces={false}
      >
        <Chrome accessibilityRole="header" maxFontSizeMultiplier={1.6} style={styles.headline} testID="return-headline">
          {headline}
        </Chrome>
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: insets.bottom + 12, rowGap: 6 }}>
        <Pressable
          onPress={goOn}
          accessibilityRole="button"
          accessibilityLabel={`Continue in ${name}`}
          style={({ pressed }) => [styles.go, { minHeight: pill, opacity: pressed ? 0.85 : 1 }]}
          testID="return-continue"
        >
          <Chrome style={styles.goText}>Continue</Chrome>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: "/start-small", params: { place: place ?? "" } })}
          accessibilityRole="button"
          style={styles.link}
          testID="return-small"
        >
          <Chrome style={styles.linkText}>Start small</Chrome>
        </Pressable>
      </View>
    </View>
  );
}

/** Opened without a place (a stale link): straight to Today. */
function Leave() {
  useEffect(() => {
    useLaunch.getState().markReady();
    router.replace("/today");
  }, []);
  return <View style={styles.root} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT },
  body: { flex: 1 },
  close: { position: "absolute", zIndex: 2, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
  headline: { color: "#FFFFFF", fontFamily: FONTS.scripture, fontSize: 40, lineHeight: 46, fontWeight: "600", letterSpacing: -0.6, paddingBottom: 24 },
  go: { borderRadius: 999, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  goText: { color: NIGHT, fontWeight: "600" },
  link: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  linkText: { color: "rgba(255,255,255,0.85)", fontWeight: "600" },
});
