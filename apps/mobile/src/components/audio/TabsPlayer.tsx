/**
 * The mini player above the tab bar (IA-17): while listening, on every tab, the chapter and verse with Play/Pause and
 * Next; a tap opens the full player. It existed only inside the reader, so leaving it left the audio with no control
 * but the Lock Screen (design QA, 18 Oct 2026). components/TabBar.tsx sets it on glass above the bar.
 */

import { formatDisplayRef } from "@yada/schema";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { next, toggle } from "../../data/audio";
import { FONTS, usePalette } from "../../design/tokens";
import { chapterTitle } from "../../lib/reader";
import { currentVerse, useAudio } from "../../state/audio";
import { Chrome } from "../Type";
import { MediaIcon } from "./MediaIcon";

export function useTabsPlayerShown(): boolean {
  return useAudio((s) => s.session !== null && s.session.status !== "finished");
}

export function TabsPlayer() {
  const palette = usePalette();
  const session = useAudio((s) => s.session);
  if (session === null) return null;
  const verse = currentVerse(session)?.verse ?? 1;
  const playing = session.status === "playing";
  const title = chapterTitle(session.book, session.chapter);
  return (
    <View style={styles.row} testID="tabs-player">
      <Pressable
        onPress={() => router.push("/player")}
        accessibilityRole="button"
        accessibilityLabel={`${playing ? "Playing" : "Paused"} ${formatDisplayRef({ book: session.book, chapter: session.chapter, verse })}, ${session.translation}. Opens the player`}
        style={styles.text}
        testID="tabs-player-open"
      >
        <Chrome tone="ink" numberOfLines={1} style={styles.title}>
          {title}
        </Chrome>
        <Chrome step="note" tone="muted" numberOfLines={1}>{`Verse ${verse} · ${session.translation}`}</Chrome>
      </Pressable>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={playing ? "Pause" : "Play"} style={[styles.round, styles.primary, { backgroundColor: palette.ink }]} testID="tabs-player-toggle">
        <MediaIcon name={playing ? "pause" : "play"} size={20} tone="paper" maxScale={1} />
      </Pressable>
      <Pressable onPress={next} accessibilityRole="button" accessibilityLabel="Next verse" style={styles.round} testID="tabs-player-next">
        <MediaIcon name="next" size={20} tone="ink" maxScale={1} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // `.tacc`: 18 pt in from the capsule's edge, 6 pt to the round controls.
  row: { flexDirection: "row", alignItems: "center", columnGap: 4, paddingVertical: 4, paddingLeft: 18, paddingRight: 6 },
  text: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: "center" },
  title: { fontFamily: FONTS.scripture, fontSize: 15, lineHeight: 19, fontWeight: "600" },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  primary: { width: 48, height: 48, borderRadius: 24 },
});
