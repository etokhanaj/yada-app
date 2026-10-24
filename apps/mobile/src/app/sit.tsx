/**
 * Sit with this (PR-02–06, AS-01; build 7 plan §2 row 18): four optional steps on the day's verse, in order with Begin or
 * any one on its own. Never music, scripts or claims about wellbeing. The verse arrives as Today shows it: under a
 * licensed translation the BSB, so the words seen are the words heard (rule 9), and the step says so.
 *
 * The first page is a page (PR-02): the verse in Literata, the steps numbered with what each is, Begin with its length,
 * and "+ Add rain" (AS-01). Each step is a calm full screen, not a page (design QA, 18 Oct 2026: they were white pages
 * with large titles): Settle and Breathe the verse on the dark ground (#10140F, PR-03, PR-04), Sit with it and choosing
 * Silence on paper (PR-05, PR-06), Silence itself on the dark ground. An × top left ends it; the caption names the step
 * and, in a run, where it is ("Settle · 1 of 4"). Meditation counts towards the streak (build 7 plan): a step that
 * reaches its end counts the day.
 */

import { formatVerseId, parseVerseId } from "@yada/schema";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { Speech } from "../../modules/yada-speech";
import { Icon } from "../components/Icon";
import { PageScreen } from "../components/Page";
import { Chrome } from "../components/Type";
import { useAppData } from "../data/AppData";
import { setAmbient, useAmbient } from "../data/ambient";
import { pause as pausePlayer } from "../data/audio";
import { countDay } from "../data/user";
import { BRAND, ON_PICTURE, ORB_LIGHT } from "../design/palette";
import { FONTS, useAXLevel, useLayout, usePalette } from "../design/tokens";
import { rateFor } from "../lib/audio/session";
import {
  aboutMinutes,
  breathSplit,
  DEFAULT_SILENCE,
  moveOnFrom,
  SETTLE,
  SILENCE_MINUTES,
  SIT_SILENCE_SECONDS,
  type Step,
  STEP_TITLES,
  stepLine,
  timeLeft,
  wordAtLocation,
  wordSpans,
} from "../lib/sit";
import { useAccessibility } from "../state/accessibility";
import { useAudio } from "../state/audio";

/** The calm ground of PR-03, PR-04 and running Silence, and the light that sits on it. */
const NIGHT = BRAND.night;
const ON_NIGHT = BRAND.onNight;

export default function Sit() {
  const { text = "", ref = "", bsb = "", place = "" } = useLocalSearchParams<{ text?: string; ref?: string; bsb?: string; place?: string }>();
  const { user } = useAppData();
  const palette = usePalette();
  const { gutter } = useLayout();
  const reduceMotion = useAccessibility((s) => s.reduceMotion);
  const split = breathSplit(text);
  const steps: Step[] = ["settle", ...(split !== null ? (["breathe"] as const) : []), "sit", "silence"];
  const [running, setRunning] = useState<{ step: Step; all: boolean } | null>(null);
  const rain = useAmbient((s) => s.on);
  useEffect(() => () => void setAmbient(false), []);
  const refLine = `${ref}${bsb !== "" ? " · BSB" : ""}`;
  const verseId = place === "" ? null : parseVerseId(place);

  const way = running === null ? null : moveOnFrom(steps, running.step, running.all);
  const advance = () => setRunning(way?.next == null ? null : { step: way.next, all: true });
  const finished = () => {
    void countDay(user).catch(() => undefined);
    if (running !== null) advance();
  };
  const close = () => setRunning(null);
  // BR-01 to BR-04: moving on early skips to the next step, or alone back to the list; only a step that reaches its
  // end counts the day.
  const moveOn: MoveOn | undefined = way === null ? undefined : { label: way.label, accessibilityLabel: way.accessibilityLabel, onPress: advance };

  if (running !== null) {
    const caption = `${STEP_TITLES[running.step]}${running.all ? ` · ${steps.indexOf(running.step) + 1} of ${steps.length}` : ""}`;
    if (running.step === "settle")
      return (
        <Calm caption={caption} onClose={close} moveOn={moveOn} key="settle">
          <Breath reduceMotion={reduceMotion} onDone={finished} />
        </Calm>
      );
    if (running.step === "breathe" && split !== null)
      return (
        <Calm caption={caption} onClose={close} moveOn={moveOn} key="breathe">
          <BreatheVerse halves={split} refLine={refLine} reduceMotion={reduceMotion} onDone={finished} />
        </Calm>
      );
    if (running.step === "sit")
      return (
        <Calm caption={caption} onClose={close} light key="sit">
          <SitWith
            text={text}
            bsb={bsb !== ""}
            onDone={finished}
            original={verseId === null ? null : () => router.push({ pathname: "/understand", params: { ref: formatVerseId(verseId), section: "original" } })}
          />
        </Calm>
      );
    return <SilenceStep caption={caption} text={text} onClose={close} onDone={finished} />;
  }

  return (
    <PageScreen title="Sit with this" back="Today" testID="sit">
      <Text style={[styles.indexVerse, { color: palette.ink }]} accessibilityLabel={`${text} ${ref}`}>
        {text}
      </Text>
      <Chrome step="note" tone="muted" style={{ marginBottom: gutter }}>
        {refLine}
      </Chrome>
      {steps.map((s, i) => (
        <Pressable
          key={s}
          onPress={() => setRunning({ step: s, all: false })}
          accessibilityRole="button"
          accessibilityLabel={`${i + 1}, ${STEP_TITLES[s]}. ${stepLine(s)}`}
          style={({ pressed }) => [styles.stepRow, i === 0 ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.divider }, pressed ? { backgroundColor: palette.fill } : null]}
          testID={`sit-step-${s}`}
        >
          <View style={[styles.stepNumber, { backgroundColor: palette.fill }]}>
            {/* Capped so the number fits its disc: at AX5 it was cut off (QA, 24 Oct 2026). */}
            <Chrome step="note" tone="ink" style={{ fontWeight: "600" }} maxFontSizeMultiplier={1.4}>
              {i + 1}
            </Chrome>
          </View>
          <View style={{ flex: 1, rowGap: 2 }}>
            <Chrome tone="ink" style={{ fontWeight: "600" }}>
              {STEP_TITLES[s]}
            </Chrome>
            <Chrome step="note" tone="muted">
              {stepLine(s)}
            </Chrome>
          </View>
          <Icon name="forward" size={16} tone="muted" />
        </Pressable>
      ))}
      <Pressable
        onPress={() => setRunning({ step: "settle", all: true })}
        accessibilityRole="button"
        accessibilityLabel={`Begin, all ${steps.length} in order, about ${aboutMinutes(steps, text)} minutes`}
        style={({ pressed }) => [styles.begin, { backgroundColor: palette.ink, opacity: pressed ? 0.85 : 1 }]}
        testID="sit-begin"
      >
        <Chrome style={{ color: palette.paper, fontWeight: "600" }}>{`Begin · about ${aboutMinutes(steps, text)} min`}</Chrome>
      </Pressable>
      {/* AS-01: one quiet line in the accent, tapped again it stops. */}
      <Pressable onPress={() => void setAmbient(!rain)} accessibilityRole="button" accessibilityLabel={rain ? "Stop the sound of rain" : "Add the sound of rain"} style={styles.rain} testID="sit-rain">
        <Chrome tone="accent" style={{ fontSize: 15, fontWeight: "600" }}>
          {rain ? "Rain · Stop" : "+ Add rain"}
        </Chrome>
      </Pressable>
    </PageScreen>
  );
}

/** Settle and Breathe the verse's way on: Next names the step it goes to, or Done when the step was chosen alone. */
interface MoveOn {
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
}

/**
 * The calm full screen every step uses: dark or paper ground, × top left, the step's caption at the top. With
 * `moveOn` (BR-01 to BR-04), Next sits at the foot and a tap anywhere else on the ground does the same, so someone who
 * has had enough need not find the button. Mobbin: Forest's one quiet way out at the foot
 * (mobbin.com/screens/048a50cf-8544-49a5-9391-e0fe06cff28e), stoic.'s Finish Earlier (ea4a9e85-b8fa-4116-89cf-097d614e9cb2).
 */
function Calm({ caption, onClose, light = false, moveOn, children }: { caption: string | null; onClose: () => void; light?: boolean; moveOn?: MoveOn; children: ReactNode }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const ground = light ? palette.paper : NIGHT;
  const ink = light ? palette.ink : ON_NIGHT;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: ground }]} testID="sit-calm">
      <StatusBar style={light ? "auto" : "light"} />
      {moveOn === undefined ? null : <Pressable style={StyleSheet.absoluteFill} onPress={moveOn.onPress} accessible={false} testID="sit-ground" />}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="End, back to Sit with this"
        style={[styles.close, { top: insets.top + 4, backgroundColor: light ? palette.fill : ON_PICTURE.glass }]}
        testID="sit-close"
      >
        <Icon name="close" size={20} tone={light ? "ink" : "paper"} />
      </Pressable>
      {caption === null ? null : (
        // Capped like the breath's own words, and clear of the × either side: at AX5 it ran into both (QA, 23 Oct 2026).
        <Chrome step="note" style={[styles.caption, { top: insets.top + 16, color: ink }]} accessibilityRole="header" maxFontSizeMultiplier={1.6}>
          {caption}
        </Chrome>
      )}
      {moveOn === undefined ? (
        // Scrolls when the words are taller than the screen: at AX5 Silence's verse ran up under the caption.
        <ScrollView contentContainerStyle={[styles.calmScroll, { paddingTop: insets.top + 84, paddingBottom: insets.bottom + 40 }]}>{children}</ScrollView>
      ) : (
        <View style={[styles.calmBody, { paddingTop: insets.top + 84, paddingBottom: insets.bottom + 110 }]} pointerEvents="none">
          {children}
        </View>
      )}
      {moveOn === undefined ? null : (
        <Pressable
          onPress={moveOn.onPress}
          accessibilityRole="button"
          accessibilityLabel={moveOn.accessibilityLabel}
          style={({ pressed }) => [styles.moveOn, { bottom: insets.bottom + 24, backgroundColor: ON_PICTURE.glass, opacity: pressed ? 0.85 : 1 }]}
          testID="sit-next"
        >
          <Chrome style={{ color: ink, fontWeight: "600" }}>{moveOn.label}</Chrome>
          <Icon name="forward" size={16} tone="paper" />
        </Pressable>
      )}
    </View>
  );
}

/**
 * One breath at a time, in 4 and out 6 (PR-03, PR-04). The haptic follows the breath (BR-01 to BR-03): taps that rise
 * through the in-breath, one firm tap at the turn, then stillness (BreathHaptics.swift); a phone that can't play it
 * gets one light tap per half. Under Reduce Motion only the words move.
 */
function useBreath(onDone: () => void): 0 | 1 {
  const [phase, setPhase] = useState<0 | 1>(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const beat = (n: number) => {
      if (!live) return;
      if (n === SETTLE.rounds * 2) return done.current();
      const p = (n % 2) as 0 | 1;
      setPhase(p);
      const felt = Speech?.breathe(p === 0 ? "in" : "out", p === 0 ? SETTLE.inSeconds : 0) ?? Promise.resolve(false);
      void felt.catch(() => false).then((ok) => {
        if (!ok && live) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      });
      timer = setTimeout(() => beat(n + 1), (p === 0 ? SETTLE.inSeconds : SETTLE.outSeconds) * 1000);
    };
    beat(0);
    return () => {
      live = false;
      if (timer !== undefined) clearTimeout(timer);
      void Speech?.stopBreathing();
    };
  }, []);
  return phase;
}

/** BR-01, BR-02 (John, 23 Oct 2026): "Breathe in" and "Breathe out" under the pace circle, as Calm Sleep words it
 * (mobbin.com/screens/54e3f825-c301-4fc9-a3d1-3b72bc658591). */
const BREATH_WORDS = ["Breathe in", "Breathe out"] as const;

function Breath({ reduceMotion, onDone }: { reduceMotion: boolean; onDone: () => void }) {
  const phase = useBreath(onDone);
  return (
    <View style={styles.centre} accessible accessibilityLiveRegion="polite" accessibilityLabel={BREATH_WORDS[phase]}>
      <Orb phase={phase} still={reduceMotion} />
      <Chrome style={styles.breathWord} maxFontSizeMultiplier={1.6}>
        {BREATH_WORDS[phase]}
      </Chrome>
      <Chrome style={styles.calmNote} maxFontSizeMultiplier={1.6}>{`In for ${SETTLE.inSeconds}, out for ${SETTLE.outSeconds}`}</Chrome>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The orb (BR-05 A, BR-06; John, 23 Oct 2026): a lit orb, its light from the centre with a soft chartreuse glow, inside
 * a faint ring that marks a full breath. A thin arc runs round the ring with the breath and closes at the turn, then
 * draws back on the out-breath, so how far through it you are shows at a glance. Mobbin: Calm Sleep's orb in a ring
 * with a marker tracing it (mobbin.com/screens/6cede835-b9a2-4fd5-8dfb-77740019313f), TIDE's soft glow on a dark
 * ground (287a15c4-8699-4f56-baee-89b6f92e71fa). Under Reduce Motion it stays still and only the words change. At AX3
 * and up it is smaller, so the words keep their room.
 */
function Orb({ phase, still }: { phase: 0 | 1; still: boolean }) {
  const size = useAXLevel() >= 3 ? 220 : 280;
  const c = size / 2;
  const ringR = (size * 128) / 280;
  const coreR = (size * 112) / 280;
  const haloR = coreR * 1.6;
  const around = 2 * Math.PI * ringR;
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    // SVG props can't take the native driver, and one value drives the orb, the arc and its head together.
    Animated.timing(breath, {
      toValue: phase === 0 ? 1 : 0,
      duration: (phase === 0 ? SETTLE.inSeconds : SETTLE.outSeconds) * 1000,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: false,
    }).start();
  }, [phase, still, breath]);
  const scale = still ? 0.8 : breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", width: haloR * 2, height: haloR * 2, transform: [{ scale }] }}>
        <Svg width={haloR * 2} height={haloR * 2}>
          <Defs>
            <RadialGradient id="orbHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0.55" stopColor={BRAND.chartreuse} stopOpacity={0.22} />
              <Stop offset="1" stopColor={BRAND.chartreuse} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="orbCore" cx="50%" cy="44%" r="62%">
              <Stop offset="0" stopColor={ORB_LIGHT.centre} />
              <Stop offset="0.4" stopColor={BRAND.chartreuse} />
              <Stop offset="0.85" stopColor={ORB_LIGHT.edge} />
              <Stop offset="1" stopColor={ORB_LIGHT.rim} />
            </RadialGradient>
          </Defs>
          <Circle cx={haloR} cy={haloR} r={haloR} fill="url(#orbHalo)" />
          <Circle cx={haloR} cy={haloR} r={coreR} fill="url(#orbCore)" />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={ringR} fill="none" stroke={ON_NIGHT} strokeOpacity={0.12} strokeWidth={1.5} />
        {still ? null : (
          <AnimatedCircle
            cx={c}
            cy={c}
            r={ringR}
            fill="none"
            stroke={BRAND.chartreuse}
            strokeOpacity={0.85}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={`${around} ${around}`}
            strokeDashoffset={breath.interpolate({ inputRange: [0, 1], outputRange: [around, 0] })}
            transform={`rotate(-90 ${c} ${c})`}
          />
        )}
      </Svg>
      {still ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: breath.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }]}>
          <View style={[styles.orbHead, { top: c - ringR - 4.5, left: c - 4.5 }]} />
        </Animated.View>
      )}
    </View>
  );
}

/**
 * Both halves stay on screen; the one being breathed is full, the other faint (PR-04). BR-07 (24 Oct 2026): the halves
 * cross-fade over half a second, and a thin line under the half being breathed fills over the in-breath and draws
 * back over the out, the orb arc's cue as a line. Under Reduce Motion the halves switch and there is no line.
 */
function BreatheVerse({ halves, refLine, reduceMotion, onDone }: { halves: [string, string]; refLine: string; reduceMotion: boolean; onDone: () => void }) {
  const phase = useBreath(onDone);
  const fade = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(fade, { toValue: phase, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
    Animated.timing(breath, {
      toValue: phase === 0 ? 1 : 0,
      duration: (phase === 0 ? SETTLE.inSeconds : SETTLE.outSeconds) * 1000,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    }).start();
  }, [phase, reduceMotion, fade, breath]);
  const opacityOf = (i: 0 | 1) =>
    reduceMotion ? (phase === i ? 1 : 0.35) : fade.interpolate({ inputRange: [0, 1], outputRange: i === 0 ? [1, 0.35] : [0.35, 1] });
  return (
    <View style={[styles.centre, { rowGap: 22 }]} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${BREATH_WORDS[phase]}: ${halves[phase]}`}>
      {BREATH_WORDS.map((label, i) => (
        <Animated.View key={label} style={{ alignItems: "center", rowGap: 6, opacity: opacityOf(i as 0 | 1) }}>
          <Chrome style={styles.breathLabel}>{label}</Chrome>
          <Text style={styles.breathHalf} maxFontSizeMultiplier={1.4}>
            {halves[i]}
          </Text>
          {reduceMotion || phase !== i ? null : (
            <View style={styles.breathLine}>
              <Animated.View style={[styles.breathLineFill, { transform: [{ scaleX: breath }] }]} />
            </View>
          )}
        </Animated.View>
      ))}
      <Chrome style={styles.calmNote}>{refLine}</Chrome>
    </View>
  );
}

/**
 * Read slowly, twice, with silence between (PR-05): the voice reads the verse with each word marked as it is said, then
 * silence, then again. With no voice on the phone the same pattern runs on the clock, unmarked.
 */
function SitWith({ text, bsb, onDone, original }: { text: string; bsb: boolean; onDone: () => void; original: (() => void) | null }) {
  const palette = usePalette();
  const spans = useRef(wordSpans(text)).current;
  const [word, setWord] = useState<number | null>(null);
  const [part, setPart] = useState<"first" | "silence" | "again">("first");
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    let live = true;
    const ids = { first: `sit:first:${Date.now()}`, again: `sit:again:${Date.now()}` };
    const timers: ReturnType<typeof setTimeout>[] = [];
    // The reader's own listening stops for this: two voices at once is noise.
    if (useAudio.getState().session?.status === "playing") pausePlayer();
    const read = (which: "first" | "again", then: () => void) => {
      if (!live) return;
      setPart(which);
      if (Speech === null) {
        timers.push(setTimeout(then, Math.max(8, spans.length / 2) * 1000));
        return;
      }
      void Speech.speak(ids[which], [{ text, offset: 0, pause: 0 }], rateFor(0.8), 0, null).catch(() => then());
    };
    const subs =
      Speech === null
        ? []
        : [
            Speech.addListener("onRange", ({ id, location }) => {
              if (live && (id === ids.first || id === ids.again)) setWord(wordAtLocation(spans, location));
            }),
            Speech.addListener("onFinish", ({ id }) => {
              if (!live) return;
              setWord(null);
              if (id === ids.first) afterFirst();
              if (id === ids.again) done.current();
            }),
          ];
    const afterFirst = () => {
      setPart("silence");
      timers.push(setTimeout(() => read("again", () => done.current()), SIT_SILENCE_SECONDS * 1000));
    };
    read("first", afterFirst);
    return () => {
      live = false;
      timers.forEach(clearTimeout);
      subs.forEach((s) => s.remove());
      void Speech?.stop();
    };
  }, [text, spans]);

  const status = part === "first" ? "First reading · then silence · then again" : part === "silence" ? "Silence · then again" : "Again";
  return (
    <View style={{ rowGap: 18, alignSelf: "stretch" }}>
      <Text style={[styles.sitVerse, { color: palette.ink, opacity: part === "silence" ? 0.9 : 1 }]} accessibilityLabel={text}>
        {spans.map((s, i) => (
          <Text key={s.start}>
            <Text style={i === word ? { backgroundColor: palette.ink, color: palette.paper } : null}>{text.slice(s.start, s.end)}</Text>
            {text.slice(s.end, spans[i + 1]?.start ?? s.end)}
          </Text>
        ))}
      </Text>
      <Chrome step="note" tone="muted" style={{ textAlign: "center" }} accessibilityLiveRegion="polite">
        {bsb ? `${status} · Read aloud in the BSB` : status}
      </Chrome>
      {original === null ? null : (
        <Pressable onPress={original} accessibilityRole="button" accessibilityLabel="The original words of this verse" style={[styles.originalPill, { backgroundColor: palette.fill }]} testID="sit-original">
          <Chrome tone="ink" style={{ fontWeight: "600", fontSize: 15 }}>
            Original
          </Chrome>
        </Pressable>
      )}
    </View>
  );
}

/** Silence (PR-06): choose 3, 5, 10 or 20 minutes on paper; then only the verse on the dark ground, the time left, a haptic at the end. */
function SilenceStep({ caption, text, onClose, onDone }: { caption: string; text: string; onClose: () => void; onDone: () => void }) {
  const palette = usePalette();
  const [minutes, setMinutes] = useState<number>(DEFAULT_SILENCE);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (endsAt === null) return;
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    const end = setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // PR-06's accessibility note: the end is heard too, not only felt.
      AccessibilityInfo.announceForAccessibility("Silence has ended");
      done.current();
    }, endsAt - Date.now());
    return () => {
      clearInterval(tick);
      clearTimeout(end);
    };
  }, [endsAt]);

  // PR-06 running: only the verse and the time left, no step caption. The × stays, a departure from the frame: twenty
  // minutes with no way out but the home gesture is a trap, and every other step keeps it.
  if (endsAt !== null)
    return (
      <Calm caption={null} onClose={onClose}>
        <View style={{ rowGap: 18, alignSelf: "stretch" }}>
          <Text style={[styles.sitVerse, { color: ON_NIGHT }]} maxFontSizeMultiplier={1.4}>{text}</Text>
          <Chrome style={[styles.calmNote, { textAlign: "center" }]} accessibilityLiveRegion="polite">
            {timeLeft(endsAt - now)}
          </Chrome>
        </View>
      </Calm>
    );
  return (
    <Calm caption={caption} onClose={onClose} light>
      <View style={{ rowGap: 22, alignSelf: "stretch", alignItems: "center" }}>
        <Text style={[styles.sitVerse, { color: palette.ink, alignSelf: "stretch" }]} maxFontSizeMultiplier={1.4}>{text}</Text>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="How long">
          {SILENCE_MINUTES.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMinutes(m)}
              accessibilityRole="radio"
              accessibilityState={{ checked: m === minutes }}
              accessibilityLabel={`${m} minutes`}
              style={[styles.chip, { backgroundColor: m === minutes ? palette.ink : palette.fill }]}
              testID={`sit-silence-${m}`}
            >
              <Chrome style={{ fontWeight: "600", color: m === minutes ? palette.paper : palette.ink }}>{`${m} min`}</Chrome>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => {
            setNow(Date.now());
            setEndsAt(Date.now() + minutes * 60_000);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Begin ${minutes} minutes of silence`}
          style={({ pressed }) => [styles.silenceGo, { backgroundColor: palette.ink, opacity: pressed ? 0.85 : 1 }]}
          testID="sit-silence-begin"
        >
          <Chrome style={{ color: palette.paper, fontWeight: "600" }}>Begin</Chrome>
        </Pressable>
      </View>
    </Calm>
  );
}

const styles = StyleSheet.create({
  indexVerse: { fontFamily: FONTS.scripture, fontSize: 21, lineHeight: 30, marginTop: 4, marginBottom: 6 },
  stepRow: { flexDirection: "row", alignItems: "center", columnGap: 14, minHeight: 56, paddingVertical: 12 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  begin: { marginTop: 24, minHeight: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  rain: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", marginTop: 8 },
  close: { position: "absolute", left: 16, zIndex: 2, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  caption: { position: "absolute", left: 68, right: 68, textAlign: "center", fontWeight: "600", opacity: 0.75 },
  calmBody: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  calmScroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  centre: { alignItems: "center", rowGap: 18 },
  orbHead: { position: "absolute", width: 9, height: 9, borderRadius: 4.5, backgroundColor: BRAND.chartreuse },
  breathWord: { color: ON_NIGHT, fontSize: 28, lineHeight: 34, fontWeight: "600", letterSpacing: 0.5 },
  breathLabel: { color: ON_NIGHT, fontSize: 13, fontWeight: "600", letterSpacing: 0.4 },
  breathHalf: { color: ON_NIGHT, fontFamily: FONTS.scripture, fontSize: 30, lineHeight: 39, textAlign: "center" },
  moveOn: { position: "absolute", alignSelf: "center", minHeight: 50, paddingHorizontal: 28, borderRadius: 25, flexDirection: "row", alignItems: "center", columnGap: 6 },
  breathLine: { width: 120, height: 3, borderRadius: 2, marginTop: 8, overflow: "hidden", backgroundColor: ON_PICTURE.track },
  breathLineFill: { flex: 1, borderRadius: 2, backgroundColor: BRAND.chartreuse, transformOrigin: "left" },
  calmNote: { color: ON_NIGHT, fontSize: 14, opacity: 0.75, textAlign: "center" },
  sitVerse: { fontFamily: FONTS.scripture, fontSize: 27, lineHeight: 39 },
  originalPill: { alignSelf: "center", minHeight: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: "center" },
  silenceGo: { minHeight: 50, paddingHorizontal: 40, borderRadius: 25, justifyContent: "center" },
});
