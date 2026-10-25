/**
 * Silence on its own (FL-04, PT-46; approved by John 24 Oct 2026: "the silence experience looks flat and dead"; Build 12
 * SL-30, approved 25 Oct 2026). One of the four ways to pray, on the day's picture blurred, as Sit is. Choose how long,
 * with rain if you like (AS-01), Begin; then the time left large inside the ring Sit's orb uses, the ring running down
 * in lime, "of 10 min" under it, and Pause. When it closes: a soft haptic, the end said aloud for VoiceOver (PR-06),
 * Amen, and the day counted.
 *
 * The ring is one animation over the span; the time inside it updates on a one-second countdown that stops when the
 * screen closes or is paused (the one timer CLAUDE.md allows).
 */

import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { GlassButton } from "../components/Glass";
import { Icon } from "../components/Icon";
import { PauseButton } from "../components/PauseButton";
import { PictureGround } from "../components/PictureGround";
import { Pill } from "../components/Pill";
import { Chrome } from "../components/Type";
import { useAppData } from "../data/AppData";
import { setAmbient, useAmbient } from "../data/ambient";
import { countDay } from "../data/user";
import { BRAND, ON_PICTURE } from "../design/palette";
import { FONTS, useLayout } from "../design/tokens";
import { clock, DEFAULT_SILENCE, SILENCE_MINUTES, timeLeft } from "../lib/sit";
import { useAccessibility } from "../state/accessibility";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function Silence() {
  const { user } = useAppData();
  const insets = useSafeAreaInsets();
  const { gutter, ax } = useLayout();
  const reduceMotion = useAccessibility((s) => s.reduceMotion);
  const rain = useAmbient((s) => s.on);
  const [minutes, setMinutes] = useState<number>(DEFAULT_SILENCE);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  // Paused: the time that was left, so Resume carries on from there.
  const [held, setHeld] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const left = useRef(new Animated.Value(1)).current;
  useEffect(() => () => void setAmbient(false), []);

  const size = ax ? 230 : 290;
  const r = size / 2 - 3;
  const around = 2 * Math.PI * r;

  useEffect(() => {
    if (endsAt === null) return;
    const span = endsAt - Date.now();
    if (!reduceMotion) Animated.timing(left, { toValue: 0, duration: span, easing: Easing.linear, useNativeDriver: false }).start();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const end = setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility("Silence has ended");
      void countDay(user).catch(() => undefined);
      void setAmbient(false);
      setEndsAt(null);
      setEnded(true);
    }, span);
    return () => {
      left.stopAnimation();
      clearInterval(tick);
      clearTimeout(end);
    };
  }, [endsAt, left, reduceMotion, user]);

  const begin = () => {
    left.setValue(1);
    setNow(Date.now());
    setEndsAt(Date.now() + minutes * 60_000);
  };
  const togglePause = () => {
    if (held !== null) {
      setNow(Date.now());
      setEndsAt(Date.now() + held);
      setHeld(null);
    } else if (endsAt !== null) {
      setHeld(Math.max(0, endsAt - Date.now()));
      setEndsAt(null);
    }
  };

  const running = endsAt !== null || held !== null;
  const msLeft = held ?? (endsAt === null ? 0 : endsAt - now);
  return (
    <View style={[styles.root, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 24 }]} testID="silence">
      <PictureGround blurred />
      <View style={[styles.bar, { paddingHorizontal: gutter - 8 }]}>
        {ended ? (
          <View style={{ height: 44 }} />
        ) : (
          <GlassButton onPicture onPress={() => router.back()} accessibilityLabel="End, back to Pray" testID="silence-close">
            <Icon name="close" size={20} tone="white" />
          </GlassButton>
        )}
        <Chrome step="note" style={{ color: ON_PICTURE.strong, fontWeight: "600" }} accessibilityElementsHidden>
          {/* Before Begin the ring already says Silence (12h QA: it said it twice). */}
          {running ? "Silence" : ""}
        </Chrome>
        {ended ? (
          <View style={{ width: 44 }} />
        ) : (
          // AS-01: rain is a switch, so it says when it is on, in lime as the ring is.
          <GlassButton onPicture onPress={() => void setAmbient(!rain)} accessibilityRole="switch" accessibilityState={{ checked: rain }} accessibilityLabel="The sound of rain" testID="silence-rain">
            <Icon name="cloud" size={20} color={rain ? BRAND.chartreuse : ON_PICTURE.text} />
          </GlassButton>
        )}
      </View>

      <View style={styles.middle}>
        <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ON_PICTURE.mark} strokeWidth={1.5} />
            {ended ? (
              <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BRAND.chartreuse} strokeWidth={3} />
            ) : running && !reduceMotion ? (
              <AnimatedCircle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={BRAND.chartreuse}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={`${around} ${around}`}
                strokeDashoffset={left.interpolate({ inputRange: [0, 1], outputRange: [around, 0] })}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            ) : null}
          </Svg>
          {ended ? (
            <>
              <Chrome style={styles.word} size={40} accessibilityRole="header">
                Amen
              </Chrome>
              <Chrome step="note" style={styles.under}>{`${minutes} minutes of silence`}</Chrome>
            </>
          ) : running ? (
            // The seconds are for the eye; VoiceOver hears the minutes, so it is not read every second.
            <View accessible accessibilityLabel={held !== null ? `Paused, ${timeLeft(msLeft).toLowerCase()}` : timeLeft(msLeft)} style={{ alignItems: "center" }}>
              <Chrome style={styles.time} size={ax ? 56 : 64} maxFontSizeMultiplier={1}>
                {clock(msLeft / 1000)}
              </Chrome>
              <Chrome step="note" style={styles.under}>{`of ${minutes} min`}</Chrome>
            </View>
          ) : (
            <Chrome style={styles.word} size={40} accessibilityRole="header">
              Silence
            </Chrome>
          )}
        </View>

        {!running && !ended ? (
          <View style={[styles.chips, { paddingHorizontal: gutter }]} accessibilityRole="radiogroup" accessibilityLabel="How long">
            {SILENCE_MINUTES.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMinutes(m)}
                accessibilityRole="radio"
                accessibilityState={{ checked: m === minutes }}
                accessibilityLabel={`${m} minutes`}
                style={[styles.chip, { backgroundColor: m === minutes ? ON_PICTURE.text : ON_PICTURE.glass }]}
                testID={`silence-${m}`}
              >
                <Chrome style={{ fontWeight: "600", color: m === minutes ? BRAND.ink : ON_PICTURE.text }}>{`${m} min`}</Chrome>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: gutter, alignItems: "center" }}>
        {ended ? (
          <Pill title="Done" onPicture stretch onPress={() => router.back()} testID="silence-done" />
        ) : running ? (
          <PauseButton paused={held !== null} onPress={togglePause} testID="silence-pause" />
        ) : (
          <Pill title="Begin" onPicture stretch onPress={begin} label={`Begin ${minutes} minutes of silence`} testID="silence-begin" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  middle: { flex: 1, alignItems: "center", justifyContent: "center", rowGap: 30 },
  word: { color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400" },
  time: { color: ON_PICTURE.text, fontWeight: "300", fontVariant: ["tabular-nums"] },
  under: { color: ON_PICTURE.muted, marginTop: 4, textAlign: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  chip: { minHeight: 46, paddingHorizontal: 14, borderRadius: 23, justifyContent: "center" },
});
