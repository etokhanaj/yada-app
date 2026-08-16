/**
 * The spike screen: reader → verse selected → Understand → back to reading,
 * for all three test passages through one component set.
 *
 * The reading surface follows the e-reader convention rather than the Bible-app
 * one: chapter identity sits inside the scroll as a quiet centred head, there
 * is no header bar and no bottom navigation, and the only chrome is two muted
 * controls that stay out of the way. The reader stays mounted underneath the
 * Understand sheet, so reading position is preserved structurally rather than
 * restored by scroll maths.
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SelectionPill } from "../components/SelectionPill";
import { Understand } from "../components/Understand";
import {
  PASSAGES,
  chapterLabel,
  chapterTranslation,
  chapterVerses,
  focalVerseNumber,
  type Verse,
} from "../data/passages";
import { leading, SPACE, TYPE, usePalette } from "../design/tokens";

export default function ReaderScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Verse>>(null);

  const [passageIndex, setPassageIndex] = useState(0);
  const [understandOpen, setUnderstandOpen] = useState(false);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [anchorY, setAnchorY] = useState(320);
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

  /** Tap selects. Tapping again extends the range — selection never requires
   *  pixel-precise dragging. Tapping the anchor again clears it. */
  function onVersePress(verseNumber: number, pageY: number): void {
    setAnchorY(pageY);
    if (anchor === null || rangeEnd !== null) {
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
      {/* The only chrome. Deliberately low-contrast: it should disappear while reading. */}
      <View style={styles.chrome}>
        <Pressable onPress={() => router.push("/probe")} accessibilityRole="button" hitSlop={12}>
          <Text style={{ color: palette.mutedInk, fontSize: TYPE.meta.size }}>Probe</Text>
        </Pressable>
        <Pressable onPress={cyclePassage} accessibilityRole="button" hitSlop={12}>
          <Text style={{ color: palette.mutedInk, fontSize: TYPE.meta.size }}>Next passage ›</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={verses}
        keyExtractor={(verse) => String(verse.number)}
        contentContainerStyle={styles.readerBody}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          // Verse rows are variable height, so a far-off target is not yet
          // measured. Estimating a pixel offset is guesswork and lands on the
          // wrong verse; instead get close, let the rows render, then ask for
          // the verse again by index. Back-to-reading must be exact.
          listRef.current?.scrollToOffset({
            offset: index * averageItemLength,
            animated: false,
          });
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index, viewPosition: 0.35, animated: false });
          }, 180);
        }}
        ListHeaderComponent={
          <View style={styles.chapterHead}>
            <Text
              style={{
                fontFamily: "Literata",
                fontSize: TYPE.chapterHead.size,
                letterSpacing: TYPE.chapterHead.tracking,
                lineHeight: leading(TYPE.chapterHead.size, TYPE.chapterHead.ratio),
                color: palette.mutedInk,
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              {chapterLabel(passage.chapterKey)}
            </Text>
            <View style={[styles.rule, { backgroundColor: palette.divider }]} />
          </View>
        }
        ListFooterComponent={
          <Text
            style={{
              fontSize: TYPE.meta.size,
              color: palette.mutedInk,
              textAlign: "center",
              marginTop: SPACE.xl,
            }}
          >
            {chapterTranslation(passage.chapterKey)}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={(event) => onVersePress(item.number, event.nativeEvent.pageY)}
            onLongPress={(event) => onVersePress(item.number, event.nativeEvent.pageY)}
            style={({ pressed }) => [
              styles.verseRow,
              {
                backgroundColor: isSelected(item.number)
                  ? palette.selection
                  : pressed
                    ? palette.selection
                    : "transparent",
              },
            ]}
          >
            <Text
              style={{
                fontFamily: "Literata",
                fontSize: TYPE.scripture.size,
                letterSpacing: TYPE.scripture.tracking,
                lineHeight: leading(TYPE.scripture.size, TYPE.scripture.ratio),
                color: palette.ink,
              }}
            >
              <Text style={{ fontSize: TYPE.meta.size, color: palette.mutedInk }}>
                {item.number}
                {"  "}
              </Text>
              {item.text}
            </Text>
          </Pressable>
        )}
      />

      {selection !== null ? (
        <SelectionPill
          label={selectionLabel}
          anchorY={anchorY}
          onUnderstand={() => setUnderstandOpen(true)}
        />
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
  chrome: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    // At accessibility sizes these two labels grow into each other and the
    // chevron clips off the edge, so they are allowed to wrap and shrink.
    flexWrap: "wrap",
    columnGap: SPACE.md,
    rowGap: SPACE.xs,
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.sm,
  },
  readerBody: {
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.xxl * 2,
  },
  chapterHead: {
    alignItems: "center",
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.xl,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    width: 56,
    marginTop: SPACE.md,
  },
  verseRow: {
    borderRadius: 5,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    marginHorizontal: -SPACE.sm,
    marginBottom: SPACE.sm,
  },
});
