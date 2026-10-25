/**
 * Today (Build 12 TD-30, TD-31; John, 24 Oct 2026: "why a timeline of verses as opposed to make it experiences for
 * humans on Today"). The date over the greeting, the lamp on the right. The day's verse on its picture, with Sit,
 * Listen, Share and More under it, as under YouVersion's Verse of the Day. Then For you today: each thing to do named
 * for what you do, with a picture and how long it takes (YouVersion's Guided Scripture). Sit with a verse; today's
 * psalms (1662, when Daily psalms is on); Spurgeon's devotional; the office ("Afternoon prayer" from noon to five);
 * your plan; Pray for someone. A finished one fades with a tick, and "1 of 6 done" shows once one is; the day counts
 * at the first, as before. Scrolled, a paper bar names the page and keeps the lamp (TD-21).
 *
 * It replaces the hero picture with the day rising over it on a sheet, the reading card's Read and Listen, the forest
 * office card, the Pray card's list and Later or Earlier (the other part's psalms stay in Earlier days).
 */

import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExperienceCard } from "../../../components/ExperienceCard";
import { FillPicture } from "../../../components/FillPicture";
import { Lamp } from "../../../components/Lamp";
import { readerHref } from "../../../components/navigation";
import { GlassIcon } from "../../../components/Page";
import { useTabBarClearance } from "../../../components/TabBar";
import { Chrome, SectionTitle } from "../../../components/Type";
import { VerseActions } from "../../../components/VerseActions";
import { useAppData, useCore } from "../../../data/AppData";
import { listen } from "../../../data/audio";
import { pictureFor } from "../../../data/pictures";
import { loadToday, type Place, type TodayData } from "../../../data/today";
import { BRAND, ON_PICTURE } from "../../../design/palette";
import { useLayout, usePalette, useType, WIDE } from "../../../design/tokens";
import { cardPictureDays, dayLabel, doneLine, greeting, officeName, pictureDay } from "../../../lib/today";
import { useAccessibility } from "../../../state/accessibility";
import { useSettings } from "../../../state/settings";

const open = (place: Place) => router.push(readerHref({ ...place, resume: true, back: "Today" }));

interface Thing {
  readonly key: string;
  readonly kicker: string;
  readonly title: string;
  readonly meta: string;
  readonly done: boolean;
  readonly onPress: () => void;
}

/** For you today, in order (TD-30), from what the day has. */
function thingsFor(data: TodayData, now: Date): Thing[] {
  const verse = data.verse;
  const out: Thing[] = [];
  if (verse !== null)
    out.push({
      key: "sit",
      kicker: "Sit with a verse",
      title: "Today’s verse, slowly",
      meta: "5 min",
      done: data.done.has("sit"),
      onPress: () => router.push({ pathname: "/sit", params: { text: verse.text, ref: verse.ref, bsb: verse.bsb ? "1" : "", place: `${verse.place.book}.${verse.place.chapter}.${verse.place.verse}`, why: "Today" } }),
    });
  const psalms = data.psalms;
  if (psalms !== null)
    out.push({
      key: "psalms",
      kicker: `Today’s psalms · ${psalms.label.replace(/^Psalms? /u, "")}`,
      title: psalms.opening === "" ? psalms.label : `“${psalms.opening}”`,
      meta: `${psalms.minutes} min`,
      done: psalms.chapters.some((c) => data.done.has(c)),
      onPress: () => open(psalms.place),
    });
  const devotional = data.devotional;
  if (devotional !== null)
    out.push({
      key: "devotional",
      kicker: `Devotional · ${devotional.ref}`,
      title: devotional.heading,
      meta: `${devotional.minutes} min`,
      done: data.done.has("devotional"),
      onPress: () => router.push({ pathname: "/devotional", params: { key: devotional.key, part: devotional.part } }),
    });
  if (data.office !== null)
    out.push({
      key: "office",
      kicker: data.part === "evening" ? "Evening prayer" : officeName(now),
      title: data.office.opening,
      meta: "15 min",
      done: data.done.has("office"),
      onPress: () => router.push({ pathname: "/office", params: { part: data.part } }),
    });
  const plan = data.plan;
  if (plan.kind === "choose")
    out.push({ key: "plan", kicker: "Your plan", title: plan.finished === true ? "You’ve read John. Choose what’s next" : "Choose a plan", meta: "Reading plans", done: false, onPress: () => router.push("/plans") });
  else if (plan.kind === "start")
    out.push({ key: "plan", kicker: "A place to start", title: "The Gospel of John, passage by passage", meta: "Begin", done: false, onPress: () => router.push({ pathname: "/thread", params: { from: "today" } }) });
  else
    out.push({
      key: "plan",
      kicker: plan.kind === "john" ? "Your plan · John" : "Your plan · The whole Bible",
      title: plan.title,
      meta: `${plan.minutes} min`,
      done: data.done.has(`read:${plan.place.book}.${plan.place.chapter}`),
      onPress: () => open(plan.place),
    });
  if (data.pray !== null)
    out.push({
      key: "pray",
      kicker: "Pray for someone",
      title: data.pray.first[0] ?? "Your list, and someone on Yada",
      meta: "One by one",
      done: data.done.has("pray"),
      onPress: () => router.push("/pray/through"),
    });
  return out;
}

export default function Today() {
  const core = useCore();
  const { user } = useAppData();
  const translation = useSettings((s) => s.translation);
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();
  const { ax, gutter: phoneGutter, regular, tabs } = useLayout();
  const gutter = regular ? WIDE.gutter : phoneGutter;
  const solid = useAccessibility((st) => st.reduceTransparency);
  const titleType = useType("pageTitle");
  const [data, setData] = useState<TodayData | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [compact, setCompact] = useState(false);
  const [headerBottom, setHeaderBottom] = useState(120);

  // Read on every focus, so the 17:00 switch, the 03:00 turn and something just finished all show (stress test #11).
  useFocusEffect(
    useCallback(() => {
      let live = true;
      const at = new Date();
      setNow(at);
      void loadToday(core, user, translation, at).then((d) => live && setData(d));
      return () => {
        live = false;
      };
    }, [core, user, translation]),
  );

  const picture = data === null ? undefined : pictureFor(data.day, data.part);
  const verse = data?.verse ?? null;
  const things = data === null ? [] : thingsFor(data, now);
  const days = data === null ? [] : cardPictureDays(pictureDay(data.day), things.length);
  const done = things.filter((t) => t.done).length;

  const openVerse = () => router.push({ pathname: "/verse", params: { part: data?.part ?? "morning" } });
  const aboutPicture = () => router.push({ pathname: "/picture", params: { part: data?.part ?? "morning" } });

  // The lamp and the number (plan §2 row 8, XT-01, XT-02): none before a day has counted; it opens You (YO-30), which
  // holds the days now Your rhythm is gone.
  const lamp =
    data === null || !data.rhythm.begun ? null : (
      <Pressable
        onPress={() => router.push("/you")}
        accessibilityRole="button"
        accessibilityLabel={data.rhythm.streak === 0 ? "Your days" : `Your days: ${data.rhythm.streak} ${data.rhythm.streak === 1 ? "day" : "days"} in a row${data.rhythm.lit ? ", today counts" : ""}`}
        hitSlop={8}
        // XT-02: lit is the selection wash, unlit the glass with a hairline ring and muted words.
        style={[
          styles.lamp,
          data.rhythm.lit ? { backgroundColor: palette.selection } : { backgroundColor: palette.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.divider },
        ]}
        testID="today-lamp"
      >
        <Lamp lit={data.rhythm.lit} color={palette.accent} />
        {data.rhythm.streak === 0 ? null : (
          <Chrome tone={data.rhythm.lit ? "ink" : "muted"} style={styles.lampCount}>
            {`${data.rhythm.streak} ${data.rhythm.streak === 1 ? "day" : "days"}`}
          </Chrome>
        )}
      </Pressable>
    );

  const verseCard =
    verse === null ? null : (
      <View style={[styles.verseCard, { backgroundColor: BRAND.night }]}>
        {picture === undefined ? null : (
          <Pressable onPress={openVerse} onLongPress={aboutPicture} style={StyleSheet.absoluteFill} accessible={false} testID="today-picture">
            <FillPicture source={picture.image} alt={picture.alt} />
          </Pressable>
        )}
        {/* Dark under the words, at least 86% under Reduce Transparency (EB-04). */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { experimental_backgroundImage: solid ? SOLID_FADE : FADE }]} />
        <View style={styles.verseInner}>
          <Chrome step="note" style={{ color: ON_PICTURE.strong, fontWeight: "600" }}>
            {`Today’s verse · ${verse.ref}${verse.bsb ? " · BSB" : ""}`}
          </Chrome>
          <Pressable
            onPress={openVerse}
            onLongPress={aboutPicture}
            accessibilityRole="button"
            accessibilityLabel={`${verse.text}. ${verse.ref}. Opens it full screen`}
            accessibilityActions={[{ name: "longpress", label: "About this picture" }]}
            onAccessibilityAction={({ nativeEvent }) => nativeEvent.actionName === "longpress" && aboutPicture()}
            testID="today-verse"
          >
            {/* EB-03: four lines at most (three at AX sizes); the whole verse is one tap away, full screen. */}
            <Chrome numberOfLines={ax ? 3 : 4} style={styles.verseText} maxFontSizeMultiplier={1.6}>
              {verse.text}
            </Chrome>
          </Pressable>
          <VerseActions
            onPicture
            actions={[
              {
                icon: "sit",
                title: "Sit",
                label: `Sit with ${verse.ref}`,
                onPress: () => things.find((t) => t.key === "sit")?.onPress(),
                testID: "today-sit",
              },
              { icon: "play", title: "Listen", label: `Listen from ${verse.ref}`, onPress: () => void listen(verse.place.book, verse.place.chapter, verse.place.verse), testID: "today-listen" },
              {
                icon: "share",
                title: "Share",
                label: `Share ${verse.ref} as an image`,
                onPress: () => router.push({ pathname: "/share-image", params: { verse: `${verse.place.book}.${verse.place.chapter}.${verse.place.verse}` } }),
                testID: "today-share",
              },
            ]}
            more={{
              actions: [
                { id: "copy", title: "Copy" },
                { id: "open", title: "Open in Bible" },
                { id: "picture", title: "About this picture" },
              ],
              onChoose: (id) => {
                if (id === "copy") void Clipboard.setStringAsync(`“${verse.text}” ${verse.ref}${verse.bsb ? " BSB" : ""}`).then(() => AccessibilityInfo.announceForAccessibility("Copied"));
                if (id === "open") open(verse.place);
                if (id === "picture") aboutPicture();
              },
            }}
          />
        </View>
      </View>
    );

  const header = (
    <View style={[styles.header, ax ? { flexDirection: "column", alignItems: "flex-start", rowGap: 8 } : null]} onLayout={(e) => setHeaderBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
      <View style={{ flexShrink: 1 }}>
        <Chrome step="note" tone="muted" style={{ fontSize: ax ? undefined : 15 }}>
          {data === null ? "" : dayLabel(data.day)}
        </Chrome>
        <Chrome tone="ink" accessibilityRole="header" style={{ fontSize: titleType.size, lineHeight: titleType.lineHeight, fontWeight: "700", letterSpacing: -0.8 }}>
          {greeting(now)}
        </Chrome>
      </View>
      {/* YO-30: the person beside the lamp opens You, there before any day has counted. */}
      <View style={styles.headerEnd}>
        {lamp}
        <GlassIcon icon="person" label="You" onPress={() => router.push("/you")} testID="today-you" />
      </View>
    </View>
  );

  const line = doneLine(done, things.length);
  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }}>
      <StatusBar style="auto" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          { paddingTop: (tabs === "top" ? 0 : insets.top) + 16, paddingHorizontal: gutter, paddingBottom: tabClearance, rowGap: 14 },
          regular ? { width: "100%", maxWidth: WIDE.page + 2 * gutter, alignSelf: "center" } : null,
        ]}
        // TD-21, TD-31: once the greeting has scrolled away, a paper bar names the page and keeps the lamp.
        onScroll={(e) => setCompact(e.nativeEvent.contentOffset.y > headerBottom - insets.top)}
        scrollEventThrottle={32}
        testID="today"
      >
        {header}
        {verseCard}
        {things.length === 0 ? null : (
          <View style={{ rowGap: 10, marginTop: 8 }}>
            <View style={styles.sectionHead}>
              <SectionTitle>For you today</SectionTitle>
              {line === null ? null : (
                <Chrome step="note" tone="muted" testID="today-done">
                  {line}
                </Chrome>
              )}
            </View>
            {things.map((t, i) => (
              <ExperienceCard
                key={t.key}
                kicker={t.kicker}
                title={t.title}
                meta={t.meta}
                done={t.done}
                image={pictureFor(days[i] ?? 1, data?.part ?? "morning")?.image}
                onPress={t.onPress}
                testID={`today-${t.key}`}
              />
            ))}
          </View>
        )}
      </ScrollView>
      {compact ? (
        <View style={[styles.compact, { paddingTop: insets.top + 4, backgroundColor: palette.paper, borderBottomColor: palette.divider }]} pointerEvents="box-none" testID="today-bar">
          {/* At AX sizes the title sits left, clear of the lamp: centred, the two ran together (12d QA). */}
          <View style={[styles.compactRow, ax ? { alignItems: "flex-start", paddingLeft: gutter } : null]}>
            <Chrome step="sheetTitle" tone="ink" accessibilityRole="header">
              Today
            </Chrome>
            <View style={[styles.compactLamp, { right: gutter }]}>{lamp}</View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Clear at the top for the picture, dark under the verse and its actions. */
const FADE = "linear-gradient(rgba(8,12,10,0.2), rgba(8,12,10,0.72))";
// At 86% black even a white sky leaves white text at about 5.5:1 (WCAG AA 4.5:1), as the hero's was (EB-04).
const SOLID_FADE = "linear-gradient(rgba(14,14,12,0.86), rgba(14,14,12,0.94))";

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 12 },
  headerEnd: { flexDirection: "row", alignItems: "center", columnGap: 8 },
  lamp: { flexDirection: "row", alignItems: "center", columnGap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 22 },
  lampCount: { fontSize: 17, fontWeight: "600", fontVariant: ["tabular-nums"] },
  verseCard: { borderRadius: 24, overflow: "hidden" },
  verseInner: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 8, rowGap: 28 },
  verseText: { color: ON_PICTURE.text, fontFamily: "Literata", fontSize: 30, lineHeight: 39, letterSpacing: -0.4 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", columnGap: 12 },
  compact: { position: "absolute", top: 0, left: 0, right: 0, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 6 },
  compactRow: { alignSelf: "stretch", minHeight: 44, alignItems: "center", justifyContent: "center" },
  compactLamp: { position: "absolute", top: 0, bottom: 0, justifyContent: "center" },
});
