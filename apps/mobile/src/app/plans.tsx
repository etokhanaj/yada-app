/**
 * Reading plans (canvas RP-01; IA v3, IA-11): two plans, each saying what it is in one line. John passage by
 * passage was Start here; M'Cheyne's Calendar of 1842 reads the whole Bible. No dates anywhere: each
 * waits where the reader stopped.
 */

import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { ListRow, PageScreen } from "../components/Page";
import { Chrome } from "../components/Type";
import { useAppData } from "../data/AppData";
import { loadMcheyne } from "../data/plans";
import { loadProgress } from "../data/startHere";
import { MCHEYNE_TOTAL, nextPortion, readingsDone } from "../lib/plans";

export default function PlansScreen() {
  const { user } = useAppData();
  const [lines, setLines] = useState<{ john: string; mcheyne: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        const [john, m] = await Promise.all([loadProgress(user), loadMcheyne(user)]);
        const next = nextPortion(m);
        const done = readingsDone(m).length;
        const mcheyne = m.read.size === 0 ? "" : next === null ? ` · all ${MCHEYNE_TOTAL} read` : ` · reading ${next.reading + 1} of ${MCHEYNE_TOTAL}`;
        if (live) setLines({ john: ` · ${john.read.size} of ${john.passages.length} read`, mcheyne: done === 0 && m.read.size === 0 ? "" : mcheyne });
      })();
      return () => {
        live = false;
      };
    }, [user]),
  );

  return (
    <PageScreen title="Reading plans" testID="plans">
      <ListRow
        first
        title={<Chrome tone="ink" style={{ fontWeight: "500" }}>The Gospel of John</Chrome>}
        subtitle={`Passage by passage, explained${lines?.john ?? ""}`}
        label={`The Gospel of John. Passage by passage, explained${lines?.john ?? ""}`}
        onPress={() => router.push({ pathname: "/thread", params: { from: "plans" } })}
        testID="plans-john"
      />
      <ListRow
        title={<Chrome tone="ink" style={{ fontWeight: "500" }}>The whole Bible</Chrome>}
        subtitle={`365 readings, four chapters each · Robert Murray M’Cheyne’s plan, 1842${lines?.mcheyne ?? ""}`}
        label={`The whole Bible. 365 readings, four chapters each. Robert Murray M’Cheyne’s plan, 1842${lines?.mcheyne ?? ""}`}
        onPress={() => router.push({ pathname: "/mcheyne", params: { from: "plans" } })}
        testID="plans-mcheyne"
      />
    </PageScreen>
  );
}
