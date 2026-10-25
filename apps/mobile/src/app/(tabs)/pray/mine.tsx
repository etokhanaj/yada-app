/**
 * Everyone on Yada (FL-05, PT-46; John 24 Oct 2026): the requests waiting from anyone using Yada, with Pray, and under
 * them your own, with Ask, since your requests live in the place they were asked. Your requests (PR-11, XT-04; Build 12
 * PR-51): Live and Answered, each a raised card with the request in Literata, how many prayed (only you see it, never
 * "0") and how long it has left or when it was answered, Mark answered on the card and ⋯ for Renew and Delete. With
 * none asked, the shared empty state offers Ask for prayer (EM-01).
 */

import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AccessibilityInfo, ActionSheetIOS, Pressable, StyleSheet, View } from "react-native";

import { circlesCloud, prayCloud } from "../../../../modules/yada-pray";
import { EmptyState } from "../../../components/EmptyState";
import { PageScreen } from "../../../components/Page";
import { RequestCard } from "../../../components/pray/RequestCard";
import { Chrome, SectionTitle } from "../../../components/Type";
import { useLayout, usePalette } from "../../../design/tokens";
import { useAppData } from "../../../data/AppData";
import { loadPrayLocal } from "../../../data/prayLocal";
import { type AskedRequest, asRequest } from "../../../lib/askSomeone";
import { newestFirst, offerable } from "../../../lib/pray";

export default function Mine() {
  const palette = usePalette();
  const { sectionGap } = useLayout();
  const { user } = useAppData();
  const [mine, setMine] = useState<AskedRequest[] | null>(null);
  // A load that failed says so, never "Nothing asked yet" (12c QA: iCloud unreachable read as an empty list).
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const reload = useCallback(() => {
    // Asked of everyone and asked of one person (AO-01) together; asks of one failing alone still show the rest.
    void prayCloud
      ?.mine()
      .then(async (m) => {
        const ones = (await circlesCloud?.asks().catch(() => [])) ?? [];
        setFailed(false);
        setMine(newestFirst<AskedRequest>([...m, ...ones.map(asRequest)]));
      })
      .catch(() => setFailed(true));
    void loadPrayLocal(user)
      .then(async (local) => {
        const open = (await prayCloud?.open([...local.prayed, ...local.blocked], 30).catch(() => [])) ?? [];
        setWaiting(offerable(open, local.prayed, local.blocked).length);
      })
      .catch(() => setWaiting(0));
  }, [user]);
  useFocusEffect(reload);

  const act = (r: AskedRequest) => {
    // An ask of one person is not renewed: its link was sent once, and ends with it. Delete leaves its share.
    const remove = r.to === undefined ? prayCloud?.remove.bind(null, r.id) : circlesCloud?.leave.bind(null, r.id, "");
    const choices: [string, (() => Promise<void>) | undefined][] =
      r.answeredAt === undefined && r.to === undefined ? [["Renew for 7 days", prayCloud?.renew.bind(null, r.id)], ["Delete", remove]] : [["Delete", remove]];
    ActionSheetIOS.showActionSheetWithOptions({ options: [...choices.map(([t]) => t), "Cancel"], destructiveButtonIndex: choices.length - 1, cancelButtonIndex: choices.length }, (i) => {
      // A failed change in iCloud said nothing (code review, 18 Oct 2026).
      void choices[i]?.[1]?.()
        .then(reload)
        .catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t change that request. Try again."));
    });
  };

  const now = Date.now();
  const live = (mine ?? []).filter((r) => r.answeredAt === undefined);
  const answered = (mine ?? []).filter((r) => r.answeredAt !== undefined);
  const answer = (r: AskedRequest) =>
    void (r.to === undefined ? prayCloud?.markAnswered(r.id) : circlesCloud?.answerAsk(r.id))
      ?.then(reload)
      .catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t mark it answered. Try again."));
  const group = (title: string, list: AskedRequest[], first: boolean) =>
    list.length === 0 ? null : (
      <View style={{ marginTop: first ? 0 : sectionGap }}>
        <Chrome step="note" tone="muted" style={{ fontWeight: "600", marginBottom: 10 }}>
          {title}
        </Chrome>
        {list.map((r) => (
          <RequestCard key={r.id} request={r} to={r.to} now={now} onAnswered={() => answer(r)} onMore={() => act(r)} />
        ))}
      </View>
    );

  return (
    <PageScreen title="Everyone on Yada" back="Pray" subtitle="Anyone using Yada can pray. Never your name." clearTabBar testID="pray-mine">
      <View style={styles.waiting}>
        <View style={{ flex: 1 }}>
          <Chrome tone="ink" style={{ fontWeight: "600" }}>
            {waiting > 0 ? `${waiting} ${waiting === 1 ? "request" : "requests"} waiting` : "None waiting just now"}
          </Chrome>
          {waiting > 0 ? (
            <Chrome step="note" tone="muted">
              One at a time
            </Chrome>
          ) : null}
        </View>
        {waiting > 0 ? (
          <Pressable onPress={() => router.push("/pray/someone")} accessibilityRole="button" accessibilityLabel="Pray for someone, one request at a time" style={[styles.pray, { backgroundColor: palette.ink }]} testID="pray-someone">
            <Chrome style={{ color: palette.paper, fontWeight: "600" }}>Pray</Chrome>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.head}>
        <SectionTitle>Your requests</SectionTitle>
        {/* Empty, the empty state holds the one Ask (EM-01). */}
        {mine !== null && mine.length === 0 ? null : <Pressable onPress={() => router.push("/pray/ask")} accessibilityRole="button" accessibilityLabel="Ask for prayer" hitSlop={8} style={styles.ask} testID="pray-ask">
          <Chrome tone="accent" style={{ fontWeight: "600" }}>
            Ask
          </Chrome>
        </Pressable>}
      </View>
      {failed && mine === null ? (
        <Pressable onPress={reload} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }} testID="mine-retry">
          <Chrome tone="muted">
            Your requests didn’t load.{" "}
            <Chrome tone="accent" style={{ fontWeight: "600" }}>
              Try again
            </Chrome>
          </Chrome>
        </Pressable>
      ) : mine !== null && mine.length === 0 ? (
        <EmptyState title="Nothing asked yet" line="What you ask shows here, with how many prayed." action="Ask for prayer" icon="plus" onAction={() => router.push("/pray/ask")} testID="mine-empty" />
      ) : (
        <>
          {group("Live", live, true)}
          {group("Answered", answered, live.length === 0)}
        </>
      )}
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  waiting: { flexDirection: "row", alignItems: "center", columnGap: 12, minHeight: 64, marginBottom: 20 },
  pray: { minHeight: 44, paddingHorizontal: 22, borderRadius: 22, justifyContent: "center" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  ask: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
});
