/**
 * The day's office, guided (DO-04 to DO-06; Build 12 OF-30, John 24 Oct 2026). One part at a time over the day's
 * picture, blurred to colour as in Sit with a verse: × and a segment per part at the top, rain on the right; the
 * office's name and the part's over its words in Literata, the reference under them; Next docked, then Amen. Amen
 * counts the day and ticks the office on Today. Long parts scroll within their step. Opened for the evening, it prays
 * the evening office over the evening's picture; from noon to five its name is "Afternoon prayer" (decision 4).
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassButton } from "../components/Glass";
import { Icon } from "../components/Icon";
import { PictureGround } from "../components/PictureGround";
import { StepSegments } from "../components/StepSegments";
import { Pill } from "../components/Pill";
import { Chrome } from "../components/Type";
import { useAppData, useCore } from "../data/AppData";
import { setAmbient, useAmbient } from "../data/ambient";
import { loadOffice, type OfficeStep } from "../data/office";
import { countDay, markDone } from "../data/user";
import { BRAND, ON_PICTURE } from "../design/palette";
import { FONTS, useLayout } from "../design/tokens";
import { dayOf, officeName, type Part, partOf } from "../lib/today";

export default function Office() {
  const core = useCore();
  const { user } = useAppData();
  const insets = useSafeAreaInsets();
  const { ax, gutter } = useLayout();
  const [steps, setSteps] = useState<OfficeStep[] | null>(null);
  const [at, setAt] = useState(0);
  const params = useLocalSearchParams<{ part?: string }>();
  // The part comes from the card that opened this; opened without one (an old link), it follows the clock.
  const now = new Date();
  const part: Part = params.part === "evening" || params.part === "morning" ? params.part : partOf(now);
  const name = part === "evening" ? "Evening prayer" : officeName(now);

  useEffect(() => {
    let live = true;
    void loadOffice(core, dayOf(new Date()), part).then((s) => live && setSteps(s));
    return () => {
      live = false;
    };
  }, [core, part]);

  const rain = useAmbient((s) => s.on);
  // Leaving prayer ends the sound: it never plays on behind another screen.
  useEffect(() => () => void setAmbient(false), []);

  const step = steps?.[at];
  const last = steps !== null && at === steps.length - 1;
  const next = () => {
    if (!last) return setAt((n) => n + 1);
    void countDay(user).catch(() => undefined);
    void markDone(user, "office").catch(() => undefined);
    router.back();
  };

  return (
    <View style={styles.root} testID="office">
      <PictureGround blurred part={part} />
      <View style={[styles.top, { paddingTop: insets.top + 4, paddingHorizontal: gutter - 8 }]}>
        <GlassButton onPicture onPress={() => router.back()} accessibilityLabel={`End ${name.toLowerCase()}`} testID="office-close">
          <Icon name="close" size={20} tone="white" />
        </GlassButton>
        <StepSegments count={steps?.length ?? 0} fill={(i) => (i <= at ? 1 : 0)} label={steps === null ? name : `${step?.label ?? ""}, part ${at + 1} of ${steps.length}`} />
        <GlassButton
          onPicture
          onPress={() => void setAmbient(!rain)}
          accessibilityRole="switch"
          accessibilityState={{ checked: rain }}
          accessibilityLabel="The sound of rain"
          testID="office-rain"
        >
          <Icon name="cloud" size={20} color={rain ? BRAND.chartreuse : ON_PICTURE.text} />
        </GlassButton>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: gutter, justifyContent: ax ? "flex-start" : "center" }]} showsVerticalScrollIndicator={false}>
        {step === undefined ? null : (
          <View style={{ rowGap: 12 }}>
            <Chrome step="note" style={{ color: ON_PICTURE.strong, fontWeight: "600" }} accessibilityRole="header">
              {`${name} · ${step.label}`}
            </Chrome>
            <Text style={styles.text} maxFontSizeMultiplier={1.4} accessibilityLanguage="en">
              {step.text}
            </Text>
            <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
              {step.ref}
            </Chrome>
          </View>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 16 }}>
        <Pill title={last ? "Amen" : "Next"} onPicture stretch disabled={step === undefined} onPress={next} label={last ? `Amen, the end of ${name.toLowerCase()}` : "Next part"} testID="office-next" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", columnGap: 14 },
  body: { flexGrow: 1, paddingVertical: 24 },
  text: { color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontSize: 30, lineHeight: 40, letterSpacing: -0.3 },
});
