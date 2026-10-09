/**
 * The Original layer: words flowing inline (Blue Letter Bible's horizontal
 * direction, not a vertical interlinear stack), each with its sourced gloss
 * underneath. Tapping a word opens its card.
 *
 * Hebrew: each word's Text sets writingDirection "rtl" (via `Original`) and
 * the row runs row-reverse. The app's global direction is never touched.
 */

import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import type { Script, Token, VerseTokens } from "../data/queries";
import { SPACE, usePalette } from "../design/tokens";
import { Label, Original, Prose } from "./Type";

export function OriginalWords({
  tokens,
  script,
  from,
}: {
  tokens: VerseTokens;
  script: Script;
  /** Verse id the reader is on, carried to the word card and occurrences. */
  from: string;
}) {
  return (
    <View>
      {tokens.title.length > 0 ? (
        <View style={{ marginBottom: SPACE.md }}>
          <Label style={{ marginBottom: SPACE.xs }}>Title</Label>
          <WordRow words={tokens.title} script={script} from={from} />
        </View>
      ) : null}
      <WordRow words={tokens.words} script={script} from={from} />
    </View>
  );
}

function WordRow({ words, script, from }: { words: readonly Token[]; script: Script; from: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.row, { flexDirection: script === "hebrew" ? "row-reverse" : "row" }]}>
      {words.map((word) => (
        <Pressable
          key={`${word.ord}-${word.position}`}
          onPress={() =>
            router.push({ pathname: "/word", params: { ord: String(word.ord), pos: String(word.position), from } })
          }
          style={({ pressed }) => [styles.word, pressed ? { backgroundColor: palette.selection } : null]}
          accessibilityRole="button"
          accessibilityLabel={`${word.translit}${word.gloss === null ? "" : `, ${word.gloss}`}`}
          accessibilityHint="Opens the word card"
          testID={`word-${word.surface}`}
        >
          <Original script={script} style={{ textAlign: "center" }}>
            {word.surface}
            {word.variantMarked ? (
              <Original script="greek" step="meta" tone="muted">
                {" °"}
              </Original>
            ) : null}
          </Original>
          <Prose step="note" tone="muted" style={{ textAlign: "center" }}>
            {word.gloss ?? "—"}
          </Prose>
        </Pressable>
      ))}
    </View>
  );
}

/** Where the per-word glosses come from, named the way the token rows name it. */
export function glossCaption(tokens: VerseTokens): string {
  const sources = [...new Set([...tokens.title, ...tokens.words].map((t) => t.glossSource).filter((s) => s !== null))];
  const named = sources.length === 0 ? "" : ` (${sources.join(", ")})`;
  return `Word-for-word glosses from the STEPBible alignment data${named}. Derived, not composed.`;
}

const styles = StyleSheet.create({
  row: {
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  word: {
    marginHorizontal: SPACE.xs,
    marginBottom: SPACE.sm,
    maxWidth: 260,
    borderRadius: 5,
    paddingHorizontal: SPACE.xs,
  },
});
