/**
 * Swipe between chapters (build plan Phase 3; canvas SW-01–04, MM-07, MM-08).
 *
 * - The page follows the finger; the neighbouring chapter peeks in from the side with its first passage's
 *   name (MM-07). Past a third of the width it goes on (one light impact at the commit point, review §4);
 *   short of it, it springs back (SW-02).
 * - After a book's last chapter the swipe stops on the End page, never running into the next book (SW-03).
 * - Off while a verse is selected, and while VoiceOver is on (the chapter links and Contents remain; SW-04).
 * - Reduce Motion: the page does not follow the finger; a committed swipe cross-fades in 200 ms (SW-04).
 */

import * as Haptics from "expo-haptics";
import { type ReactNode, useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { usePalette } from "../design/tokens";

const COMMIT_SHARE = 1 / 3;

/** Whether a release at `dx` (of `width`) with `velocity` goes on to the neighbouring page. Worklet-safe. */
function commits(dx: number, width: number, velocity: number): boolean {
  "worklet";
  return Math.abs(dx) > width * COMMIT_SHARE || (Math.abs(dx) > width * 0.15 && Math.abs(velocity) > 800 && Math.sign(velocity) === Math.sign(dx));
}

export function ChapterSwipe({
  children,
  enabled,
  reduceMotion,
  chapterKey,
  previous,
  next,
  onPrevious,
  onNext,
}: {
  children: ReactNode;
  enabled: boolean;
  reduceMotion: boolean;
  /** Changes with the chapter, so the page snaps home under the new text. */
  chapterKey: string;
  /** What peeks in from the left, or null where the swipe should not go. */
  previous: ReactNode | null;
  next: ReactNode | null;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const fade = useSharedValue(1);
  const [peek, setPeek] = useState<"prev" | "next" | null>(null);

  useEffect(() => {
    x.value = 0;
    shown.value = null;
    fade.value = reduceMotion ? withTiming(1, { duration: 200 }) : 1;
    setPeek(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterKey]);

  const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const go = (dir: "prev" | "next") => {
    if (dir === "prev") onPrevious();
    else onNext();
  };

  // Plain booleans: the worklets below run on the UI thread and cannot hold React elements.
  const hasNext = next !== null;
  const hasPrevious = previous !== null;
  // The direction the page is moving, so the JS thread hears about it once per change, not per frame.
  const shown = useSharedValue<"prev" | "next" | null>(null);
  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      "worklet";
      // A non-finite translation (seen from synthesised touches under XCUITest) would leave the page's
      // transform at NaN, which draws nothing at all.
      if (!Number.isFinite(e.translationX)) return;
      const dir = e.translationX < 0 ? "next" : "prev";
      if (shown.value !== dir) {
        shown.value = dir;
        runOnJS(setPeek)(dir);
      }
      const blocked = (dir === "next" && !hasNext) || (dir === "prev" && !hasPrevious);
      if (reduceMotion) return;
      // Rubber-band where there is no page to go to.
      x.value = blocked ? e.translationX * 0.15 : e.translationX;
    })
    .onEnd((e) => {
      "worklet";
      const dir = e.translationX < 0 ? "next" : "prev";
      const blocked = (dir === "next" && !hasNext) || (dir === "prev" && !hasPrevious);
      if (!blocked && commits(e.translationX, width, e.velocityX)) {
        // One light impact at the commit point, not when the page lands (review §4).
        runOnJS(tick)();
        if (reduceMotion) {
          fade.value = withTiming(0, { duration: 100 }, (done) => {
            if (done) runOnJS(go)(dir);
          });
        } else {
          x.value = withTiming(dir === "next" ? -width : width, { duration: 220 }, (done) => {
            if (done) runOnJS(go)(dir);
          });
        }
      } else {
        shown.value = null;
        x.value = withSpring(0, { damping: 22, stiffness: 220 }, (done) => {
          if (done) runOnJS(setPeek)(null);
        });
      }
    });

  const page = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: fade.value }));
  const rightPage = useAnimatedStyle(() => ({ transform: [{ translateX: x.value + width }] }));
  const leftPage = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - width }] }));

  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1, overflow: "hidden", backgroundColor: palette.paper }} testID="swipe-frame">
        <Animated.View style={[StyleSheet.absoluteFill, page]} testID="swipe-page">
          {children}
        </Animated.View>
        {peek === "next" && next !== null && !reduceMotion ? (
          <Animated.View style={[StyleSheet.absoluteFill, styles.peek, { backgroundColor: palette.paper, borderLeftColor: palette.divider }, rightPage]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {next}
          </Animated.View>
        ) : null}
        {peek === "prev" && previous !== null && !reduceMotion ? (
          <Animated.View style={[StyleSheet.absoluteFill, styles.peek, { backgroundColor: palette.paper, borderRightColor: palette.divider }, leftPage]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {previous}
          </Animated.View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  peek: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
});
