/**
 * The clock and battery for a page that opens on a picture or a circle's tone (Pray, a circle): white while that
 * band is under them, the page's own colours once it has scrolled away. Set only while the page is on screen. They
 * stayed white over the white page below the band, so the time vanished (QA, 24 Oct 2026).
 */

import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function usePictureStatusBar() {
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  const band = useRef(Number.POSITIVE_INFINITY);
  // Only the flip re-renders: React skips setting the same boolean again.
  const [over, setOver] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return {
    statusBar: focused ? <StatusBar style={over ? "light" : "auto"} /> : null,
    onBandLayout: (e: LayoutChangeEvent) => {
      band.current = e.nativeEvent.layout.height;
    },
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => setOver(e.nativeEvent.contentOffset.y < band.current - insets.top),
  };
}
