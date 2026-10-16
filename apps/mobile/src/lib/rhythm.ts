/**
 * The streak, defined (build 7 plan §2, row 8; John, 15 Oct 2026: "lets have streak but lets define it"). Pure,
 * so it is tested.
 *
 * - A day counts when you read or listen in it. Days are local dates on Today's clock (the day turns at 03:00).
 * - One rest day a week, Monday to Sunday, never breaks it; a second missed day that week, or two in a row, ends it.
 * - It restarts quietly: no "lost", no best, no restore. Today not yet counted is not a miss; the day is not over.
 * - Days after today are ignored, so moving the clock back cannot add to it (plan §6).
 */

import { dayOf } from "./today";

/** "2026-10-15": how a counted day is stored and synced. */
export function dayKey(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

export function todayKey(now: Date): string {
  return dayKey(dayOf(now));
}

function parse(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

/** Monday of the day's week, as a key. */
function weekOf(day: Date): string {
  const monday = new Date(day);
  monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return dayKey(monday);
}

export interface Rhythm {
  /** Days counted in the current run; rest days don't add. 0 when there is none. */
  readonly streak: number;
  /** Today already counts: the lamp is lit. */
  readonly lit: boolean;
  /** Days counted this calendar year. */
  readonly thisYear: number;
  /** Anything was ever counted: before that, Today shows no lamp (XT-01). */
  readonly begun: boolean;
}

export function rhythmOf(days: Iterable<string>, today: string): Rhythm {
  const counted = new Set([...days].filter((d) => d <= today));
  const lit = counted.has(today);
  const year = today.slice(0, 4);
  const thisYear = [...counted].filter((d) => d.startsWith(year)).length;

  let streak = 0;
  const restedIn = new Set<string>();
  let missedYesterday = false;
  const cursor = parse(today);
  // Today not yet counted is still open: start the walk from yesterday.
  if (!lit) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const key = dayKey(cursor);
    if (counted.has(key)) {
      streak += 1;
      missedYesterday = false;
    } else {
      const week = weekOf(cursor);
      if (missedYesterday || restedIn.has(week)) break;
      restedIn.add(week);
      missedYesterday = true;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return { streak, lit, thisYear, begun: counted.size > 0 };
}
