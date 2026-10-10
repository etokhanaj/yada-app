/**
 * A typographic cover (brief §8.14, canvas DP-01–DP-03): the passage's word
 * large in its own script, its transliteration and gloss, then the passage
 * title — the text as the image (Tolan, Fable, Apple Books chapter openers).
 * No illustration, gradient or watermark copy of the word: a ghosted word
 * behind was tried on the canvas and muddied the text.
 *
 * With no word, the passage title takes the large slot in Literata.
 * At AX sizes everything stacks and wraps; the word drops to headword size.
 */

import type { ReactNode } from "react";
import { View } from "react-native";

import type { PassageCover } from "../data/understand";
import { FONTS, useLayout } from "../design/tokens";
import { Chrome, Original } from "./Type";
import { displayGloss } from "../lib/glosses";
import { DivineText } from "./Verse";

export function Cover({ cover, label, after, footer = true }: { cover: PassageCover; label?: ReactNode; after?: string; footer?: boolean }) {
  const { ax } = useLayout();
  const { word } = cover;
  return (
    <View>
      {label}
      {word !== null ? (
        <>
          <Original
            script={cover.script}
            // 58 pt at default; at AX sizes the headword token (canvas .ax5 .cw), which Dynamic Type grows.
            style={ax ? { fontSize: 40, lineHeight: 50 } : { fontSize: 58, lineHeight: cover.script === "hebrew" ? 84 : 66, letterSpacing: -0.5 }}
            maxFontSizeMultiplier={ax ? 1.45 : 1}
          >
            {word.surface}
          </Original>
          <Chrome step="note" tone="muted" style={{ fontSize: 16, lineHeight: 22 }} maxFontSizeMultiplier={3.1}>
            {word.translit}
            {word.gloss === null ? "" : ` · “${displayGloss(word.gloss)}”`}
            {after === undefined ? "" : ` · ${after}`}
          </Chrome>
          {footer ? (
            <Chrome tone="ink" style={{ fontFamily: FONTS.scripture, fontSize: 20, lineHeight: 26, marginTop: 10 }} maxFontSizeMultiplier={2.2}>
              <DivineText text={cover.title} /> · {cover.range}
            </Chrome>
          ) : null}
        </>
      ) : (
        <Chrome
          tone="ink"
          style={{ fontFamily: FONTS.scripture, fontSize: 30, lineHeight: 36, fontWeight: "600", letterSpacing: -0.4, marginTop: 6 }}
          maxFontSizeMultiplier={2}
        >
          <DivineText text={cover.title} />
        </Chrome>
      )}
    </View>
  );
}

/** One VoiceOver phrase for a cover: word, transliteration, gloss and title, each once. */
export function coverLabel(cover: PassageCover): string {
  const w = cover.word;
  return w === null ? cover.title : `${w.surface}, ${w.translit}${w.gloss === null ? "" : `, ${displayGloss(w.gloss)}`}. ${cover.title}, ${cover.range}`;
}
