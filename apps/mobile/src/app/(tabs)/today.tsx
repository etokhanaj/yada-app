/**
 * Today (build 7a; canvas DR-11, DR-12, DR-15, XT-01, EB-03, EB-04): the day as one page.
 *
 * - The day's picture runs edge to edge with the greeting and the day's verse set on it, and the day rises over it
 *   on a sheet (John: "knock yourself out", 15 Oct 2026; the App Store's Today and Fitness+). At AX sizes, in the
 *   evening (build 7a ships morning pictures only) and before a picture exists, the page is plain type, the
 *   reading first.
 * - Cards only as CLAUDE.md allows: one per thing you tap, a soft fill, no shadow, no buttons inside a card that is
 *   itself the tap, except the reading card's Read.
 * - Nothing counts or ticks here; the streak's lamp arrives in build 7a step 4.
 */

import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { readerHref } from "../../components/navigation";
import { ListRow } from "../../components/Page";
import { Chrome, SectionTitle } from "../../components/Type";
import { useAppData, useCore } from "../../data/AppData";
import { Lamp } from "../../components/Lamp";
import { DAY_PICTURES } from "../../data/pictures.generated";
import { loadToday, type Place, type TodayData } from "../../data/today";
import { FONTS, useLayout, usePalette, useType } from "../../design/tokens";
import { dayLabel, greeting, pictureDay } from "../../lib/today";
import { useAccessibility } from "../../state/accessibility";
import { useSettings } from "../../state/settings";

const open = (place: Place) => router.push(readerHref({ ...place, resume: true, back: "Today" }));

export default function Today() {
  const core = useCore();
  const { user } = useAppData();
  const translation = useSettings((s) => s.translation);
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { ax, gutter } = useLayout();
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

  const picture = data === null || data.part === "evening" ? undefined : DAY_PICTURES.find((p) => p.day === pictureDay(data.day));
  const hero = picture !== undefined && !ax;
  const hello = greeting(now);
  const date = data === null ? "" : dayLabel(data.day);

  const verse = data?.verse ?? null;
  const verseBlock = (onPicture: boolean) =>
    verse === null ? null : (
      <Pressable
        onPress={() => open(verse.place)}
        accessibilityRole="button"
        accessibilityLabel={`${verse.text}. ${verse.ref}. Opens the verse`}
        style={onPicture ? styles.verseOnPicture : [styles.versePlain, { backgroundColor: palette.card }]}
        testID="today-verse"
      >
        <Chrome tone={onPicture ? "paper" : "ink"} style={[styles.verseText, onPicture ? { color: "#FFFFFF" } : null]}>
          {verse.text}
        </Chrome>
        <Chrome step="note" tone={onPicture ? "paper" : "muted"} style={onPicture ? { color: "rgba(255,255,255,0.88)", fontWeight: "600" } : { fontWeight: "600" }}>
          {verse.ref}
          {verse.bsb ? " · BSB" : ""}
        </Chrome>
        {/* PR-01: Sit with this, beside the day's verse. */}
        <Pressable
          onPress={() => router.push({ pathname: "/sit", params: { text: verse.text, ref: verse.ref } })}
          accessibilityRole="button"
          accessibilityLabel="Sit with this verse"
          hitSlop={10}
          testID="today-sit"
        >
          <Chrome step="note" tone={onPicture ? "paper" : "ink"} style={[{ fontWeight: "600", marginTop: 6 }, onPicture ? { color: "#FFFFFF" } : null]}>
            Sit with this
          </Chrome>
        </Pressable>
      </Pressable>
    );

  const cards: ReactNode =
    data === null ? null : (
      <View style={{ rowGap: 10 }}>
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
          <Pressable
            onPress={() => data.psalms !== null && open(data.psalms.place)}
            accessibilityRole="button"
            accessibilityLabel={`Read ${data.psalms.label}`}
            style={({ pressed }) => [styles.primary, { backgroundColor: palette.ink, opacity: pressed ? 0.8 : 1 }]}
            testID="today-read"
          >
            <Chrome tone="paper" style={{ fontWeight: "600", color: palette.paper }}>
              Read
            </Chrome>
          </Pressable>
        </Card>
        )}

        {data.office !== null ? (
          // DO-01 (build 8, John 17 Oct 2026): Daily prayer's own card previews the guided steps it opens, the
          // forest and chartreuse of Yada's brand against the light sheet; one card, no shadow.
          <Pressable
            onPress={() => router.push("/office")}
            accessibilityRole="button"
            accessibilityLabel={`Daily prayer, about 15 minutes. ${data.office.opening}`}
            style={({ pressed }) => [styles.office, { opacity: pressed ? 0.9 : 1 }]}
            testID="today-office"
          >
            <Chrome style={styles.officeKicker} maxFontSizeMultiplier={2}>
              Daily prayer
            </Chrome>
            <Chrome style={styles.officeText} numberOfLines={ax ? 4 : 2}>
              {data.office.opening}
            </Chrome>
            <Chrome style={styles.officeRef} maxFontSizeMultiplier={2}>
              Psalm 95:1
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

        {data.devotional !== null ? (
          <Card
            onPress={() => router.push({ pathname: "/devotional", params: { key: data.devotional?.key ?? "", part: data.devotional?.part ?? "morning" } })}
            label={`Devotional by C. H. Spurgeon: ${data.devotional.heading} ${data.devotional.ref}`}
            testID="today-devotional"
          >
            <View style={styles.who}>
              <Image source={require("../../../assets/today/spurgeon.jpg")} style={styles.avatar} accessibilityIgnoresInvertColors />
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

        {data.plan.kind === "start" ? (
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
            onPress={() => data.plan.kind !== "start" && open(data.plan.place)}
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

        {/* PR-01 (build 7 plan row 18, built in build 8): Pray is one card after the reading. */}
        <Card onPress={() => router.push("/pray")} label="Pray: your list, and someone to pray for" testID="today-pray">
          <Chrome tone="ink" style={styles.cardTitle}>
            Pray
          </Chrome>
          <Chrome step="note" tone="muted">
            Your list, and someone to pray for
          </Chrome>
        </Card>

        {data.other === null ? null : (
          <View style={{ marginTop: 30 }}>
            <SectionTitle style={{ marginBottom: 4 }}>{data.part === "morning" ? "Later" : "Earlier"}</SectionTitle>
            <ListRow
              first
              onPress={() => data.other !== null && open(data.other.place)}
              title={`${data.part === "morning" ? "This evening" : "This morning"} · ${data.other.label}`}
              label={`${data.part === "morning" ? "This evening" : "This morning"}, ${data.other.label}`}
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
        style={[styles.lamp, { backgroundColor: onPicture ? "rgba(0,0,0,0.28)" : palette.card }]}
        testID="today-lamp"
      >
        <Lamp lit={data.rhythm.lit} color={onPicture ? "#FFFFFF" : palette.accent} />
        <Chrome tone={onPicture ? "paper" : "ink"} style={[styles.lampCount, onPicture ? { color: "#FFFFFF" } : null]}>
          {data.rhythm.streak}
        </Chrome>
      </Pressable>
    );

  if (hero && picture !== undefined) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: palette.paper }} contentContainerStyle={{ paddingBottom: 120 }} testID="today">
        {/* Light over the picture while Today shows; the root's dark returns when it unmounts (simulator,
            16 Oct 2026: the clock was black on day 16's aspens). */}
        {focused ? <StatusBar style="light" /> : null}
        <View style={styles.hero}>
          <Image source={picture.image} style={StyleSheet.absoluteFill} resizeMode="cover" accessible accessibilityLabel={picture.alt} />
          {/* EB-04: Reduce Transparency swaps the fade for a solid band under the text. */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              solid
                ? null
                : { experimental_backgroundImage: "linear-gradient(rgba(0,0,0,0.42), rgba(0,0,0,0) 26%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 66%, rgba(0,0,0,0.82))" },
            ]}
          />
          {/* Reduce Transparency has no fade, so the greeting gets the same solid band as the verse; with the fade, a
              shadow still keeps it legible on a bright picture (day 16's aspens, simulator, 16 Oct 2026). */}
          <View
            style={[
              styles.heroTop,
              styles.titleRow,
              { top: insets.top + 12, left: gutter, right: gutter },
              solid ? { backgroundColor: "rgba(20,18,14,0.92)", borderRadius: 16, padding: 12 } : null,
            ]}
          >
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
          <View style={[styles.heroBottom, { left: gutter, right: gutter }, solid ? { backgroundColor: "rgba(20,18,14,0.92)", borderRadius: 16, padding: 12 } : null]}>
            {verseBlock(true)}
          </View>
        </View>
        <View style={[styles.sheet, { backgroundColor: palette.paper, paddingHorizontal: gutter }]}>{cards}</View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.paper }}
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: gutter, paddingBottom: 120, rowGap: 14 }}
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
      {cards}
      {verseBlock(false)}
      {picture !== undefined ? (
        <Image source={picture.image} style={[styles.inlinePicture, { backgroundColor: palette.card }]} resizeMode="cover" accessible accessibilityLabel={picture.alt} />
      ) : null}
    </ScrollView>
  );
}

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
  office: { borderRadius: 24, padding: 20, paddingBottom: 16, backgroundColor: "#183F35" },
  officeKicker: { color: "#DBEC9A", fontSize: 13, fontWeight: "600", marginBottom: 10 },
  officeText: { color: "#FFFFFF", fontFamily: FONTS.scripture, fontSize: 22, lineHeight: 30 },
  officeRef: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 8 },
  officeFoot: { flexDirection: "row", alignItems: "center", columnGap: 12, marginTop: 18 },
  officeMarks: { flexDirection: "row", columnGap: 5 },
  officeMark: { width: 14, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)" },
  officeLen: { flex: 1, color: "rgba(255,255,255,0.78)", fontSize: 13 },
  officeBegin: { minHeight: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  officeBeginText: { color: "#183F35", fontSize: 16, fontWeight: "600" },
  hero: { height: 520, justifyContent: "flex-end" },
  heroTop: { position: "absolute" },
  onPicture: { color: "#FFFFFF", textShadowColor: "rgba(0,0,0,0.55)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", columnGap: 12 },
  titleText: { flexShrink: 1 },
  lamp: { flexDirection: "row", alignItems: "center", columnGap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 22 },
  lampCount: { fontSize: 17, fontWeight: "600", fontVariant: ["tabular-nums"] },
  heroBottom: { position: "absolute", bottom: 52 },
  sheet: { marginTop: -30, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 20 },
  verseOnPicture: { rowGap: 8, minHeight: 44 },
  versePlain: { borderRadius: 24, padding: 20, rowGap: 8 },
  verseText: { fontFamily: FONTS.scripture, fontSize: 25, lineHeight: 33, fontWeight: "400" },
  card: { borderRadius: 24 },
  cardInner: { paddingVertical: 18, paddingHorizontal: 20, rowGap: 4 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", columnGap: 8, flexWrap: "wrap" },
  cardTitle: { fontFamily: FONTS.scripture, fontSize: 20, lineHeight: 26, fontWeight: "600" },
  readingTitle: { fontFamily: FONTS.scripture, fontSize: 30, lineHeight: 36, fontWeight: "600", letterSpacing: -0.4, marginBottom: 6 },
  primary: { alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 22, borderRadius: 999, justifyContent: "center" },
  who: { flexDirection: "row", alignItems: "center", columnGap: 10, marginBottom: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  inlinePicture: { height: 260, borderRadius: 24, width: "100%" },
});
