/**
 * LS-30: leaving the reader, listening goes on in a mini player above the tab bar on every tab: the passage, then
 * the verse and the voice ("John 2:3 · Heart"), and Pause; a tap opens the full player. components/TabBar.tsx sets it
 * on glass, a hairline and the barely-there `--float` lift, no drop shadow (24 Oct 2026). Next verse went with
 * LS-30: the reader's docked player (RD-32) is where verses are stepped.
 */

import { formatDisplayRef } from "@yada/schema";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { toggle } from "../../data/audio";
import { FONTS, useLayout, usePalette } from "../../design/tokens";
import { pericopeForVerse } from "../../lib/pericopes";
import { chapterTitle } from "../../lib/reader";
import { currentVerse, useAudio } from "../../state/audio";
import { Chrome } from "../Type";
import { Buffering, bufferingLabel } from "./Buffering";
import { MediaIcon } from "./MediaIcon";
import { usePericopes, useVoiceName } from "./usePassage";

export function useTabsPlayerShown(): boolean {
  return useAudio((s) => s.session !== null && s.session.status !== "finished");
}

export function TabsPlayer() {
  const palette = usePalette();
  const { ax } = useLayout();
  const session = useAudio((s) => s.session);
  const pericopes = usePericopes(session?.book);
  const voice = useVoiceName(session);
  if (session === null) return null;
  const now = currentVerse(session);
  const ref = formatDisplayRef({ book: session.book, chapter: session.chapter, verse: now?.verse ?? 1 });
  const title = pericopeForVerse(pericopes, now?.ord ?? 0)?.label ?? chapterTitle(session.book, session.chapter);
  const detail = voice === null ? ref : `${ref} · ${voice}`;
  const playing = session.status === "playing";
  const action = playing ? "Pause" : "Play";
  return (
    <View style={styles.row} testID="tabs-player">
      <Pressable
        onPress={() => router.push("/player")}
        accessibilityRole="button"
        accessibilityLabel={`${playing ? "Playing" : "Paused"}: ${title}, ${ref}${voice === null ? "" : `, ${voice}`}. Opens the player`}
        style={styles.text}
        testID="tabs-player-open"
      >
        <Chrome tone="ink" numberOfLines={ax ? 2 : 1} style={styles.title}>
          {title}
        </Chrome>
        <Chrome step="note" tone="muted" numberOfLines={ax ? 2 : 1}>
          {detail}
        </Chrome>
      </Pressable>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={session.buffering === true ? bufferingLabel(action) : action}
        style={({ pressed }) => [styles.round, { backgroundColor: palette.ink }, pressed ? styles.pressed : null]}
        testID="tabs-player-toggle"
      >
        {session.buffering === true ? <Buffering /> : <MediaIcon name={playing ? "pause" : "play"} size={20} tone="paper" maxScale={1} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // LS-30: 16 pt in from the capsule's leading edge, 10 pt round the control, 12 pt between them.
  row: { flexDirection: "row", alignItems: "center", columnGap: 12, paddingVertical: 10, paddingLeft: 16, paddingRight: 10 },
  text: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center" },
  title: { fontFamily: FONTS.scripture, fontSize: 15, lineHeight: 19, fontWeight: "600" },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.72 },
});
