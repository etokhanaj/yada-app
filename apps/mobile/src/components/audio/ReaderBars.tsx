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
import Svg, { Circle, Rect } from "react-native-svg";

import { FONTS, useLayout, usePalette } from "../../design/tokens";
import { Icon } from "../Icon";
import { Chrome } from "../Type";
import { type Segment, segmentFill } from "../../lib/audio/session";
import { MediaIcon, type MediaIconName } from "./MediaIcon";
import { Buffering, bufferingLabel } from "./Buffering";

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

export interface ChapterProgress {
  readonly segments: readonly Segment[];
  readonly verse: number;
}

/** The chapter as a 3 pt line split at its passages, filled to the playing verse (the full player's bar, small). */
function ProgressLine({ progress, testID }: { progress: ChapterProgress; testID: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.row, { columnGap: 3, height: 3, marginBottom: 10 }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID={testID}>
      {progress.segments.map((s) => (
        <View key={s.from} style={{ flex: s.to - s.from + 1, height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: palette.divider }}>
          <View style={{ width: `${Math.round(segmentFill(s, progress.verse) * 100)}%`, height: 3, backgroundColor: palette.ink }} />
        </View>
      ))}
    </View>
  );
}

/**
 * While a verse is selected the bar is the verse's actions (AU-03) and the audio plays on unseen: this strip
 * above them keeps it in view, the progress line and the playing verse, one tap to the full player and one to
 * pause (John, 15 Oct 2026: "when it's playing I can still see the Understand button" and nothing says it plays).
 */
export function NowPlayingStrip({
  progress,
  line,
  accessibility,
  playing,
  onOpen,
  onToggle,
}: {
  progress: ChapterProgress | null;
  /** "5  The Light shines in the darkness…" */
  line: string;
  accessibility: string;
  playing: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const { ax } = useLayout();
  return (
    <View style={{ marginBottom: 10 }} testID="now-playing">
      {progress !== null ? <ProgressLine progress={progress} testID="now-playing-progress" /> : null}
      <View style={[styles.row, { alignItems: "center", columnGap: 8 }]}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={accessibility}
          testID="now-playing-open"
          style={({ pressed }) => [{ flex: 1, minHeight: 44, justifyContent: "center" }, pressed ? styles.pressed : null]}
        >
          <Chrome tone="muted" step="note" numberOfLines={ax ? 2 : 1}>
            {line}
          </Chrome>
        </Pressable>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={playing ? "Pause" : "Play"}
          testID="now-playing-toggle"
          style={({ pressed }) => [styles.round, { width: 44, height: 44 }, pressed ? styles.pressed : null]}
        >
          <MediaIcon name={playing ? "pause" : "play"} size={ax ? 26 : 18} maxScale={1} />
        </Pressable>
      </View>
    </View>
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
  nextDisabled,
  under,
  buffering,
  onClose,
  progress,
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
  /** US-04: at the end of a book there is no next verse to go to. */
  nextDisabled?: boolean;
  /** EG-03: the audio is the BSB under a licensed page, with one tap to read along in it. */
  under?: { line: string; action: string; onAction: () => void } | null;
  /** ST-01: a streaming chapter is waiting for bytes; the play control shows a spinner. */
  buffering?: boolean;
  /**
   * The chapter's progress as a line along the bar's top, split at its passages as in the full player: the
   * familiar mark of a mini player that opens into a bigger one (John, 15 Oct 2026; Future Pro's compact player,
   * https://mobbin.com/screens/50d44c95-e4c8-4e4a-b65b-1df69344b1e4).
   */
  progress?: ChapterProgress | null;
  /** Paused, the bar can be put away: it had no way to go, and at AX5 it held a quarter of the page (UX pass, 15 Oct 2026). */
  onClose?: () => void;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  const round = ax ? 72 : 44;
  const control = (name: MediaIconName, label: string, onPress: () => void, testID: string, primary = false) => (
    <Pressable
      onPress={onPress}
      disabled={testID === "mini-next" && nextDisabled === true}
      accessibilityRole="button"
      accessibilityLabel={primary && buffering === true ? bufferingLabel(label) : label}
      accessibilityState={testID === "mini-next" && nextDisabled === true ? { disabled: true } : undefined}
      testID={testID}
      style={({ pressed }) => [
        styles.round,
        testID === "mini-next" && nextDisabled === true ? { opacity: 0.3 } : null,
        { width: primary && !ax ? 48 : round, height: primary && !ax ? 48 : round, backgroundColor: primary ? palette.ink : "transparent" },
        pressed ? styles.pressed : null,
      ]}
    >
      {primary && buffering === true ? <Buffering large={ax} /> : <MediaIcon name={name} size={ax ? 30 : primary ? 22 : 20} tone={primary ? "paper" : "ink"} maxScale={1} />}
    </Pressable>
  );
  return (
    <Bar onHeight={onHeight} testID="mini-player">
      {progress != null ? <ProgressLine progress={progress} testID="mini-progress" /> : null}
      {under != null ? (
        <View style={[styles.row, { alignItems: "center", justifyContent: "space-between", marginBottom: 8 }]} testID="audio-under">
          <Chrome tone="muted" step="note">
            {under.line}
          </Chrome>
          <Pressable onPress={under.onAction} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }} testID="audio-under-action">
            <Chrome tone="accent" size={15} style={{ fontWeight: "600" }}>
              {under.action}
            </Chrome>
          </Pressable>
        </View>
      ) : null}
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
          <Chrome tone="muted" step="note" numberOfLines={ax ? 2 : 1}>
            {detail}
          </Chrome>
        </Pressable>
        <View style={[styles.row, { alignItems: "center", columnGap: 4, justifyContent: ax ? "space-between" : "flex-start" }]}>
          {control("previous", "Previous verse", onPrevious, "mini-previous")}
          {control(playing ? "pause" : "play", playing ? "Pause" : "Play", onToggle, "mini-toggle", true)}
          {control("next", "Next verse", onNext, "mini-next")}
          {!playing && onClose !== undefined ? (
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Stop listening"
              testID="mini-close"
              style={({ pressed }) => [styles.round, { width: round, height: round }, pressed ? styles.pressed : null]}
            >
              <Icon name="close" size={ax ? 26 : 18} maxScale={1} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Bar>
  );
}

/** BA-04's ring: the share of a book downloaded, around a stop square (canvas `.pring`). */
export function StopRing({ share, size }: { share: number; size: number }) {
  const palette = usePalette();
  const r = 15;
  const length = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" accessible={false} importantForAccessibility="no-hide-descendants">
      <Circle cx={18} cy={18} r={r} fill="none" stroke={palette.divider} strokeWidth={3} />
      <Circle
        cx={18}
        cy={18}
        r={r}
        fill="none"
        stroke={palette.ink}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${length * Math.max(share, 0.02)} ${length}`}
        transform="rotate(-90 18 18)"
      />
      <Rect x={13} y={13} width={10} height={10} rx={2} fill={palette.ink} />
    </Svg>
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
