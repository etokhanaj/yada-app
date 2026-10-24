/**
 * Pray, a tab of its own (PT-46; FL-01 to FL-06; canvas https://claude.ai/artifact/RFdeRVhQ51Bce2E45DRQwJ, approved by
 * John 24 Oct 2026: "make pray its own tab"; "the stoic page ... make you choose a style"). It opens on ways to pray,
 * each its own tile, as stoic.'s Library separates breathing from meditation
 * (mobbin.com/screens/707eaf59-9086-4479-bdbf-0338f589fe51): the day's office wide on the picture, then Sit with a
 * verse, Bible prayers, Pray for others and Silence; then When you're, the six moments (VM). Below, People are places,
 * not ways: Your list, Everyone on Yada, and each circle as a cover with how many requests you haven't prayed (PC-01).
 * One + opens Add or ask (PT-40). Tiles are things you do; rows are places you go. A request you prayed for that was
 * answered in the last week shows as one quiet line above People (PC-23). Without CloudKit the list, the ways and the
 * moments still work and the rest is left out (XT-05).
 */

import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import {
  type Circle,
  type CircleMember,
  circlesCloud,
  type PrayerRequest,
  prayCloud,
} from "../../../../modules/yada-pray";
import { FillPicture } from "../../../components/FillPicture";
import { Icon, type IconName } from "../../../components/Icon";
import { ListRow, PageScreen } from "../../../components/Page";
import {
  CircleCover,
  NewCircleCover,
} from "../../../components/pray/CircleCover";
import { Chrome, SectionTitle } from "../../../components/Type";
import { useAppData, useCore } from "../../../data/AppData";
import { pictureFor } from "../../../data/pictures";
import { loadPrayLocal } from "../../../data/prayLocal";
import { watchCircles } from "../../../data/prayNotify";
import { PRAYERS_OF_THE_BIBLE } from "../../../data/prayersOfTheBible";
import { dayVerse } from "../../../data/today";
import { BRAND, ON_PICTURE } from "../../../design/palette";
import { FONTS, useLayout, usePalette } from "../../../design/tokens";
import { MOMENTS } from "../../../lib/moments";
import {
  answeredLines,
  circleParams,
  ICLOUD_WAIT_MS,
  offerable,
  recentlyAnswered,
  withinTime,
} from "../../../lib/pray";
import { dayOf, partOf } from "../../../lib/today";
import { useSettings } from "../../../state/settings";

interface CircleView {
  readonly circle: Circle;
  readonly members: readonly CircleMember[];
  /** Requests from others you haven't prayed yet. */
  readonly fresh: number;
}

type Verse = Awaited<ReturnType<typeof dayVerse>>;

export default function Pray() {
  const { user } = useAppData();
  const core = useCore();
  const translation = useSettings((s) => s.translation);
  const palette = usePalette();
  const { gutter, ax } = useLayout();
  const [openList, setOpenList] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [circles, setCircles] = useState<CircleView[]>([]);
  const [circlesFailed, setCirclesFailed] = useState(false);
  const [answeredOne, setAnsweredOne] = useState<PrayerRequest | null>(null);
  const [verse, setVerse] = useState<Verse>(null);
  const now = new Date();
  const part = partOf(now);

  const reload = useCallback(() => {
    const at = new Date();
    void dayVerse(core, translation, dayOf(at), partOf(at))
      .then(setVerse)
      .catch(() => setVerse(null));
    void loadPrayLocal(user)
      .then(async (local) => {
        setOpenList(local.list.filter((i) => i.answered === undefined).length);
        if (prayCloud !== null) {
          const [open, prayedFor] = await Promise.all([
            prayCloud
              .open([...local.prayed, ...local.blocked], 30)
              .catch(() => []),
            prayCloud.fetch([...local.prayed].slice(0, 50)).catch(() => []),
          ]);
          setAnsweredOne(recentlyAnswered(prayedFor, Date.now())[0] ?? null);
          setWaiting(offerable(open, local.prayed, local.blocked).length);
        }
        if (circlesCloud === null) return;
        const cloud = circlesCloud;
        const all = await withinTime(cloud.list(), ICLOUD_WAIT_MS);
        setCirclesFailed(false);
        const views = await Promise.all(
          all.map(async (circle): Promise<CircleView> => {
            const [members, requests] = await Promise.all([
              cloud.members(circle.id, circle.owner).catch(() => []),
              cloud.requests(circle.id, circle.owner).catch(() => []),
            ]);
            return {
              circle,
              members,
              fresh: requests.filter((r) => !r.mine && !local.prayed.has(r.id))
                .length,
            };
          }),
        );
        setCircles(views);
        // FL-06: the new-request notice covers any circle joined since it was last set.
        if (views.length > 0) void watchCircles(user).catch(() => undefined);
        // An invitation accepted while Yada opened goes to the welcome (PC-07), then the circle.
        const accepted = await cloud.takeAccepted();
        const joined = views.find((v) => accepted.includes(v.circle.id));
        if (joined !== undefined)
          router.push({
            pathname: "/pray/joined",
            params: circleParams(joined.circle),
          });
      })
      .catch(() => {
        setCircles([]);
        setCirclesFailed(circlesCloud !== null);
      });
  }, [user, core, translation]);
  useFocusEffect(reload);

  const others =
    openList + circles.reduce((n, c) => n + c.fresh, 0) + (waiting > 0 ? 1 : 0);
  const sit = () => {
    if (verse === null)
      return AccessibilityInfo.announceForAccessibility(
        "Today’s verse isn’t ready yet. Try again.",
      );
    router.push({
      pathname: "/sit",
      params: {
        text: verse.text,
        ref: verse.ref,
        bsb: verse.bsb ? "1" : "",
        place: `${verse.place.book}.${verse.place.chapter}.${verse.place.verse}`,
      },
    });
  };
  const picture = pictureFor(now, part);

  return (
    <PageScreen
      title="Pray"
      back={null}
      clearTabBar
      testID="pray"
      right={
        <Pressable
          onPress={() => router.push("/pray/add-or-ask")}
          accessibilityRole="button"
          accessibilityLabel="Add or ask"
          style={[styles.plus, { backgroundColor: palette.fill }]}
          testID="pray-plus"
        >
          <Icon name="plus" size={22} />
        </Pressable>
      }
    >
      {/* The day's office, wide on the picture: the one way to pray that needs no choosing. */}
      <Pressable
        onPress={() => router.push({ pathname: "/office", params: { part } })}
        accessibilityRole="button"
        accessibilityLabel={`${part === "evening" ? "Evening" : "Morning"} prayer, about 15 minutes`}
        style={({ pressed }) => [
          styles.office,
          { backgroundColor: BRAND.forest, opacity: pressed ? 0.9 : 1 },
        ]}
        testID="pray-office"
      >
        {picture !== undefined ? <FillPicture source={picture.image} /> : null}
        <View
          style={[
            StyleSheet.absoluteFill,
            { experimental_backgroundImage: FADE },
          ]}
        />
        <View style={styles.officeText}>
          <Chrome
            style={{
              color: ON_PICTURE.text,
              fontFamily: FONTS.scripture,
              fontWeight: "400",
            }}
            size={28}
          >
            {part === "evening" ? "Evening prayer" : "Morning prayer"}
          </Chrome>
          <Chrome step="note" style={{ color: ON_PICTURE.strong }}>
            15 min
          </Chrome>
        </View>
      </Pressable>

      <View style={[styles.ways, ax ? styles.waysAx : null]}>
        <Way
          icon="target"
          title="Sit with a verse"
          line="8 min"
          onPress={sit}
          testID="pray-way-sit"
        />
        {PRAYERS_OF_THE_BIBLE.length > 0 ? (
          <Way
            icon="book-open"
            title="Bible prayers"
            line={`${PRAYERS_OF_THE_BIBLE.length} prayers`}
            onPress={() => router.push("/pray/bible")}
            testID="pray-way-bible"
          />
        ) : null}
        <Way
          icon="people"
          title="Pray for others"
          line={
            others > 0
              ? `${others} ${others === 1 ? "person" : "people"}`
              : "Your list and circles"
          }
          onPress={() => router.push("/pray/through")}
          testID="pray-way-others"
        />
        <Way
          icon="hourglass"
          title="Silence"
          line="3–20 min"
          onPress={() => router.push("/silence")}
          testID="pray-way-silence"
        />
      </View>

      <SectionTitle style={{ marginTop: 26, marginBottom: 10 }}>
        When you’re
      </SectionTitle>
      <ScrollView
        horizontal={!ax}
        showsHorizontalScrollIndicator={false}
        style={ax ? null : { marginHorizontal: -gutter }}
        contentContainerStyle={
          ax ? styles.chipsAx : [styles.chips, { paddingHorizontal: gutter }]
        }
      >
        {MOMENTS.map((m) => (
          <Pressable
            key={m.name}
            onPress={() =>
              router.push({
                pathname: "/moment",
                params: { name: m.name, from: "pray" },
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`When you’re ${m.name.toLowerCase()}: verses to pray with`}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: palette.fill, opacity: pressed ? 0.7 : 1 },
            ]}
            testID={`pray-moment-${m.name}`}
          >
            <Chrome
              tone="ink"
              style={{ fontFamily: FONTS.scripture, fontWeight: "400" }}
              size={19}
            >
              {m.name}
            </Chrome>
          </Pressable>
        ))}
      </ScrollView>

      {answeredOne !== null ? <AnsweredLine request={answeredOne} /> : null}

      <SectionTitle style={{ marginTop: 28, marginBottom: 2 }}>
        People
      </SectionTitle>
      <ListRow
        first
        title="Your list"
        subtitle="Only you"
        onPress={() => router.push("/pray/list")}
        testID="pray-list-row"
      />
      {prayCloud !== null ? (
        <ListRow
          title="Everyone on Yada"
          subtitle={
            waiting > 0 ? `${waiting} waiting` : "None waiting just now"
          }
          onPress={() => router.push("/pray/mine")}
          testID="pray-everyone-row"
        />
      ) : null}
      {circlesCloud !== null ? (
        <View style={{ marginTop: 16 }}>
          <ScrollView
            horizontal={!ax}
            showsHorizontalScrollIndicator={false}
            style={ax ? null : { marginHorizontal: -gutter }}
            contentContainerStyle={
              ax ? { rowGap: 12 } : { columnGap: 12, paddingHorizontal: gutter }
            }
          >
            {circles.map((v) => (
              <CircleCover
                key={v.circle.id}
                circle={v.circle}
                members={v.members}
                fresh={v.fresh}
                onPress={() =>
                  router.push({
                    pathname: "/pray/circle",
                    params: circleParams(v.circle),
                  })
                }
              />
            ))}
            <NewCircleCover onPress={() => router.push("/pray/new-circle")} />
          </ScrollView>
          {circlesFailed ? (
            // A list that didn't load says so, rather than looking like no circles (QA, 24 Oct 2026).
            <Pressable
              onPress={reload}
              accessibilityRole="button"
              style={{ marginTop: 8, minHeight: 44, justifyContent: "center" }}
              testID="pray-circles-retry"
            >
              <Chrome step="note" tone="muted">
                Your circles didn’t load.{" "}
                <Chrome step="note" tone="accent" style={{ fontWeight: "600" }}>
                  Try again
                </Chrome>
              </Chrome>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </PageScreen>
  );
}

/** A way to pray (PT-46): its glyph, its name on one line, and one fact. */
function Way({
  icon,
  title,
  line,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  line: string;
  onPress: () => void;
  testID: string;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${line}`}
      style={({ pressed }) => [
        styles.way,
        ax ? styles.wayAx : null,
        { backgroundColor: palette.fill, opacity: pressed ? 0.8 : 1 },
      ]}
      testID={testID}
    >
      <Icon name={icon} size={26} />
      <View>
        <Chrome
          tone="ink"
          style={{ fontFamily: FONTS.scripture, fontWeight: "400" }}
          size={19}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {title}
        </Chrome>
        <Chrome step="note" tone="muted" style={{ marginTop: 3 }}>
          {line}
        </Chrome>
      </View>
    </Pressable>
  );
}

function AnsweredLine({ request }: { request: PrayerRequest }) {
  const palette = usePalette();
  const { title, line } = answeredLines(request, Date.now());
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/pray/someone",
          params: { again: request.id },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${line}. Opens it`}
      style={styles.answered}
      testID="pray-answered"
    >
      <View
        style={[styles.answeredMark, { backgroundColor: palette.selection }]}
      >
        <Icon name="check" size={16} tone="accent" />
      </View>
      <View style={{ flex: 1, rowGap: 2 }}>
        <Chrome tone="ink" style={{ fontWeight: "600" }}>
          {title}
        </Chrome>
        <Chrome step="note" tone="muted">
          {line}
        </Chrome>
      </View>
      <Icon name="forward" size={16} tone="muted" />
    </Pressable>
  );
}

/** Clear at the top, dark under the words. */
const FADE = "linear-gradient(rgba(8,20,15,0) 35%, rgba(8,20,15,0.7))";

const styles = StyleSheet.create({
  plus: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  office: {
    height: 170,
    borderRadius: 24,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  officeText: { padding: 16 },
  ways: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    marginTop: 10,
  },
  waysAx: { flexDirection: "column" },
  way: {
    width: "48.5%",
    minHeight: 132,
    borderRadius: 24,
    padding: 16,
    justifyContent: "space-between",
  },
  wayAx: { width: "100%", rowGap: 14 },
  chips: { columnGap: 8 },
  chipsAx: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 46,
    paddingHorizontal: 20,
    borderRadius: 23,
    justifyContent: "center",
  },
  answered: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    minHeight: 56,
    marginTop: 20,
  },
  answeredMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
