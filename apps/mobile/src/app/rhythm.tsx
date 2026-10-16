/**
 * Your rhythm (build 7 plan §2 row 8, DR-22): the streak's number, its three rules in a sentence each, and the
 * year's count. No best, no "lost", no restore, no notifications (John, 15 Oct 2026).
 */

import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Lamp } from "../components/Lamp";
import { ListRow } from "../components/Page";
import { SheetScreen } from "../components/Sheet";
import { Chrome, Prose } from "../components/Type";
import { useAppData } from "../data/AppData";
import { loadDays } from "../data/user";
import { usePalette } from "../design/tokens";
import { type Rhythm, rhythmOf, todayKey } from "../lib/rhythm";

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

export default function RhythmScreen() {
  const { user } = useAppData();
  const palette = usePalette();
  const [rhythm, setRhythm] = useState<Rhythm | null>(null);

  useEffect(() => {
    let live = true;
    void loadDays(user).then((d) => live && setRhythm(rhythmOf(d, todayKey(new Date()))));
    return () => {
      live = false;
    };
  }, [user]);

  return (
    <SheetScreen title="Your rhythm" backLabel={null} noBack footer={false} testID="rhythm">
      {rhythm === null ? null : (
        <>
          <View style={styles.count} accessible accessibilityLabel={`${days(rhythm.streak)}${rhythm.lit ? ", today counts" : ""}`}>
            <Lamp lit={rhythm.lit} color={palette.accent} size={36} />
            <Chrome tone="ink" style={styles.number}>
              {days(rhythm.streak)}
            </Chrome>
          </View>
          <Prose>A day counts when you read or listen.</Prose>
          <Prose>One rest day a week never breaks it.</Prose>
          <Prose>If it ends, it starts again quietly.</Prose>
          <ListRow first title="This year" right={<Chrome tone="muted">{days(rhythm.thisYear)}</Chrome>} chevron={false} testID="rhythm-year" />
        </>
      )}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  count: { flexDirection: "row", alignItems: "center", columnGap: 12, marginBottom: 8 },
  number: { fontSize: 34, lineHeight: 41, fontWeight: "700", letterSpacing: -0.8 },
});
