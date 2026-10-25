/**
 * Sit with a verse, the end (SW-06; Build 12, John 24 Oct 2026). Amen, and that the day counts. Then, if the reader
 * wants, a word of the verse to keep: tapped, it goes on its own line in the verse's note ("Kept: still", decision 2),
 * under whatever the note already says. Save bookmarks the verse, Share makes it an image, Done closes Sit. Nothing
 * here is required: Done alone is a whole ending.
 */

import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BarFrame, Capsule } from "../../components/ActionBar";
import { Icon } from "../../components/Icon";
import { Lamp } from "../../components/Lamp";
import { Chrome } from "../../components/Type";
import { useAppData } from "../../data/AppData";
import { isBookmarked, keepWord, loadDays, markDone, toggleBookmark } from "../../data/user";
import { FONTS, useLayout, usePalette } from "../../design/tokens";
import { rhythmOf, todayKey } from "../../lib/rhythm";
import { wordSpans } from "../../lib/sit";

export default function SitAmen() {
  const params = useLocalSearchParams<{ text?: string; ref?: string; bsb?: string; place?: string }>();
  const text = params.text ?? "";
  const place = params.place ?? "";
  const refLine = `${params.ref ?? ""}${params.bsb === "1" ? " · BSB" : ""}`;
  const { user } = useAppData();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { gutter, ax, pill } = useLayout();
  const [streak, setStreak] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [kept, setKept] = useState<ReadonlySet<number>>(new Set());
  const [barHeight, setBarHeight] = useState(0);
  const words = wordSpans(text).map((s) => text.slice(s.start, s.end));

  useEffect(() => {
    void markDone(user, "sit").catch(() => undefined);
    void loadDays(user).then((days) => setStreak(rhythmOf(days, todayKey(new Date())).streak));
    if (place !== "") void isBookmarked(user, place).then(setSaved);
  }, [user, place]);

  const keep = (i: number) => {
    const word = words[i];
    if (word === undefined || place === "" || kept.has(i)) return;
    void keepWord(user, place, word)
      .then(() => {
        setKept(new Set([...kept, i]));
        AccessibilityInfo.announceForAccessibility(`Kept “${word}” in your note on ${params.ref ?? "this verse"}`);
      })
      .catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t keep the word. Try again."));
  };
  const save = () => {
    if (place === "") return;
    void toggleBookmark(user, place).then((now) => {
      setSaved(now);
      AccessibilityInfo.announceForAccessibility(now ? "Saved" : "Removed from Saved");
    });
  };
  // Closes Amen and the setup under it, back to wherever Sit was opened.
  const done = () => router.dismiss(2);

  return (
    <View style={[styles.screen, { backgroundColor: palette.paper }]} testID="sit-amen">
      {/* The session's picture set the bar light; on paper it must follow the theme again. */}
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: gutter, paddingTop: insets.top + 24, paddingBottom: barHeight + 24 }]}>
        <Chrome tone="ink" style={{ fontFamily: FONTS.scripture, fontWeight: "400" }} size={40} maxFontSizeMultiplier={1.1} accessibilityRole="header">
          Amen
        </Chrome>
        {streak === null ? null : (
          <View style={styles.counts}>
            <Lamp lit color={palette.accent} size={18} />
            <Chrome step="note" tone="muted">{`Today counts · ${streak} ${streak === 1 ? "day" : "days"} in a row`}</Chrome>
          </View>
        )}
        {place === "" ? null : (
          <>
            <Chrome step="note" tone="muted" style={{ fontWeight: "600", marginTop: 40, marginBottom: 10 }}>
              Tap a word to keep
            </Chrome>
            <View style={styles.words} accessibilityRole="none">
              {words.map((w, i) => {
                const on = kept.has(i);
                return (
                  <Pressable
                    key={`${i}-${w}`}
                    onPress={() => keep(i)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={on ? `${w}, kept` : `Keep “${w}”`}
                    style={({ pressed }) => [styles.word, on ? { backgroundColor: palette.ink } : pressed ? { backgroundColor: palette.fill } : null]}
                    testID={`sit-word-${i}`}
                  >
                    <Chrome style={{ fontFamily: FONTS.scripture, fontWeight: "400", color: on ? palette.paper : palette.ink }} size={21} maxFontSizeMultiplier={1.5}>
                      {w}
                    </Chrome>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        <Chrome step="note" tone="muted" style={{ marginTop: 8 }}>
          {refLine}
        </Chrome>
      </ScrollView>
      <BarFrame onHeight={setBarHeight} testID="sit-amen-bar">
        <View style={ax ? { rowGap: 8 } : { flexDirection: "row", columnGap: 8 }}>
          {place === "" ? null : (
            <View style={{ flexDirection: "row", columnGap: 8 }}>
              <Capsule square={!ax} grow={ax} height={pill} selected={saved} onPress={save} label={saved ? `Saved, ${params.ref ?? ""}` : `Save ${params.ref ?? ""}`} testID="sit-save">
                <Icon name="bookmark" size={20} tone={saved ? "accent" : "ink"} filled={saved} />
              </Capsule>
              <Capsule square={!ax} grow={ax} height={pill} onPress={() => router.push({ pathname: "/share-image", params: { verse: place } })} label={`Share ${params.ref ?? ""}`} testID="sit-share">
                <Icon name="share" size={20} />
              </Capsule>
            </View>
          )}
          <Capsule primary grow height={pill} onPress={done} label="Done" testID="sit-done">
            <Chrome tone="paper" style={{ fontWeight: "600" }}>
              Done
            </Chrome>
          </Capsule>
        </View>
      </BarFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flexGrow: 1, justifyContent: "center" },
  counts: { flexDirection: "row", alignItems: "center", columnGap: 6, marginTop: 6 },
  // Each word a 44 pt target, spaced as a line of text: SW-06 draws the verse as it reads, with the kept word in ink.
  words: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 },
  word: { minHeight: 44, justifyContent: "center", paddingHorizontal: 3, borderRadius: 8 },
});
