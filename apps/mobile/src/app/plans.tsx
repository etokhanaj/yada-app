/**
 * PL-30: reading plans, each a card you tap (polish-2026-10-15: a plan is one self-contained thing): its own
 * picture, what it is, how far you are, Continue or Start. John passage by passage was Start here; M'Cheyne's
 * Calendar of 1842 reads the whole Bible. No dates anywhere: each waits where the reader stopped.
 */

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { FillPicture } from "../components/FillPicture";
import { PageScreen } from "../components/Page";
import { Pill } from "../components/Pill";
import { Chrome } from "../components/Type";
import { useAppData } from "../data/AppData";
import { pictureFor } from "../data/pictures";
import { loadMcheyne } from "../data/plans";
import { loadProgress } from "../data/startHere";
import { FONTS, useLayout, usePalette } from "../design/tokens";
import { MCHEYNE_TOTAL, nextPortion, readingsDone } from "../lib/plans";

/**
 * Each plan keeps its own picture (decision 5, John 24 Oct 2026): fixed day numbers, so it never changes with the
 * date. John is the fog on the Yellowstone (day 1), the whole Bible the sunrise above the fog (day 10), as PL-30.
 */
const PLAN_PICTURE = { john: 1, mcheyne: 10 } as const;

interface PlanState {
  readonly done: number;
  readonly total: number;
  /** Under the bar: "1 of 46 read"; null before the first is read, when there is no bar and the pill says Start. */
  readonly line: string | null;
}

export default function PlansScreen() {
  // Every exit names its destination: Bible, or Search when opened from its ways in (SE-30).
  const { back = "Bible" } = useLocalSearchParams<{ back?: string }>();
  const { user } = useAppData();
  const { sectionGap } = useLayout();
  const [state, setState] = useState<{ john: PlanState; mcheyne: PlanState } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        const [john, m] = await Promise.all([loadProgress(user), loadMcheyne(user)]);
        const next = nextPortion(m);
        const done = readingsDone(m).length;
        const mLine = m.read.size === 0 ? null : next === null ? `All ${MCHEYNE_TOTAL} read` : `Reading ${next.reading + 1} of ${MCHEYNE_TOTAL}`;
        if (live)
          setState({
            john: { done: john.read.size, total: john.passages.length, line: john.read.size === 0 ? null : `${john.read.size} of ${john.passages.length} read` },
            mcheyne: { done, total: MCHEYNE_TOTAL, line: mLine },
          });
      })();
      return () => {
        live = false;
      };
    }, [user]),
  );

  return (
    <PageScreen title="Reading plans" back={back} testID="plans">
      {state === null ? null : (
        <View style={{ rowGap: sectionGap / 2 }}>
          <PlanCard
            title="The Gospel of John"
            line="Passage by passage, explained"
            picture={PLAN_PICTURE.john}
            state={state.john}
            onPress={() => router.push({ pathname: "/thread", params: { from: "plans" } })}
            testID="plans-john"
          />
          <PlanCard
            title="The whole Bible"
            line="365 readings, four chapters each · Robert Murray M’Cheyne’s plan, 1842"
            picture={PLAN_PICTURE.mcheyne}
            state={state.mcheyne}
            onPress={() => router.push({ pathname: "/mcheyne", params: { from: "plans" } })}
            testID="plans-mcheyne"
          />
        </View>
      )}
    </PageScreen>
  );
}

function PlanCard({ title, line, picture, state, onPress, testID }: { title: string; line: string; picture: number; state: PlanState; onPress: () => void; testID: string }) {
  const palette = usePalette();
  const { ax } = useLayout();
  const image = pictureFor(picture, "morning");
  const action = state.line === null ? "Start" : "Continue";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${line}${state.line === null ? "" : `. ${state.line}`}. ${action}`}
      style={({ pressed }) => [styles.card, { backgroundColor: palette.card, opacity: pressed ? 0.85 : 1 }]}
      testID={testID}
    >
      {image === undefined ? null : (
        <View style={{ height: ax ? 110 : 132, backgroundColor: palette.fill }}>
          <FillPicture source={image.image} alt={image.alt} />
        </View>
      )}
      <View style={styles.words}>
        <Chrome tone="ink" style={styles.title} maxFontSizeMultiplier={2}>
          {title}
        </Chrome>
        <Chrome step="note" tone="muted">
          {line}
        </Chrome>
        {state.line === null ? null : (
          <View style={{ marginTop: 10, rowGap: 6 }}>
            <View style={[styles.track, { backgroundColor: palette.fill }]}>
              <View style={[styles.track, { width: `${Math.min(100, (state.done / Math.max(state.total, 1)) * 100)}%`, backgroundColor: palette.accent }]} />
            </View>
            <Chrome step="note" tone="muted">
              {state.line}
            </Chrome>
          </View>
        )}
        {/* The whole card is the target; the pill says what it does, so VoiceOver hears it once in the card's label. */}
        <View style={{ alignSelf: "flex-start", marginTop: 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
          {/* Ink for Start too: a fill pill vanished on the card's own fill (12f QA). */}
          <Pill small primary title={action} onPress={onPress} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, overflow: "hidden" },
  words: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, rowGap: 2 },
  title: { fontFamily: FONTS.scripture, fontWeight: "400", fontSize: 22, lineHeight: 28 },
  track: { height: 4, borderRadius: 2 },
});
