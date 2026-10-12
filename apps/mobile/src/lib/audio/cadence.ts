/**
 * Reading cadence: where a verse's spoken form is cut into utterances, how long the voice rests
 * after each, and how long it rests before a verse. Measured and argued in
 * docs/research/speech-cadence.md.
 *
 * Why utterances and not SSML <break>: with AVSpeechUtterance(ssmlRepresentation:) the word
 * ranges index the SSML markup, not the plain speech string, and an IPA attribute shifts them
 * too (probe, 11 Oct 2026). Separate utterances with delays are Apple's documented way to add
 * pauses (AVSpeechUtterance overview), and each one's ranges are plain offsets we can add to.
 *
 * Why these boundaries: the voice rests about 0.2 s at every comma, colon and full stop alike,
 * and not at all after a full stop inside closing quotes (`me.’”`), nor between verses, which
 * were spoken back to back. Readers aloud pause about 0.73 s at a full stop and 0.65 s at a
 * clause boundary, but only at under half of commas (Hunt, BYU 2023), so commas keep the
 * voice's own short rest and are never cut, except before a quotation.
 *
 * All seconds are at 1×; pauseFor divides them by the speed, so 1.5× is brisker throughout.
 */

export type Boundary = "sentence" | "clause" | "quote";

/** The rest after a cut inside a verse. A cut ends the utterance, so this replaces the voice's own 0.2 s. */
export const PAUSE: Readonly<Record<Boundary, number>> = {
  sentence: 0.55,
  clause: 0.35,
  // `saying, “This…`: a reader takes a breath before quoted speech, and after it before `he said`.
  quote: 0.3,
};

/** The rest before a verse, by how the one before it ended, or what it opens. */
export const LEAD = {
  /** The verse before ended a sentence. A verse is a unit, so a shade more than a sentence inside one. */
  sentence: 0.6,
  clause: 0.35,
  comma: 0.25,
  /** A verse that breaks mid-sentence runs on, with no more than a word gap. */
  none: 0.08,
  /** The first verse of a passage, as a reader rests at a paragraph (0.4–1.8 s, Kazlauskienė & Kalašinskaitė 2020). */
  passage: 1.2,
  /** On into the next chapter. */
  chapter: 1.5,
} as const;

/** One utterance: [start, end) of the spoken form, and the rest after it at 1×. */
export interface Phrase {
  readonly start: number;
  readonly end: number;
  readonly pause: number;
}

/** Closing quotes and brackets, which belong to the punctuation before them. */
const CLOSERS = String.raw`[”’"')\]]`;

const CUT = new RegExp(String.raw`([.?!]${CLOSERS}*)(?=\s+\S)|([;:]${CLOSERS}*)(?=\s+\S)|(,)(?=\s+[“‘"])`, "g");

/**
 * The spoken form cut into phrases, from offset `from` (resuming mid-verse). Each cut keeps
 * its white space on the left, so every phrase but the first starts on a word, and the
 * phrases tile [from, text.length) exactly: an offset inside phrase p is p.start plus the
 * synthesizer's own range location.
 */
export function phrasesOf(text: string, from = 0): Phrase[] {
  const cuts: Array<{ at: number; pause: number }> = [];
  for (const m of text.matchAll(CUT)) {
    let at = m.index + m[0].length;
    while (at < text.length && /\s/.test(text.charAt(at))) at++;
    // `“Enough!” declared Israel.`: a quotation's ! or ? followed by a lower-case word is a
    // speaker tag, the same sentence going on, so it rests as before a quotation, not a full stop.
    const tag = m[1] !== undefined && /\p{Ll}/u.test(text.charAt(at));
    const kind: Boundary = m[1] !== undefined && !tag ? "sentence" : m[2] !== undefined ? "clause" : "quote";
    cuts.push({ at, pause: PAUSE[kind] });
  }
  const out: Phrase[] = [];
  let start = from;
  for (const c of cuts) {
    if (c.at <= start) continue;
    out.push({ start, end: c.at, pause: c.pause });
    start = c.at;
  }
  if (start < text.length || out.length === 0) out.push({ start, end: text.length, pause: 0 });
  return out;
}

/** How a verse's spoken form ends, for the rest before the next one. */
export function endingOf(text: string): keyof Pick<typeof LEAD, "sentence" | "clause" | "comma" | "none"> {
  const tail = text.trimEnd().replace(new RegExp(`${CLOSERS}+$`), "");
  const last = tail.charAt(tail.length - 1);
  if (".?!".includes(last) && last !== "") return "sentence";
  if (last === ";" || last === ":") return "clause";
  // A dash at a verse's end (BSB, LSV) is a break in thought, read like a comma.
  if (last === "," || last === "—") return "comma";
  return "none";
}

export type VerseOpening = "start" | "verse" | "passage" | "chapter";

/**
 * The rest before a verse. "start": the reader pressed Listen, Play, a line or next, so it
 * answers at once. "verse": carried on from `previous`.
 */
export function leadFor(opening: VerseOpening, previous: string | null): number {
  if (opening === "start") return 0;
  if (opening === "passage") return LEAD.passage;
  if (opening === "chapter") return LEAD.chapter;
  return previous === null ? 0 : LEAD[endingOf(previous)];
}

/** A rest at `speed`: 0.8× rests longer, 1.5× shorter, in proportion. */
export function pauseFor(seconds: number, speed: number): number {
  return Math.round((seconds / speed) * 1000) / 1000;
}
