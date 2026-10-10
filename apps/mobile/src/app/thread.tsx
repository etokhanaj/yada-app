/**
 * Start here (canvas ST-01): John, passage by passage, in order.
 *
 * Built only from the pericope labels in the John bundle: no invented
 * introductions, no prose Yada has not reviewed. Speak's lesson outline marks
 * the current lesson (https://mobbin.com/screens/9e4fb95e-0e88-4662-8089-86da1f6cc31a);
 * here the next passage is marked in type: its number and `Next` in the accent,
 * its title semibold. Not the wash and bar, which mean a selected verse only.
 * Finished passages take a check, muted.
 */

import { ordToParts, verseOrd } from "@yada/schema";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { CoverWordLine } from "../components/Cover";
import { Icon } from "../components/Icon";
import { readerHref } from "../components/navigation";
import { ListRow, PageScreen } from "../components/Page";
import { Chrome } from "../components/Type";
import { useAppData, useCore, useLog, useQuery } from "../data/AppData";
import { loadPassageCover, loadPericopes } from "../data/understand";
import { loadThreadStep, saveThreadStep } from "../data/user";
import { useLayout } from "../design/tokens";
import { rangeInBook, threadMark } from "../lib/saved";

const THREAD = "start-here-john";

export default function ThreadScreen() {
  const { user } = useAppData();
  const { ax } = useLayout();
  const log = useLog();
  const core = useCore();
  const { data: pericopes } = useQuery(() => loadPericopes("JHN"), []);
  // DP-03: the Gospel's opening word heads the thread.
  const { data: cover } = useQuery(() => loadPassageCover(core, "JHN", verseOrd("JHN", 1, 1)), []);
  const [step, setStep] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void loadThreadStep(user, THREAD).then(setStep);
    }, [user]),
  );

  return (
    <PageScreen
      title="The Gospel of John"
      // DP-03: the large title, then the Gospel's opening word on one line ending in the count.
      // Not one accessible element: the word keeps its own view so VoiceOver reads it in Greek.
      subtitle={
        pericopes === undefined ? undefined : cover !== undefined && cover !== null && cover.word !== null ? (
          <CoverWordLine cover={cover} after={`${pericopes.length} passages, in order`} />
        ) : (
          `${pericopes.length} passages`
        )
      }
      testID="thread"
    >
      {(pericopes ?? []).map((pericope, index) => {
        const mark = threadMark(index, step);
        const range = rangeInBook(pericope.pericope_id);
        const start = ordToParts(pericope.start_ord);
        return (
          <ListRow
            key={pericope.pericope_id}
            first={index === 0}
            here={mark === "next"}
            done={mark === "done"}
            chevron={mark === "next"}
            label={`${pericope.label}, ${range}${mark === "done" ? ", read" : mark === "next" ? ", next" : ""}`}
            testID={`thread-${index + 1}`}
            onPress={() => {
              // Tapping a passage makes the one after it next, so the thread
              // follows the reader rather than grading them.
              void saveThreadStep(user, THREAD, index + 1);
              log("thread_step", `${start.book}.${start.chapter}.${start.verse}`, String(index + 1));
              router.push(readerHref({ book: start.book, chapter: start.chapter, verse: start.verse }));
            }}
            right={
              mark === "done" ? (
                <Icon name="check" size={20} tone="accent" />
              ) : mark === "next" ? (
                <Chrome step="note" tone="accent" style={{ fontWeight: "700" }}>
                  Next
                </Chrome>
              ) : undefined
            }
          >
            {/* Numbered in Literata old-style figures, the range indented under the title (DP-03). */}
            <View style={styles.numbered}>
              <Chrome
                tone={mark === "next" ? "accent" : "muted"}
                style={[styles.title, styles.num, mark === "next" ? { fontWeight: "600" } : null]}
                maxFontSizeMultiplier={2.2}
              >
                {index + 1}
              </Chrome>
              <Chrome tone={mark === "done" ? "muted" : "ink"} style={[styles.title, { flex: 1, fontWeight: mark === "next" ? "600" : "400" }]} maxFontSizeMultiplier={2.2}>
                {pericope.label}
              </Chrome>
            </View>
            <Chrome step="note" tone="muted" style={{ paddingLeft: ax ? 0 : 34 }}>
              {range}
            </Chrome>
          </ListRow>
        );
      })}
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: "Literata",
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  num: {
    minWidth: 22,
    fontVariant: ["oldstyle-nums"],
  },
  numbered: {
    flexDirection: "row",
    alignItems: "baseline",
    columnGap: 12,
  },
});
