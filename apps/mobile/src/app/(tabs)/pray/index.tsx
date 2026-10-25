/**
 * Pray, a tab of its own (PT-46), in the Build 12 system (PR-50, PR-51; John, 24 Oct 2026: "some lists are plain… make
 * it more rich than flat all the time"). The day's office on its picture with its own Begin; the ways to pray on four
 * tints; For when you're as picture tiles. Then People, each a row with a picture or avatars and a Pray pill: Your list,
 * each circle with a lime badge for requests you haven't prayed, Everyone on Yada, and New circle. Then Your requests,
 * the newest two as raised cards, with See all. Tiles are things you do; rows are places you go. A request you prayed
 * for that was answered in the last week shows as one quiet line above People (PC-23). Without CloudKit the list, the
 * ways and the moments still work and the rest is left out (XT-05).
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
import { GlassButton } from "../../../components/Glass";
import { Badge } from "../../../components/Badge";
import { Icon, type IconName } from "../../../components/Icon";
import { ListRow, PageScreen } from "../../../components/Page";
import { AvatarStack } from "../../../components/pray/CircleCover";
import { RequestCard } from "../../../components/pray/RequestCard";
import { PictureTile, TileGrid, TintTile } from "../../../components/Tiles";
import { Chrome, SectionTitle } from "../../../components/Type";
import { useAppData, useCore } from "../../../data/AppData";
import { pictureFor } from "../../../data/pictures";
import { loadPrayLocal } from "../../../data/prayLocal";
import { watchCircles } from "../../../data/prayNotify";
import { PRAYERS_OF_THE_BIBLE } from "../../../data/prayersOfTheBible";
import { dayVerse } from "../../../data/today";
import { BRAND, ON_PICTURE } from "../../../design/palette";
import { FONTS, useLayout, usePalette } from "../../../design/tokens";
import { type AskedRequest, asRequest } from "../../../lib/askSomeone";
import { MOMENTS } from "../../../lib/moments";
import {
  answeredLines,
  circleParams,
  ICLOUD_WAIT_MS,
  newestFirst,
  offerable,
  peopleLine,
  recentlyAnswered,
  withinTime,
} from "../../../lib/pray";
import { dayOf, officeName, partOf } from "../../../lib/today";
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
  const { gutter, ax } = useLayout();
  const [openList, setOpenList] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [circles, setCircles] = useState<CircleView[]>([]);
  const [circlesFailed, setCirclesFailed] = useState(false);
  const [answeredOne, setAnsweredOne] = useState<PrayerRequest | null>(null);
  const [mine, setMine] = useState<AskedRequest[]>([]);
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
          // Your requests (PR-51): asked of everyone and asked of one person (AO-01), newest two.
          const [everyone, ones] = await Promise.all([prayCloud.mine().catch(() => []), circlesCloud?.asks().catch(() => []) ?? Promise.resolve([])]);
          setMine(newestFirst<AskedRequest>([...everyone, ...ones.map(asRequest)]).slice(0, 2));
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
        why: "Today",
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
        // A + alone didn't say what it adds (Sit audit, 24 Oct 2026): the capsule names it, as ‹ Today names where back goes.
        <GlassButton shape="capsule" onPress={() => router.push("/pray/add-or-ask")} accessibilityLabel="Add a prayer or ask for one" testID="pray-plus">
          <Icon name="plus" size={18} />
          <Chrome tone="ink" style={{ fontWeight: "500", marginRight: 2 }}>
            Prayer
          </Chrome>
        </GlassButton>
      }
    >
      {/* PR-50: the day's office, wide on the picture with its own Begin: the one way to pray that needs no choosing.
          The whole card is the button; Begin shows what a tap does. */}
      <Pressable
        onPress={() => router.push({ pathname: "/office", params: { part } })}
        accessibilityRole="button"
        accessibilityLabel={`${officeName(now)}, about 15 minutes. Begin`}
        style={({ pressed }) => [styles.office, ax ? styles.officeAx : null, { backgroundColor: BRAND.forest, opacity: pressed ? 0.9 : 1 }]}
        testID="pray-office"
      >
        {picture !== undefined ? <FillPicture source={picture.image} /> : null}
        <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: FADE }]} />
        <View style={styles.officeText}>
          <View style={{ flexShrink: 1 }}>
            <Chrome style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400" }} size={26}>
              {officeName(now)}
            </Chrome>
            <Chrome step="note" style={{ color: ON_PICTURE.strong, marginTop: 2 }}>
              15 min
            </Chrome>
          </View>
          <View style={[styles.begin, { backgroundColor: ON_PICTURE.text }]}>
            <Icon name="play" size={16} color={BRAND.ink} filled />
            <Chrome style={{ color: BRAND.ink, fontWeight: "600" }}>Begin</Chrome>
          </View>
        </View>
      </Pressable>

      <View style={{ marginTop: 10 }}>
        <TileGrid>
          <TintTile
            tint="forest"
            icon="sit"
            title="Sit with a verse"
            line="5–15 min"
            onPress={sit}
            testID="pray-way-sit"
          />
          {PRAYERS_OF_THE_BIBLE.length > 0 ? (
            <TintTile
              tint="sand"
              icon="book-open"
              title="Bible prayers"
              line={`${PRAYERS_OF_THE_BIBLE.length} prayers`}
              onPress={() => router.push("/pray/bible")}
              testID="pray-way-bible"
            />
          ) : null}
          <TintTile
            tint="sky"
            icon="people"
            title="Pray for others"
            // "One by one" says this prays through them; People › Your list below is where they're kept (Sit audit,
            // 24 Oct 2026: "2 people" twice on one screen read as the same place).
            line={others > 0 ? `${others} ${others === 1 ? "person" : "people"}, one by one` : "Your list and circles"}
            onPress={() => router.push("/pray/through")}
            testID="pray-way-others"
          />
          <TintTile
            tint="clay"
            icon="hourglass"
            title="Silence"
            line="3–20 min"
            onPress={() => router.push("/silence")}
            testID="pray-way-silence"
          />
        </TileGrid>
      </View>

      <SectionTitle style={{ marginTop: 26, marginBottom: 10 }}>
        For when you’re
      </SectionTitle>
      <ScrollView
        horizontal={!ax}
        showsHorizontalScrollIndicator={false}
        style={ax ? null : { marginHorizontal: -gutter }}
        contentContainerStyle={
          ax ? styles.moodsAx : [styles.moods, { paddingHorizontal: gutter }]
        }
      >
        {MOMENTS.map((m) => (
          <PictureTile
            key={m.name}
            title={m.name}
            image={pictureFor(m.picture, "morning")?.image}
            onPress={() =>
              router.push({
                pathname: "/moment",
                params: { name: m.name, from: "pray" },
              })
            }
            label={`When you’re ${m.name.toLowerCase()}: verses to pray with`}
            testID={`pray-moment-${m.name}`}
          />
        ))}
      </ScrollView>

      {answeredOne !== null ? <AnsweredLine request={answeredOne} /> : null}

      <SectionTitle style={{ marginTop: 28, marginBottom: 2 }}>People</SectionTitle>
      <ListRow
        first
        leading={<Thumb icon="lock" />}
        title="Your list"
        subtitle={openList > 0 ? `${openList} ${openList === 1 ? "prayer" : "prayers"} · only you` : "Only you"}
        onPress={() => router.push("/pray/list")}
        action={openList > 0 ? { title: "Pray", label: "Pray through your list", onPress: () => router.push({ pathname: "/pray/through", params: { scope: "list" } }) } : undefined}
        testID="pray-list-row"
      />
      {circles.map((v) => (
        <ListRow
          key={v.circle.id}
          leading={<AvatarStack members={v.members} />}
          title={v.circle.name}
          subtitle={
            <View style={styles.meta}>
              {v.fresh > 0 ? <Badge text={`${v.fresh} new`} /> : null}
              <Chrome step="note" tone="muted">
                {peopleLine(v.circle.people)}
              </Chrome>
            </View>
          }
          label={[v.circle.name, peopleLine(v.circle.people), v.fresh > 0 ? `${v.fresh} new` : null].filter((x) => x !== null).join(". ")}
          onPress={() => router.push({ pathname: "/pray/circle", params: circleParams(v.circle) })}
          action={
            v.fresh > 0
              ? { title: "Pray", label: `Pray for ${v.circle.name}`, onPress: () => router.push({ pathname: "/pray/through", params: { scope: "circle", id: v.circle.id, owner: v.circle.owner } }) }
              : undefined
          }
          testID={`pray-circle-${v.circle.id}`}
        />
      ))}
      {prayCloud !== null ? (
        <ListRow
          leading={<Thumb icon="globe" forest />}
          title="Everyone on Yada"
          subtitle={waiting > 0 ? `${waiting} asking just now` : "None waiting just now"}
          onPress={() => router.push("/pray/mine")}
          action={waiting > 0 ? { title: "Pray", label: "Pray for someone on Yada", onPress: () => router.push("/pray/someone") } : undefined}
          testID="pray-everyone-row"
        />
      ) : null}
      {circlesCloud !== null && !circlesFailed ? (
        <ListRow leading={<Thumb icon="plus" />} title="New circle" subtitle="Up to 12 people" onPress={() => router.push("/pray/new-circle")} testID="pray-new-circle" />
      ) : null}
      {circlesFailed ? (
        // A list that didn't load says so, rather than looking like no circles (QA, 24 Oct 2026).
        <Pressable onPress={reload} accessibilityRole="button" style={{ marginTop: 8, minHeight: 44, justifyContent: "center" }} testID="pray-circles-retry">
          <Chrome step="note" tone="muted">
            Your circles didn’t load.{" "}
            <Chrome step="note" tone="accent" style={{ fontWeight: "600" }}>
              Try again
            </Chrome>
          </Chrome>
        </Pressable>
      ) : null}

      {mine.length > 0 ? (
        <>
          <SectionTitle
            style={{ marginTop: 28, marginBottom: 12 }}
            link={{ label: "See all your requests", onPress: () => router.push("/pray/mine"), testID: "pray-requests-all" }}
          >
            Your requests
          </SectionTitle>
          {mine.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              to={r.to}
              now={Date.now()}
              onAnswered={() =>
                void (r.to === undefined ? prayCloud?.markAnswered(r.id) : circlesCloud?.answerAsk(r.id))
                  ?.then(reload)
                  .catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t mark it answered. Try again."))
              }
            />
          ))}
        </>
      ) : null}
    </PageScreen>
  );
}

/** A row's 56 pt picture where it has no people to show (PR-51): its glyph on fill, or white on the forest. */
function Thumb({ icon, forest = false }: { icon: IconName; forest?: boolean }) {
  const palette = usePalette();
  const { ax } = useLayout();
  const box = ax ? 64 : 56;
  return (
    <View style={[styles.thumb, { width: box, height: box, backgroundColor: forest ? BRAND.forest : palette.fill }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icon name={icon} size={22} {...(forest ? { tone: "white" as const } : {})} />
    </View>
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
  office: {
    height: 176,
    borderRadius: 24,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  officeAx: { height: 210 },
  officeText: { padding: 16, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  begin: { flexDirection: "row", alignItems: "center", columnGap: 6, minHeight: 40, paddingHorizontal: 16, borderRadius: 20 },
  thumb: { borderRadius: 14, alignItems: "center", justifyContent: "center" },
  meta: { flexDirection: "row", alignItems: "center", columnGap: 6, flexWrap: "wrap" },
  moods: { columnGap: 10 },
  moodsAx: { rowGap: 10 },
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
