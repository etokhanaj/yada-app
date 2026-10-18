/**
 * Today (build 7a; canvas DR-11, DR-12, DR-15, XT-01, XT-02, EB-01, EB-03, EB-04): the day as one page.
 *
 * - The day's picture runs edge to edge with the greeting and the day's verse set on it, and the day rises over it
 *   on a sheet (John: "knock yourself out", 15 Oct 2026; the App Store's Today and Fitness+). The evening has its own
 *   picture from 17:00 (DR-12). At AX sizes the picture is a figure after the lead card.
 * - Cards only as CLAUDE.md allows: one per thing you tap, a soft fill, no shadow, no buttons inside a card that is
 *   itself the tap, except the reading card's Read.
 */

import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { readerHref } from "../../../components/navigation";
import { ListRow } from "../../../components/Page";
import { Chrome, SectionTitle } from "../../../components/Type";
import { useAppData, useCore } from "../../../data/AppData";
import { Lamp } from "../../../components/Lamp";
import { pictureFor } from "../../../data/pictures";
import { loadToday, type Place, type TodayData } from "../../../data/today";
import { countDay } from "../../../data/user";
import { listen } from "../../../data/audio";
import { MediaIcon } from "../../../components/audio/MediaIcon";
import { FONTS, useLayout, usePalette, useType, WIDE } from "../../../design/tokens";
import { dayLabel, greeting, laterRow } from "../../../lib/today";
import { useTabBarClearance } from "../../../components/TabBar";
import { useAccessibility } from "../../../state/accessibility";
import { useSettings } from "../../../state/settings";
import { BRAND } from "../../../design/palette";
import { FillPicture } from "../../../components/FillPicture";

const open = (place: Place) => router.push(readerHref({ ...place, resume: true, back: "Today" }));

/** The lamp pill on the picture (XT-02, `.thero .stk`): lit is a near-white pill with ink words and a forest lamp. */
const LIT_ON_PICTURE = "rgba(255,255,255,0.92)";
const UNLIT_ON_PICTURE = "rgba(255,255,255,0.2)";

export default function Today() {
  const core = useCore();
  const { user } = useAppData();
  const translation = useSettings((s) => s.translation);
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();
  const { ax, gutter: phoneGutter, regular, tabs, sectionGap } = useLayout();
  const gutter = regular ? WIDE.gutter : phoneGutter;
  const solid = useAccessibility((st) => st.reduceTransparency);
  const titleType = useType("pageTitle");
  const [data, setData] = useState<TodayData | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [focused, setFocused] = useState(false);

  // Read on every focus, so the 17:00 switch, the 03:00 turn and a passage just read all show (stress test #11).
  useFocusEffect(
    useCallback(() => {
      let live = true;
      const at = new Date();
      setNow(at);
      setFocused(true);
      void loadToday(core, user, translation, at).then((d) => live && setData(d));
      return () => {
        live = false;
        setFocused(false);
      };
    }, [core, user, translation]),
  );

  // RT-07, John 18 Oct 2026: the day's verse counts for the day when the reader taps Done on it. Opening the app never does.
  const markDone = () => {
    void countDay(user)
      .then(() => loadToday(core, user, translation, new Date()))
      .then(setData)
      .catch(() => undefined);
  };

  const picture = data === null ? undefined : pictureFor(data.day, data.part);
  const hero = picture !== undefined && !ax && !regular;
  const hello = greeting(now);
  const date = data === null ? "" : dayLabel(data.day);

  const verse = data?.verse ?? null;
  // DR-16: the picture and the verse open the day's verse full screen; a long press, About this picture (DR-14).
  const openVerse = () => router.push({ pathname: "/verse", params: { part: data?.part ?? "morning" } });
  const aboutPicture = () => router.push({ pathname: "/picture", params: { part: data?.part ?? "morning" } });
  const verseBlock = (onPicture: boolean) => {
    if (verse === null) return null;
    const sit = () => router.push({ pathname: "/sit", params: { text: verse.text, ref: verse.ref, bsb: verse.bsb ? "1" : "", place: `${verse.place.book}.${verse.place.chapter}.${verse.place.verse}` } });
    const unlit = data?.rhythm.lit !== true;
    // The verse is one VoiceOver element, so Sit with this and Done inside it are unreachable by swipe; they are its
    // actions instead (code review, 18 Oct 2026).
    const actions = [{ name: "sit", label: "Sit with this verse" }, ...(unlit ? [{ name: "done", label: "Done. Counts today" }] : []), ...(onPicture ? [{ name: "longpress", label: "About this picture" }] : [])];
    return (
      <Pressable
        onPress={openVerse}
        onLongPress={onPicture ? aboutPicture : undefined}
        accessibilityRole="button"
        accessibilityLabel={`${verse.text}. ${verse.ref}. Opens the day's verse`}
        accessibilityActions={actions}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === "sit") sit();
          else if (nativeEvent.actionName === "done" && unlit) markDone();
          else if (nativeEvent.actionName === "longpress" && onPicture) aboutPicture();
        }}
        // DR-15 (build 7 plan §6): with no picture the verse is text on the page, never a box around text (CLAUDE.md).
        style={onPicture ? styles.verseOnPicture : styles.versePlain}
        testID="today-verse"
      >
        {/* EB-03: four lines at most (three at AX sizes); the whole verse is one tap away, full screen. */}
        <Chrome tone={onPicture ? "paper" : "ink"} numberOfLines={ax ? 3 : 4} style={[styles.verseText, onPicture ? { color: "#FFFFFF" } : null]}>
          {verse.text}
        </Chrome>
        {/* DR-11, PR-01: "Psalm 1:3 · Sit with this" on one line; RT-07: Done counts the day, until it has counted. */}
        <View style={styles.verseActions}>
          <Chrome step="note" tone={onPicture ? "paper" : "muted"} style={onPicture ? { color: "rgba(255,255,255,0.88)", fontWeight: "600" } : { fontWeight: "600" }}>
            {verse.ref}
            {verse.bsb ? " · BSB" : ""}
            {" ·"}
          </Chrome>
          <Pressable
            onPress={sit}
            accessibilityRole="button"
            accessibilityLabel="Sit with this verse"
            style={styles.verseAction}
            testID="today-sit"
          >
            <Chrome step="note" tone={onPicture ? "paper" : "ink"} style={[{ fontWeight: "600", textDecorationLine: "underline" }, onPicture ? { color: "#FFFFFF" } : null]}>
              Sit with this
            </Chrome>
          </Pressable>
          {unlit ? (
            <Pressable
              onPress={markDone}
              accessibilityRole="button"
              accessibilityLabel="Done. Counts today"
              style={styles.verseAction}
              testID="today-done"
            >
              <Chrome step="note" tone={onPicture ? "paper" : "ink"} style={[{ fontWeight: "600", textDecorationLine: "underline" }, onPicture ? { color: "#FFFFFF" } : null]}>
                Done
              </Chrome>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    );
  };

  // `figure` goes after the lead card: at AX sizes the picture, carrying the verse, sits there (DR-11 AX5).
  const cardsWith = (figure: ReactNode): ReactNode =>
    data === null ? null : (
      <View style={{ rowGap: 10 }}>
        {data.plan.kind === "choose" ? (
          // EB-01: Daily psalms Off and no plan; the lead asks for one, as the reading card would lead.
          <Card label="Your plan: choose a plan" testID="today-choose-plan">
            <Chrome step="note" tone="muted" style={{ fontWeight: "600" }}>
              Your plan
            </Chrome>
            <Chrome tone="ink" style={[styles.readingTitle, { marginBottom: 14 }]} maxFontSizeMultiplier={2}>
              Choose a plan
            </Chrome>
            <Pressable
              onPress={() => router.push("/plans")}
              accessibilityRole="button"
              accessibilityLabel="Reading plans"
              style={({ pressed }) => [styles.primary, ax ? styles.wide : null, { backgroundColor: palette.ink, opacity: pressed ? 0.8 : 1 }]}
              testID="today-plans"
            >
              <Chrome tone="paper" style={{ fontWeight: "600", color: palette.paper }}>
                Reading plans
              </Chrome>
            </Pressable>
          </Card>
        ) : null}
        {data.psalms === null ? null : (
        <Card label={`${data.psalms.label}. ${data.psalms.opening}`} testID="today-reading">
          <Chrome tone="ink" style={styles.readingTitle} maxFontSizeMultiplier={2}>
            {data.psalms.label}
          </Chrome>
          {data.psalms.opening !== "" ? (
            <Chrome tone="muted" style={{ fontFamily: FONTS.scripture, fontSize: 16, lineHeight: 23, fontWeight: "400", marginBottom: 14 }} numberOfLines={ax ? 4 : 2}>
              {data.psalms.opening}
            </Chrome>
          ) : null}
          {/* DR-11: Read or Listen, the reading's two ways in (build 7 plan §2 row 2). */}
          <View style={[styles.readRow, ax ? { flexDirection: "column", alignItems: "stretch" } : null]}>
            <Pressable
              onPress={() => data.psalms !== null && open(data.psalms.place)}
              accessibilityRole="button"
              accessibilityLabel={`Read ${data.psalms.label}`}
              style={({ pressed }) => [styles.primary, ax ? styles.wide : null, { backgroundColor: palette.ink, opacity: pressed ? 0.8 : 1 }]}
              testID="today-read"
            >
              <Chrome tone="paper" style={{ fontWeight: "600", color: palette.paper }}>
                Read
              </Chrome>
            </Pressable>
            <Pressable
              onPress={() => data.psalms !== null && void listen(data.psalms.place.book, data.psalms.place.chapter, data.psalms.place.verse)}
              accessibilityRole="button"
              accessibilityLabel={`Listen to ${data.psalms.label}`}
              style={({ pressed }) => [styles.primary, styles.listen, ax ? styles.wide : null, { backgroundColor: palette.paper, opacity: pressed ? 0.8 : 1 }]}
              testID="today-listen"
            >
              <MediaIcon name="play" size={12} maxScale={1.6} />
              <Chrome tone="ink" style={{ fontWeight: "600" }}>
                Listen
              </Chrome>
            </Pressable>
          </View>
        </Card>
        )}

        {data.office !== null ? (
          // DO-01 (build 8, John 17 Oct 2026): Daily prayer's own card previews the guided steps it opens, the
          // forest and chartreuse of Yada's brand against the light sheet; one card, no shadow.
          // Evening prayer (Build 10) is the same card titled for the part; the screen reads the part it was opened for,
          // so a card tapped just before the evening turns still opens the office it showed.
          <Pressable
            onPress={() => router.push({ pathname: "/office", params: { part: data.part } })}
            accessibilityRole="button"
            accessibilityLabel={`${data.part === "evening" ? "Evening prayer" : "Daily prayer"}, about 15 minutes. ${data.office.opening}`}
            style={({ pressed }) => [styles.office, { opacity: pressed ? 0.9 : 1 }]}
            testID="today-office"
          >
            <Chrome style={styles.officeKicker} maxFontSizeMultiplier={2}>
              {data.part === "evening" ? "Evening prayer" : "Daily prayer"}
            </Chrome>
            <Chrome style={styles.officeText} numberOfLines={ax ? 4 : 2}>
              {data.office.opening}
            </Chrome>
            <Chrome style={styles.officeRef} maxFontSizeMultiplier={2}>
              {data.office.ref}
            </Chrome>
            <View style={[styles.officeFoot, ax ? { flexWrap: "wrap", rowGap: 10 } : null]}>
              <View style={styles.officeMarks} accessible={false}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={styles.officeMark} />
                ))}
              </View>
              <Chrome style={styles.officeLen} maxFontSizeMultiplier={2}>
                About 15 min
              </Chrome>
              <View style={styles.officeBegin}>
                <Chrome style={styles.officeBeginText}>Begin</Chrome>
              </View>
            </View>
          </Pressable>
        ) : null}

        {figure}

        {data.devotional !== null ? (
          <Card
            onPress={() => router.push({ pathname: "/devotional", params: { key: data.devotional?.key ?? "", part: data.devotional?.part ?? "morning" } })}
            label={`Devotional by C. H. Spurgeon: ${data.devotional.heading} ${data.devotional.ref}`}
            testID="today-devotional"
          >
            <View style={styles.who}>
              <Image source={require("../../../../assets/today/spurgeon.jpg")} style={styles.avatar} accessibilityIgnoresInvertColors />
              <Chrome tone="ink" step="note" style={{ fontWeight: "600", fontSize: 15 }}>
                C. H. Spurgeon
              </Chrome>
            </View>
            <Chrome tone="ink" style={styles.cardTitle}>
              {data.devotional.heading}
            </Chrome>
            <Chrome step="note" tone="muted">
              {data.devotional.ref}
            </Chrome>
          </Card>
        ) : null}

        {data.plan.kind === "choose" ? null : data.plan.kind === "start" ? (
          <Card onPress={() => router.push({ pathname: "/thread", params: { from: "today" } })} label="A place to start: The Gospel of John, passage by passage, explained" testID="today-start">
            <Chrome step="note" tone="muted" style={{ fontWeight: "600" }}>
              A place to start
            </Chrome>
            <Chrome tone="ink" style={styles.cardTitle}>
              The Gospel of John
            </Chrome>
            <Chrome step="note" tone="muted">
              Passage by passage, explained
            </Chrome>
          </Card>
        ) : (
          <Card
            onPress={() => (data.plan.kind === "john" || data.plan.kind === "mcheyne") && open(data.plan.place)}
            label={`Your plan: ${data.plan.title}, ${data.plan.sub}${data.plan.kind === "john" ? `, ${data.plan.count}` : ""}`}
            testID="today-plan"
          >
            <View style={styles.cardHead}>
              <Chrome step="note" tone="muted" style={{ fontWeight: "600" }}>
                {data.plan.kind === "john" ? "The Gospel of John" : "M’Cheyne"}
              </Chrome>
              {data.plan.kind === "john" ? (
                <Chrome step="note" tone="muted">
                  {data.plan.count}
                </Chrome>
              ) : null}
            </View>
            <Chrome tone="ink" style={styles.cardTitle}>
              {data.plan.title}
            </Chrome>
            <Chrome step="note" tone="muted">
              {data.plan.sub}
            </Chrome>
          </Card>
        )}

        {/* PR-01 (build 7 plan row 18, built in build 8): Pray is one card after the reading. DR-11's `.prc`: "Pray"
            and the list's size, then its first two lines in Literata, each after an accent dot. */}
        {data.pray === null ? null : (
          <Card
            onPress={() => router.push("/today/pray")}
            label={data.pray.count === 0 ? "Pray: your list, and someone to pray for" : `Pray: ${data.pray.count} on your list. ${data.pray.first.join(". ")}`}
            testID="today-pray"
          >
            <View style={styles.cardHead}>
              <Chrome step="note" tone="muted" style={{ fontWeight: "600" }}>
                Pray
              </Chrome>
              {data.pray.count > 0 ? (
                <Chrome step="note" tone="muted">
                  {data.pray.count}
                </Chrome>
              ) : null}
            </View>
            {data.pray.count === 0 ? (
              <Chrome tone="ink" style={styles.cardTitle}>
                Your list, and someone to pray for
              </Chrome>
            ) : (
              data.pray.first.map((line, i) => (
                <View key={i} style={styles.prayLine}>
                  <View style={[styles.prayDot, { backgroundColor: palette.accent }]} />
                  <Chrome tone="ink" numberOfLines={1} style={{ fontFamily: FONTS.scripture, fontSize: 16, lineHeight: 23, flex: 1 }}>
                    {line}
                  </Chrome>
                </View>
              ))
            )}
          </Card>
        )}

        {data.other === null ? null : (
          // DR-11, DR-12: a section of its own, the set on the first line and Spurgeon's part under it when there is one.
          // The column's 10 pt row gap plus this makes the page's section gap (`--secgap`; it was a fixed 30).
          <View style={{ marginTop: sectionGap - 10 }}>
            <SectionTitle style={{ marginBottom: 4 }}>{data.part === "morning" ? "Later" : "Earlier"}</SectionTitle>
            <ListRow
              first
              onPress={() => data.other !== null && open(data.other.place)}
              {...laterRow(data.part, data.other.label, data.other.spurgeon)}
              testID="today-other"
            />
          </View>
        )}
      </View>
    );

  // The lamp and the number (plan §2 row 8, XT-01, XT-02): none before a day has counted; it opens Your rhythm.
  const lamp = (onPicture: boolean) =>
    data === null || !data.rhythm.begun ? null : (
      <Pressable
        onPress={() => router.push("/rhythm")}
        accessibilityRole="button"
        accessibilityLabel={`Your rhythm: ${data.rhythm.streak} ${data.rhythm.streak === 1 ? "day" : "days"}${data.rhythm.lit ? ", today counts" : ""}`}
        hitSlop={8}
        // XT-02: lit and unlit differ in the pill as well as the lamp's fill. On the picture, lit is near-white with ink
        // words and a forest lamp, unlit a faint glass with white words; on paper, lit is the selection wash, unlit the
        // glass with a hairline ring and muted words (canvas `.stk`, `.stk.lit`).
        style={[
          styles.lamp,
          onPicture
            ? { backgroundColor: data.rhythm.lit ? LIT_ON_PICTURE : solid ? "rgba(0,0,0,0.55)" : UNLIT_ON_PICTURE }
            : data.rhythm.lit
              ? { backgroundColor: palette.selection }
              : { backgroundColor: palette.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.divider },
        ]}
        testID="today-lamp"
      >
        <Lamp lit={data.rhythm.lit} color={onPicture ? (data.rhythm.lit ? BRAND.forest : "#FFFFFF") : palette.accent} />
        <Chrome
          tone={onPicture ? "paper" : data.rhythm.lit ? "ink" : "muted"}
          style={[styles.lampCount, onPicture ? { color: data.rhythm.lit ? "#111311" : "#FFFFFF" } : null]}
        >
          {data.rhythm.streak}
        </Chrome>
      </Pressable>
    );

  if (hero && picture !== undefined) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: palette.paper }} contentContainerStyle={{ paddingBottom: tabClearance }} testID="today">
        {/* Light over the picture while Today shows; the root's dark returns when it unmounts (simulator,
            16 Oct 2026: the clock was black on day 16's aspens). */}
        {focused ? <StatusBar style="light" /> : null}
        {/* A dark ground while the picture decodes, so the white greeting never sits on white (images audit). */}
        <View style={[styles.hero, { backgroundColor: BRAND.night }]}>
          <Pressable onPress={openVerse} onLongPress={aboutPicture} style={StyleSheet.absoluteFill} accessible={false} testID="today-picture">
            <FillPicture source={picture.image} alt={picture.alt} />
          </Pressable>
          {/* EB-04: under Reduce Transparency the fade runs darker and nearly opaque behind the text, edge to edge,
              instead of boxed bands, which read as stray cards on the picture (John, 18 Oct 2026). The shadow on the
              greeting keeps it legible on a bright picture either way (day 16's aspens, simulator, 16 Oct 2026). */}
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { experimental_backgroundImage: solid ? SOLID_FADE : FADE }]}
          />
          <View style={[styles.heroTop, styles.titleRow, { top: insets.top + 12, left: gutter, right: gutter }]}>
            <View style={styles.titleText}>
              <Chrome tone="paper" accessibilityRole="header" style={[titleStyle(titleType), styles.onPicture]}>
                {hello}
              </Chrome>
              <Chrome tone="paper" step="note" style={[styles.onPicture, { color: "rgba(255,255,255,0.92)", fontSize: 15 }]}>
                {date}
              </Chrome>
            </View>
            {lamp(true)}
          </View>
          <View style={[styles.heroBottom, { left: gutter, right: gutter }]}>
            {verseBlock(true)}
          </View>
        </View>
        <View style={[styles.sheet, { backgroundColor: palette.paper, paddingHorizontal: gutter }]}>{cardsWith(null)}</View>
      </ScrollView>
    );
  }

  // DR-11 AX5: the picture as a figure, carrying the verse and Sit with this. It was a bare picture at the foot of the
  // page, under Later (images audit, 18 Oct 2026). TB-01 draws the same figure, 440 pt tall, as the iPad's left column.
  const figure = (height?: number): ReactNode =>
    picture === undefined ? (
      verseBlock(false)
    ) : (
      <View style={[styles.figure, { backgroundColor: BRAND.night }, height === undefined ? null : { height }]}>
        <Pressable onPress={openVerse} onLongPress={aboutPicture} style={StyleSheet.absoluteFill} accessible={false} testID="today-picture">
          <FillPicture source={picture.image} alt={picture.alt} />
        </Pressable>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { experimental_backgroundImage: FIGURE_FADE }]} />
        {verseBlock(true)}
      </View>
    );

  // TB-01, DU-01 open: on an iPad or an open Duo the greeting sits on paper, and the picture and the day's cards stand
  // side by side beside the sidebar; under the top tabs (portrait) the picture leads and the cards follow. At AX sizes
  // the iPhone's single column, the picture after the lead card, reads better than two narrow ones.
  const columns = regular && !ax && picture !== undefined;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.paper }}
      contentContainerStyle={[
        // Under the top tabs the capsule has already taken the status bar's room.
        { paddingTop: (tabs === "top" ? 0 : insets.top) + 24, paddingHorizontal: gutter, paddingBottom: tabClearance, rowGap: columns ? 18 : 14 },
        regular ? { width: "100%", maxWidth: WIDE.page + 2 * gutter, alignSelf: "center" } : null,
      ]}
      testID="today"
    >
      <View style={[styles.titleRow, ax ? { flexDirection: "column", alignItems: "flex-start", rowGap: 8 } : null]}>
        <View style={styles.titleText}>
          <Chrome tone="ink" accessibilityRole="header" style={titleStyle(titleType)}>
            {hello}
          </Chrome>
          <Chrome step="note" tone="muted" style={{ fontSize: ax ? undefined : 15 }}>
            {date}
          </Chrome>
        </View>
        {lamp(false)}
      </View>
      {columns ? (
        <View style={tabs === "side" ? styles.columns : styles.stacked}>
          <View style={tabs === "side" ? styles.column : null}>{figure(440)}</View>
          <View style={tabs === "side" ? styles.column : null}>{cardsWith(null)}</View>
        </View>
      ) : (
        cardsWith(figure())
      )}
    </ScrollView>
  );
}

// The top holds longer and darker: at 42% fading out by 26%, the greeting and date fell under 3:1 on 12 of the 30
// pictures (images audit, 18 Oct 2026).
const FADE = "linear-gradient(rgba(0,0,0,0.62), rgba(0,0,0,0.48) 20%, rgba(0,0,0,0) 36%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.5) 64%, rgba(0,0,0,0.84))";
// At 86% black even a white sky leaves white text at about 5.5:1 (WCAG AA 4.5:1). The greeting and date sit in the top
// 30% and the verse below 48% of the picture, so both stay at or above it; only the band between them shows the picture.
const SOLID_FADE = "linear-gradient(rgba(14,14,12,0.9), rgba(14,14,12,0.86) 30%, rgba(14,14,12,0.3) 39%, rgba(14,14,12,0.86) 48%, rgba(14,14,12,0.94))";

// The AX figure's words fill its lower part, so it is dark under them throughout: at least 86% (design system).
const FIGURE_FADE = "linear-gradient(rgba(14,14,12,0.2), rgba(14,14,12,0.86) 35%, rgba(14,14,12,0.94))";

const titleStyle = (t: ReturnType<typeof useType>) => ({ fontSize: t.size, lineHeight: t.lineHeight, fontWeight: "700" as const, letterSpacing: -0.8, fontFamily: undefined });

function Card({ children, onPress, label, testID }: { children: ReactNode; onPress?: () => void; label: string; testID: string }) {
  const palette = usePalette();
  const inner = <View style={styles.cardInner}>{children}</View>;
  if (onPress === undefined)
    return (
      <View style={[styles.card, { backgroundColor: palette.card }]} accessibilityLabel={label} testID={testID}>
        {inner}
      </View>
    );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, { backgroundColor: palette.card, opacity: pressed ? 0.85 : 1 }]}
      testID={testID}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  office: { borderRadius: 24, padding: 20, paddingBottom: 16, backgroundColor: BRAND.forest },
  officeKicker: { color: BRAND.chartreuse, fontSize: 13, fontWeight: "600", marginBottom: 10 },
  officeText: { color: "#FFFFFF", fontFamily: FONTS.scripture, fontSize: 22, lineHeight: 30 },
  officeRef: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 8 },
  officeFoot: { flexDirection: "row", alignItems: "center", columnGap: 12, marginTop: 18 },
  officeMarks: { flexDirection: "row", columnGap: 5 },
  officeMark: { width: 14, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)" },
  officeLen: { flex: 1, color: "rgba(255,255,255,0.78)", fontSize: 13 },
  officeBegin: { minHeight: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  officeBeginText: { color: BRAND.forest, fontSize: 16, fontWeight: "600" },
  // Clipped: unclipped, the picture drew on past the hero and showed again at the foot of the page, under the last row
  // (John, 18 Oct 2026: "a photo after Later this evening").
  hero: { height: 520, justifyContent: "flex-end", overflow: "hidden" },
  heroTop: { position: "absolute" },
  onPicture: { color: "#FFFFFF", textShadowColor: "rgba(0,0,0,0.55)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", columnGap: 12 },
  titleText: { flexShrink: 1 },
  lamp: { flexDirection: "row", alignItems: "center", columnGap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 22 },
  lampCount: { fontSize: 17, fontWeight: "600", fontVariant: ["tabular-nums"] },
  heroBottom: { position: "absolute", bottom: 52 },
  sheet: { marginTop: -30, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 20 },
  verseOnPicture: { rowGap: 8, minHeight: 44 },
  verseActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 12 },
  verseAction: { minHeight: 44, minWidth: 44, justifyContent: "center" },
  versePlain: { rowGap: 8, marginTop: 10 },
  verseText: { fontFamily: FONTS.scripture, fontSize: 25, lineHeight: 33, fontWeight: "400" },
  card: { borderRadius: 24 },
  cardInner: { paddingVertical: 18, paddingHorizontal: 20, rowGap: 4 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", columnGap: 8, flexWrap: "wrap" },
  cardTitle: { fontFamily: FONTS.scripture, fontSize: 20, lineHeight: 26, fontWeight: "600" },
  readingTitle: { fontFamily: FONTS.scripture, fontSize: 30, lineHeight: 36, fontWeight: "600", letterSpacing: -0.4, marginBottom: 6 },
  primary: { alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 22, borderRadius: 999, justifyContent: "center", alignItems: "center" },
  readRow: { flexDirection: "row", columnGap: 8, rowGap: 8 },
  prayLine: { flexDirection: "row", alignItems: "center", columnGap: 10, marginTop: 4 },
  prayDot: { width: 6, height: 6, borderRadius: 3 },
  listen: { flexDirection: "row", columnGap: 6 },
  wide: { alignSelf: "stretch" },
  who: { flexDirection: "row", alignItems: "center", columnGap: 10, marginBottom: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  figure: { minHeight: 300, borderRadius: 24, overflow: "hidden", justifyContent: "flex-end", padding: 20 },
  // TB-01 `.w2`: two equal columns 28 pt apart, each starting at the top; `.wpg.port .w2`: one column.
  columns: { flexDirection: "row", columnGap: 28, alignItems: "flex-start" },
  column: { flex: 1, minWidth: 0 },
  stacked: { rowGap: 10 },
});
