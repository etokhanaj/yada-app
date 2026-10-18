/**
 * "The page lifts" (brief §8.17, canvas SP-03–SP-05): the native splash is
 * replaced by an identical overlay, which waits for the first screen to be
 * ready (so it never lengthens launch), then
 *   0–160 ms   the leaf tilts −8° about the join, SPRING.standard;
 *   160–520 ms the symbol scales to 0.9 and fades with the dark ground while
 *              the screen beneath fades in and rises 6 pt.
 * Reduce Motion: a 150 ms cross-fade, no tilt or scale. Cold launch only (the
 * root layout mounts once per process). No haptic. Hidden from VoiceOver, so
 * focus waits for the first screen.
 */

import * as SplashScreen from "expo-splash-screen";
import { type ReactNode, useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { create } from "zustand";

import { SPRING } from "../design/tokens";
import { BRAND } from "../design/palette";

/**
 * The first screen says when it can draw. A cold launch with a saved position
 * opens the reader (brief §8.18), which reports once its chapter loads;
 * otherwise Home is the first screen and reports.
 * `routed` keeps Home from opening the reader twice in one process: Home can
 * remount, and a Fast Refresh re-runs its module, but this store outlives both.
 */
export const useLaunch = create<{ ready: boolean; routed: boolean; markReady: () => void; markRouted: () => void }>((set) => ({
  ready: false,
  routed: false,
  markReady: () => set({ ready: true }),
  markRouted: () => set({ routed: true }),
}));

/** Same size as app.config.ts's expo-splash-screen imageWidth, so the hand-over is invisible. */
const SYMBOL = 125;
/** The native splash's own ground (app.config.ts splash backgroundColor), so the hand-over shows no colour change (design QA, 18 Oct 2026). */
const GROUND = BRAND.night;

export function LaunchStage({ reduceMotion, children }: { reduceMotion: boolean; children: ReactNode }) {
  const ready = useLaunch((s) => s.ready);
  const [shown, setShown] = useState(true);
  const tilt = useSharedValue(0);
  const lift = useSharedValue(0);

  // A first screen that never reports (a deep link to a sheet, a load error) must not leave
  // the overlay up: after 1.5 s it lifts regardless.
  useEffect(() => {
    const timer = setTimeout(() => useLaunch.getState().markReady(), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const done = () => setShown(false);
    if (reduceMotion) {
      lift.value = withTiming(1, { duration: 150 }, (finished) => {
        if (finished) runOnJS(done)();
      });
      return;
    }
    tilt.value = withSpring(1, SPRING.standard);
    lift.value = withDelay(
      160,
      withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(done)();
      }),
    );
  }, [ready, reduceMotion, tilt, lift]);

  const screen = useAnimatedStyle(() => ({
    opacity: lift.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - lift.value) * 6 }],
  }));

  return (
    <View style={{ flex: 1 }}>
      {/* Hidden to VoiceOver until it can be seen, so focus never lands on an invisible control. */}
      <Animated.View
        style={[{ flex: 1 }, screen]}
        accessibilityElementsHidden={shown}
        importantForAccessibility={shown ? "no-hide-descendants" : "auto"}
      >
        {children}
      </Animated.View>
      {shown ? <Overlay tilt={tilt} lift={lift} reduceMotion={reduceMotion} /> : null}
    </View>
  );
}

function Overlay({ tilt, lift, reduceMotion }: { tilt: SharedValue<number>; lift: SharedValue<number>; reduceMotion: boolean }) {
  const ground = useAnimatedStyle(() => ({ opacity: 1 - lift.value }));
  const symbol = useAnimatedStyle(() => ({ transform: [{ scale: reduceMotion ? 1 : 1 - 0.1 * lift.value }] }));
  const leaf = useAnimatedStyle(() => ({ transform: [{ rotate: `${-8 * tilt.value}deg` }] }));
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // The native splash goes as soon as its copy is on screen.
      // Its own fade would overlap the copy and hide the tilt, so it cuts.
      onLayout={() => {
        SplashScreen.setOptions({ fade: false, duration: 0 });
        void SplashScreen.hideAsync();
      }}
      style={[StyleSheet.absoluteFill, styles.ground, ground]}
    >
      <Animated.View style={[styles.symbol, symbol]}>
        <Image source={require("../../assets/brand/splash-stem.png")} style={styles.layer} />
        <Animated.Image
          source={require("../../assets/brand/splash-leaf.png")}
          // Pivot at the join between stem and leaf (canvas SP-04 note).
          style={[styles.layer, { transformOrigin: "54.4% 57% 0" }, leaf]}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ground: {
    backgroundColor: GROUND,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  symbol: {
    width: SYMBOL,
    height: SYMBOL,
  },
  layer: {
    position: "absolute",
    width: SYMBOL,
    height: SYMBOL,
  },
});
