/**
 * Your rhythm (build 7 plan §2 row 8, DR-22; reworked as RT-02, build 10a, John 18 Oct 2026). It leads with the days read
 * this year, a number that only grows: a run that restarts at "1 day" read as a reset. The run is second and small, with
 * the lamp. Nothing here shows a best, a record, a lost run or a count of missed days, and there is nothing to restore.
 *
 * Taken from timespent (https://mobbin.com/screens/1257a839-9577-4320-957c-5d9c25b7477e): a year grid with month names.
 * Rejected: Duolingo's streak-extension prompt (https://mobbin.com/screens/1755644a-3b98-4a8e-906f-0ef606e166eb) and
 * Speak's "Don't Lose Your Record" (https://mobbin.com/screens/ce7c882c-abef-4918-ad3c-e88db68b6344).
 *
 * VoiceOver reads "28 days this year. 1 day in a row. Today read." and the grid is one image with its summary.
 * The grid shows one tint: the canvas draws a second for "the day's verse alone", but a synced day carries no kind
 * (lib/cloudSync.ts days are plain presence), so the app cannot tell the two apart without guessing.
 */

import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Lamp } from "../components/Lamp";
import { SheetScreen } from "../components/Sheet";
import { Chrome, Prose, SectionTitle } from "../components/Type";
import { useAppData } from "../data/AppData";
import { loadDays } from "../data/user";
import { FONTS, useLayout, usePalette } from "../design/tokens";
import { type Rhythm, rhythmOf, todayKey } from "../lib/rhythm";
import { GRID_WEEKS, gridSummary, thisWeek, yearGrid } from "../lib/yearGrid";

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const CELL = 10;
const GAP = 3;

export default function RhythmScreen() {
  const { user } = useAppData();
  const palette = usePalette();
  const { ax } = useLayout();
  const [state, setState] = useState<{ rhythm: Rhythm; all: string[] } | null>(null);

  useEffect(() => {
    let live = true;
    void loadDays(user).then((d) => live && setState({ all: d, rhythm: rhythmOf(d, todayKey(new Date())) }));
    return () => {
      live = false;
    };
  }, [user]);

  const today = todayKey(new Date());
  const grid = state === null ? null : yearGrid(state.all, today);
  const week = state === null ? [] : thisWeek(state.all, today);
  const r = state?.rhythm;

  return (
    <SheetScreen title="Your rhythm" backLabel={null} noBack footer={false} testID="rhythm">
      {state === null || r === undefined || grid === null ? null : (
        <>
          <View accessible accessibilityLabel={`${days(r.thisYear)} this year. ${days(r.streak)} in a row.${r.lit ? " Today read." : ""}`}>
            <View style={styles.lead}>
              <Chrome tone="ink" style={styles.number} maxFontSizeMultiplier={1.6} testID="rhythm-year">
                {r.thisYear}
              </Chrome>
              <Chrome tone="muted">{r.thisYear === 1 ? "day this year" : "days this year"}</Chrome>
            </View>
            {r.streak > 0 ? (
              <View style={styles.run}>
                <View style={[styles.lampDisc, { backgroundColor: palette.fill }]}>
                  <Lamp lit={r.lit} color={palette.accent} size={22} />
                </View>
                <Chrome tone="ink" style={{ fontWeight: "600" }}>{`${days(r.streak)} in a row`}</Chrome>
              </View>
            ) : null}
          </View>

          <View
            style={styles.week}
            accessible
            accessibilityLabel={`This week: ${week.flatMap((d, i) => (d.counted ? [WEEKDAY_NAMES[i]] : [])).join(", ") || "no days yet"}`}
          >
            {week.map((d, i) => (
              <View key={d.key} style={styles.weekDay}>
                <Chrome step="note" tone="muted">
                  {WEEKDAYS[i]}
                </Chrome>
                <View
                  style={[
                    styles.dot,
                    { borderColor: d.today ? palette.ink : "transparent", backgroundColor: d.counted ? palette.accent : palette.fill },
                  ]}
                />
              </View>
            ))}
          </View>

          <SectionTitle style={{ marginTop: 28, marginBottom: 6 }}>How it works</SectionTitle>
          {/* Set as the frame's plain claims (canvas .claim), not reading prose. */}
          <Chrome tone="ink">Reading or listening counts, and so does the day’s verse.</Chrome>
          <Chrome tone="ink" style={{ marginTop: 8 }}>A day of rest each week never breaks it.</Chrome>

          {ax ? (
            <Prose tone="muted" style={{ marginTop: 20 }}>{gridSummary(grid)}</Prose>
          ) : (
            <View accessible accessibilityRole="image" accessibilityLabel={gridSummary(grid)} style={styles.gridWrap} testID="rhythm-grid">
              <View style={styles.months}>
                {grid.months.map((m) => (
                  <Chrome key={`${m.week}-${m.name}`} step="note" tone="muted" style={{ position: "absolute", left: m.week * (CELL + GAP) }}>
                    {m.name}
                  </Chrome>
                ))}
              </View>
              <View style={styles.cells}>
                {grid.weeks.map((w, wi) => (
                  <View key={wi} style={{ rowGap: GAP }}>
                    {w.map((c) => (
                      <View
                        key={c.key}
                        style={{
                          width: CELL,
                          height: CELL,
                          borderRadius: 3,
                          backgroundColor: c.counted ? palette.accent : palette.fill,
                          opacity: c.future ? 0 : 1,
                        }}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  lead: { flexDirection: "row", alignItems: "baseline", columnGap: 10, flexWrap: "wrap" },
  number: { fontFamily: FONTS.scripture, fontSize: 64, lineHeight: 70, fontWeight: "600", letterSpacing: -1.5 },
  run: { flexDirection: "row", alignItems: "center", columnGap: 10, minHeight: 44, marginTop: 6 },
  lampDisc: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  week: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  weekDay: { alignItems: "center", rowGap: 6, minWidth: 32 },
  dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5 },
  gridWrap: { marginTop: 28, rowGap: 6 },
  months: { height: 20, width: GRID_WEEKS * (CELL + GAP) },
  cells: { flexDirection: "row", columnGap: GAP },
});
