/**
 * The headline Scripture of Daily Light on the Daily Path (Bagster, c.1875, KJV, public domain) for each
 * morning and evening. Only the reference lives here: the verse text comes from the reader's own
 * translation in the core bundle, so one wording is on screen, not the book's.
 *
 * data/dailyLight.json is parsed from the pinned CCEL ThML (content/raw/daily-light) and every reference
 * is checked against core.v5 by scripts/check-daily-light.mjs (rule 4).
 */

import type { BookCode } from "@yada/schema";

import DAILY_LIGHT from "../data/dailyLight.json";

/** Same words as the Psalter and the Today screen use; the data file keys are the source's own am/pm. */
export type Part = "morning" | "evening";

export interface DailyLightRef {
  readonly book: BookCode;
  readonly chapter: number;
  readonly verse: number;
  /** Last verse of the range, same chapter. Absent for a single verse. */
  readonly to?: number;
}

const TABLE = DAILY_LIGHT as unknown as Readonly<Record<string, Readonly<Record<"am" | "pm", DailyLightRef>>>>;

/** "MMDD" from the local date. 29 February has its own entry; the book has 366 days. */
export function mmdd(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

export function verseFor(date: Date, part: Part): DailyLightRef {
  const day = TABLE[mmdd(date)];
  if (!day) throw new Error(`Daily Light has no entry for ${mmdd(date)}`);
  return day[part === "morning" ? "am" : "pm"];
}
