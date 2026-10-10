/**
 * The Literal Standard Version marks words its translators supplied, words
 * with nothing under them in the Hebrew or Greek, in [square brackets]:
 * "In [the] beginning God created". The LSV is CC BY-SA 4.0 and Yada never
 * alters Bible text, so the brackets stay exactly as printed. Only the drawing
 * changes: a supplied span is set in mutedInk (the brackets with it), and
 * VoiceOver reads it without the brackets, as a reader would aloud.
 *
 * Double brackets are something else: [[ … ]] encloses a passage the earliest
 * manuscripts lack (Mark 16:9–20, John 7:53–8:11) and often opens in one verse
 * and closes in another, so they are never treated as supplied words.
 */

import { splitDivineName, type TextSegment } from "./reader";

export interface SuppliedPiece {
  readonly text: string;
  readonly supplied: boolean;
}

/** Only the LSV's brackets mean "supplied"; any other translation is left as one piece. */
const MARKS_SUPPLIED: ReadonlySet<string> = new Set(["LSV"]);

// One bracket, not two, on each side, with no bracket inside.
const SUPPLIED = /(?<!\[)\[([^[\]]+)\](?!\])/g;

export function splitSupplied(text: string): SuppliedPiece[] {
  const out: SuppliedPiece[] = [];
  let last = 0;
  for (const m of text.matchAll(SUPPLIED)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), supplied: false });
    out.push({ text: m[0], supplied: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), supplied: false });
  return out;
}

/** LORD in small capitals everywhere, supplied words muted in the LSV only. */
export function scriptureSegments(text: string, translation: string): TextSegment[] {
  if (!MARKS_SUPPLIED.has(translation)) return splitDivineName(text);
  return splitSupplied(text).flatMap((piece) =>
    splitDivineName(piece.text).map((s) => (piece.supplied ? { ...s, supplied: true } : s)),
  );
}

/**
 * The supplied runs within characters [start, end) of `text`: Compare draws
 * its marked words one at a time, and a bracketed span can cross a word
 * boundary ("[it is]").
 */
export function suppliedSlicer(text: string, translation: string): (start: number, end: number) => SuppliedPiece[] {
  const spans = MARKS_SUPPLIED.has(translation)
    ? [...text.matchAll(SUPPLIED)].map((m) => [m.index, m.index + m[0].length] as const)
    : [];
  return (start, end) => {
    const out: SuppliedPiece[] = [];
    let at = start;
    for (const [a, b] of spans) {
      if (b <= at || a >= end) continue;
      if (a > at) out.push({ text: text.slice(at, a), supplied: false });
      const to = Math.min(b, end);
      out.push({ text: text.slice(Math.max(a, at), to), supplied: true });
      at = to;
    }
    if (at < end) out.push({ text: text.slice(at, end), supplied: false });
    return out;
  };
}

/** What VoiceOver reads: the same words, without the LSV's single brackets. */
export function spokenText(text: string, translation: string): string {
  if (!MARKS_SUPPLIED.has(translation)) return text;
  return text.replace(SUPPLIED, "$1");
}
