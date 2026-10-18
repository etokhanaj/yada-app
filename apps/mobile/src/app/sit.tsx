/**
 * Sit with this (PR-02–06; build 7 plan §2 row 18): four optional steps on the day's verse, in order with Begin or any
 * one on its own. Settle breathes in 4 and out 6 with a haptic on each, only the word under Reduce Motion; Breathe the
 * verse splits it only at its own break; Sit with it reads it twice with silence between; Silence is 3, 5, 10 or 20
 * minutes. Never music, scripts or claims about wellbeing. The verse arrives as Today shows it: under a licensed
 * translation the BSB, so the words seen are the words heard. The quiet rain of AS-01 is one tap away.
 */

import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import { ListRow, PageScreen } from "../components/Page";
import { Chrome, Scripture } from "../components/Type";
import { setAmbient, useAmbient } from "../data/ambient";
import { usePalette } from "../design/tokens";
import { breathSplit, SETTLE, SILENCE_MINUTES } from "../lib/sit";
import { useAccessibility } from "../state/accessibility";

type Step = "settle" | "breathe" | "sit" | "silence";
const TITLES: Record<Step, string> = { settle: "Settle", breathe: "Breathe the verse", sit: "Sit with it", silence: "Silence" };

export default function Sit() {
  const { text = "", ref = "" } = useLocalSearchParams<{ text?: string; ref?: string }>();
  const palette = usePalette();
  const reduceMotion = useAccessibility((s) => s.reduceMotion);
  const split = breathSplit(text);
  const steps: Step[] = ["settle", ...(split !== null ? (["breathe"] as const) : []), "sit", "silence"];
  const [running, setRunning] = useState<{ step: Step; all: boolean } | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const rain = useAmbient((s) => s.on);
  useEffect(() => () => void setAmbient(false), []);

  const after = () => {
    if (running === null) return;
    const i = steps.indexOf(running.step);
    const next = running.all ? steps[i + 1] : undefined;
    setRunning(next === undefined ? null : { step: next, all: true });
  };

  const rainLine = (
    <Pressable onPress={() => void setAmbient(!rain)} accessibilityRole="button" accessibilityLabel={rain ? "Stop the sound of rain" : "Add the sound of rain"} hitSlop={10} testID="sit-rain">
      <Chrome tone="muted">{rain ? "Rain · Stop" : "+ Add rain"}</Chrome>
    </Pressable>
  );

  if (running !== null)
    return (
      <PageScreen title={TITLES[running.step]} back="Sit with this" testID={`sit-${running.step}`}>
        {running.step === "settle" ? <Breath words={["Breathe in", "Breathe out"]} reduceMotion={reduceMotion} onDone={after} /> : null}
        {running.step === "breathe" && split !== null ? <Breath words={split} reduceMotion={reduceMotion} onDone={after} scripture /> : null}
        {running.step === "sit" ? <Twice text={text} onDone={after} /> : null}
        {running.step === "silence" ? (
          minutes === null ? (
            <View style={{ rowGap: 0 }}>
              {SILENCE_MINUTES.map((m, i) => (
                <ListRow key={m} first={i === 0} title={`${m} minutes`} onPress={() => setMinutes(m)} testID={`sit-silence-${m}`} />
              ))}
            </View>
          ) : (
            <Silence minutes={minutes} text={text} onDone={() => { setMinutes(null); after(); }} />
          )
        ) : null}
        <View style={{ marginTop: 28 }}>{rainLine}</View>
      </PageScreen>
    );

  return (
    <PageScreen title="Sit with this" back="Today" testID="sit">
      <Scripture step="claim">{text}</Scripture>
      <Chrome step="note" tone="muted" style={{ marginTop: 6, marginBottom: 20 }}>
        {ref}
      </Chrome>
      {steps.map((s, i) => (
        <ListRow key={s} first={i === 0} title={TITLES[s]} onPress={() => setRunning({ step: s, all: false })} testID={`sit-step-${s}`} />
      ))}
      <Pressable onPress={() => setRunning({ step: steps[0] as Step, all: true })} accessibilityRole="button" accessibilityLabel="Begin, all four in order" style={[styles.begin, { backgroundColor: palette.ink }]} testID="sit-begin">
        <Chrome style={{ color: palette.paper, fontWeight: "600" }}>Begin</Chrome>
      </Pressable>
      <View style={{ marginTop: 20 }}>{rainLine}</View>
    </PageScreen>
  );
}

/** In for 4, out for 6, four rounds; a soft shape grows and shrinks, or only the words under Reduce Motion (PR-03, PR-04). */
function Breath({ words, reduceMotion, onDone, scripture = false }: { words: readonly [string, string] | string[]; reduceMotion: boolean; onDone: () => void; scripture?: boolean }) {
  const palette = usePalette();
  const scale = useRef(new Animated.Value(0.6)).current;
  const [phase, setPhase] = useState<0 | 1>(0);
  useEffect(() => {
    let live = true;
    const round = async (n: number): Promise<void> => {
      for (const [p, secs, to] of [[0, SETTLE.inSeconds, 1], [1, SETTLE.outSeconds, 0.6]] as const) {
        if (!live) return;
        setPhase(p);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await new Promise<void>((resolve) => {
          if (reduceMotion) setTimeout(resolve, secs * 1000);
          else Animated.timing(scale, { toValue: to, duration: secs * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start(() => resolve());
        });
      }
      if (live && n + 1 < SETTLE.rounds) return round(n + 1);
      if (live) onDone();
    };
    void round(0);
    return () => {
      live = false;
      scale.stopAnimation();
    };
    // One run per mount: the words and settings are fixed while the step plays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const word = words[phase] ?? "";
  return (
    <View style={{ alignItems: "center", rowGap: 28, paddingVertical: 24 }} accessible accessibilityLiveRegion="polite" accessibilityLabel={word}>
      {reduceMotion ? null : <Animated.View style={[styles.shape, { backgroundColor: palette.selection, transform: [{ scale }] }]} />}
      {scripture ? <Scripture step="claim" style={{ textAlign: "center" }}>{word}</Scripture> : <Chrome tone="ink" style={{ fontSize: 22 }}>{word}</Chrome>}
    </View>
  );
}

/** Read slowly, twice, with silence between (PR-05): the verse, a pause with nothing, the verse again. */
function Twice({ text, onDone }: { text: string; onDone: () => void }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const t1 = setTimeout(() => setShown(false), 30_000);
    const t2 = setTimeout(() => setShown(true), 45_000);
    const t3 = setTimeout(onDone, 75_000);
    return () => [t1, t2, t3].forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <View style={{ minHeight: 200, justifyContent: "center" }}>{shown ? <Scripture step="claim">{text}</Scripture> : null}</View>;
}

/** Silence (PR-06): only the verse until the time is up, then a haptic. */
function Silence({ minutes, text, onDone }: { minutes: number; text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
    }, minutes * 60_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Scripture step="claim">{text}</Scripture>;
}

const styles = StyleSheet.create({
  begin: { marginTop: 24, minHeight: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  shape: { width: 180, height: 180, borderRadius: 90 },
});
