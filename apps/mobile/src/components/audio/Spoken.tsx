/**
 * The read-along mark drawn into a verse (AU-02, AU-04, AU-05).
 *
 * John's call (11 Oct 2026): the spoken word is a filled ink pill with the word in paper, radius 6,
 * inverted like the primary buttons, so it never reads as the selection wash (whole verse, pale,
 * with a bar). Words already spoken are ink, words still to come mutedInk (Apple Music sing-along,
 * https://mobbin.com/screens/d4df9c1d-7006-4d78-87e2-852058c3ec53).
 *
 * Reduce Motion (AU-05): no pill. The playing verse is set semibold and its spoken words in ink;
 * the mark moves word to word without any fade.
 *
 * A nested Text span cannot take a corner radius on iOS, so the pill is an inline View holding the
 * word, set in the verse's own face and size and lowered onto the line's baseline.
 */

import type { BookCode } from "@yada/schema";
import { Text, View } from "react-native";

import { usePalette } from "../../design/tokens";
import { markPieces, type VerseMark } from "../../lib/audio/text";
import type { TextSegment } from "../../lib/reader";
import { useReduceMotion } from "../../lib/motion";
import { markKey, useAudio } from "../../state/audio";

/** The mark for one verse, re-rendering its row only when that verse's mark changes. */
export function useVerseMark(book: BookCode, chapter: number, translation: string, verse: number): VerseMark | null {
  const key = useAudio((s) => markKey(s, book, chapter, translation, verse));
  if (key === "") return null;
  if (key === "u") return { kind: "upcoming" };
  const [, start, end] = key.split(":");
  return { kind: "current", word: start === undefined ? null : { start: Number(start), end: Number(end) } };
}

export interface SpokenFace {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly letterSpacing: number;
}

/** Drawn segments under a mark. `offset`: the display offset of the first segment. */
export function SpokenSegments({
  segments,
  mark,
  offset = 0,
  face,
}: {
  segments: readonly TextSegment[];
  mark: VerseMark;
  offset?: number;
  face: SpokenFace;
}) {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  return (
    <>
      {markPieces(segments, mark, offset).map((p, i) => {
        const caps = p.smallCaps ? { fontVariant: ["small-caps" as const], letterSpacing: 0.6 } : null;
        const text = p.smallCaps ? p.text.charAt(0) + p.text.slice(1).toLowerCase() : p.text;
        if (p.tone === "pill" && !reduceMotion) {
          return (
            <View key={i} style={{ backgroundColor: palette.ink, borderRadius: 6, paddingHorizontal: 4, marginHorizontal: -1, transform: [{ translateY: Math.round(face.fontSize * 0.15) }] }}>
              <Text
                allowFontScaling={false}
                style={[{ fontFamily: face.fontFamily, fontSize: face.fontSize, lineHeight: Math.round(face.fontSize * 1.22), letterSpacing: face.letterSpacing, color: palette.paper }, caps]}
              >
                {text}
              </Text>
            </View>
          );
        }
        const muted = p.tone === "muted" || p.supplied === true;
        return (
          <Text key={i} style={[{ color: muted ? palette.mutedInk : palette.ink }, caps]}>
            {text}
          </Text>
        );
      })}
    </>
  );
}
