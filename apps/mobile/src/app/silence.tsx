/**
 * Silence on its own (FL-04, PT-46; approved by John 24 Oct 2026: "the silence experience looks flat and dead"). It was
 * only the last step of Sit with this; here it is its own way to pray. Choose how long, with rain if you like (AS-01),
 * then the Settle orb's ring (BR-05 A) runs down the time on the night ground with the minutes left under it, and
 * nothing else. When it closes: a soft haptic, the end said aloud for VoiceOver (PR-06), Amen, and the day counted.
 *
 * The ring is one animation over the whole span; the minutes under it update on a 15 s countdown that stops when this
 * screen closes (the one timer CLAUDE.md allows).
 */

import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { Icon } from "../components/Icon";
import { Chrome } from "../components/Type";
import { useAppData } from "../data/AppData";
import { setAmbient, useAmbient } from "../data/ambient";
import { countDay } from "../data/user";
import { BRAND, ON_PICTURE } from "../design/palette";
import { FONTS, useLayout } from "../design/tokens";
import { DEFAULT_SILENCE, SILENCE_MINUTES, timeLeft } from "../lib/sit";
import { useAccessibility } from "../state/accessibility";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 280;
const R = 128;
const AROUND = 2 * Math.PI * R;

export default function Silence() {
  const { user } = useAppData();
  const insets = useSafeAreaInsets();
  const { gutter } = useLayout();
  const reduceMotion = useAccessibility((s) => s.reduceMotion);
  const rain = useAmbient((s) => s.on);
  const [minutes, setMinutes] = useState<number>(DEFAULT_SILENCE);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const left = useRef(new Animated.Value(1)).current;
  useEffect(() => () => void setAmbient(false), []);

  useEffect(() => {
    if (endsAt === null) return;
    const span = endsAt - Date.now();
    if (!reduceMotion)
      Animated.timing(left, {
        toValue: 0,
        duration: span,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    const end = setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility("Silence has ended");
      void countDay(user).catch(() => undefined);
      void setAmbient(false);
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

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 24 },
      ]}
      testID="silence"
    >
      <StatusBar style="light" />
      <View style={{ paddingHorizontal: 16 }}>
        {ended ? (
          <View style={{ height: 44 }} />
        ) : (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="End, back to Pray"
            style={styles.round}
            testID="silence-close"
          >
            <Icon name="close" size={20} tone="paper" />
          </Pressable>
        )}
      </View>

      <View style={styles.middle}>
        <View
          style={{
            width: SIZE,
            height: SIZE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg
            width={SIZE}
            height={SIZE}
            style={[StyleSheet.absoluteFill, { overflow: "visible" }]}
          >
            <Defs>
              <RadialGradient id="silenceGlow" cx="50%" cy="50%" r="50%">
                <Stop
                  offset="0.3"
                  stopColor={BRAND.chartreuse}
                  stopOpacity={ended ? 0.24 : 0.12}
                />
                <Stop offset="1" stopColor={BRAND.chartreuse} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={SIZE * 0.6}
              fill="url(#silenceGlow)"
            />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={BRAND.onNight}
              strokeOpacity={0.12}
              strokeWidth={1.5}
            />
            {ended ? (
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={BRAND.chartreuse}
                strokeWidth={3}
              />
            ) : endsAt !== null && !reduceMotion ? (
              <AnimatedCircle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={BRAND.chartreuse}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={`${AROUND} ${AROUND}`}
                strokeDashoffset={left.interpolate({
                  inputRange: [0, 1],
                  outputRange: [AROUND, 0],
                })}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            ) : null}
          </Svg>
          {ended ? (
            <>
              <Chrome style={styles.word} size={40} accessibilityRole="header">
                Amen
              </Chrome>
              <Chrome
                step="note"
                style={styles.under}
              >{`${minutes} minutes of silence`}</Chrome>
            </>
          ) : endsAt !== null ? (
            <Chrome style={styles.under} accessibilityLiveRegion="polite">
              {timeLeft(endsAt - now)}
            </Chrome>
          ) : (
            <Chrome style={styles.word} size={40} accessibilityRole="header">
              Silence
            </Chrome>
          )}
        </View>

        {endsAt === null && !ended ? (
          <View
            style={styles.chips}
            accessibilityRole="radiogroup"
            accessibilityLabel="How long"
          >
            {SILENCE_MINUTES.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMinutes(m)}
                accessibilityRole="radio"
                accessibilityState={{ checked: m === minutes }}
                accessibilityLabel={`${m} minutes`}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      m === minutes ? BRAND.onNight : ON_PICTURE.glass,
                  },
                ]}
                testID={`silence-${m}`}
              >
                <Chrome
                  style={{
                    fontWeight: "600",
                    color: m === minutes ? BRAND.ink : BRAND.onNight,
                  }}
                >{`${m} min`}</Chrome>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: gutter, rowGap: 12 }}>
        {endsAt === null && !ended ? (
          <Pressable
            onPress={() => void setAmbient(!rain)}
            accessibilityRole="button"
            accessibilityLabel={
              rain ? "Stop the sound of rain" : "Add the sound of rain"
            }
            style={styles.rain}
            testID="silence-rain"
          >
            <Chrome style={{ color: BRAND.chartreuse, fontWeight: "600" }}>
              {rain ? "Rain · Stop" : "+ Add rain"}
            </Chrome>
          </Pressable>
        ) : null}
        {ended ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={styles.primary}
            testID="silence-done"
          >
            <Chrome style={styles.primaryText}>Done</Chrome>
          </Pressable>
        ) : endsAt === null ? (
          <Pressable
            onPress={begin}
            accessibilityRole="button"
            accessibilityLabel={`Begin ${minutes} minutes of silence`}
            style={styles.primary}
            testID="silence-begin"
          >
            <Chrome style={styles.primaryText}>Begin</Chrome>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.night },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ON_PICTURE.glass,
  },
  middle: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    rowGap: 30,
  },
  word: {
    color: BRAND.onNight,
    fontFamily: FONTS.scripture,
    fontWeight: "400",
  },
  under: {
    color: BRAND.onNight,
    opacity: 0.75,
    marginTop: 6,
    textAlign: "center",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 23,
    justifyContent: "center",
  },
  rain: { alignSelf: "center", minHeight: 44, justifyContent: "center" },
  primary: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: BRAND.chartreuse,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: BRAND.ink, fontWeight: "600" },
});
