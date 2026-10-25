/**
 * Verses for a moment (Build 11h; VM-01 to VM-04, VM-08 to VM-11). The six moments and their passages are John's,
 * approved on 22 Oct 2026 in the review queue (packages/pipeline/prototypes/data/moments.json on claude/build-11-data,
 * PR #17: status "approved", each candidate kept or dropped), in the order he approved them. The references came from OpenBible.info's topic
 * scores (CC BY 4.0); the words are always the BSB's, whatever the reader reads (rule 9). No score, rank or count is
 * shown (John, 18 Oct 2026).
 */

import { BOOK_CODES, ordToParts } from "@yada/schema";

export interface MomentPassage {
  readonly start: number;
  readonly end: number;
}

export interface Moment {
  readonly name: string;
  readonly passages: readonly MomentPassage[];
  /** The helpline line beneath (docs/research/moments-topics.md): Anxious, Afraid, Grieving and Lonely only. */
  readonly support: boolean;
  /** The day picture the mood keeps on its tile (Build 12 decision 3, John 24 Oct 2026). */
  readonly picture: number;
}

const p = (start: number, end = start): MomentPassage => ({ start, end });

export const MOMENTS: readonly Moment[] = [
  { name: "Anxious", support: true, picture: 14, passages: [p(50004006, 50004007), p(60005007), p(20012025), p(40006025, 40006034), p(43014027), p(19055022), p(19094019), p(23041010)] },
  { name: "Afraid", support: true, picture: 7, passages: [p(23041010), p(55001007), p(19034004), p(6001009), p(19023001, 19023006), p(19056003, 19056004), p(20029025)] },
  { name: "Grieving", support: true, picture: 13, passages: [p(40005004), p(19147003), p(66021004), p(19034018), p(60005007), p(40011028, 40011030)] },
  { name: "Lonely", support: true, picture: 24, passages: [p(19027010), p(23041010), p(5031006), p(19023004), p(40028020), p(60005007)] },
  { name: "Tired", support: false, picture: 10, passages: [p(40011028, 40011030), p(23040031), p(48006009, 48006010), p(24031025)] },
  { name: "Thankful", support: false, picture: 16, passages: [p(49005020), p(52005018), p(51003017), p(19103002), p(19106001), p(50004006), p(19100004)] },
];

export function momentNamed(name: string): Moment | undefined {
  return MOMENTS.find((m) => m.name === name);
}

/** "Philippians 4:6–7", "Psalm 23:1–6": the book's own name, Psalms one at a time. */
export function passageLabel({ start, end }: MomentPassage): string {
  const a = ordToParts(start);
  const b = ordToParts(end);
  const book = a.book === "PSA" ? "Psalm" : BOOK_CODES[a.book].name;
  if (start === end) return `${book} ${a.chapter}:${a.verse}`;
  return a.chapter === b.chapter ? `${book} ${a.chapter}:${a.verse}–${b.verse}` : `${book} ${a.chapter}:${a.verse}–${b.chapter}:${b.verse}`;
}

/** A passage's opening, `words` long with an ellipsis when it runs on; the whole passage opens in the reader (VM-04). */
export function opening(text: string, words: number): string {
  const all = text.trim().split(/\s+/);
  return all.length <= words ? text.trim() : `${all.slice(0, words).join(" ").replace(/[,;:.—–-]+$/, "")}…`;
}

const COUNT = ["none", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** VM-09: "That’s all five for Anxious." under the last passage. */
export function lastLine(moment: Moment): string {
  const n = moment.passages.length;
  return `That’s all ${COUNT[n] ?? String(n)} for ${moment.name}.`;
}
