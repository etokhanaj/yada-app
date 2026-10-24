/**
 * A widget's door (navigation.ts openHref): the widget's link lands here and hands its verse to
 * openFromOutside, so it closes what is open and lands on the reader as a notification or Siri does,
 * resumed where Continue lands (IA-13; IA stress test, 15 Oct 2026).
 */

import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { useLaunch } from "../components/LaunchOverlay";
import { openFromOutside } from "../components/navigation";
import { chapterFromParams } from "../lib/chapters";
import { usePalette } from "../design/tokens";

export default function OpenScreen() {
  const palette = usePalette();
  const params = useLocalSearchParams<{ book?: string; chapter?: string; verse?: string }>();
  useEffect(() => {
    // The door chooses the place: Home, put under it on a cold launch, must not also open the saved one.
    const routed = () => useLaunch.getState().markRouted();
    const { book, chapter } = chapterFromParams(params.book, params.chapter);
    const verse = Number(params.verse);
    routed();
    openFromOutside({ book, chapter, ...(Number.isInteger(verse) && verse > 0 ? { verse } : {}), resume: true });
  }, [params.book, params.chapter, params.verse]);
  return <View style={{ flex: 1, backgroundColor: palette.paper }} />;
}
