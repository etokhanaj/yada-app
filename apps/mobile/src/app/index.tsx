/**
 * The spike screen: reader → verse selected → Understand → back to reading,
 * for all three test passages through one component set.
 *
 * The reader stays mounted underneath the Understand sheet, which is the design
 * brief's "looking underneath the verse" made literal — and it means reading
 * position is preserved structurally rather than restored by scroll maths.
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Understand } from "../components/Understand";
import {
  PASSAGES,
  chapterLabel,
  chapterTranslation,
  chapterVerses,
  focalVerseNumber,
  type Verse,
} from "../data/passages";
import { leading, METADATA_LABEL, SPACE, TYPE, usePalette } from "../design/tokens";

export default function ReaderScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Verse>>(null);

  const [passageIndex, setPassageIndex] = useState(0);
  const [understandOpen, setUnderstandOpen] = useState(false);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [originalSeed, setOriginalSeed] = useState(false);

  const passage = PASSAGES[passageIndex]!;
  const verses = useMemo(() => chapterVerses(passage.chapterKey), [passage.chapterKey]);

  /**
   * Deep-link driven state, for the screenshot matrix:
   *   yada:///?passage=2&understand=1&original=1
   * Every rubric frame is reproducible from a URL rather than a tap sequence,
   * so the Dynamic Type matrix can be recaptured identically after any change.
   */
  const params = useLocalSearchParams<{
    passage?: string;
    understand?: string;
    original?: string;
  }>();

  useEffect(() => {
    const index = Number(params.passage);
    if (Number.isInteger(index) && index >= 0 && index < PASSAGES.length) {
      setPassageIndex(index);
      const target = PASSAGES[index];
      if (target !== undefined) {
        setAnchor(focalVerseNumber(target));
        setRangeEnd(null);
      }
    }
    if (params.understand !== undefined) setUnderstandOpen(params.understand === "1");
    if (params.original !== undefined) setOriginalSeed(params.original === "1");
  }, [params.passage, params.understand, params.original]);

  /** Keep the focal verse on screen when a deep link changes the passage. */
  useEffect(() => {
    const focalIndex = verses.findIndex((verse) => verse.number === focalVerseNumber(passage));
    if (focalIndex < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: focalIndex, viewPosition: 0.35, animated: false });
    }, 120);
    return () => clearTimeout(timer);
  }, [passage, verses]);

  const selection = useMemo(() => {
    if (anchor === null) return null;
    const end = rangeEnd ?? anchor;
    return { start: Math.min(anchor, end), end: Math.max(anchor, end) };
  }, [anchor, rangeEnd]);

  const isSelected = (verseNumber: number): boolean =>
    selection !== null && verseNumber >= selection.start && verseNumber <= selection.end;

  const selectionLabel =
    selection === null
      ? ""
      : selection.start === selection.end
        ? `${chapterLabel(passage.chapterKey)}:${selection.start}`
        : `${chapterLabel(passage.chapterKey)}:${selection.start}–${selection.end}`;

  /** Tap selects. Tapping again with a selection open extends the range —
   *  selection never requires pixel-precise dragging. */
  function onVersePress(verseNumber: number): void {
    if (anchor === null || (rangeEnd !== null && anchor !== null)) {
      setAnchor(verseNumber);
      setRangeEnd(null);
      return;
    }
    if (verseNumber === anchor) {
      setAnchor(null);
      setRangeEnd(null);
      return;
    }
    setRangeEnd(verseNumber);
  }

  function cyclePassage(): void {
    setPassageIndex((index) => (index + 1) % PASSAGES.length);
    setAnchor(null);
    setRangeEnd(null);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  const focal = focalVerseNumber(passage);
  const focalText = verses.find((verse) => verse.number === focal)?.text ?? "";

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper, paddingTop: insets.top }}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Text style={[METADATA_LABEL, { color: palette.mutedInk }]}>
          {chapterLabel(passage.chapterKey)} · {chapterTranslation(passage.chapterKey)}
        </Text>
        <View style={{ flexDirection: "row", gap: SPACE.md }}>
          <Pressable onPress={() => router.push("/probe")} accessibilityRole="button">
            <Text style={{ color: palette.mutedInk, fontSize: TYPE.meta.size }}>Probe</Text>
          </Pressable>
          <Pressable onPress={cyclePassage} accessibilityRole="button">
            <Text style={{ color: palette.accent, fontSize: TYPE.meta.size }}>Next passage ›</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={verses}
        keyExtractor={(verse) => String(verse.number)}
        contentContainerStyle={styles.readerBody}
        onScrollToIndexFailed={({ index }) => {
          // Verse rows are variable height, so an unmeasured target can fail.
          listRef.current?.scrollToOffset({ offset: index * 120, animated: false });
        }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onVersePress(item.number)}
            onLongPress={() => onVersePress(item.number)}
            style={{
              backgroundColor: isSelected(item.number) ? palette.selection : "transparent",
              borderRadius: 4,
              paddingHorizontal: SPACE.xs,
            }}
          >
            <Text
              style={{
                fontFamily: "Literata",
                fontSize: TYPE.scripture.size,
                lineHeight: leading(TYPE.scripture.size, TYPE.scripture.ratio),
                color: palette.ink,
                marginBottom: SPACE.sm,
              }}
            >
              <Text style={{ fontSize: TYPE.meta.size, color: palette.mutedInk }}>
                {item.number}{"  "}
              </Text>
              {item.text}
            </Text>
          </Pressable>
        )}
      />

      {selection !== null ? (
        <View
          style={[
            styles.actionRow,
            {
              borderTopColor: palette.divider,
              backgroundColor: palette.paper,
              paddingBottom: insets.bottom + SPACE.sm,
            },
          ]}
        >
          <Pressable
            onPress={() => setUnderstandOpen(true)}
            style={[styles.primaryAction, { backgroundColor: palette.accent }]}
            accessibilityRole="button"
          >
            <Text style={{ color: palette.paper, fontSize: TYPE.claim.size }}>
              Understand {selectionLabel} →
            </Text>
          </Pressable>
          <Text style={{ color: palette.mutedInk, fontSize: TYPE.meta.size }}>
            Original · Compare · ⋯
          </Text>
        </View>
      ) : null}

      <Modal
        visible={understandOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setUnderstandOpen(false)}
      >
        <Understand
          key={`${passage.verseId}-${String(originalSeed)}`}
          entry={passage.entry}
          reference={passage.reference}
          verseText={focalText}
          script={passage.script}
          readingLabel={selectionLabel}
          initialOriginalOpen={originalSeed}
          onBackToReading={() => setUnderstandOpen(false)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  readerBody: {
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.xl * 3,
  },
  actionRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryAction: {
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: 6,
  },
});
