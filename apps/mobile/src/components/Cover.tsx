/**
 * A typographic cover, English-led (brief §8.14, canvas DP-01 / DP-03 as
 * redrawn 10 Oct): the passage title leads in large Literata semibold; beneath
 * it one line with the passage's key word at reading size in its own script,
 * then transliteration, gloss and range in mutedInk. John chose English to
 * lead because a Greek word set at 58 pt read as a wall to anyone who does not
 * read Greek; the word stays as the hint of what is underneath.
 *
 * No illustration, gradient or watermark copy of the word: a ghosted word
 * behind was tried on the canvas and muddied the text. With no entry for the
 * passage, the title stands alone (DP-02).
 */

import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import type { PassageCover } from "../data/understand";
import { FONTS } from "../design/tokens";
import { Chrome, Original, Prose } from "./Type";
import { displayGloss } from "../lib/glosses";
import { DivineText } from "./Verse";

export function Cover({ cover, label }: { cover: PassageCover; label?: ReactNode }) {
  return (
    <View>
      {label}
      <Chrome tone="ink" style={styles.title} maxFontSizeMultiplier={2}>
        <DivineText text={cover.title} />
      </Chrome>
      <CoverWordLine cover={cover} />
    </View>
  );
}

/**
 * The key word, then `logos · “word” · 1:1–18`. `after` replaces the range
 * (Start here ends it with the passage count instead, DP-03). Nothing when the
 * passage has no entry: never a word the source data does not hold (rule 4).
 *
 * Two Texts in a wrapping row, not one Text with a nested span: RN applies
 * `accessibilityLanguage` per Text view only (see Type.tsx rule 4), so the word
 * needs its own view for VoiceOver to read it in Greek or Hebrew. At AX sizes
 * the muted half drops whole beneath the word and wraps there; nothing is cut.
 */
export function CoverWordLine({ cover, after }: { cover: PassageCover; after?: string }) {
  const { word } = cover;
  if (word === null) return null;
  return (
    <View style={styles.line}>
      <Original
        script={cover.script}
        // Reading size (the interlinear's 24 pt), fixed like the rest of the cover; it grows
        // with Dynamic Type to the original token's AX5 size (60 pt). Hebrew's points need more leading.
        style={{ fontSize: 24, lineHeight: cover.script === "hebrew" ? 36 : 30 }}
        maxFontSizeMultiplier={2.5}
      >
        {word.surface}
      </Original>
      <Prose step="claim" tone="muted" style={styles.rest}>
        {word.translit}
        {word.gloss === null ? "" : ` · “${displayGloss(word.gloss)}”`}
        {` · ${after ?? cover.range}`}
      </Prose>
    </View>
  );
}

/** One VoiceOver phrase for a cover: title first, as it reads on screen, then the word, each once. */
export function coverLabel(cover: PassageCover): string {
  const w = cover.word;
  return w === null
    ? cover.title
    : `${cover.title}, ${cover.range}. ${w.surface}, ${w.translit}${w.gloss === null ? "" : `, ${displayGloss(w.gloss)}`}`;
}

const styles = StyleSheet.create({
  title: {
    fontFamily: FONTS.scripture,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "600",
    letterSpacing: -0.4,
    marginTop: 6,
  },
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: 8,
    marginTop: 4,
  },
  rest: {
    flexShrink: 1,
  },
});
