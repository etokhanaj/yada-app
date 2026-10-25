/**
 * Audio's parts of the reader's bottom bar when nothing is selected. Same ground as the selection
 * bar (ActionBar): paper, hairline top, no shadow, docked to the bottom edge, after the verses to
 * VoiceOver.
 *
 * At rest: Listen, drawn in ActionBar's RestBar beside the passage's Understand, which opens the
 * passage guide (AU-01, IA-04). At AX sizes it becomes a full-width row, "Listen ▶" (AU-01 AX5).
 *
 * Playing (RD-32, after AU-02): the bar is the player. What is playing (opens the full player), the voice and
 * speed, the time, previous verse, pause, next verse. Going back to re-hear a verse is the commonest move while listening (John,
 * 11 Oct 2026). Matter, https://mobbin.com/screens/9f487f5f-2f6c-4cd5-94ab-01616381033a ·
 * Audible, https://mobbin.com/screens/3f32bf32-8516-4fd2-a248-4565689b793a
 */

import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Rect } from "react-native-svg";

import { FONTS, useLayout, usePalette } from "../../design/tokens";
import { playingTime } from "../../data/audio";
import { type Segment, segmentFill, speedAccessibilityLabel, speedLabel } from "../../lib/audio/session";
import { clock } from "../../lib/sit";
import { useAudio } from "../../state/audio";
import { Icon } from "../Icon";
import { Pill } from "../Pill";
import { Chrome } from "../Type";
import { MediaIcon, type MediaIconName } from "./MediaIcon";
import { Buffering, bufferingLabel } from "./Buffering";
import { useVoiceName } from "./usePassage";

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

/**
 * RD-32: listening docks a player in the reader. The passage and its verse, "Heart · 1×" to the Voice sheet (RD-34),
 * the time through the chapter's recording, then previous verse, pause and next verse round the middle. The time is
 * read from the audio store as each word is spoken (data/audio.ts playingTime), never from a timer (no polling,
 * John, 18 Oct 2026).
 */
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
}: {
  /** The passage, "The wedding at Cana"; the chapter where there are no passages. */
  title: string;
  /** "Verse 3". */
  detail: string;
  /** "The wedding at Cana, John 2:3, Berean Standard Bible. Opens the player" (AU-06). */
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
  /** Paused, the bar can be put away: it had no way to go, and at AX5 it held a quarter of the page (UX pass, 15 Oct 2026). */
  onClose?: () => void;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  const session = useAudio((s) => s.session);
  const speed = useAudio((s) => s.speed);
  const voice = useVoiceName(session);
  // Whole seconds, so the bar redraws only when the shown second changes, not on every word.
  const elapsed = useAudio((s) => Math.floor((s.session === null ? null : playingTime(s.session))?.elapsed ?? 0));
  const duration = useAudio((s) => Math.floor((s.session === null ? null : playingTime(s.session))?.duration ?? 0));
  const time = duration > 0;
  const side = ax ? 64 : 44;
  const step = (name: MediaIconName, label: string, onPress: () => void, testID: string, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      testID={testID}
      style={({ pressed }) => [styles.round, { width: side, height: side }, disabled ? { opacity: 0.3 } : null, pressed ? styles.pressed : null]}
    >
      <MediaIcon name={name} size={ax ? 30 : 24} maxScale={1} />
    </Pressable>
  );
  const action = playing ? "Pause" : "Play";
  return (
    <Bar onHeight={onHeight} testID="mini-player">
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
        style={{ rowGap: 10 }}
      >
        <View style={ax ? { rowGap: 6, alignItems: "flex-start" } : [styles.row, { alignItems: "center", columnGap: 10 }]}>
          <Pressable
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={accessibility}
            testID="mini-open"
            style={({ pressed }) => [styles.label, ax ? { flex: 0, alignSelf: "stretch" } : null, pressed ? styles.pressed : null]}
          >
            <Chrome tone="ink" size={15} style={{ fontFamily: FONTS.scripture, fontWeight: "600" }} numberOfLines={ax ? 2 : 1}>
              {title}
            </Chrome>
            <Chrome tone="muted" step="note" numberOfLines={1}>
              {detail}
            </Chrome>
          </Pressable>
          <View style={[styles.row, { alignItems: "center" }]}>
            <Pill
              small
              title={voice === null ? speedLabel(speed) : `${voice} · ${speedLabel(speed)}`}
              label={`Voice and speed: ${voice === null ? "" : `${voice}, `}${speed === 1 ? "normal speed" : speedAccessibilityLabel(speed)}`}
              onPress={() => router.push("/voice")}
              testID="mini-voice"
            />
            {!playing && onClose !== undefined ? (
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Stop listening"
                testID="mini-close"
                style={({ pressed }) => [styles.round, { width: 44, height: 44 }, pressed ? styles.pressed : null]}
              >
                <Icon name="close" size={ax ? 26 : 18} maxScale={1} />
              </Pressable>
            ) : null}
          </View>
        </View>
        {time ? (
          <View accessible accessibilityLabel={`${clock(elapsed)} of ${clock(duration)}`} testID="mini-time">
            <View style={{ height: 4, borderRadius: 2, backgroundColor: palette.fill }}>
              <View style={{ width: `${Math.min(100, Math.round((elapsed / duration) * 100))}%`, height: 4, borderRadius: 2, backgroundColor: palette.ink }} />
            </View>
            <View style={[styles.row, { justifyContent: "space-between", marginTop: 6 }]}>
              <Chrome tone="muted" step="note" style={styles.figures}>
                {clock(elapsed)}
              </Chrome>
              <Chrome tone="muted" step="note" style={styles.figures}>
                {clock(duration)}
              </Chrome>
            </View>
          </View>
        ) : null}
        <View style={[styles.row, { alignItems: "center", justifyContent: "center", columnGap: 28 }]}>
          {step("previous", "Previous verse", onPrevious, "mini-previous")}
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={buffering === true ? bufferingLabel(action) : action}
            testID="mini-toggle"
            style={({ pressed }) => [styles.round, { width: 64, height: 64, backgroundColor: palette.ink }, pressed ? styles.pressed : null]}
          >
            {buffering === true ? <Buffering large={ax} /> : <MediaIcon name={playing ? "pause" : "play"} size={26} tone="paper" maxScale={1} />}
          </Pressable>
          {step("next", "Next verse", onNext, "mini-next", nextDisabled === true)}
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
  // The two times keep their width as the seconds change.
  figures: {
    fontVariant: ["tabular-nums"],
  },
});
