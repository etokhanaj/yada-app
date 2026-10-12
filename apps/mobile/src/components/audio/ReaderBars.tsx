/**
 * Audio's parts of the reader's bottom bar when nothing is selected. Same ground as the selection
 * bar (ActionBar): paper, hairline top, no shadow, docked to the bottom edge, after the verses to
 * VoiceOver.
 *
 * At rest: Listen, drawn in ActionBar's RestBar beside the passage's Understand, which opens the
 * passage guide (AU-01, IA-04). At AX sizes it becomes a full-width row, "Listen ▶" (AU-01 AX5).
 *
 * Playing (AU-02): the bar is the player. What is playing (opens the full player), previous verse,
 * pause, next verse. Going back to re-hear a verse is the commonest move while listening (John,
 * 11 Oct 2026). Matter, https://mobbin.com/screens/9f487f5f-2f6c-4cd5-94ab-01616381033a ·
 * Audible, https://mobbin.com/screens/3f32bf32-8516-4fd2-a248-4565689b793a
 */

import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONTS, useLayout, usePalette } from "../../design/tokens";
import { Chrome } from "../Type";
import { MediaIcon, type MediaIconName } from "./MediaIcon";

function Bar({ children, onHeight, testID }: { children: ReactNode; onHeight: (h: number) => void; testID: string }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
      style={[styles.bar, { backgroundColor: palette.paper, boxShadow: `0 -1px 0 ${palette.divider}`, paddingBottom: Math.max(insets.bottom, 12) }]}
      testID={testID}
    >
      {children}
    </View>
  );
}

/**
 * Listen, in RestBar's audio slot (AU-01): a round play button beside the passage's Understand,
 * or a full-width "Listen ▶" row at AX sizes and where there is no passage to understand.
 */
export function ListenButton({ onListen, alone, label }: { onListen: () => void; alone: boolean; label: string }) {
  const palette = usePalette();
  const { ax, pill } = useLayout();
  const row = ax || alone;
  return (
    <Pressable
      onPress={onListen}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Reads the chapter aloud from here"
      testID="listen"
      style={({ pressed }) => [
        styles.capsule,
        row ? [styles.listRow, styles.spread, ax ? null : styles.grow] : { width: pill },
        { minHeight: pill, backgroundColor: palette.fill },
        pressed ? styles.pressed : null,
      ]}
    >
      {row ? (
        <Chrome tone="ink" style={{ fontWeight: "500" }}>
          Listen
        </Chrome>
      ) : null}
      <MediaIcon name="play" size={ax ? 30 : 22} maxScale={1} />
    </Pressable>
  );
}

export function MiniPlayer({
  title,
  detail,
  accessibility,
  playing,
  onOpen,
  onPrevious,
  onToggle,
  onNext,
  onHeight,
}: {
  /** The passage, "The Word became flesh"; the chapter where there are no passages. */
  title: string;
  /** "Verse 5 · BSB". */
  detail: string;
  /** "The Word became flesh, John 1:5, Berean Standard Bible. Opens the player" (AU-06). */
  accessibility: string;
  playing: boolean;
  onOpen: () => void;
  onPrevious: () => void;
  onToggle: () => void;
  onNext: () => void;
  onHeight: (h: number) => void;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  const round = ax ? 72 : 44;
  const control = (name: MediaIconName, label: string, onPress: () => void, testID: string, primary = false) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        styles.round,
        { width: primary && !ax ? 48 : round, height: primary && !ax ? 48 : round, backgroundColor: primary ? palette.ink : "transparent" },
        pressed ? styles.pressed : null,
      ]}
    >
      <MediaIcon name={name} size={ax ? 30 : primary ? 22 : 20} tone={primary ? "paper" : "ink"} maxScale={1} />
    </Pressable>
  );
  return (
    <Bar onHeight={onHeight} testID="mini-player">
      <View
        accessibilityRole="toolbar"
        accessibilityLabel="Audio player"
        // Magic tap (two-finger double tap) plays and pauses (AU-06).
        onMagicTap={onToggle}
        style={ax ? { rowGap: 8 } : [styles.row, { alignItems: "center", columnGap: 6 }]}
      >
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={accessibility}
          testID="mini-open"
          style={({ pressed }) => [styles.label, ax ? { flex: 0 } : null, pressed ? styles.pressed : null]}
        >
          <Chrome tone="ink" size={15} style={{ fontFamily: FONTS.scripture, fontWeight: "600" }} numberOfLines={ax ? undefined : 1}>
            {title}
          </Chrome>
          <Chrome tone="muted" step="note">
            {detail}
          </Chrome>
        </Pressable>
        <View style={[styles.row, { alignItems: "center", columnGap: 4, justifyContent: ax ? "space-between" : "flex-start" }]}>
          {control("previous", "Previous verse", onPrevious, "mini-previous")}
          {control(playing ? "pause" : "play", playing ? "Pause" : "Play", onToggle, "mini-toggle", true)}
          {control("next", "Next verse", onNext, "mini-next")}
        </View>
      </View>
    </Bar>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    columnGap: 8,
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  capsule: {
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 14,
  },
  listRow: {
    alignSelf: "stretch",
    justifyContent: "flex-start",
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  spread: {
    justifyContent: "space-between",
  },
  round: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    justifyContent: "center",
    rowGap: 1,
    paddingLeft: 6,
  },
  pressed: {
    opacity: 0.72,
  },
});
