/**
 * The iOS accessibility settings Yada's drawing depends on, read once and kept
 * current. One store rather than a listener per component: usePalette() runs
 * in nearly every view, and each would otherwise subscribe to the same event.
 *
 * - Increase Contrast ("darker system colours") swaps mutedInk and divider (brief §3).
 * - Reduce Motion turns every Yada animation into a cut or cross-fade (brief §5).
 * - Reduce Transparency draws glass controls and the reader's collapsed header
 *   line solid (palette.glassSolid, hairline edge kept). The ⋯ menu is UIKit's
 *   and follows the setting itself.
 * - VoiceOver on: the reader header never steps back, so its title is always
 *   one swipe away (build plan, "Header step-back + VoiceOver").
 */

import { AccessibilityInfo } from "react-native";
import { create } from "zustand";

interface AccessibilityState {
  increaseContrast: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  screenReader: boolean;
}

export const useAccessibility = create<AccessibilityState>(() => ({
  increaseContrast: false,
  reduceMotion: false,
  reduceTransparency: false,
  screenReader: false,
}));

/** Call once from the root layout; returns the unsubscribe. */
export function watchAccessibility(): () => void {
  const set = (patch: Partial<AccessibilityState>) => useAccessibility.setState(patch);
  void AccessibilityInfo.isDarkerSystemColorsEnabled().then((increaseContrast) => set({ increaseContrast }));
  void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => set({ reduceMotion }));
  void AccessibilityInfo.isReduceTransparencyEnabled().then((reduceTransparency) => set({ reduceTransparency }));
  void AccessibilityInfo.isScreenReaderEnabled().then((screenReader) => set({ screenReader }));
  const subs = [
    AccessibilityInfo.addEventListener("darkerSystemColorsChanged", (increaseContrast) => set({ increaseContrast })),
    AccessibilityInfo.addEventListener("reduceMotionChanged", (reduceMotion) => set({ reduceMotion })),
    AccessibilityInfo.addEventListener("reduceTransparencyChanged", (reduceTransparency) => set({ reduceTransparency })),
    AccessibilityInfo.addEventListener("screenReaderChanged", (screenReader) => set({ screenReader })),
  ];
  return () => subs.forEach((s) => s.remove());
}
