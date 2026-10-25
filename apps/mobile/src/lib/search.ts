/**
 * SE-32 Nothing found: "Did you mean anxious?" offers the nearest word the Bible's text itself uses, from the full-text
 * index's own vocabulary (data/queries.ts nearestTerm), never a dictionary of English, so the word it offers always
 * finds verses. When that word, or the one typed, is one of For when you're moods, its picture tile follows.
 */

import { type Moment, MOMENTS } from "./moments";

/**
 * Edit distance with a swap of two neighbouring letters counted as one edit ("anxoius" is one slip from "anxious"),
 * stopping once every path is past `max`.
 */
export function editDistance(a: string, b: string, max = Number.POSITIVE_INFINITY): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2]! + 1);
      row.push(d);
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length]!;
}

/** One slip in a short word, two in a longer one: more would offer words that only share letters. */
export function allowedEdits(word: string): number {
  return word.length <= 4 ? 1 : 2;
}

/**
 * The index word nearest `word`, or null when none is within `allowedEdits`, with the typed word's opening capital.
 * Ties go to the word the Bible uses more often, then to the alphabet, so the same slip always offers the same word.
 */
export function nearestWord(word: string, vocabulary: ReadonlyArray<{ term: string; count: number }>): string | null {
  const typed = word.trim().toLowerCase();
  if (typed.length < 3) return null;
  const max = allowedEdits(typed);
  let best: { term: string; count: number; d: number } | null = null;
  for (const v of vocabulary) {
    if (v.term === typed) return null;
    const d = editDistance(typed, v.term, max);
    if (d > max) continue;
    if (best === null || d < best.d || (d === best.d && (v.count > best.count || (v.count === best.count && v.term < best.term)))) {
      best = { term: v.term, count: v.count, d };
    }
  }
  if (best === null) return null;
  // "Melchizedekk" is offered "Melchizedek": the index holds its words in lower case, the reader typed a capital.
  const first = word.trim()[0] ?? "";
  return first !== first.toLowerCase() ? best.term[0]!.toUpperCase() + best.term.slice(1) : best.term;
}

/** The mood a word names ("anxious" → Anxious), for SE-32's picture tile. */
export function moodFor(word: string | null): Moment | undefined {
  if (word === null) return undefined;
  const w = word.trim().toLowerCase();
  return MOMENTS.find((m) => m.name.toLowerCase() === w);
}
