/**
 * Daily prayer, guided (DO-04–06; John, 17 Oct 2026: "make the prayers more visual"). The day's picture full bleed
 * under a soft scrim, one part at a time in large Literata, the step marks, Next and, on the last part, Amen, which
 * returns to Today. After Insight Timer, Oura, Forest and Opal's sessions (mobbin.com/screens/7bf892dd-c66e-4a13-
 * be51-3a9633d0a363, 7be5795d-113c-493f-a297-ae5b4fbd4fc9, c6485d4b-493d-440e-847e-6b3ba1176d45,
 * b7a85dff-8e86-4211-9dec-73f5bf2ac492). Long parts scroll within their step.
 */

import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCore } from "../data/AppData";
import { setAmbient, useAmbient } from "../data/ambient";
import { loadOffice, type OfficeStep } from "../data/office";
import { DAY_PICTURES } from "../data/pictures.generated";
import { FONTS, useLayout } from "../design/tokens";
import { dayOf, pictureDay } from "../lib/today";

const FOREST = "#183F35";

export default function Office() {
  const core = useCore();
  const insets = useSafeAreaInsets();
  const { ax, gutter } = useLayout();
  const [steps, setSteps] = useState<OfficeStep[] | null>(null);
  const [at, setAt] = useState(0);
  const day = dayOf(new Date());
  const picture = DAY_PICTURES.find((p) => p.day === pictureDay(day));

  useEffect(() => {
    let live = true;
    void loadOffice(core, day).then((s) => live && setSteps(s));
    return () => {
      live = false;
    };
    // The day is fixed for the session; reloading on every render would refetch each step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core]);

  const rain = useAmbient((s) => s.on);
  // Leaving prayer ends the sound: it never plays on behind another screen.
  useEffect(() => () => void setAmbient(false), []);

  const step = steps?.[at];
  const last = steps !== null && at === steps.length - 1;
  const next = () => (last ? router.back() : setAt((n) => n + 1));

  return (
    <View style={[styles.root, { backgroundColor: FOREST }]} testID="office">
      {picture !== undefined ? <Image source={picture.image} style={StyleSheet.absoluteFill} resizeMode="cover" accessible accessibilityLabel={picture.alt} /> : null}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      <View style={[styles.top, { top: insets.top + 8, left: gutter, right: gutter }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close daily prayer" style={styles.close} testID="office-close">
          <Text style={styles.closeX}>×</Text>
        </Pressable>
        {steps !== null ? (
          <View style={styles.marks} accessible accessibilityLabel={`Part ${at + 1} of ${steps.length}`}>
            {steps.map((s, i) => (
              <View key={`${s.ref}-${i}`} style={[styles.mark, i <= at ? styles.markOn : null]} />
            ))}
          </View>
        ) : null}
      </View>
      <ScrollView
        style={{ flex: 1, marginTop: insets.top + 64, marginBottom: insets.bottom + 96 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: ax ? "flex-start" : "center", paddingHorizontal: gutter + 12 }}
      >
        {step !== undefined ? (
          <View>
            <Text style={styles.label} accessibilityRole="header" maxFontSizeMultiplier={2}>
              {step.label}
            </Text>
            <Text style={[styles.text, ax ? { fontSize: 34, lineHeight: 46 } : null]} accessibilityLanguage="en">
              {step.text}
            </Text>
            <Text style={styles.ref} maxFontSizeMultiplier={2}>
              {step.ref}
            </Text>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.foot, { bottom: insets.bottom + 24, left: gutter, right: gutter }]}>
        <Pressable
          onPress={() => void setAmbient(!rain)}
          accessibilityRole="button"
          accessibilityLabel={rain ? "Stop the sound of rain" : "Add the sound of rain"}
          style={styles.sound}
          testID="office-rain"
        >
          <Text style={styles.soundText}>{rain ? "Rain · Stop" : "+ Add rain"}</Text>
        </Pressable>
        <Pressable onPress={next} disabled={step === undefined} accessibilityRole="button" accessibilityLabel={last ? "Amen, back to Today" : "Next part"} style={styles.next} testID="office-next">
          <Text style={styles.nextText}>{last ? "Amen" : "Next"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { backgroundColor: "rgba(8,14,12,0.62)" },
  top: { position: "absolute", flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 1 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  closeX: { color: "#fff", fontSize: 26, lineHeight: 28 },
  marks: { flexDirection: "row", columnGap: 6 },
  mark: { width: 18, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)" },
  markOn: { backgroundColor: "#fff" },
  label: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600", marginBottom: 14 },
  text: { color: "#fff", fontFamily: FONTS.scripture, fontSize: 26, lineHeight: 36 },
  ref: { color: "rgba(255,255,255,0.78)", fontSize: 13, marginTop: 14 },
  foot: { position: "absolute", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sound: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  soundText: { color: "rgba(255,255,255,0.88)", fontSize: 15 },
  next: { minHeight: 50, minWidth: 110, paddingHorizontal: 26, borderRadius: 25, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  nextText: { color: FOREST, fontSize: 17, fontWeight: "600" },
});
