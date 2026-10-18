/**
 * The Psalter as appointed by the 1662 Book of Common Prayer: the whole of it read once a month, a set of
 * psalms each for Morning and Evening Prayer on each of 30 days.
 *
 * The table is transcribed from the pinned source in content/raw/bcp1662 (eskimo.com/~lhowell/bcp1662,
 * "The Psalms", Days 1-31), parsed twice by different methods that agree, never typed from memory (rule 4).
 * Psalm 119 is split by the printed eight-verse sections: Day 24 evening 1-32, Day 25 morning 33-72,
 * evening 73-104, Day 26 morning 105-144, evening 145-176.
 *
 * The source's own rules ("The Order how the Psalter is appointed to be read"):
 *  - February reads only to the 28th or 29th day, so the psalms of days 29 and 30 are not read in
 *    February; the table is not compressed to fit.
 *  - Months of 31 days read on the 31st the same psalms as the day before (the source heads Day 30 as
 *    "Day 30 (and 31)").
 * The 03:00 day boundary is the caller's job; this takes a Date and uses its local calendar date.
 */

import type { SetEnd } from "./audio/stop";
import { psalmForDay } from "./reminder";

export type PsalterPart = "morning" | "evening";

/** One psalm, or a verse range inside one (only Psalm 119 is ever split). */
export interface PsalmRange {
  readonly psalm: number;
  readonly from?: number;
  readonly to?: number;
}
export type PsalmSet = readonly PsalmRange[];

export interface PsalterDay {
  readonly morning: PsalmSet;
  readonly evening: PsalmSet;
}

/** Index 0 is day 1. */
export const PSALTER: readonly PsalterDay[] = [
  // day 1
  { morning: [{ psalm: 1 }, { psalm: 2 }, { psalm: 3 }, { psalm: 4 }, { psalm: 5 }],
    evening: [{ psalm: 6 }, { psalm: 7 }, { psalm: 8 }] },
  // day 2
  { morning: [{ psalm: 9 }, { psalm: 10 }, { psalm: 11 }],
    evening: [{ psalm: 12 }, { psalm: 13 }, { psalm: 14 }] },
  // day 3
  { morning: [{ psalm: 15 }, { psalm: 16 }, { psalm: 17 }],
    evening: [{ psalm: 18 }] },
  // day 4
  { morning: [{ psalm: 19 }, { psalm: 20 }, { psalm: 21 }],
    evening: [{ psalm: 22 }, { psalm: 23 }] },
  // day 5
  { morning: [{ psalm: 24 }, { psalm: 25 }, { psalm: 26 }],
    evening: [{ psalm: 27 }, { psalm: 28 }, { psalm: 29 }] },
  // day 6
  { morning: [{ psalm: 30 }, { psalm: 31 }],
    evening: [{ psalm: 32 }, { psalm: 33 }, { psalm: 34 }] },
  // day 7
  { morning: [{ psalm: 35 }, { psalm: 36 }],
    evening: [{ psalm: 37 }] },
  // day 8
  { morning: [{ psalm: 38 }, { psalm: 39 }, { psalm: 40 }],
    evening: [{ psalm: 41 }, { psalm: 42 }, { psalm: 43 }] },
  // day 9
  { morning: [{ psalm: 44 }, { psalm: 45 }, { psalm: 46 }],
    evening: [{ psalm: 47 }, { psalm: 48 }, { psalm: 49 }] },
  // day 10
  { morning: [{ psalm: 50 }, { psalm: 51 }, { psalm: 52 }],
    evening: [{ psalm: 53 }, { psalm: 54 }, { psalm: 55 }] },
  // day 11
  { morning: [{ psalm: 56 }, { psalm: 57 }, { psalm: 58 }],
    evening: [{ psalm: 59 }, { psalm: 60 }, { psalm: 61 }] },
  // day 12
  { morning: [{ psalm: 62 }, { psalm: 63 }, { psalm: 64 }],
    evening: [{ psalm: 65 }, { psalm: 66 }, { psalm: 67 }] },
  // day 13
  { morning: [{ psalm: 68 }],
    evening: [{ psalm: 69 }, { psalm: 70 }] },
  // day 14
  { morning: [{ psalm: 71 }, { psalm: 72 }],
    evening: [{ psalm: 73 }, { psalm: 74 }] },
  // day 15
  { morning: [{ psalm: 75 }, { psalm: 76 }, { psalm: 77 }],
    evening: [{ psalm: 78 }] },
  // day 16
  { morning: [{ psalm: 79 }, { psalm: 80 }, { psalm: 81 }],
    evening: [{ psalm: 82 }, { psalm: 83 }, { psalm: 84 }, { psalm: 85 }] },
  // day 17
  { morning: [{ psalm: 86 }, { psalm: 87 }, { psalm: 88 }],
    evening: [{ psalm: 89 }] },
  // day 18
  { morning: [{ psalm: 90 }, { psalm: 91 }, { psalm: 92 }],
    evening: [{ psalm: 93 }, { psalm: 94 }] },
  // day 19
  { morning: [{ psalm: 95 }, { psalm: 96 }, { psalm: 97 }],
    evening: [{ psalm: 98 }, { psalm: 99 }, { psalm: 100 }, { psalm: 101 }] },
  // day 20
  { morning: [{ psalm: 102 }, { psalm: 103 }],
    evening: [{ psalm: 104 }] },
  // day 21
  { morning: [{ psalm: 105 }],
    evening: [{ psalm: 106 }] },
  // day 22
  { morning: [{ psalm: 107 }],
    evening: [{ psalm: 108 }, { psalm: 109 }] },
  // day 23
  { morning: [{ psalm: 110 }, { psalm: 111 }, { psalm: 112 }, { psalm: 113 }],
    evening: [{ psalm: 114 }, { psalm: 115 }] },
  // day 24
  { morning: [{ psalm: 116 }, { psalm: 117 }, { psalm: 118 }],
    evening: [{ psalm: 119, from: 1, to: 32 }] },
  // day 25
  { morning: [{ psalm: 119, from: 33, to: 72 }],
    evening: [{ psalm: 119, from: 73, to: 104 }] },
  // day 26
  { morning: [{ psalm: 119, from: 105, to: 144 }],
    evening: [{ psalm: 119, from: 145, to: 176 }] },
  // day 27
  { morning: [{ psalm: 120 }, { psalm: 121 }, { psalm: 122 }, { psalm: 123 }, { psalm: 124 }, { psalm: 125 }],
    evening: [{ psalm: 126 }, { psalm: 127 }, { psalm: 128 }, { psalm: 129 }, { psalm: 130 }, { psalm: 131 }] },
  // day 28
  { morning: [{ psalm: 132 }, { psalm: 133 }, { psalm: 134 }, { psalm: 135 }],
    evening: [{ psalm: 136 }, { psalm: 137 }, { psalm: 138 }] },
  // day 29
  { morning: [{ psalm: 139 }, { psalm: 140 }, { psalm: 141 }],
    evening: [{ psalm: 142 }, { psalm: 143 }] },
  // day 30
  { morning: [{ psalm: 144 }, { psalm: 145 }, { psalm: 146 }],
    evening: [{ psalm: 147 }, { psalm: 148 }, { psalm: 149 }, { psalm: 150 }] },
];

/** The day of the Psalter for a calendar date: the 31st repeats day 30. */
export function psalterDay(date: Date): number {
  return Math.min(date.getDate(), 30);
}

export function setFor(date: Date, part: PsalterPart): PsalmSet {
  return PSALTER[psalterDay(date) - 1]![part];
}

/** "Psalms 1–5", "Psalm 8", "Psalm 119:1–32". */
export function label(set: PsalmSet): string {
  const parts: string[] = [];
  let i = 0;
  while (i < set.length) {
    const r = set[i]!;
    if (r.from !== undefined && r.to !== undefined) {
      parts.push(`${r.psalm}:${r.from}\u2013${r.to}`);
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < set.length && set[j + 1]!.from === undefined && set[j + 1]!.psalm === set[j]!.psalm + 1) j += 1;
    parts.push(j > i ? `${r.psalm}\u2013${set[j]!.psalm}` : `${r.psalm}`);
    i = j + 1;
  }
  return `${set.length > 1 ? "Psalms" : "Psalm"} ${parts.join(", ")}`;
}

/**
 * Settings › Daily psalms (DR-04): the 1662 morning and evening table, One a day (Psalm 1 to 150 by the day of
 * the year, the reminder's `psalmForDay`), or Off.
 */
export type PsalterChoice = "1662" | "one" | "office" | "off";

/**
 * DR-04: each choice says what it is. The lines are DR-04's, with two changes: Off says only Today, since the widget
 * keeps its own psalm a day whatever this is set to (targets/widget, design QA DR-07); and Daily prayer, which DO-03
 * added after DR-04 was drawn, says what data/office.ts builds.
 */
export const PSALTER_CHOICES: readonly { readonly id: PsalterChoice; readonly title: string; readonly line: string }[] = [
  // DO-03 (build 8, John 17 Oct 2026): Daily prayer as a fourth choice, the 1662 table by its own name.
  { id: "1662", title: "1662 Prayer Book", line: "All 150 in a month, as the 1662 Prayer Book divides them" },
  { id: "one", title: "One a day", line: "Psalm 1 to 150, then again" },
  { id: "office", title: "Daily prayer", line: "Morning and Evening Prayer step by step: the day’s psalms and lessons" },
  { id: "off", title: "Off", line: "No psalms on Today" },
];

export function parsePsalter(stored: string | undefined): PsalterChoice {
  return stored === "one" || stored === "office" || stored === "off" ? stored : "1662";
}

/** The set to read now under the choice; null when daily psalms are off. One a day is the same all day. */
export function setForChoice(date: Date, part: PsalterPart, choice: PsalterChoice): PsalmSet | null {
  // Daily prayer carries its own psalms (the Daily Office lectionary), so Today shows its card instead.
  if (choice === "off" || choice === "office") return null;
  return choice === "one" ? [{ psalm: psalmForDay(date) }] : setFor(date, part);
}

/**
 * DR-08: the 1662 set now being heard, when `psalm`:`verse` is one of its psalms and not past its end: the player's
 * "Evening · Psalms 6–8" and Stop playing's "End of this evening's psalms · After Psalm 8". One a day's set is one
 * psalm, which "End of this psalm" already covers.
 */
export function setHolding(day: Date, part: PsalterPart, choice: PsalterChoice, psalm: number, verse: number): { label: string; end: SetEnd } | null {
  if (choice !== "1662") return null;
  const set = setFor(day, part);
  const range = set.find((r) => r.psalm === psalm && verse >= (r.from ?? 1) && verse <= (r.to ?? Infinity));
  const last = set[set.length - 1];
  if (range === undefined || last === undefined) return null;
  return { label: label(set), end: { part, psalm: last.psalm, to: last.to ?? null } };
}

/** DR-02: in the reader on one of the set's psalms, the next one in the set, or null after the last. */
export function nextInSet(set: PsalmSet, psalm: number): PsalmRange | null {
  const at = set.findIndex((r) => r.psalm === psalm);
  return at < 0 ? null : (set[at + 1] ?? null);
}
