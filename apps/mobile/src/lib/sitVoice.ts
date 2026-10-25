/**
 * Where Sit's words sit in their chapter's recording (Build 12: Sit reads in Heart, never the iPhone voice). Sit shows
 * a verse, a short passage, or a verse with a psalm's title taken off its front; this finds the run of verses those
 * words are, and which of each verse's words, so the recording's own timings light them. Pure, so it is tested.
 */

export interface RunPart {
  readonly verse: number;
  /** The verse's first word that Sit shows (past a psalm's title), and how many it shows. */
  readonly first: number;
  readonly count: number;
  /** Where those words start among Sit's own words. */
  readonly sitFirst: number;
}

const same = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((w, i) => w === b[i]);

/**
 * The verses from `from` on whose words are exactly Sit's words, or null when they aren't (another text, a passage
 * running into the next chapter). Only the first verse may start part way in; every verse ends whole.
 */
export function verseRun(sit: readonly string[], verses: ReadonlyArray<{ verse: number; words: readonly string[] }>, from: number): RunPart[] | null {
  const start = verses.findIndex((v) => v.verse === from);
  const head = verses[start];
  if (head === undefined || sit.length === 0) return null;
  for (let skip = 0; skip < head.words.length; skip++) {
    const tail = head.words.slice(skip);
    if (tail.length > sit.length || !same(tail, sit.slice(0, tail.length))) continue;
    const parts: RunPart[] = [{ verse: head.verse, first: skip, count: tail.length, sitFirst: 0 }];
    let at = tail.length;
    for (let i = start + 1; at < sit.length; i++) {
      const v = verses[i];
      if (v === undefined || v.words.length > sit.length - at || !same(v.words, sit.slice(at, at + v.words.length))) return null;
      parts.push({ verse: v.verse, first: 0, count: v.words.length, sitFirst: at });
      at += v.words.length;
    }
    return parts;
  }
  return null;
}
