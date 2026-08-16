/**
 * The Original layer: a disclosure under the English, never a separate mode.
 * Words flow inline (Blue Letter Bible's horizontal direction, not a vertical
 * interlinear stack), each carrying its derived gloss underneath.
 *
 * Hebrew gets per-Text writingDirection and a reversed row. The global RTL
 * switch is never touched: the app chrome stays LTR.
 *
 * The word card follows the reader-dictionary convention — tiny tracked label,
 * large headword, then the word shown in its immediate context — but without
 * the bordered panels those apps wrap everything in. Typography carries the
 * hierarchy; containers would make this read as a knowledge product.
 */

import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { Script } from "../data/passages";
import {
  FONTS,
  leading,
  METADATA_LABEL,
  SPACE,
  SPRING,
  TYPE,
  useIsDark,
  usePalette,
} from "../design/tokens";

interface GlossWord {
  surface: string;
  translit: string;
  gloss: string;
  strongs?: string;
}

interface Selection {
  word: GlossWord;
  index: number;
  anchorY: number;
}

export function Original({
  gloss,
  script,
  occurrences,
}: {
  gloss: GlossWord[];
  script: Script;
  occurrences: (surface: string) => number;
}) {
  const palette = usePalette();
  const [selected, setSelected] = useState<Selection | null>(null);
  const rtl = script === "hebrew";
  const scriptFont = rtl ? FONTS.hebrew : FONTS.greek;

  return (
    <View>
      <View style={[styles.wordRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        {gloss.map((word, index) => (
          <Pressable
            key={`${word.surface}-${index}`}
            onPress={(event) =>
              setSelected({ word, index, anchorY: event.nativeEvent.pageY })
            }
            style={({ pressed }) => [
              styles.word,
              pressed ? { backgroundColor: palette.selection } : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${word.translit}, ${word.gloss}`}
          >
            <Text
              style={{
                fontFamily: scriptFont,
                fontSize: TYPE.original.size,
                lineHeight: leading(TYPE.original.size, TYPE.original.ratio),
                color: palette.ink,
                writingDirection: rtl ? "rtl" : "ltr",
                textAlign: "center",
              }}
            >
              {word.surface}
            </Text>
            <Text
              style={{
                fontSize: TYPE.meta.size,
                lineHeight: leading(TYPE.meta.size, TYPE.meta.ratio),
                color: palette.mutedInk,
                textAlign: "center",
              }}
            >
              {word.gloss}
            </Text>
          </Pressable>
        ))}
      </View>

      <WordCard
        selection={selected}
        gloss={gloss}
        onDismiss={() => setSelected(null)}
        scriptFont={scriptFont}
        rtl={rtl}
        script={script}
        occurrences={occurrences}
      />
    </View>
  );
}

/**
 * Kindle/Apple Books pattern: a popover in place, anchored near the word, never
 * a navigation push. Dismissing leaves the reading position untouched.
 */
function WordCard({
  selection,
  gloss,
  onDismiss,
  scriptFont,
  rtl,
  script,
  occurrences,
}: {
  selection: Selection | null;
  gloss: GlossWord[];
  onDismiss: () => void;
  scriptFont: string;
  rtl: boolean;
  script: Script;
  occurrences: (surface: string) => number;
}) {
  const palette = usePalette();
  const isDark = useIsDark();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selection === null) return;
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, ...SPRING.standard, useNativeDriver: true }).start();
  }, [selection, enter]);

  if (selection === null) return null;
  const { word, index, anchorY } = selection;
  const top = Math.max(90, Math.min(anchorY + 28, 520));

  // The word in its immediate context, the way a reader dictionary shows a
  // headword inside its example sentence.
  const context = gloss.slice(Math.max(0, index - 2), Math.min(gloss.length, index + 3));

  return (
    <Modal transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View
          style={[
            styles.card,
            {
              top,
              backgroundColor: palette.paper,
              borderColor: palette.divider,
              shadowOpacity: isDark ? 0.55 : 0.18,
              opacity: enter,
              transform: [
                { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
              ],
            },
          ]}
        >
          <Text style={[METADATA_LABEL, { color: palette.mutedInk }]}>
            {script === "hebrew" ? "Original Hebrew" : "Original Greek"}
          </Text>

          <Text
            style={{
              fontFamily: scriptFont,
              fontSize: TYPE.headword.size,
              letterSpacing: TYPE.headword.tracking,
              lineHeight: leading(TYPE.headword.size, TYPE.headword.ratio),
              color: palette.ink,
              writingDirection: rtl ? "rtl" : "ltr",
              marginTop: SPACE.sm,
            }}
          >
            {word.surface}
          </Text>

          <Text
            style={{
              fontSize: TYPE.claim.size,
              lineHeight: leading(TYPE.claim.size, TYPE.claim.ratio),
              color: palette.ink,
              marginTop: SPACE.xs,
            }}
          >
            {word.translit} · {word.gloss}
          </Text>

          {word.strongs !== undefined ? (
            <Text style={[METADATA_LABEL, { color: palette.mutedInk, marginTop: SPACE.md }]}>
              {word.strongs} · {occurrences(word.surface)} in this verse
            </Text>
          ) : null}

          <View style={[styles.hairline, { backgroundColor: palette.divider }]} />

          <Text style={[METADATA_LABEL, { color: palette.mutedInk }]}>In this verse</Text>
          <Text
            style={{
              fontFamily: scriptFont,
              fontSize: TYPE.original.size - 4,
              lineHeight: leading(TYPE.original.size - 4, 1.6),
              color: palette.mutedInk,
              writingDirection: rtl ? "rtl" : "ltr",
              marginTop: SPACE.xs,
            }}
          >
            {context.map((entry, offset) => {
              const isTarget = Math.max(0, index - 2) + offset === index;
              return (
                <Text
                  key={`${entry.surface}-${offset}`}
                  style={isTarget ? { color: palette.ink, fontWeight: "600" } : null}
                >
                  {entry.surface}{" "}
                </Text>
              );
            })}
          </Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wordRow: {
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  word: {
    marginRight: SPACE.md,
    marginBottom: SPACE.sm,
    maxWidth: 260,
    borderRadius: 5,
    paddingHorizontal: SPACE.xs,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  card: {
    position: "absolute",
    left: SPACE.lg,
    right: SPACE.lg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACE.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 8,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    marginVertical: SPACE.md,
  },
});
