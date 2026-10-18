/**
 * M'Cheyne (canvas RP-02, RP-03, DN-03): the reading the plan is on, its four portions, the one to read
 * next marked in type as John's Next is (PG-06), finished ones muted with a check; then the readings
 * finished. "Reading 2 of 365", never a date: it waits where the reader stopped (lib/plans.ts).
 * The last reading ends on one quiet line and a way to start again; nothing celebrates (DN-03).
 */

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { Icon } from "../components/Icon";
import { readerHref } from "../components/navigation";
import { ListRow, PageScreen } from "../components/Page";
import { SectionTitle, Chrome, Prose, Scripture } from "../components/Type";
import { formatDay } from "../lib/dates";
import { useAppData } from "../data/AppData";
import { chooseYourPlan, loadMcheyne, type McheyneState, restartMcheyne } from "../data/plans";
import { useLayout } from "../design/tokens";
import { keyOf, MCHEYNE_READINGS, MCHEYNE_TOTAL, nextPortion, type Portion, portionLabel, portionSpoken, readingsDone } from "../lib/plans";

/** M'Cheyne's preface to the Calendar (1842, public domain), one sentence, exactly as printed. */
const MCHEYNE_PREFACE =
  "It has long been in my mind to prepare a scheme of Scripture reading, in which as many as were made willing by God might agree, so that the whole Bible might be read once by you in the year, and all might be feeding in the same portion of the green pasture at the same time.";

export default function McheyneScreen() {
  const { user } = useAppData();
  const { sectionGap } = useLayout();
  const [state, setState] = useState<McheyneState | null>(null);
  const reload = useCallback(() => {
    let live = true;
    void loadMcheyne(user).then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, [user]);
  useFocusEffect(reload);
  // As the John plan: from Home's Your plan it returns to Home, not "Plans" (IA stress test, 15 Oct 2026).
  const { from } = useLocalSearchParams<{ from?: string }>();
  const back = from === "plans" ? "Plans" : from === "today" ? "Today" : "Bible";

  if (state === null) return <PageScreen title="M’Cheyne" back={back} testID="mcheyne">{null}</PageScreen>;
  const next = nextPortion(state);
  const open = (portion: Portion) => {
    // Reading from the plan makes it "Your plan" (IA-14), so the reader counts its chapters (RP-04).
    const first = portion[0];
    if (first !== undefined)
      void chooseYourPlan(user, "mcheyne").then(() =>
        router.push(readerHref({ book: first.b, chapter: first.c, ...(first.vs === undefined ? {} : { verse: first.vs }), resume: true, back: "M’Cheyne" })),
      );
  };

  if (next === null) {
    // DN-03: one quiet line; a new round keeps the finished year in the record.
    return (
      <PageScreen title="M’Cheyne" back={back} testID="mcheyne">
        <Prose step="claim" tone="muted" testID="mcheyne-done">
          {`You’ve read all ${MCHEYNE_TOTAL} readings.`}
        </Prose>
        {/* MM-12: the plan's span, the day it was begun, and M'Cheyne's own words, quoted exactly from the
            pinned 1842 Calendar (content/raw/mcheyne/calendar.pdf); approved by John, 13 Oct 2026. */}
        <Chrome step="note" tone="muted" style={{ marginTop: 6 }}>
          {`The whole Bible, four chapters at a sitting${state.begun === null ? "" : ` · Begun ${formatDay(new Date(state.begun))}`}`}
        </Chrome>
        <Scripture step="claim" style={{ marginTop: sectionGap, fontStyle: "italic" }} testID="mcheyne-preface">
          {MCHEYNE_PREFACE}
        </Scripture>
        <Chrome step="note" tone="muted" style={{ marginTop: 6 }}>
          Robert Murray M’Cheyne, 1842
        </Chrome>
        <View style={{ marginTop: sectionGap }}>
          <ListRow first title="Start again from reading 1" onPress={() => void restartMcheyne(user, state.round).then(reload)} testID="mcheyne-restart" />
        </View>
      </PageScreen>
    );
  }

  const reading = MCHEYNE_READINGS[next.reading] ?? [];
  const done = readingsDone(state);
  return (
    <PageScreen title="M’Cheyne" back={back} subtitle={`Reading ${next.reading + 1} of ${MCHEYNE_TOTAL}`} testID="mcheyne">
      {reading.map((portion, pi) => {
        const isRead = state.read.has(keyOf(next.reading, pi));
        const isNext = pi === next.portion;
        const name = portionLabel(portion);
        return (
          <ListRow
            key={pi}
            first={pi === 0}
            here={isNext}
            done={isRead}
            chevron={isNext}
            label={isNext ? `Next, ${portionSpoken(portion)}` : `${portionSpoken(portion)}${isRead ? ", read" : ""}`}
            right={isRead ? <Icon name="check" size={20} tone="accent" /> : undefined}
            onPress={() => open(portion)}
            testID={`mcheyne-portion-${pi + 1}`}
          >
            {isNext ? (
              <Chrome step="note" tone="accent" style={{ fontWeight: "600" }}>
                Next
              </Chrome>
            ) : null}
            <Chrome tone={isRead ? "muted" : "ink"} size={isNext ? 18 : undefined} style={isNext ? { fontWeight: "600" } : undefined}>
              {name}
            </Chrome>
          </ListRow>
        );
      })}
      {state.read.size === 0 ? (
        // RP-02: said once, before anything is read.
        <Chrome step="note" tone="muted" style={{ marginTop: 12 }} testID="mcheyne-no-dates">
          No dates. It waits where you stop.
        </Chrome>
      ) : null}
      {done.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <SectionTitle style={{ marginBottom: 6 }}>Read</SectionTitle>
          {done.map((ri, i) => {
            const portions = (MCHEYNE_READINGS[ri] ?? []).map(portionLabel);
            return (
              <ListRow
                key={ri}
                first={i === 0}
                chevron={false}
                title={`Reading ${ri + 1}`}
                subtitle={portions.join(" · ")}
                label={`Reading ${ri + 1}, ${portions.join(", ")}, read`}
                testID={`mcheyne-read-${ri + 1}`}
              />
            );
          })}
        </View>
      ) : null}
    </PageScreen>
  );
}
