/**
 * Prayers of the Bible (PR-08): prayers in Scripture to pray with, each a passage the reader opens in the BSB.
 *
 * The 39 entries are John's, approved on 18 Oct 2026 (docs/review-2026-10-18-henry-prayers.md, "Prayers of the
 * Bible: all 39 approved"; rule 2: only John approves entries). Titles and passages are copied from that table in its
 * order; only the apostrophe is set typographically, as everywhere else on screen. BSB text only; the reader opens the
 * whole passage because the first verse sometimes only introduces the prayer. Luke 23:34 keeps the BSB footnote that
 * some manuscripts leave the prayer out: the entry opens the BSB verse with its own notes, and nothing here drops
 * them. Add or change entries only from a later review John approves.
 */

import { BOOK_CODES, type BookCode } from "@yada/schema";

export interface BiblePrayer {
  /** "Hannah’s prayer", as John names it. */
  readonly title: string;
  readonly book: BookCode;
  readonly chapter: number;
  readonly from: number;
  /** The last verse, in the same chapter. */
  readonly to: number;
}

export const PRAYERS_OF_THE_BIBLE: readonly BiblePrayer[] = [
  { title: "Abraham pleads for Sodom", book: "GEN", chapter: 18, from: 23, to: 32 },
  { title: "Jacob before meeting Esau", book: "GEN", chapter: 32, from: 9, to: 12 },
  { title: "Moses pleads for Israel", book: "EXO", chapter: 32, from: 11, to: 13 },
  { title: "Hannah’s prayer", book: "1SA", chapter: 2, from: 1, to: 10 },
  { title: "David after God’s promise", book: "2SA", chapter: 7, from: 18, to: 29 },
  { title: "Solomon asks for wisdom", book: "1KI", chapter: 3, from: 6, to: 9 },
  { title: "Solomon dedicates the temple", book: "1KI", chapter: 8, from: 22, to: 53 },
  { title: "Elijah on Mount Carmel", book: "1KI", chapter: 18, from: 36, to: 37 },
  { title: "Hezekiah under siege", book: "2KI", chapter: 19, from: 15, to: 19 },
  { title: "Jabez", book: "1CH", chapter: 4, from: 10, to: 10 },
  { title: "David’s praise before the people", book: "1CH", chapter: 29, from: 10, to: 19 },
  { title: "Jehoshaphat before battle", book: "2CH", chapter: 20, from: 6, to: 12 },
  { title: "Ezra’s confession", book: "EZR", chapter: 9, from: 6, to: 15 },
  { title: "Nehemiah for Jerusalem", book: "NEH", chapter: 1, from: 5, to: 11 },
  { title: "The Levites’ confession", book: "NEH", chapter: 9, from: 5, to: 37 },
  { title: "A prayer of confession", book: "PSA", chapter: 51, from: 1, to: 19 },
  { title: "A prayer of David", book: "PSA", chapter: 86, from: 1, to: 17 },
  { title: "A prayer of Moses", book: "PSA", chapter: 90, from: 1, to: 17 },
  { title: "Search me, O God", book: "PSA", chapter: 139, from: 23, to: 24 },
  { title: "Jeremiah buys the field", book: "JER", chapter: 32, from: 17, to: 25 },
  { title: "Daniel’s confession", book: "DAN", chapter: 9, from: 4, to: 19 },
  { title: "Jonah from the fish", book: "JON", chapter: 2, from: 1, to: 9 },
  { title: "Habakkuk’s prayer", book: "HAB", chapter: 3, from: 1, to: 19 },
  { title: "The Lord’s Prayer", book: "MAT", chapter: 6, from: 9, to: 13 },
  { title: "Jesus in Gethsemane", book: "MAT", chapter: 26, from: 39, to: 39 },
  { title: "Mary’s song", book: "LUK", chapter: 1, from: 46, to: 55 },
  { title: "Simeon", book: "LUK", chapter: 2, from: 29, to: 32 },
  { title: "The tax collector", book: "LUK", chapter: 18, from: 13, to: 13 },
  { title: "Jesus on the cross: forgive them", book: "LUK", chapter: 23, from: 34, to: 34 },
  { title: "Jesus on the cross: into your hands", book: "LUK", chapter: 23, from: 46, to: 46 },
  { title: "Jesus prays for himself and his followers", book: "JHN", chapter: 17, from: 1, to: 26 },
  { title: "The church under threat", book: "ACT", chapter: 4, from: 24, to: 30 },
  { title: "Stephen", book: "ACT", chapter: 7, from: 59, to: 60 },
  { title: "Paul: that you may know him", book: "EPH", chapter: 1, from: 15, to: 23 },
  { title: "Paul: rooted in love", book: "EPH", chapter: 3, from: 14, to: 21 },
  { title: "Paul: that your love may abound", book: "PHP", chapter: 1, from: 9, to: 11 },
  { title: "Paul: filled with the knowledge of his will", book: "COL", chapter: 1, from: 9, to: 12 },
  { title: "The God of peace", book: "HEB", chapter: 13, from: 20, to: 21 },
  { title: "Come, Lord Jesus", book: "REV", chapter: 22, from: 20, to: 20 },
];

/** "Matthew 6:9–13", "1 Samuel 2:1–10": the reference under each title (PR-08). */
export function prayerRef(p: BiblePrayer): string {
  const book = p.book === "PSA" ? "Psalm" : BOOK_CODES[p.book].name;
  return `${book} ${p.chapter}:${p.from}${p.to > p.from ? `–${p.to}` : ""}`;
}
