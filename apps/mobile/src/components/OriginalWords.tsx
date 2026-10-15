/**
 * The interlinear (canvas J01-06, GN-03): each word over its sourced gloss,
 * flowing in reading direction (Blue Letter Bible's horizontal flow, not a
 * vertical stack). Tapping a word opens its card.
 *
 * Hebrew flows from the right edge and wraps right to left: each word's Text
 * sets writingDirection "rtl" and the row runs row-reverse. The page around
 * it stays LTR; the app's global direction is never touched (brief §5).
 *
 * From AX3, one word per row, original and gloss side by side; a gloss that
 * does not fit wraps beneath its word rather than breaking it (v2-review U5).
 * The chosen word is marked as everything chosen is: the selection tint, gloss
 * in ink, semibold (S10).
 */

import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import type { Script, Token, VerseTokens } from "../data/queries";
import { displayGloss } from "../lib/glosses";
import { useReduceMotion } from "../lib/motion";
import { useAXLevel, usePalette } from "../design/tokens";
import { Label, Original, Prose } from "./Type";

export function OriginalWords({
  tokens,
  script,
  onWord,
  chosen,
}: {
  tokens: VerseTokens;
  script: Script;
  onWord: (word: Token) => void;
  /** Position of the word whose card is open. */
  chosen?: number;
}) {
  return (
    <View style={{ rowGap: 16 }}>
      {/* A psalm's title is Hebrew verse 0, printed inside English verse 1, so it is shown with it. */}
      {tokens.title.length > 0 ? (
        <View>
          <Label style={{ marginBottom: 6 }}>Title</Label>
          <WordFlow words={tokens.title} script={script} onWord={onWord} chosen={chosen} />
        </View>
      ) : null}
      <WordFlow words={tokens.words} script={script} onWord={onWord} chosen={chosen} />
    </View>
  );
}

function WordFlow({
  words,
  script,
  onWord,
  chosen,
}: {
  words: readonly Token[];
  script: Script;
  onWord: (word: Token) => void;
  chosen?: number;
}) {
  const palette = usePalette();
  const rows = useAXLevel() >= 3;
  const rtl = script === "hebrew";
  const reduceMotion = useReduceMotion();
  /**
   * D-02: glosses arrive in reading order (Hebrew from the right, since the
   * row runs row-reverse), 40 ms apart, a 160 ms fade and 5 pt rise each,
   * once per open. Reduce Motion: they are simply there.
   */
  const reveal = (i: number) => (reduceMotion ? undefined : FadeInDown.delay(i * 40).duration(160).withInitialValues({ transform: [{ translateY: 5 }] }));

  if (rows) {
    return (
      <View>
        {words.map((word, i) => {
          const mark = word.position === chosen;
          return (
            <Pressable
              key={`${word.ord}-${word.position}`}
              onPress={() => {
                // The same light tick as the flowing layout below: the AX3+ rows had none (review §4).
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onWord(word);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${word.translit}${word.gloss === null ? "" : `, ${displayGloss(word.gloss)}`}`}
              accessibilityHint="Opens the word"
              accessibilityState={{ selected: mark }}
              testID={`word-${word.surface}`}
              style={({ pressed }) => [
                styles.wordRow,
                // Hebrew keeps its column at the trailing edge, wrapped or not.
                { flexDirection: rtl ? "row-reverse" : "row" },
                i > 0 ? { boxShadow: `0 -1px 0 ${palette.divider}` } : null,
                mark ? { backgroundColor: palette.selection, borderRadius: 10, paddingHorizontal: 8 } : null,
                pressed ? { backgroundColor: palette.fill } : null,
              ]}
            >
              <Original script={script}>{word.surface}</Original>
              <Prose step="note" tone={mark ? "ink" : "muted"} style={mark ? { fontWeight: "600" } : null}>
                {word.gloss === null ? "—" : displayGloss(word.gloss)}
              </Prose>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.flow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
      {words.map((word, i) => {
        const mark = word.position === chosen;
        return (
          <Pressable
            key={`${word.ord}-${word.position}`}
            onPress={() => {
              // D-01, the Reduce Motion form everywhere: a light tick as the card rises (the
              // matched flight into the headword cannot cross two native sheets).
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onWord(word);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${word.translit}${word.gloss === null ? "" : `, ${displayGloss(word.gloss)}`}`}
            accessibilityHint="Opens the word"
            accessibilityState={{ selected: mark }}
            testID={`word-${word.surface}`}
            style={({ pressed }) => [
              styles.word,
              pressed && !reduceMotion ? { transform: [{ scale: 0.96 }] } : null,
              mark ? { backgroundColor: palette.selection } : null,
              pressed ? { backgroundColor: palette.fill } : null,
            ]}
          >
            <Original script={script} style={{ textAlign: "center", lineHeight: rtl ? undefined : 31 }}>
              {word.surface}
              {word.variantMarked ? (
                <Original script="greek" step="note" tone="muted">
                  {" °"}
                </Original>
              ) : null}
            </Original>
            <Animated.View entering={reveal(i)}>
              <Prose step="note" tone={mark ? "ink" : "muted"} style={[{ textAlign: "center" }, mark ? { fontWeight: "600" } : null]}>
                {word.gloss === null ? "—" : displayGloss(word.gloss)}
              </Prose>
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Glosses: STEPBible (TAGNT, TBESG)": where the per-word glosses come from (J01-06). */
export function glossCaption(tokens: VerseTokens): string {
  const sources = [...new Set([...tokens.title, ...tokens.words].map((t) => t.glossSource).filter((s) => s !== null))];
  return `Glosses: STEPBible${sources.length === 0 ? "" : ` (${sources.join(", ")})`}`;
}

const styles = StyleSheet.create({
  flow: {
    flexWrap: "wrap",
    alignItems: "flex-start",
    rowGap: 16,
    columnGap: 10,
  },
  word: {
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
    maxWidth: 260,
    minHeight: 44,
  },
  wordRow: {
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "baseline",
    columnGap: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
});
