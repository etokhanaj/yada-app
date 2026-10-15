/**
 * A widget's door (navigation.ts openHref): the widget's link lands here and hands its verse to
 * openFromOutside, so it closes what is open and lands on the reader as a notification or Siri does,
 * resumed where Continue lands (IA-13; IA stress test, 15 Oct 2026).
 *
 * `?to=player` is the Live Activity's (SX-17–23): the full player over the reader at what is playing, as
 * the reader's own player bar opens it; with nothing playing any more, the reader where it stopped.
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { useLaunch } from "../components/LaunchOverlay";
import { openFromOutside } from "../components/navigation";
import { chapterFromParams } from "../lib/chapters";
import { usePalette } from "../design/tokens";
import { currentVerse, useAudio } from "../state/audio";

export default function OpenScreen() {
  const palette = usePalette();
  const params = useLocalSearchParams<{ book?: string; chapter?: string; verse?: string; to?: string }>();
  useEffect(() => {
    // The door chooses the place: Home, put under it on a cold launch, must not also open the saved one.
    const routed = () => useLaunch.getState().markRouted();
    if (params.to === "player") {
      const s = useAudio.getState().session;
      const verse = s === null ? undefined : currentVerse(s);
      // Nothing plays after the app was killed: Home lands where the reader stopped, as a cold launch does.
      if (s !== null) routed();
      openFromOutside(s === null ? null : { book: s.book, chapter: s.chapter, ...(verse === undefined ? {} : { verse: verse.verse }), resume: true });
      if (s !== null) router.push("/player");
      return;
    }
    const { book, chapter } = chapterFromParams(params.book, params.chapter);
    const verse = Number(params.verse);
    routed();
    openFromOutside({ book, chapter, ...(Number.isInteger(verse) && verse > 0 ? { verse } : {}), resume: true });
  }, [params.book, params.chapter, params.verse, params.to]);
  return <View style={{ flex: 1, backgroundColor: palette.paper }} />;
}
