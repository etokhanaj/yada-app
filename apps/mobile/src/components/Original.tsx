/**
 * The Original layer: a disclosure under the English, never a separate mode.
 * Words flow inline (Blue Letter Bible's horizontal direction, not a vertical
 * interlinear stack), each carrying its derived gloss underneath.
 *
 * Hebrew gets per-Text writingDirection and a reversed row. The global RTL
 * switch is never touched: the app chrome stays LTR.
 */

import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { Script } from "../data/passages";
import { FONTS, leading, METADATA_LABEL, SPACE, TYPE, usePalette } from "../design/tokens";

interface GlossWord {
  surface: string;
  translit: string;
  gloss: string;
  strongs?: string;
}

interface Anchor {
  x: number;
  y: number;
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
  const [selected, setSelected] = useState<{ word: GlossWord; anchor: Anchor } | null>(null);
  const rtl = script === "hebrew";
  const scriptFont = rtl ? FONTS.hebrew : FONTS.greek;

  return (
    <View>
      <View
        style={[
          styles.wordRow,
          { flexDirection: rtl ? "row-reverse" : "row" },
        ]}
      >
        {gloss.map((word, index) => (
          <Pressable
            key={`${word.surface}-${index}`}
            onPress={(event) => {
              const { pageX, pageY } = event.nativeEvent;
              setSelected({ word, anchor: { x: pageX, y: pageY } });
            }}
            style={styles.word}
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
        onDismiss={() => setSelected(null)}
        scriptFont={scriptFont}
        rtl={rtl}
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
  onDismiss,
  scriptFont,
  rtl,
  occurrences,
}: {
  selection: { word: GlossWord; anchor: Anchor } | null;
  onDismiss: () => void;
  scriptFont: string;
  rtl: boolean;
  occurrences: (surface: string) => number;
}) {
  const palette = usePalette();
  if (selection === null) return null;
  const { word, anchor } = selection;
  const top = Math.max(80, Math.min(anchor.y + 24, 560));

  return (
    <Modal transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <View
          style={[
            styles.card,
            { top, backgroundColor: palette.paper, borderColor: palette.divider },
          ]}
        >
          <Text
            style={{
              fontFamily: scriptFont,
              fontSize: TYPE.original.size + 4,
              lineHeight: leading(TYPE.original.size + 4, TYPE.original.ratio),
              color: palette.ink,
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {word.surface}
          </Text>
          <Text style={{ fontSize: TYPE.claim.size, color: palette.ink, marginTop: SPACE.xs }}>
            {word.translit} · {word.gloss}
          </Text>
          {word.strongs !== undefined ? (
            <Text style={[METADATA_LABEL, { color: palette.mutedInk, marginTop: SPACE.sm }]}>
              {word.strongs}
            </Text>
          ) : null}
          <Text style={{ fontSize: TYPE.meta.size, color: palette.mutedInk, marginTop: SPACE.sm }}>
            {occurrences(word.surface)} occurrence(s) in this verse
          </Text>
        </View>
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
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  card: {
    position: "absolute",
    left: SPACE.lg,
    right: SPACE.lg,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACE.md,
  },
});
