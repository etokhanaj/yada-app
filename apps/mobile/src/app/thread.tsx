/**
 * Start here: John, passage by passage, in order.
 *
 * Built only from the pericope labels in the John bundle — no invented
 * introductions, no prose Yada has not reviewed. Plain rows with the next
 * passage in the accent colour, as Speak's lesson outline marks the current
 * lesson (https://mobbin.com/screens/9e4fb95e-0e88-4662-8089-86da1f6cc31a).
 */

import { ordToParts } from "@yada/schema";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { readerHref } from "../components/navigation";
import { PageHeader } from "../components/PageHeader";
import { Label, Prose } from "../components/Type";
import { useAppData, useLog, useQuery } from "../data/AppData";
import { loadPericopes } from "../data/understand";
import { loadThreadStep, saveThreadStep } from "../data/user";
import { SPACE, usePalette } from "../design/tokens";
import { formatRange } from "../lib/chapters";

const THREAD = "start-here-john";

export default function ThreadScreen() {
  const palette = usePalette();
  const { user } = useAppData();
  const log = useLog();
  const { data: pericopes } = useQuery(() => loadPericopes("JHN"), []);
  const [step, setStep] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void loadThreadStep(user, THREAD).then(setStep);
    }, [user]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }}>
      <PageHeader title="Start here" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xxl }}>
        <Label style={{ marginBottom: SPACE.sm }}>The Gospel of John · {pericopes?.length ?? 0} passages</Label>
        {(pericopes ?? []).map((pericope, index) => {
          const next = index === step;
          const done = index < step;
          const start = ordToParts(pericope.start_ord);
          return (
            <Pressable
              key={pericope.pericope_id}
              onPress={() => {
                // Tapping a passage makes the one after it "next", so the
                // thread follows the reader rather than grading them.
                void saveThreadStep(user, THREAD, index + 1);
                log("thread_step", `${start.book}.${start.chapter}.${start.verse}`, String(index + 1));
                router.push(readerHref({ book: start.book, chapter: start.chapter, verse: start.verse }));
              }}
              style={({ pressed }) => [styles.row, { borderTopColor: palette.divider }, pressed ? { backgroundColor: palette.selection } : null]}
              accessibilityRole="link"
              accessibilityLabel={`${index + 1}. ${pericope.label}, ${formatRange(pericope.pericope_id)}${next ? ", next" : ""}`}
              testID={`thread-${index + 1}`}
            >
              <Prose step="note" tone="muted" style={styles.number}>
                {index + 1}
              </Prose>
              <View style={{ flex: 1 }}>
                <Prose step="claim" tone={next ? "accent" : done ? "muted" : "ink"} style={next ? { fontWeight: "600" } : null}>
                  {pericope.label}
                </Prose>
                <Prose step="note" tone="muted">
                  {formatRange(pericope.pericope_id)}
                  {next ? " · next" : ""}
                </Prose>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACE.md,
    columnGap: SPACE.md,
    marginHorizontal: -SPACE.sm,
    paddingHorizontal: SPACE.sm,
  },
  number: {
    minWidth: 24,
    paddingTop: 3,
  },
});
