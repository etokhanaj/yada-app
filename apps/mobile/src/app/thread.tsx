/**
 * Start here (canvas PG-06): John, passage by passage, in order. Each row
 * opens its passage with the guide over it.
 *
 * Built from the pericope labels in the John bundle: no invented
 * introductions. Speak's lesson outline marks the current lesson
 * (https://mobbin.com/screens/9e4fb95e-0e88-4662-8089-86da1f6cc31a); here the
 * next passage is marked in type: `Next · 1:1–18` above its title, its number
 * in the accent, its title semibold, and its Where we are shown whole beneath
 * (never cut before its point). Not the wash and bar, which mean a selected
 * verse only (John, 10 Oct 2026). Finished passages take a check, muted; with
 * all 46 finished there is no Next and nothing celebrates (edge case 2).
 */

import { ordToParts, verseOrd } from "@yada/schema";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { CoverWordLine } from "../components/Cover";
import { Icon } from "../components/Icon";
import { readerHref } from "../components/navigation";
import { ListRow, PageScreen } from "../components/Page";
import { Chrome, Prose } from "../components/Type";
import { useAppData, useCore, useLog, useQuery } from "../data/AppData";
import { loadOrientation } from "../data/guide";
import { loadProgress, type Progress } from "../data/startHere";
import { loadPassageCover } from "../data/understand";
import { FONTS, useLayout } from "../design/tokens";
import { rangeInBook } from "../lib/saved";
import { listMark, nextPassage } from "../lib/startHere";

export default function ThreadScreen() {
  const { user } = useAppData();
  const { ax } = useLayout();
  const log = useLog();
  const core = useCore();
  // DP-03: the Gospel's opening word heads the thread.
  const { data: cover } = useQuery(() => loadPassageCover(core, "JHN", verseOrd("JHN", 1, 1)), []);
  const [progress, setProgress] = useState<(Progress & { orientation: string | null }) | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        const p = await loadProgress(user);
        const next = nextPassage(p.passages.length, p.read, p.lastFinished);
        const nextRow = next === null ? undefined : p.passages[next];
        const orientation = nextRow === undefined ? null : await loadOrientation(nextRow);
        if (live) setProgress({ ...p, orientation });
      })();
      return () => {
        live = false;
      };
    }, [user]),
  );

  const passages = progress?.passages ?? [];
  const next = progress === null ? null : nextPassage(passages.length, progress.read, progress.lastFinished);

  return (
    <PageScreen
      title="The Gospel of John"
      // DP-03: the large title, then the Gospel's opening word on one line ending in the count.
      // Not one accessible element: the word keeps its own view so VoiceOver reads it in Greek.
      subtitle={
        progress === null ? undefined : cover !== undefined && cover !== null && cover.word !== null ? (
          <CoverWordLine cover={cover} after={`${passages.length} passages, in order`} />
        ) : (
          `${passages.length} passages`
        )
      }
      testID="thread"
    >
      {passages.map((pericope, index) => {
        const mark = listMark(index, progress?.read ?? new Set(), next);
        const range = rangeInBook(pericope.pericope_id);
        const start = ordToParts(pericope.start_ord);
        const orientation = mark === "next" ? (progress?.orientation ?? null) : null;
        return (
          <ListRow
            key={pericope.pericope_id}
            // PG-06 rules the list off from the title block: a hairline above the first row too.
            first={false}
            here={mark === "next"}
            done={mark === "done"}
            chevron={mark === "next"}
            label={
              mark === "next"
                ? `Next, passage ${index + 1}, ${pericope.label}, John ${range.replace("–", " to ")}.${orientation === null ? "" : ` ${orientation}`} Opens the passage guide`
                : `${index + 1}, ${pericope.label}, ${range}${mark === "done" ? ", read" : ""}`
            }
            testID={`thread-${index + 1}`}
            onPress={() => {
              log("thread_step", `${start.book}.${start.chapter}.${start.verse}`, String(index + 1));
              router.push(readerHref({ book: start.book, chapter: start.chapter, verse: start.verse, resume: true, guide: pericope.pericope_id }));
            }}
            right={mark === "done" ? <Icon name="check" size={20} tone="accent" /> : undefined}
          >
            {mark === "next" ? (
              // "Next · range" above the title, so the mark is read before the title (PG-06).
              <Chrome step="note" tone="accent" style={{ fontWeight: "600", paddingLeft: ax ? 0 : 34 }}>
                Next · {range}
              </Chrome>
            ) : null}
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
            {mark === "next" ? (
              orientation !== null ? (
                <Prose step="claim" tone="muted" style={{ paddingLeft: ax ? 0 : 34, marginTop: 4, fontFamily: FONTS.scripture }}>
                  {orientation}
                </Prose>
              ) : null
            ) : (
              <Chrome step="note" tone="muted" style={{ paddingLeft: ax ? 0 : 34 }}>
                {range}
              </Chrome>
            )}
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
