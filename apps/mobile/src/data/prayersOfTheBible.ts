/**
 * Prayers of the Bible (PR-08): prayers in Scripture to pray with, each a passage the reader opens in the BSB.
 *
 * The entries are John's: 39 approved on 18 Oct 2026 (docs/review-2026-10-18-henry-prayers.md, "Prayers of the
 * Bible: all 39 approved"), and 10 more on 25 Oct 2026 (docs/review-2026-10-25-naves-needs.md: "Approve 1–5 and
 * 7–10", then "add 6 as well"; rule 2: only John approves entries). Daniel 9 and Nehemiah 1 moved to The nation, where
 * Nave's places them (John, 25 Oct 2026: "it should"). Titles and passages are copied from that table in its
 * order; only the apostrophe is set typographically, as everywhere else on screen. BSB text only; the reader opens the
 * whole passage because the first verse sometimes only introduces the prayer. Luke 23:34 keeps the BSB footnote that
 * some manuscripts leave the prayer out: the entry opens the BSB verse with its own notes, and nothing here drops
 * them. Add or change entries only from a later review John approves.
 */

import { BOOK_CODES, type BookCode } from "@yada/schema";

/**
 * What a prayer is for (PT-42, PT-45; approved by John 24 Oct 2026 with the Bible prayers redesign). "Forgiveness"
 * follows the common term in prayer collections. Every day is the Lord's Prayer alone, which leads the page.
 */
export const PRAYER_NEEDS = ["Forgiveness", "Afraid", "Wisdom", "For others", "Thankful", "Trust"] as const;
/**
 * Needs beyond the six, from Nave's Topical Bible (1896): PRAYER, "Importunity in" and NATION, "Prayer for" (John,
 * 25 Oct 2026). They show on By need (BN-30), never as tiles: Bible prayers keeps six ("it remains just 6").
 */
export const MORE_NEEDS = ["Keep asking", "The nation"] as const;
export type PrayerNeed = (typeof PRAYER_NEEDS)[number] | (typeof MORE_NEEDS)[number] | "Every day";

export interface BiblePrayer {
  /** "Hannah’s prayer", as John names it. */
  readonly title: string;
  readonly need: PrayerNeed;
  readonly book: BookCode;
  readonly chapter: number;
  readonly from: number;
  /** The last verse, in the same chapter. */
  readonly to: number;
}

export const PRAYERS_OF_THE_BIBLE: readonly BiblePrayer[] = [
  { title: "Abraham pleads for Sodom", need: "For others", book: "GEN", chapter: 18, from: 23, to: 32 },
  { title: "Jacob before meeting Esau", need: "Afraid", book: "GEN", chapter: 32, from: 9, to: 12 },
  { title: "Moses pleads for Israel", need: "For others", book: "EXO", chapter: 32, from: 11, to: 13 },
  { title: "Moses: show me your ways", need: "Keep asking", book: "EXO", chapter: 33, from: 12, to: 16 },
  { title: "Hannah’s prayer", need: "Thankful", book: "1SA", chapter: 2, from: 1, to: 10 },
  { title: "David after God’s promise", need: "Thankful", book: "2SA", chapter: 7, from: 18, to: 29 },
  { title: "Solomon asks for wisdom", need: "Wisdom", book: "1KI", chapter: 3, from: 6, to: 9 },
  { title: "Solomon dedicates the temple", need: "For others", book: "1KI", chapter: 8, from: 22, to: 53 },
  { title: "Elijah on Mount Carmel", need: "Trust", book: "1KI", chapter: 18, from: 36, to: 37 },
  { title: "Hezekiah under siege", need: "Afraid", book: "2KI", chapter: 19, from: 15, to: 19 },
  { title: "Jabez", need: "Trust", book: "1CH", chapter: 4, from: 10, to: 10 },
  { title: "David’s praise before the people", need: "Thankful", book: "1CH", chapter: 29, from: 10, to: 19 },
  { title: "Jehoshaphat before battle", need: "Afraid", book: "2CH", chapter: 20, from: 6, to: 12 },
  { title: "Ezra’s confession", need: "Forgiveness", book: "EZR", chapter: 9, from: 6, to: 15 },
  { title: "Nehemiah for Jerusalem", need: "The nation", book: "NEH", chapter: 1, from: 5, to: 11 },
  { title: "The Levites’ confession", need: "Forgiveness", book: "NEH", chapter: 9, from: 5, to: 37 },
  { title: "A prayer of confession", need: "Forgiveness", book: "PSA", chapter: 51, from: 1, to: 19 },
  { title: "Rise up, O God; defend your cause", need: "The nation", book: "PSA", chapter: 74, from: 1, to: 23 },
  { title: "Restore us again", need: "The nation", book: "PSA", chapter: 85, from: 1, to: 7 },
  { title: "A prayer of David", need: "Trust", book: "PSA", chapter: 86, from: 1, to: 17 },
  { title: "Day and night I cry out", need: "Keep asking", book: "PSA", chapter: 88, from: 1, to: 18 },
  { title: "A prayer of Moses", need: "Wisdom", book: "PSA", chapter: 90, from: 1, to: 17 },
  { title: "Out of the depths", need: "Keep asking", book: "PSA", chapter: 130, from: 1, to: 8 },
  { title: "Search me, O God", need: "Forgiveness", book: "PSA", chapter: 139, from: 23, to: 24 },
  { title: "I cry aloud to the LORD", need: "Keep asking", book: "PSA", chapter: 142, from: 1, to: 7 },
  { title: "Jeremiah buys the field", need: "Trust", book: "JER", chapter: 32, from: 17, to: 25 },
  { title: "Look, O LORD", need: "The nation", book: "LAM", chapter: 2, from: 20, to: 22 },
  { title: "Remember, O LORD", need: "The nation", book: "LAM", chapter: 5, from: 1, to: 22 },
  { title: "Daniel’s confession", need: "The nation", book: "DAN", chapter: 9, from: 4, to: 19 },
  { title: "Jonah from the fish", need: "Afraid", book: "JON", chapter: 2, from: 1, to: 9 },
  { title: "How long, O LORD?", need: "Keep asking", book: "HAB", chapter: 1, from: 2, to: 4 },
  { title: "Habakkuk’s prayer", need: "Trust", book: "HAB", chapter: 3, from: 1, to: 19 },
  { title: "The Lord’s Prayer", need: "Every day", book: "MAT", chapter: 6, from: 9, to: 13 },
  { title: "The Canaanite woman", need: "Keep asking", book: "MAT", chapter: 15, from: 22, to: 28 },
  { title: "Jesus in Gethsemane", need: "Afraid", book: "MAT", chapter: 26, from: 39, to: 39 },
  { title: "Mary’s song", need: "Thankful", book: "LUK", chapter: 1, from: 46, to: 55 },
  { title: "Simeon", need: "Thankful", book: "LUK", chapter: 2, from: 29, to: 32 },
  { title: "The tax collector", need: "Forgiveness", book: "LUK", chapter: 18, from: 13, to: 13 },
  { title: "Jesus on the cross: forgive them", need: "For others", book: "LUK", chapter: 23, from: 34, to: 34 },
  { title: "Jesus on the cross: into your hands", need: "Trust", book: "LUK", chapter: 23, from: 46, to: 46 },
  { title: "Jesus prays for himself and his followers", need: "For others", book: "JHN", chapter: 17, from: 1, to: 26 },
  { title: "The church under threat", need: "Afraid", book: "ACT", chapter: 4, from: 24, to: 30 },
  { title: "Stephen", need: "For others", book: "ACT", chapter: 7, from: 59, to: 60 },
  { title: "Paul: that you may know him", need: "For others", book: "EPH", chapter: 1, from: 15, to: 23 },
  { title: "Paul: rooted in love", need: "For others", book: "EPH", chapter: 3, from: 14, to: 21 },
  { title: "Paul: that your love may abound", need: "For others", book: "PHP", chapter: 1, from: 9, to: 11 },
  { title: "Paul: filled with the knowledge of his will", need: "Wisdom", book: "COL", chapter: 1, from: 9, to: 12 },
  { title: "The God of peace", need: "Trust", book: "HEB", chapter: 13, from: 20, to: 21 },
  { title: "Come, Lord Jesus", need: "Trust", book: "REV", chapter: 22, from: 20, to: 20 },
];

/** "Matthew 6:9–13", "1 Samuel 2:1–10": the reference under each title (PR-08). */
export function prayerRef(p: BiblePrayer): string {
  const book = p.book === "PSA" ? "Psalm" : BOOK_CODES[p.book].name;
  return `${book} ${p.chapter}:${p.from}${p.to > p.from ? `–${p.to}` : ""}`;
}

/** Every need, the six first: By need (BN-30) lists them all. */
export const ALL_NEEDS = [...PRAYER_NEEDS, ...MORE_NEEDS] as const;

/** One need's prayers in Bible order, each with its index in the full list (the prayer screen opens by index). */
export function prayersFor(need: PrayerNeed): Array<{ prayer: BiblePrayer; index: number }> {
  return PRAYERS_OF_THE_BIBLE.flatMap((prayer, index) => (prayer.need === need ? [{ prayer, index }] : []));
}

/** "4 verses", "1 verse": a prayer's length under its reference (BN-31). */
export function prayerLength(p: BiblePrayer): string {
  const n = p.to - p.from + 1;
  return `${n} ${n === 1 ? "verse" : "verses"}`;
}

/**
 * A prayer's own picture (BP-31; Pictures, decision 5: a thing keeps its picture): the Lord's Prayer day 16, as on Bible
 * prayers; the rest by their place in the Bible, so a prayer looks the same each time.
 */
export function prayerPicture(p: BiblePrayer): number {
  if (p.need === "Every day") return 16;
  return ((p.chapter * 31 + p.from) % 30) + 1;
}
