/**
 * The full player (AU-04): the chapter as lyrics, the playing verse large and in ink with the
 * spoken word in the pill, the passage-segmented progress bar, "Verse 5 · of 51", then speed,
 * previous, pause, next and Guide. No stop button and no times (there is no audio file, so any
 * duration would be invented); the down chevron closes it and the audio keeps going.
 *
 * Lyrics: Apple Music sing-along, https://mobbin.com/screens/d869e223-b0f8-4cec-a965-c1955fe513c6 ·
 * Spotify, https://mobbin.com/screens/27859727-f251-4887-8b72-e4776a6d7597 · transcript player,
 * Brink, https://mobbin.com/screens/0c68aed6-765a-4380-a4ff-a88ef011ce6c. Tapping a line plays
 * from it. The playing verse scrolls to 30% from the top as it starts, unless the reader has
 * scrolled in the last 4 s; under Reduce Motion it snaps there (AU-05).
 *
 * VoiceOver (AU-06): close → the verses → progress (adjustable: swipe up or down moves a verse;
 * the verse is its value) → speed → previous → pause → next → Guide. Word tracking is never
 * announced and focus never moves on its own. Magic tap plays and pauses.
 *
 * The speed button opens a native menu of speeds (lib/audio/voice.ts). The voice is named under the
 * title (BA-01): Heart or George, each as a computer voice, opening the Voice sheet (BA-03) where the book
 * has a reading; "iPhone voice" where it has none, the system voice reading unasked (John, 13 Oct 2026:
 * the iPhone voice and Personal Voice are no longer choices).
 */

import { type MenuAction, MenuView } from "@react-native-menu/menu";
import { BOOK_CODES, type BookCode, formatVerseId } from "@yada/schema";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Buffering, bufferingLabel } from "../components/audio/Buffering";
import { MediaIcon, type MediaIconName } from "../components/audio/MediaIcon";
import { SpokenSegments, useVerseMark } from "../components/audio/Spoken";
import { usePericopes } from "../components/audio/usePassage";
import { Icon } from "../components/Icon";
import { Chrome } from "../components/Type";
import { useAppData } from "../data/AppData";
import { endSession, jumpTo, next, previous, setRepeat, setSpeed, setStop, toggle } from "../data/audio";
import { loadSettings } from "../data/user";
import { readingKey, readText, refreshRecordings, useRecordings } from "../data/recordings";
import type { VerseText } from "../data/queries";
import { transparent } from "../design/contrast";
import { FONTS, LTR_PROSE, useAXLevel, useLayout, usePalette, useType } from "../design/tokens";
import { FADE_BOTTOM, FADE_TOP, followOffset, progressSegments, segmentFill, speedAccessibilityLabel, speedLabel } from "../lib/audio/session";
import { passageEndIndex, passageStartIndex, repeatChoices, statusLine, stopChoices } from "../lib/audio/stop";
import { playerMenu } from "../lib/audio/voice";
import { parsePsalter, type PsalterChoice, setHolding } from "../lib/dailyPsalms";
import { useReduceMotion } from "../lib/motion";
import { pericopeForVerse } from "../lib/pericopes";
import { chapterTitle } from "../lib/reader";
import { dayOf, partOf } from "../lib/today";
import { scriptureSegments, spokenText } from "../lib/supplied";
import { currentVerse, useAudio } from "../state/audio";

/** How long a drag of the lyrics holds off the follow scroll (refs_au). */
const HOLD_AFTER_DRAG_MS = 4000;

export default function PlayerScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { ax, gutter } = useLayout();
  const axLevel = useAXLevel();
  const reduceMotion = useReduceMotion();
  const session = useAudio((s) => s.session);
  const speed = useAudio((s) => s.speed);
  const stop = useAudio((s) => s.stop);
  const repeat = useAudio((s) => s.repeat);
  // "Stops in 27 min" counts down while the player is open: a tick a minute is enough for whole minutes.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (stop?.kind !== "time") return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [stop]);
  const voiceNote = useAudio((s) => s.voiceNote);
  // "You're offline." appears under the title, so VoiceOver is told; it goes when the player closes.
  useEffect(() => {
    if (voiceNote !== null) AccessibilityInfo.announceForAccessibility(voiceNote);
  }, [voiceNote]);
  useEffect(() => () => useAudio.setState({ voiceNote: null }), []);
  useEffect(() => void refreshRecordings(), []);
  const note = voiceNote;
  // DR-08: Settings › Daily psalms, so a psalm of today's set is titled by the set and can stop at its end.
  const { user } = useAppData();
  const [psalter, setPsalter] = useState<PsalterChoice | null>(null);
  useEffect(() => {
    let live = true;
    void loadSettings(user).then((s) => {
      if (live) setPsalter(parsePsalter(s["dailyPsalms"]));
    });
    return () => {
      live = false;
    };
  }, [user]);

  const pericopes = usePericopes(session?.book);
  const reading = useRecordings((s) => {
    const text = session === null ? null : readText(session.translation);
    return session === null || text === null ? undefined : s.books[readingKey(session.book, text)];
  });
  const recordedBook = reading !== undefined;
  const scroll = useRef<ScrollView>(null);
  const rows = useRef(new Map<number, { y: number; height: number }>());
  const [viewport, setViewport] = useState(0);
  const viewportRef = useRef(0);
  const draggedAt = useRef(0);
  const placed = useRef(false);

  const verse = session === null ? undefined : currentVerse(session);

  useEffect(() => {
    if (verse === undefined) return;
    if (Date.now() - draggedAt.current < HOLD_AFTER_DRAG_MS) return;
    const row = rows.current.get(verse.verse);
    if (row === undefined) return;
    scroll.current?.scrollTo({ y: followOffset(row.y, row.height, viewportRef.current), animated: placed.current && !reduceMotion });
    placed.current = true;
  }, [verse?.verse, verse, reduceMotion]);

  if (session === null || verse === undefined) return <View style={{ flex: 1, backgroundColor: palette.paper }} />;

  const { book, chapter, translation, verses, status } = session;
  const playing = status === "playing";
  const buffering = useAudio((a) => a.session?.buffering === true);
  const name = BOOK_CODES[book].name;
  const title = chapterTitle(book, chapter);
  const passage = pericopeForVerse(pericopes, verse.ord);
  const lastVerse = verses[verses.length - 1]?.verse ?? verses.length;
  const segments = progressSegments(pericopes, verses[0] === undefined ? verse.ord : verses[0].ord - verses[0].verse + 1, lastVerse);
  // DR-08: "Evening · Psalms 6–8" while one of today's psalms plays, the psalm named beneath.
  const clock = new Date();
  const daySet = book === "PSA" && psalter !== null ? setHolding(dayOf(clock), partOf(clock), psalter, chapter, verse.verse) : null;
  const heading = daySet === null ? (passage?.label ?? title) : `${daySet.end.part === "morning" ? "Morning" : "Evening"} · ${daySet.label}`;
  const namesChapter = daySet !== null || passage !== null;

  const onMenu = (id: string) => {
    if (id.startsWith("speed:")) setSpeed(Number(id.slice("speed:".length)));
    else if (id === "stop:off") setStop(null);
    else if (id.startsWith("stop:")) {
      const choice = stopChoices(repeat, pericopes.length > 0, daySet !== null).find((c) => `stop:${c}` === id);
      if (choice !== undefined) setStop(choice, daySet?.end ?? null);
    } else if (id === "repeat:off") setRepeat(null);
    else if (id.startsWith("repeat:")) {
      const choice = repeatChoices(pericopes.length > 0).find((r) => `repeat:${r}` === id);
      if (choice !== undefined) setRepeat(choice);
    }
    else if (id === "end") {
      // The full player had no way to stop (IA stress test, 15 Oct 2026): the session ends and the player closes.
      endSession();
      router.back();
    }
  };
  // LB-01–07: where the passage and the chapter end, for the menu's "After 1:18" and the line under the progress.
  const ords = verses.map((v) => v.ord);
  const starts = pericopes.length === 0 ? null : new Set(pericopes.map((p) => p.start_ord));
  const at = Math.max(0, session.index);
  const passageFirst = verses[passageStartIndex(at, ords, starts)]?.verse ?? 1;
  const passageLast = verses[passageEndIndex(at, ords, starts)]?.verse ?? lastVerse;
  const setLine = statusLine(stop, repeat, { chapter, verse: verse.verse, passageFirst, passageLast, chapterLast: lastVerse, chapterTitle: title }, now);
  // BA-01, BA-05, BA-06: the voice named under the title, a computer voice named as one wherever it is
  // named (John, 12 Oct 2026). It opens the Voice sheet (BA-03, LB-10) wherever the book has a reading in this
  // text: the choice of voice where two read it (the BSB), the book's download in every text
  // (docs/build-6-decisions.md). A chapter already on the phone plays without the manifest, so a playing
  // reading opens it by itself (offline too), and the player asks for the manifest about the rest.
  const voiceLine = session.recorded !== true ? "iPhone voice" : reading === undefined ? "Computer voice" : `${reading.narrator_name}, computer voice`;
  const voiceChoices = recordedBook || session.recorded === true;

  // VoiceOver reads a row by each element's top edge, so in the one-row layout every control is as
  // tall as the pause button and draws its circle inside: speed → previous → pause → next → Guide (AU-06).
  const slot = ax ? null : { height: 72 };
  const round = (iconName: MediaIconName, label: string, onPress: () => void, size: number, testID: string, primary = false) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={primary && buffering ? bufferingLabel(label) : label}
      testID={testID}
      style={({ pressed }) => [styles.round, { width: size }, slot ?? { height: size }, pressed ? styles.pressed : null]}
    >
      <View style={[styles.round, { width: size, height: size, backgroundColor: primary ? palette.ink : "transparent" }]}>
        {/* ST-02: the same spinner as the mini bar while a streaming chapter waits for bytes. */}
        {primary && buffering ? <Buffering large /> : <MediaIcon name={iconName} size={ax ? 30 : primary ? 30 : 26} tone={primary ? "paper" : "ink"} maxScale={1} />}
      </View>
    </Pressable>
  );

  // The speed menu, native as the ⋯ menus on Home and Translations (MT-04): the button shows the speed,
  // the frame's one control in that slot (AU-04).
  const menu = playerMenu(
    speed,
    stop,
    repeat,
    {
      verse: `${chapter}:${verse.verse}`,
      passage: starts === null ? null : `${chapter}:${passageFirst}–${passageLast}`,
      chapter: title,
      passageEnd: starts === null ? null : `${chapter}:${passageLast}`,
      chapterEnd: `${chapter}:${lastVerse}`,
      psalm: book === "PSA",
      set: daySet?.end ?? null,
    },
    now,
  );
  const speedButton = (
    <MenuView
      shouldOpenOnLongPress={false}
      actions={[
        ...menu.map((section): MenuAction => ({
          id: section.id,
          title: section.title,
          ...(section.subtitle === undefined ? {} : { subtitle: section.subtitle }),
          subactions: section.rows.map((row) => ({
            id: row.id,
            title: row.title,
            ...(row.subtitle === undefined ? {} : { subtitle: row.subtitle }),
            state: row.on ? ("on" as const) : ("off" as const),
          })),
        })),
        { id: "end", title: "Stop listening", attributes: { destructive: true } },
      ]}
      onPressAction={({ nativeEvent }) => onMenu(nativeEvent.event)}
      testID="player-speed"
      style={[styles.round, { width: ax ? 72 : 44 }, slot ?? { height: 72 }]}
    >
      {/* The menu is a UIButton; a child that took the touch would keep it from opening (index.tsx). */}
      <View
        pointerEvents="none"
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${speedAccessibilityLabel(speed)}, stop and repeat`}
        accessibilityValue={setLine === null ? undefined : { text: setLine }}
        style={[styles.round, { width: ax ? 72 : 44 }, slot ?? { height: 72 }]}
      >
        <View style={[styles.round, { width: ax ? 72 : 44, height: ax ? 72 : 44, backgroundColor: palette.fill }]}>
          <Chrome tone="ink" size={ax ? undefined : 15} style={{ fontWeight: "600" }} maxFontSizeMultiplier={ax ? 2 : 1.4}>
            {speedLabel(speed)}
          </Chrome>
        </View>
      </View>
    </MenuView>
  );

  const guideButton =
    passage === null ? (
      <View style={{ width: ax ? 72 : 44 }} />
    ) : (
      <Pressable
        onPress={() => router.push({ pathname: "/guide", params: { ref: passage.pericope_id } })}
        accessibilityRole="button"
        accessibilityLabel={`Open the passage guide, ${passage.label}`}
        testID="player-guide"
        style={({ pressed }) => [
          styles.round,
          ax ? { width: 72, height: 72, backgroundColor: palette.fill } : { minWidth: 44, height: 72, paddingHorizontal: 12 },
          pressed ? styles.pressed : null,
        ]}
      >
        <Chrome tone={ax ? "ink" : "accent"} size={15} style={{ fontWeight: "600" }} maxFontSizeMultiplier={1.4}>
          Guide
        </Chrome>
      </Pressable>
    );

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper, paddingTop: insets.top + 4 }} onMagicTap={toggle} testID="player">
      <View style={[styles.header, ax ? styles.headerAx : null, { paddingHorizontal: 14 }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close player"
          testID="player-close"
          // Design QA X6: the sheets' white circle with a hairline ring (polish-2026-10-15.md), not a grey disc.
          style={({ pressed }) => [
            styles.round,
            { width: ax ? 64 : 44, height: ax ? 64 : 44, backgroundColor: palette.sheet, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.edge },
            pressed ? styles.pressed : null,
          ]}
        >
          <Icon name="down" size={20} maxScale={1.5} />
        </Pressable>
        <View style={[styles.title, ax ? { flex: 0, alignItems: "flex-start", paddingHorizontal: 6 } : null]}>
          {/* BA-01 AX5: one line, two at most. US-02: a book with no passages names the chapter once. */}
          <Chrome tone="ink" step="sheetTitle" accessibilityRole="header" style={{ textAlign: ax ? "left" : "center" }} numberOfLines={ax ? 2 : 1}>
            {heading}
          </Chrome>
          {/* BA-01: the place is plain text; the voice is its own control, accented with ⌄, only where there is a choice (BA-06). */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: ax ? "flex-start" : "center" }}>
            <Chrome tone="muted" step="note" accessibilityLabel={[namesChapter ? title : null, translation].filter((p) => p !== null).join(", ")}>
              {`${[namesChapter ? title : null, translation].filter((p) => p !== null).join(" · ")} · `}
            </Chrome>
            {voiceChoices ? (
              <Pressable
                onPress={() => router.push("/voice")}
                accessibilityRole="button"
                accessibilityLabel={`Voice: ${voiceLine}`}
                accessibilityHint="Changes the voice"
                hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", columnGap: 2 }, pressed ? styles.pressed : null]}
                testID="player-voice"
              >
                <Chrome tone="accent" step="note" style={{ fontWeight: "600" }}>
                  {voiceLine}
                </Chrome>
                <Icon name="down" size={12} tone="accent" maxScale={2} />
              </Pressable>
            ) : (
              <Chrome tone="muted" step="note" testID="player-voice">
                {voiceLine}
              </Chrome>
            )}
          </View>
        </View>
        {ax ? null : <View style={{ width: 44 }} />}
      </View>
      {note !== null ? (
        <Chrome tone="muted" step="note" style={[styles.hint, { textAlign: ax ? "left" : "center" }]} testID="voice-hint">
          {note}
        </Chrome>
      ) : null}

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scroll}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 18, paddingBottom: windowHeight * 0.5, rowGap: 18 }}
          onLayout={(e) => {
            viewportRef.current = e.nativeEvent.layout.height;
            setViewport(e.nativeEvent.layout.height);
          }}
          onScrollBeginDrag={() => (draggedAt.current = Date.now())}
          onMomentumScrollEnd={() => (draggedAt.current = Date.now())}
          showsVerticalScrollIndicator={false}
          testID="player-lyrics"
        >
          {/* LB-08: while the chapter's name is said it is the line playing, in ink above verse 1. */}
          {session.titling === true ? (
            <Text
              accessibilityLabel={`${title}, playing`}
              maxFontSizeMultiplier={2}
              style={[LTR_PROSE, { fontFamily: "System", fontSize: axLevel === 0 ? 27 : 24, fontWeight: "600", color: palette.ink }]}
              testID="player-title-line"
            >
              {title}
            </Text>
          ) : null}
          {verses.map((v) => (
            <View
              key={v.ord}
              onLayout={(e) => {
                const { y, height } = e.nativeEvent.layout;
                rows.current.set(v.verse, { y, height });
                // The first layout of the playing line places it, without animation.
                if (v.verse === verse.verse && !placed.current) {
                  scroll.current?.scrollTo({ y: followOffset(y, height, viewportRef.current), animated: false });
                  placed.current = true;
                }
              }}
            >
              <Line
                verse={v}
                name={name}
                chapter={chapter}
                book={book}
                translation={translation}
                place={v.verse < verse.verse ? "past" : v.verse === verse.verse && session.titling !== true ? "current" : "upcoming"}
                bold={reduceMotion}
                big={axLevel === 0}
              />
            </View>
          ))}
        </ScrollView>
        {/* The lyrics fade in under the header and out above the controls (AU-04), drawn over the
            scroll rather than as a mask so taps still reach every line. */}
        <View pointerEvents="none" style={[styles.fade, { top: 0, height: viewport * FADE_TOP, experimental_backgroundImage: `linear-gradient(${palette.paper}, ${transparent(palette.paper)})` }]} />
        <View pointerEvents="none" style={[styles.fade, { bottom: 0, height: viewport * FADE_BOTTOM, experimental_backgroundImage: `linear-gradient(${transparent(palette.paper)}, ${palette.paper})` }]} />
      </View>

      <View style={[styles.controls, { paddingHorizontal: ax ? 14 : 20, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={title}
          accessibilityValue={{ min: 1, max: lastVerse, now: verse.verse, text: `verse ${verse.verse} of ${lastVerse}` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => (e.nativeEvent.actionName === "increment" ? next() : previous())}
          testID="player-progress"
        >
          <View style={styles.progress}>
            {segments.map((s) => (
              <View key={s.from} style={[styles.segment, { flex: s.to - s.from + 1, backgroundColor: palette.divider }]}>
                <View style={[styles.fill, { width: `${Math.round(segmentFill(s, verse.verse) * 100)}%`, backgroundColor: palette.ink }]} />
              </View>
            ))}
          </View>
          <View style={styles.progressLabels} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {/* Review §6: "Verse 5 of 51" is one phrase at every size; split, AX5 wrapped "of 51" alone. */}
            {ax ? (
              <Chrome tone="muted" step="note" style={{ fontVariant: ["tabular-nums"] }}>
                {`Verse\u00a0${verse.verse} of\u00a0${lastVerse}`}
              </Chrome>
            ) : (
              <>
                <Chrome tone="muted" step="note" style={{ fontVariant: ["tabular-nums"] }}>
                  {`Verse ${verse.verse}`}
                </Chrome>
                <Chrome tone="muted" step="note" style={{ fontVariant: ["tabular-nums"] }}>
                  {`of ${lastVerse}`}
                </Chrome>
              </>
            )}
          </View>
        </View>
        {/* LB-03, LB-06: one line while a stop or a repeat is set, under the progress it is about; nothing otherwise. */}
        {setLine !== null ? (
          <Chrome tone="muted" step="note" style={{ marginTop: 2 }} testID="player-status">
            {setLine}
          </Chrome>
        ) : null}
        {ax ? (
          <View style={styles.gridAx}>
            {round("previous", "Previous verse", previous, 80, "player-previous")}
            {round(playing ? "pause" : "play", playing ? "Pause" : "Play", toggle, 80, "player-toggle", true)}
            {round("next", "Next verse", next, 80, "player-next")}
            <View style={styles.rowAx}>
              {speedButton}
              <View style={{ width: 80 }} />
              {guideButton}
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            {speedButton}
            {round("previous", "Previous verse", previous, 56, "player-previous")}
            {round(playing ? "pause" : "play", playing ? "Pause" : "Play", toggle, 72, "player-toggle", true)}
            {round("next", "Next verse", next, 56, "player-next")}
            {guideButton}
          </View>
        )}
      </View>
    </View>
  );
}

/** One verse of the lyrics. Past and upcoming in mutedInk (upcoming lighter), the playing one in ink. */
function Line({
  verse,
  name,
  book,
  chapter,
  translation,
  place,
  bold,
  big,
}: {
  verse: VerseText;
  name: string;
  book: BookCode;
  chapter: number;
  translation: string;
  place: "past" | "current" | "upcoming";
  bold: boolean;
  big: boolean;
}) {
  const palette = usePalette();
  const scripture = useType("scripture");
  const { fontScale } = useWindowDimensions();
  const mark = useVerseMark(book, chapter, translation, verse.verse);
  const current = place === "current";
  // Canvas `.ly` 20 pt, `.ly.cur` 27 pt against the reader's 21; one size at AX, where both are the reading size.
  const size = big ? Math.round(scripture.size * (current ? 27 / 21 : 20 / 21)) : scripture.size;
  const ratio = current ? 1.38 : 1.45;
  const segments = scriptureSegments(verse.text, translation);
  return (
    <Pressable
      // UL-03: the playing line opens its Understand, over the player; any other line plays from there.
      onPress={() => (current ? router.push({ pathname: "/understand", params: { ref: formatVerseId(book, chapter, verse.verse) } }) : jumpTo(verse.verse))}
      accessibilityRole="button"
      accessibilityLabel={`${name} ${chapter}:${verse.verse}${current ? ", playing" : ""}. ${spokenText(verse.text, translation)}`}
      accessibilityHint={current ? "Opens Understand" : "Plays from this verse"}
      testID={`line-${verse.verse}`}
      style={{ opacity: place === "upcoming" ? 0.55 : 1 }}
    >
      <Text
        maxFontSizeMultiplier={scripture.maxFontSizeMultiplier}
        style={[
          LTR_PROSE,
          {
            fontFamily: FONTS.scripture,
            fontSize: size,
            lineHeight: Math.round(size * ratio),
            letterSpacing: -0.2,
            color: current ? palette.ink : palette.mutedInk,
            fontWeight: current && bold ? "600" : "400",
          },
        ]}
      >
        <Text style={{ fontFamily: "System", fontSize: current ? 14 : 12, fontWeight: "600", color: current ? palette.ink : palette.mutedInk }}>
          {`${verse.verse}  `}
        </Text>
        {current && mark !== null ? (
          <SpokenSegments
            segments={segments}
            mark={mark}
            face={{ fontFamily: FONTS.scripture, fontSize: size * Math.min(fontScale, scripture.maxFontSizeMultiplier), letterSpacing: -0.2 }}
          />
        ) : (
          verse.text
        )}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    paddingTop: 4,
    paddingBottom: 6,
  },
  headerAx: {
    flexDirection: "column",
    alignItems: "flex-start",
    rowGap: 8,
  },
  title: {
    flex: 1,
    alignItems: "center",
    rowGap: 1,
  },
  hint: {
    marginTop: 4,
    marginBottom: 8,
    marginHorizontal: 32,
  },
  round: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.72,
  },
  controls: {
    paddingTop: 12,
  },
  progress: {
    flexDirection: "row",
    columnGap: 4,
    height: 5,
    marginTop: 8,
    marginBottom: 6,
  },
  segment: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  gridAx: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    alignItems: "center",
    rowGap: 12,
    marginTop: 14,
  },
  rowAx: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
});
