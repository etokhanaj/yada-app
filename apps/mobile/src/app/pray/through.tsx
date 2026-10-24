/**
 * Pray for others (FL-03, PT-46; approved by John 24 Oct 2026): your list, then your circles' requests you haven't
 * prayed, then one request from everyone on Yada, one at a time on the night ground, each with Prayed. It ends on how
 * many you prayed for, which counts the day. A circle sees one more prayed, never who (plan §I.3); a public request is
 * marked as the hold screen marks it (PR-09), and watched for its answer (PA-02).
 */

import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { circlesCloud, prayCloud } from "../../../modules/yada-pray";
import { Icon } from "../../components/Icon";
import { Chrome } from "../../components/Type";
import { useAppData } from "../../data/AppData";
import { loadPrayLocal, markPrayed } from "../../data/prayLocal";
import { watchAnswer } from "../../data/prayNotify";
import { countDay } from "../../data/user";
import { BRAND, ON_PICTURE } from "../../design/palette";
import { FONTS, useLayout } from "../../design/tokens";
import { ICLOUD_WAIT_MS, offerable, withinTime } from "../../lib/pray";

interface Turn {
  readonly key: string;
  /** "Your list", "Home group · Sam", "Someone on Yada". */
  readonly who: string;
  readonly text: string;
  readonly kind: "list" | "circle" | "public";
  readonly id?: string;
  readonly circle?: { readonly id: string; readonly owner: string };
}

export default function PrayThrough() {
  const { user } = useAppData();
  const insets = useSafeAreaInsets();
  const { gutter } = useLayout();
  const [turns, setTurns] = useState<Turn[] | null>(null);
  const [at, setAt] = useState(0);
  const [inCircles, setInCircles] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const local = await loadPrayLocal(user);
      const out: Turn[] = local.list
        .filter((i) => i.answered === undefined)
        .map((i, n) => ({
          key: `list-${n}`,
          who: "Your list",
          text: i.text,
          kind: "list" as const,
        }));
      if (circlesCloud !== null) {
        const cloud = circlesCloud;
        const circles = await withinTime(cloud.list(), ICLOUD_WAIT_MS).catch(
          () => [],
        );
        // All at once, each with iCloud's time limit, so one slow circle can't leave the screen empty (code review).
        const each = await Promise.all(
          circles.map((c) =>
            withinTime(cloud.requests(c.id, c.owner), ICLOUD_WAIT_MS).catch(
              () => [],
            ),
          ),
        );
        for (const [n, c] of circles.entries()) {
          const requests = each[n] ?? [];
          for (const r of requests.filter(
            (x) => !x.mine && !local.prayed.has(x.id),
          ))
            out.push({
              key: `c-${r.id}`,
              who: r.firstName === "" ? c.name : `${c.name} · ${r.firstName}`,
              text: r.text,
              kind: "circle",
              id: r.id,
              circle: { id: c.id, owner: c.owner },
            });
        }
      }
      if (prayCloud !== null) {
        const open = await prayCloud
          .open([...local.prayed, ...local.blocked], 10)
          .catch(() => []);
        const first = offerable(open, local.prayed, local.blocked)[0];
        if (first !== undefined)
          out.push({
            key: `p-${first.id}`,
            who: "Someone on Yada",
            text: first.text,
            kind: "public",
            id: first.id,
          });
      }
      if (live) setTurns(out);
    })().catch(() => live && setTurns([]));
    return () => {
      live = false;
    };
  }, [user]);

  const turn = turns?.[at];
  const finished = turns !== null && turns.length > 0 && at >= turns.length;
  const prayed = () => {
    if (turn === undefined) return;
    if (
      turn.kind === "circle" &&
      turn.circle !== undefined &&
      turn.id !== undefined
    ) {
      setInCircles(true);
      void circlesCloud
        ?.prayed(turn.circle.id, turn.circle.owner, turn.id)
        .catch(() =>
          AccessibilityInfo.announceForAccessibility(
            "Couldn’t mark it prayed.",
          ),
        );
      void markPrayed(user, turn.id).catch(() => undefined);
    }
    if (turn.kind === "public" && turn.id !== undefined) {
      const id = turn.id;
      void prayCloud?.prayed(id).catch(() => undefined);
      void markPrayed(user, id)
        .then(() => watchAnswer(user, id))
        .catch(() => undefined);
    }
    if (turns !== null && at + 1 >= turns.length)
      void countDay(user).catch(() => undefined);
    setAt(at + 1);
  };

  const top = (
    <View style={[styles.top, { paddingHorizontal: 16 }]}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="End, back to Pray"
        style={styles.round}
        testID="through-close"
      >
        <Icon name="close" size={20} tone="paper" />
      </Pressable>
      {turns !== null && !finished && turns.length > 0 ? (
        <Chrome
          step="note"
          style={styles.caption}
        >{`${at + 1} of ${turns.length}`}</Chrome>
      ) : null}
      <View style={{ width: 44 }} />
    </View>
  );

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 24 },
      ]}
      testID="pray-through"
    >
      <StatusBar style="light" />
      {top}
      <ScrollView
        contentContainerStyle={[styles.middle, { paddingHorizontal: gutter }]}
      >
        {turns === null ? null : turns.length === 0 ? (
          <>
            <Text style={styles.big} maxFontSizeMultiplier={1.6}>
              No one to pray for yet
            </Text>
            <Chrome step="note" style={styles.under}>
              Add someone to your list, or join a circle.
            </Chrome>
          </>
        ) : finished ? (
          <>
            <Text
              style={styles.big}
              maxFontSizeMultiplier={1.6}
              accessibilityRole="header"
            >{`You prayed for ${turns.length}`}</Text>
            {inCircles ? (
              <Chrome step="note" style={styles.under}>
                Circles see one more prayed. Never who.
              </Chrome>
            ) : null}
          </>
        ) : turn !== undefined ? (
          <>
            <Chrome step="note" style={styles.who}>
              {turn.who}
            </Chrome>
            <Text
              style={styles.big}
              maxFontSizeMultiplier={1.6}
              accessibilityLiveRegion="polite"
            >
              {turn.text}
            </Text>
          </>
        ) : null}
      </ScrollView>
      <View style={{ paddingHorizontal: gutter }}>
        {turns !== null && turns.length === 0 ? (
          <Pressable
            onPress={() => router.replace("/pray/add")}
            accessibilityRole="button"
            style={styles.primary}
            testID="through-add"
          >
            <Chrome style={styles.primaryText}>Add to your list</Chrome>
          </Pressable>
        ) : finished ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={styles.primary}
            testID="through-done"
          >
            <Chrome style={styles.primaryText}>Done</Chrome>
          </Pressable>
        ) : turn !== undefined ? (
          <Pressable
            onPress={prayed}
            accessibilityRole="button"
            accessibilityLabel={`Prayed for: ${turn.text}`}
            style={styles.primary}
            testID="through-prayed"
          >
            <Chrome style={styles.primaryText}>Prayed</Chrome>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.night },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ON_PICTURE.glass,
  },
  caption: { color: BRAND.onNight, opacity: 0.75, fontWeight: "600" },
  middle: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  who: {
    color: BRAND.onNight,
    opacity: 0.7,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  big: {
    color: BRAND.onNight,
    fontFamily: FONTS.scripture,
    fontSize: 28,
    lineHeight: 38,
    textAlign: "center",
  },
  under: {
    color: BRAND.onNight,
    opacity: 0.7,
    marginTop: 14,
    textAlign: "center",
  },
  primary: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: BRAND.chartreuse,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: BRAND.ink, fontWeight: "600" },
});
