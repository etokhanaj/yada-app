/**
 * What the read-along speaks, and which rendered word each spoken range belongs to (AU-02, AU-04).
 *
 * The verse on screen is never altered (Yada never alters Bible text). The synthesizer is given a
 * spoken form of it, and every character of that form remembers the character of the display text
 * it came from, so a word-boundary range from AVSpeechSynthesizer lands on the word the reader sees.
 *
 * Spoken form, character by character:
 * - LORD and GOD (the BSB's small capitals) are read as "Lord", "God", and any other word in
 *   capitals (the LSV's psalm titles, "A PSALM OF DAVID") as an ordinary word: a synthesizer
 *   spells some capitalised words letter by letter. Same length, so offsets do not move.
 * - The LSV's YHWH is read "Yahweh" rather than spelled out letter by letter.
 * - Marks that are not words are not read: the LSV's [supplied] brackets and its || line
 *   divider, and footnote markers (* † ‡) should a source ever carry them.
 * Numbers ("600,000", "153") are left as printed: AVSpeechSynthesizer reads them as numbers.
 */

export interface WordRange {
  /** Character offsets into the display text, end exclusive. */
  readonly start: number;
  readonly end: number;
}

export interface SpokenText {
  readonly text: string;
  /** source[i] is the display offset of spoken character i. */
  readonly source: readonly number[];
}

/** The words as drawn: maximal runs without white space, punctuation attached ("Word,"). */
export function wordRanges(display: string): WordRange[] {
  const out: WordRange[] = [];
  for (const m of display.matchAll(/\S+/g)) out.push({ start: m.index, end: m.index + m[0].length });
  return out;
}

const SILENT = new Set(["[", "]", "|", "*", "†", "‡"]);

/** Whole words in capitals, two letters or more; LORD’s keeps its apostrophe. */
const CAPITALS = /\b[A-Z][A-Z]+\b/g;

export function spokenFor(display: string): SpokenText {
  // Capitals first, at the same length, so offsets are still the display's.
  const cased = display.replace(CAPITALS, (w) => (w === "YHWH" ? w : w.charAt(0) + w.slice(1).toLowerCase()));
  let text = "";
  const source: number[] = [];
  for (let i = 0; i < cased.length; i++) {
    if (cased.startsWith("YHWH", i) && !/\w/.test(cased.charAt(i - 1)) && !/\w/.test(cased.charAt(i + 4))) {
      // Six spoken characters over four drawn ones, each inside the drawn word.
      [..."Yahweh"].forEach((ch, k) => {
        text += ch;
        source.push(i + Math.min(k, 3));
      });
      i += 3;
      continue;
    }
    const ch = cased.charAt(i);
    if (SILENT.has(ch)) continue;
    text += ch;
    source.push(i);
  }
  return { text, source };
}

/**
 * The index of the drawn word a spoken range starts in. A range that starts on white space
 * (or a silent mark) belongs to the next word. Null past the end.
 */
export function wordAt(words: readonly WordRange[], spoken: SpokenText, location: number): number | null {
  const d = spoken.source[location];
  if (d === undefined) return null;
  const i = words.findIndex((w) => w.end > d);
  return i < 0 ? null : i;
}

/** Where speech resumes from a word (speed change, resume after a cut): its first spoken character. */
export function spokenOffsetOf(spoken: SpokenText, word: WordRange): number {
  const i = spoken.source.findIndex((d) => d >= word.start);
  return i < 0 ? spoken.text.length : i;
}

/** How a drawn piece of the playing verse looks: spoken (ink), the word now (pill), still to come (muted). */
export type SpokenTone = "ink" | "pill" | "muted";

/** The mark on one verse while audio plays. `word` null: the verse has started, no word yet. */
export type VerseMark = { readonly kind: "upcoming" } | { readonly kind: "current"; readonly word: WordRange | null };

/** The tone of display character `i` under `mark`. */
export function toneAt(mark: VerseMark, i: number): SpokenTone {
  if (mark.kind === "upcoming" || mark.word === null) return "muted";
  if (i < mark.word.start) return "ink";
  return i < mark.word.end ? "pill" : "muted";
}

/**
 * Split drawn segments (small capitals, LSV supplied words) wherever the tone changes, so the
 * renderer only has to style each piece. `offset` is the first segment's display offset, for a
 * verse drawn in parts (a psalm title above, verse 1 split beside its chapter numeral).
 */
export function markPieces<S extends { readonly text: string }>(
  segments: readonly S[],
  mark: VerseMark,
  offset = 0,
): Array<S & { readonly tone: SpokenTone }> {
  const cuts =
    mark.kind === "current" && mark.word !== null ? [mark.word.start, mark.word.end] : [];
  const out: Array<S & { readonly tone: SpokenTone }> = [];
  let at = offset;
  for (const s of segments) {
    const end = at + s.text.length;
    const points = [at, ...cuts.filter((c) => c > at && c < end), end];
    for (let k = 0; k < points.length - 1; k++) {
      const a = points[k] ?? at;
      const b = points[k + 1] ?? end;
      if (b > a) out.push({ ...s, text: s.text.slice(a - at, b - at), tone: toneAt(mark, a) });
    }
    at = end;
  }
  return out;
}
