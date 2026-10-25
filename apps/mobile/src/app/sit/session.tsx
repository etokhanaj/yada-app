/**
 * Sit with a verse, the session (SW-03 to SW-05; Build 12, John 24 Oct 2026). One player in four parts on the day's
 * picture blurred to colour: breathe with the orb, hear the verse read with each word lit, quiet with the time left,
 * hear it again. The progress segments sit between × and rain; the part's name is for VoiceOver, not printed. Pause in
 * the middle, Skip on the right, × back to the setup. The verse is read by Heart or George from its chapter's
 * recording (data/sitVoice.ts), never the iPhone voice; with no recording to be had it is read in silence, and one
 * line says why. The length chosen sets the quiet (lib/sit.ts). When the verse splits at its own break, the last rounds
 * of breathing breathe its halves. The session reaching its end counts the day, then Amen (SW-06).
 *
 * Refs: Insight Timer, a session on a photograph with a large time (mobbin.com/screens/7e0d32d9-0307-4a43-ba85-64f99c6a669f);
 * Ahead, words centred over segmented progress (mobbin.com/screens/514576f9-9fef-4393-aa77-5edbc6c6763f); Calm Sleep's
 * orb in a ring (mobbin.com/screens/54e3f825-c301-4fc9-a3d1-3b72bc658591); Life Reset's count and what comes next
 * (mobbin.com/screens/8cad3cd9-ead8-429c-8d48-a9fd14c76bc9).
 */

import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { Speech } from "../../../modules/yada-speech";
import { GlassButton } from "../../components/Glass";
import { Icon } from "../../components/Icon";
import { PauseButton } from "../../components/PauseButton";
import { StepSegments } from "../../components/StepSegments";
import { PictureGround } from "../../components/PictureGround";
import { Chrome } from "../../components/Type";
import { useAppData, useCore } from "../../data/AppData";
import { setAmbient, useAmbient } from "../../data/ambient";
import { pause as pausePlayer } from "../../data/audio";
import { type SitReading, sitReading } from "../../data/sitVoice";
import { countDay } from "../../data/user";
import { BADGE, BRAND, ON_PICTURE, ORB_LIGHT } from "../../design/palette";
import { FONTS, useAXLevel, useLayout } from "../../design/tokens";
import {
  breathAnnouncement,
  breathAt,
  breathSeconds,
  breathSplit,
  clock,
  PART_NAMES,
  quietSeconds,
  readSeconds,
  SESSION_MINUTES,
  SESSION_PARTS,
  type SessionMinutes,
  type SessionPart,
  SETTLE,
  VERSE_ROUNDS,
  wordAtLocation,
  wordSpans,
} from "../../lib/sit";
import { useAccessibility } from "../../state/accessibility";
import { useAudio } from "../../state/audio";

const BREATH_WORDS = ["Breathe in", "Breathe out"] as const;

export default function SitSession() {
  const params = useLocalSearchParams<{ text?: string; ref?: string; bsb?: string; place?: string; minutes?: string }>();
  const text = params.text ?? "";
  const bsb = params.bsb === "1";
  const refLine = `${params.ref ?? ""}${bsb ? " · BSB" : ""}`;
  const minutes: SessionMinutes = SESSION_MINUTES.find((m) => String(m) === params.minutes) ?? 5;
  const { user } = useAppData();
  const core = useCore();
  const insets = useSafeAreaInsets();
  const { gutter } = useLayout();
  const reduceMotion = useAccessibility((s) => s.reduceMotion);
  const rain = useAmbient((s) => s.on);

  const spans = useRef(wordSpans(text)).current;
  const split = useRef(breathSplit(text)).current;
  const quiet = quietSeconds(minutes, text);
  const [index, setIndex] = useState(0);
  const part: SessionPart = SESSION_PARTS[index] ?? "again";
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [word, setWord] = useState<number | null>(null);
  // Found while the breathing runs: undefined until then, null when these words have no recording to read from.
  const [reading, setReading] = useState<SitReading | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void sitReading(core, params.place ?? "", text)
      .catch(() => null)
      .then((r) => live && setReading(r));
    return () => {
      live = false;
    };
  }, [core, params.place, text]);
  const segments = reading != null && "segments" in reading ? reading.segments : null;
  const hearing = part === "hear" || part === "again";
  // No recording to be had: the verse is read in silence for as long as reading it takes.
  const silent = Speech === null || (reading !== undefined && segments === null);
  const timed = part === "breathe" || part === "quiet" || (hearing && silent);
  const partLength = part === "breathe" ? breathSeconds() : part === "quiet" ? quiet : readSeconds(text);

  const next = () => {
    setWord(null);
    setSeconds(0);
    // Skipping while paused starts the next part playing: a pause belongs to the part it was pressed in.
    setPaused(false);
    if (index + 1 < SESSION_PARTS.length) {
      setIndex(index + 1);
      return;
    }
    // The session reached its end: the day counts (build 7 plan: meditation counts), then Amen.
    void countDay(user)
      .catch(() => undefined)
      .then(() => router.replace({ pathname: "/sit/amen", params: { text, ref: params.ref ?? "", bsb: params.bsb ?? "", place: params.place ?? "" } }));
  };
  const nextRef = useRef(next);
  nextRef.current = next;

  // The reader's own listening stops for this: two voices at once is noise.
  useEffect(() => {
    if (useAudio.getState().session?.status === "playing") pausePlayer();
  }, []);

  // A countdown on screen (CLAUDE.md: the one timer allowed): it runs while a timed part shows and stops with it.
  useEffect(() => {
    if (!timed || paused) return;
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [timed, paused, index]);
  useEffect(() => {
    if (!timed || seconds < partLength) return;
    if (part === "quiet") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility("The quiet has ended");
    }
    nextRef.current();
  }, [timed, seconds, partLength, part]);

  // Hear it read, and again: the recording's segments in turn, each word lit from its timings as it is said.
  const playing = useRef<{ id: string; index: number } | null>(null);
  useEffect(() => {
    if (Speech === null || !hearing || segments === null) return;
    const speech = Speech;
    const base = `sit:${part}:${Date.now()}`;
    const play = (i: number) => {
      const segment = segments[i];
      if (segment === undefined) return nextRef.current();
      const id = `${base}:${i}`;
      playing.current = { id, index: i };
      void speech.playSegment(id, segment, 1).catch(() => nextRef.current());
    };
    const subs = [
      speech.addListener("onRange", (e) => {
        if (e.id === playing.current?.id) setWord(wordAtLocation(spans, e.location));
      }),
      speech.addListener("onFinish", (e) => {
        if (e.id === playing.current?.id) play(playing.current.index + 1);
      }),
    ];
    play(0);
    return () => {
      playing.current = null;
      subs.forEach((sub) => sub.remove());
      void speech.stop();
    };
  }, [part, hearing, segments, spans]);

  const togglePause = () => {
    const now = !paused;
    setPaused(now);
    const speech = Speech;
    const at = playing.current;
    if (speech !== null && hearing && segments !== null && at !== null) {
      if (now) void speech.pause();
      // Paused between two verses there is nothing to resume: the verse it stopped at plays again from its start.
      else
        void speech.resume().then((ok) => {
          const segment = segments[at.index];
          if (!ok && segment !== undefined) void speech.playSegment(at.id, segment, 1).catch(() => nextRef.current());
        });
    }
  };

  const progress = hearing && !silent ? (word === null ? 0 : (word + 1) / spans.length) : seconds / partLength;
  const breath = breathAt(seconds);

  return (
    <View style={styles.screen} testID="sit-session">
      <PictureGround blurred />
      <View style={[styles.top, { paddingTop: insets.top + 4, paddingHorizontal: gutter - 8 }]}>
        <GlassButton onPicture onPress={() => router.back()} accessibilityLabel="End" testID="sit-end">
          <Icon name="close" size={20} tone="white" />
        </GlassButton>
        <StepSegments count={SESSION_PARTS.length} fill={(i) => (i < index ? 1 : i === index ? progress : 0)} label={`${PART_NAMES[part]}, part ${index + 1} of ${SESSION_PARTS.length}`} />
        <GlassButton
          onPicture
          onPress={() => void setAmbient(!rain)}
          accessibilityRole="switch"
          accessibilityState={{ checked: rain }}
          accessibilityLabel="The sound of rain"
          testID="sit-session-rain"
        >
          <Icon name="cloud" size={20} color={rain ? BRAND.chartreuse : ON_PICTURE.text} />
        </GlassButton>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        {part === "breathe" ? (
          <Breathe phase={breath.phase} left={breath.left} half={split !== null && breath.round >= SETTLE.rounds - VERSE_ROUNDS ? split[breath.phase] : null} paused={paused} still={reduceMotion} />
        ) : part === "quiet" ? (
          <View style={styles.quiet}>
            <Chrome style={styles.clock} maxFontSizeMultiplier={1.2} accessibilityLabel={`${clock(quiet - seconds)} left`}>
              {clock(quiet - seconds)}
            </Chrome>
            <Text style={styles.faint} maxFontSizeMultiplier={1.5}>
              {text}
            </Text>
          </View>
        ) : (
          <View style={{ rowGap: 16 }}>
            <Text style={styles.read} maxFontSizeMultiplier={1.27} accessibilityLabel={text}>
              {spans.map((s, i) => (
                <Text key={s.start}>
                  <Text style={i === word ? styles.lit : null}>{text.slice(s.start, s.end)}</Text>
                  {text.slice(s.end, spans[i + 1]?.start ?? s.end)}
                </Text>
              ))}
            </Text>
            <Chrome step="note" style={{ color: ON_PICTURE.strong, fontWeight: "600" }}>
              {refLine}
            </Chrome>
            {silent ? (
              <Chrome step="note" style={{ color: ON_PICTURE.muted }} accessibilityLiveRegion="polite">
                {reading != null && "missing" in reading
                  ? `${reading.missing === "offline" ? "You’re offline" : "The reading didn’t load"} · Read it slowly to yourself`
                  : "Read it slowly to yourself"}
              </Chrome>
            ) : null}
          </View>
        )}
      </ScrollView>

      <View style={[styles.controls, { paddingHorizontal: gutter, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.side} />
        <PauseButton paused={paused} onPress={togglePause} testID="sit-pause" />
        <Pressable
          onPress={() => nextRef.current()}
          accessibilityRole="button"
          accessibilityLabel={index + 1 < SESSION_PARTS.length ? `Skip to ${PART_NAMES[SESSION_PARTS[index + 1] ?? "again"].toLowerCase()}` : "Skip to the end"}
          style={[styles.side, styles.skip]}
          testID="sit-skip"
        >
          <Chrome style={{ color: ON_PICTURE.text, fontWeight: "600" }}>Skip</Chrome>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * SW-03: one soft lime orb grows toward a faint ring that marks a full breath, the seconds left inside it in ink, the
 * words under it. VoiceOver hears each half once as it starts ("Breathe in, 4 seconds. Then out for 6."). Under Reduce
 * Motion the orb stays still and only the count and words change. The haptic follows the breath, as before (BR-01).
 */
function Breathe({ phase, left, half, paused, still }: { phase: 0 | 1; left: number; half: string | null; paused: boolean; still: boolean }) {
  const ring = useAXLevel() >= 3 ? 230 : 290;
  const orb = ring * 0.7;
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const full = phase === 0 ? SETTLE.inSeconds : SETTLE.outSeconds;
    AccessibilityInfo.announceForAccessibility(breathAnnouncement(phase, full));
    const felt = Speech?.breathe(phase === 0 ? "in" : "out", phase === 0 ? SETTLE.inSeconds : 0) ?? Promise.resolve(false);
    void felt.catch(() => false).then((ok) => {
      if (!ok) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });
    return () => void Speech?.stopBreathing();
  }, [phase]);

  useEffect(() => {
    if (still) return;
    if (paused) {
      grow.stopAnimation();
      return;
    }
    // Runs over the seconds left of this half, so a resumed breath picks up where it stopped.
    Animated.timing(grow, { toValue: phase === 0 ? 1 : 0, duration: left * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start();
    // `left` is read only when a half starts or resumes: a new tick must not restart the motion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, still, grow]);

  const scale = still ? 0.85 : grow.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1 / 0.7] });
  return (
    <View style={styles.breathe} accessible accessibilityLabel={breathAnnouncement(phase, left)}>
      <View style={{ width: ring, height: ring, alignItems: "center", justifyContent: "center" }} importantForAccessibility="no-hide-descendants">
        <View style={[StyleSheet.absoluteFill, styles.ring, { borderRadius: ring / 2, borderColor: ON_PICTURE.mark }]} />
        <Animated.View style={{ position: "absolute", width: orb, height: orb, transform: [{ scale }] }}>
          <Svg width={orb} height={orb}>
            <Defs>
              <RadialGradient id="sitOrb" cx="50%" cy="42%" r="58%">
                <Stop offset="0" stopColor={ORB_LIGHT.centre} />
                <Stop offset="0.55" stopColor={ORB_LIGHT.middle} />
                <Stop offset="1" stopColor={ORB_LIGHT.edge} />
              </RadialGradient>
            </Defs>
            <Circle cx={orb / 2} cy={orb / 2} r={orb / 2} fill="url(#sitOrb)" />
          </Svg>
        </Animated.View>
        <Chrome style={styles.count} maxFontSizeMultiplier={1}>
          {left}
        </Chrome>
      </View>
      <View style={{ alignItems: "center", rowGap: 6 }} importantForAccessibility="no-hide-descendants">
        {half === null ? (
          <Chrome style={styles.breathWord} maxFontSizeMultiplier={1.27}>
            {BREATH_WORDS[phase]}
          </Chrome>
        ) : (
          <Text style={styles.half} maxFontSizeMultiplier={1.27}>
            {half}
          </Text>
        )}
        <Chrome style={{ color: ON_PICTURE.muted, textAlign: "center" }} maxFontSizeMultiplier={1.6}>
          {half === null ? (phase === 0 ? `Out for ${SETTLE.outSeconds} next` : `In for ${SETTLE.inSeconds} next`) : BREATH_WORDS[phase]}
        </Chrome>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", columnGap: 14 },
  body: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
  breathe: { alignItems: "center", rowGap: 34 },
  ring: { borderWidth: 1.5 },
  count: { color: BRAND.ink, fontSize: 46, lineHeight: 54, fontWeight: "300", fontVariant: ["tabular-nums"] },
  breathWord: { color: ON_PICTURE.text, fontSize: 30, lineHeight: 36, fontWeight: "600", letterSpacing: -0.3, textAlign: "center" },
  half: { color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontSize: 30, lineHeight: 39, textAlign: "center" },
  read: { color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontSize: 30, lineHeight: 40, letterSpacing: -0.4 },
  lit: { backgroundColor: BADGE.ground, color: BADGE.ink },
  quiet: { alignItems: "center", rowGap: 22 },
  clock: { color: ON_PICTURE.text, fontSize: 72, lineHeight: 80, fontWeight: "300", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  faint: { color: ON_PICTURE.text, opacity: 0.62, fontFamily: FONTS.scripture, fontSize: 21, lineHeight: 29, textAlign: "center" },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { width: 72 },
  skip: { minHeight: 44, alignItems: "flex-end", justifyContent: "center" },
});
