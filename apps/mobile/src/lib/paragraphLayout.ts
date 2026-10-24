/**
 * The reader in paragraphs (RU-6, fresh-eyes review, approved by John 23 Oct 2026): which verses share a paragraph,
 * and where each verse sits inside its paragraph's text, so a tap, a selection, VoiceOver and a jump to a verse still
 * work verse by verse once verses flow together. Pure, so it can be tested.
 *
 * A paragraph's text is one React Native Text: per verse its prefix (number and marks), its words, its suffix (the
 * Readers differ mark), and one space between verses. An inline view counts as one character (U+FFFC), as iOS lays
 * it out, so the line lengths onTextLayout reports add up to these offsets.
 */

/** Where a paragraph breaks besides the BSB's own starts: a passage title, a verse this version leaves out. */
export function groupParagraphs<V extends { readonly ord: number; readonly verse: number; readonly through?: number }>(
  verses: readonly V[],
  startsHere: (verse: V, before: V | undefined) => boolean,
): V[][] {
  const out: V[][] = [];
  verses.forEach((v, i) => {
    const before = i === 0 ? undefined : verses[i - 1];
    const last = out[out.length - 1];
    if (last === undefined || startsHere(v, before)) out.push([v]);
    else last.push(v);
  });
  return out;
}

/** One verse's share of its paragraph's text. */
export interface RunLength {
  readonly verse: number;
  /** The number, its bookmark and note marks, and the space before the words. */
  readonly prefix: number;
  readonly body: number;
  /** The Readers differ mark after the words. */
  readonly suffix: number;
}

/** A verse's characters [start, end) in the paragraph's text, and where its words begin. */
export interface RunSpan {
  readonly verse: number;
  readonly start: number;
  readonly bodyStart: number;
  readonly end: number;
}

/** Offsets of each run; runs are joined by one space, outside any verse's span. */
export function runSpans(runs: readonly RunLength[]): RunSpan[] {
  let at = 0;
  return runs.map((r, i) => {
    const start = at + (i === 0 ? 0 : 1);
    at = start + r.prefix + r.body + r.suffix;
    return { verse: r.verse, start, bodyStart: start + r.prefix, end: at };
  });
}

export function textLength(runs: readonly RunLength[]): number {
  const spans = runSpans(runs);
  return spans[spans.length - 1]?.end ?? 0;
}

/**
 * The chapter numeral sits beside the paragraph's first two lines, so its text is drawn in two Texts cut at `at`.
 * Per run: how many of its words' characters go before the cut, and whether its prefix and suffix do. A run's
 * prefix or suffix is never cut (the inline marks are joined to their words); one the cut falls inside goes after.
 */
export interface RunCut {
  readonly verse: number;
  /** The space joining this run to the one before it. */
  readonly joinBefore: boolean;
  readonly prefixBefore: boolean;
  /** Characters of the words before the cut: 0 to body. */
  readonly bodyBefore: number;
  readonly suffixBefore: boolean;
}

export function cutRuns(runs: readonly RunLength[], at: number): RunCut[] {
  return runSpans(runs).map((s, i) => {
    const r = runs[i] as RunLength;
    return {
      verse: s.verse,
      joinBefore: i > 0 && s.start <= at,
      prefixBefore: s.bodyStart <= at,
      bodyBefore: s.bodyStart > at ? 0 : Math.min(r.body, at - s.bodyStart),
      suffixBefore: s.end <= at,
    };
  });
}

export interface LaidLine {
  readonly text: string;
  readonly y: number;
  readonly height: number;
}

/** One drawn block of the paragraph: its lines, the offset of its first character, and its top in the paragraph. */
export interface LaidBlock {
  readonly lines: readonly LaidLine[];
  readonly offset: number;
  readonly top: number;
}

export interface VerseRect {
  readonly top: number;
  readonly bottom: number;
}

/**
 * Each verse's top and bottom in the paragraph, from the lines its characters fall on. A verse sharing a line with
 * the next shares that line's height: VoiceOver's frames overlap there, which it allows.
 */
export function verseRects(spans: readonly RunSpan[], blocks: readonly LaidBlock[]): Map<number, VerseRect> {
  const out = new Map<number, VerseRect>();
  for (const block of blocks) {
    let at = block.offset;
    for (const line of block.lines) {
      const start = at;
      const end = at + line.text.length;
      at = end;
      for (const s of spans) {
        if (s.start >= end || s.end <= start) continue;
        const top = block.top + line.y;
        const bottom = top + line.height;
        const was = out.get(s.verse);
        out.set(s.verse, was === undefined ? { top, bottom } : { top: Math.min(was.top, top), bottom: Math.max(was.bottom, bottom) });
      }
    }
  }
  return out;
}
