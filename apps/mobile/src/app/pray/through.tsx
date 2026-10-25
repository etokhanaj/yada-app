/**
 * Pray for others (FL-03; Build 12 PF-30 to PF-32, John 24 Oct 2026: "once you click pray for others did we upgrade
 * that too?"). One person at a time on the evening picture, blurred: × and one segment per person at the top; who asked
 * and when, the request large in Literata, and what they will see; Prayed and Next. The order is as before: your list,
 * then your circles' requests you haven't prayed, then one request from everyone on Yada. `scope` narrows it to your
 * list, or to one circle, when Pray on that row opened it (PR-51).
 *
 * The end (PF-32) says Amen and that the day counts, then who you prayed for by place, and Done. A circle sees one more
 * prayed, never who (plan §I.3); a public request is marked as the hold screen marks it (PR-09) and watched for its
 * answer (PA-02). Next moves on without marking anything.
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { circlesCloud, prayCloud } from "../../../modules/yada-pray";
import { BarFrame, Capsule } from "../../components/ActionBar";
import { GlassButton } from "../../components/Glass";
import { Icon, type IconName } from "../../components/Icon";
import { Lamp } from "../../components/Lamp";
import { ListRow } from "../../components/Page";
import { PictureGround } from "../../components/PictureGround";
import { StepSegments } from "../../components/StepSegments";
import { Pill } from "../../components/Pill";
import { Avatar } from "../../components/pray/Avatar";
import { Chrome } from "../../components/Type";
import { useAppData } from "../../data/AppData";
import { loadPrayLocal, markPrayed } from "../../data/prayLocal";
import { watchAnswer } from "../../data/prayNotify";
import { countDay, loadDays, markDone } from "../../data/user";
import { ON_PICTURE } from "../../design/palette";
import { FONTS, useLayout, usePalette } from "../../design/tokens";
import { askedLine, ICLOUD_WAIT_MS, offerable, withinTime } from "../../lib/pray";
import { prayedByPlace, type Turn } from "../../lib/prayThrough";
import { rhythmOf, todayKey } from "../../lib/rhythm";

export default function PrayThrough() {
  const params = useLocalSearchParams<{ scope?: string; id?: string; owner?: string }>();
  const scope = params.scope === "list" ? "list" : params.scope === "circle" ? "circle" : "all";
  const { user } = useAppData();
  const insets = useSafeAreaInsets();
  const { gutter, ax } = useLayout();
  const [turns, setTurns] = useState<Turn[] | null>(null);
  const [at, setAt] = useState(0);
  const [prayed, setPrayed] = useState<Turn[]>([]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const local = await loadPrayLocal(user);
      const now = Date.now();
      const out: Turn[] =
        scope === "circle"
          ? []
          : local.list
              .filter((i) => i.answered === undefined)
              .map((i, n) => ({ key: `list-${n}`, place: "Your list", text: i.text, kind: "list" as const }));
      if (scope !== "list" && circlesCloud !== null) {
        const cloud = circlesCloud;
        const all = await withinTime(cloud.list(), ICLOUD_WAIT_MS).catch(() => []);
        const circles = scope === "circle" ? all.filter((c) => c.id === params.id && c.owner === params.owner) : all;
        // All at once, each with iCloud's time limit, so one slow circle can't leave the screen empty (code review).
        const each = await Promise.all(circles.map((c) => withinTime(cloud.requests(c.id, c.owner), ICLOUD_WAIT_MS).catch(() => [])));
        for (const [n, c] of circles.entries()) {
          for (const r of (each[n] ?? []).filter((x) => !x.mine && !local.prayed.has(x.id)))
            out.push({
              key: `c-${r.id}`,
              place: c.name,
              text: r.text,
              kind: "circle",
              id: r.id,
              asker: { id: r.creator, name: r.firstName },
              circle: { id: c.id, owner: c.owner },
            });
        }
      }
      if (scope === "all" && prayCloud !== null) {
        const open = await prayCloud.open([...local.prayed, ...local.blocked], 10).catch(() => []);
        const first = offerable(open, local.prayed, local.blocked)[0];
        if (first !== undefined)
          out.push({ key: `p-${first.id}`, place: "Someone on Yada", text: first.text, kind: "public", id: first.id, asked: askedLine("", first.createdAt, now) });
      }
      if (live) setTurns(out);
    })().catch(() => live && setTurns([]));
    return () => {
      live = false;
    };
  }, [user, scope, params.id, params.owner]);

  const turn = turns?.[at];
  const finished = turns !== null && turns.length > 0 && at >= turns.length;
  const next = () => setAt(at + 1);
  const markIt = () => {
    if (turn === undefined) return;
    if (turn.kind === "circle" && turn.circle !== undefined && turn.id !== undefined) {
      void circlesCloud?.prayed(turn.circle.id, turn.circle.owner, turn.id).catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t mark it prayed."));
      void markPrayed(user, turn.id).catch(() => undefined);
    }
    if (turn.kind === "public" && turn.id !== undefined) {
      const id = turn.id;
      void prayCloud?.prayed(id).catch(() => undefined);
      void markPrayed(user, id)
        .then(() => watchAnswer(user, id))
        .catch(() => undefined);
    }
    setPrayed([...prayed, turn]);
    next();
  };

  const [counted, setCounted] = useState(false);
  // The end: the day counts once something was prayed for; with nothing marked, there is no end to show.
  useEffect(() => {
    if (!finished) return;
    if (prayed.length === 0) router.back();
    else {
      // Amen reads the run once today is counted, not after a guessed delay (review).
      void countDay(user)
        .catch(() => undefined)
        .then(() => setCounted(true));
      void markDone(user, "pray").catch(() => undefined);
    }
  }, [finished, prayed.length, user]);

  if (finished && prayed.length > 0) return <Amen prayed={prayed} counted={counted} />;

  return (
    <View style={styles.root} testID="pray-through">
      <PictureGround blurred part="evening" />
      <View style={[styles.top, { paddingTop: insets.top + 4, paddingHorizontal: gutter - 8 }]}>
        <GlassButton onPicture onPress={() => router.back()} accessibilityLabel="End, back to Pray" testID="through-close">
          <Icon name="close" size={20} tone="white" />
        </GlassButton>
        {turns !== null && turns.length > 0 && turn !== undefined ? (
          <>
            <StepSegments count={turns.length} fill={(i) => (i < at ? 1 : 0)} label={`Person ${at + 1} of ${turns.length}`} />
            <Chrome step="note" style={styles.count} maxFontSizeMultiplier={1.4} importantForAccessibility="no">
              {`${at + 1} of ${turns.length}`}
            </Chrome>
          </>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={[styles.middle, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        {turns === null ? null : turns.length === 0 ? (
          <>
            <Text style={styles.big} maxFontSizeMultiplier={1.4} accessibilityRole="header">
              No one to pray for yet
            </Text>
            <Chrome style={{ color: ON_PICTURE.muted }}>Add someone to your list, or join a circle.</Chrome>
          </>
        ) : turn !== undefined ? (
          <>
            <Who turn={turn} />
            <Text style={styles.big} maxFontSizeMultiplier={1.4} accessibilityLiveRegion="polite">
              {turn.text}
            </Text>
            <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
              {turn.kind === "list"
                ? "Only you see this"
                : `${turn.kind === "circle" && turn.asker !== undefined && turn.asker.name !== "" ? turn.asker.name : "They"} will see that one more person prayed, never who`}
            </Chrome>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.foot, { paddingHorizontal: gutter, paddingBottom: insets.bottom + 16 }]}>
        {turns !== null && turns.length === 0 ? (
          <Pill title="Add to your list" onPicture stretch onPress={() => router.replace("/pray/add")} testID="through-add" />
        ) : turn !== undefined ? (
          <>
            <Pill title="Prayed" icon="check" onPicture stretch onPress={markIt} label={`Prayed for: ${turn.text}`} testID="through-prayed" />
            <GlassButton onPicture shape="capsule" onPress={next} accessibilityLabel={at + 1 < (turns?.length ?? 0) ? "Next, without marking prayed" : "Finish, without marking prayed"} style={{ alignSelf: "stretch" }} testID="through-next">
              <View style={[styles.nextInner, ax ? null : { minHeight: 50 }]}>
                <Chrome style={{ color: ON_PICTURE.text, fontWeight: "600" }}>Next</Chrome>
              </View>
            </GlassButton>
          </>
        ) : null}
      </View>
    </View>
  );
}

/** Who asked, over the request: your list's lock, the asker's avatar and circle, or Yada's globe (PF-30, PF-31). */
function Who({ turn }: { turn: Turn }) {
  const disc = (icon: IconName) => (
    <View style={styles.disc}>
      <Icon name={icon} size={18} tone="white" />
    </View>
  );
  const line = turn.kind === "circle" && turn.asker !== undefined && turn.asker.name !== "" ? `${turn.asker.name} · ${turn.place}` : turn.place;
  return (
    <View style={styles.who}>
      {turn.kind === "circle" && turn.asker !== undefined ? <Avatar id={turn.asker.id} name={turn.asker.name} size={36} onDark /> : disc(turn.kind === "list" ? "lock" : "globe")}
      <View style={{ flexShrink: 1 }}>
        <Chrome style={{ color: ON_PICTURE.text, fontWeight: "600" }}>{line}</Chrome>
        {turn.asked === undefined || turn.asked === null ? null : (
          <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
            {`Asked ${turn.asked.toLowerCase()}`}
          </Chrome>
        )}
      </View>
    </View>
  );
}

/** PF-32: Amen, the day counted, who you prayed for by place, and Done. */
function Amen({ prayed, counted }: { prayed: readonly Turn[]; counted: boolean }) {
  const { user } = useAppData();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { gutter, pill } = useLayout();
  const [streak, setStreak] = useState<number | null>(null);
  const [barHeight, setBarHeight] = useState(0);
  useEffect(() => {
    if (!counted) return;
    void loadDays(user).then((d) => setStreak(rhythmOf(d, todayKey(new Date())).streak));
  }, [user, counted]);
  const places = prayedByPlace(prayed);
  return (
    <View style={[styles.root, { backgroundColor: palette.paper }]} testID="through-amen">
      <ScrollView contentContainerStyle={[styles.amen, { paddingHorizontal: gutter, paddingTop: insets.top + 24, paddingBottom: barHeight + 24 }]}>
        <Chrome tone="ink" style={{ fontFamily: FONTS.scripture, fontWeight: "400" }} size={40} maxFontSizeMultiplier={1.1} accessibilityRole="header">
          Amen
        </Chrome>
        {streak === null ? null : (
          <View style={styles.counts}>
            <Lamp lit color={palette.accent} size={18} />
            <Chrome step="note" tone="muted">{`Today counts · ${streak} ${streak === 1 ? "day" : "days"} in a row`}</Chrome>
          </View>
        )}
        <Chrome tone="ink" style={{ fontSize: 20, lineHeight: 26, fontWeight: "600", marginTop: 36, marginBottom: 6 }}>
          {`You prayed for ${prayed.length}`}
        </Chrome>
        {places.map((p, i) => (
          <ListRow
            key={p.place}
            first={i === 0}
            chevron={false}
            leading={
              <View style={[styles.thumb, { backgroundColor: palette.fill }]}>
                <Icon name={p.kind === "list" ? "lock" : p.kind === "circle" ? "people" : "globe"} size={20} />
              </View>
            }
            title={p.place}
            right={<Chrome step="note" tone="muted">{p.line}</Chrome>}
          />
        ))}
        {prayed.some((t) => t.kind !== "list") ? (
          <Chrome step="note" tone="muted" style={{ marginTop: 12 }}>
            They see one more prayed. Never who.
          </Chrome>
        ) : null}
      </ScrollView>
      <BarFrame onHeight={setBarHeight} testID="through-amen-bar">
        <Capsule primary grow height={pill} onPress={() => router.back()} label="Done" testID="through-done">
          <Chrome tone="paper" style={{ fontWeight: "600" }}>
            Done
          </Chrome>
        </Capsule>
      </BarFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", columnGap: 14 },
  count: { color: ON_PICTURE.strong, fontWeight: "600", minWidth: 44, textAlign: "right" },
  middle: { flexGrow: 1, justifyContent: "center", rowGap: 16, paddingVertical: 24 },
  who: { flexDirection: "row", alignItems: "center", columnGap: 10 },
  disc: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: ON_PICTURE.glass },
  big: { color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontSize: 30, lineHeight: 39, letterSpacing: -0.3 },
  foot: { rowGap: 8 },
  nextInner: { alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
  amen: { flexGrow: 1, justifyContent: "center" },
  counts: { flexDirection: "row", alignItems: "center", columnGap: 6, marginTop: 6 },
  thumb: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});

