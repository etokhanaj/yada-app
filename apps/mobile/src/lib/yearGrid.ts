/**
 * The year grid in Your rhythm (RT-02; docs/build-10-ux-pass.md "RT-02, Your rhythm"): the last 24 weeks, one cell
 * per day, Monday first, the current week last, month names above. Nothing here shows a best, a record or a lost
 * run. Pure, so it is tested.
 */

import { dayKey } from "./rhythm";

export const GRID_WEEKS = 24;

export interface GridCell {
  readonly key: string;
  readonly counted: boolean;
  /** After today: drawn empty, never as a miss. */
  readonly future: boolean;
}

export interface YearGrid {
  /** Oldest week first; each week Monday to Sunday. */
  readonly weeks: readonly (readonly GridCell[])[];
  /** The month name over the first week that starts in it. */
  readonly months: readonly { readonly week: number; readonly name: string }[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parse(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

export function yearGrid(days: Iterable<string>, today: string, weeks = GRID_WEEKS): YearGrid {
  const counted = new Set(days);
  const now = parse(today);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const start = new Date(monday);
  start.setDate(monday.getDate() - 7 * (weeks - 1));

  const grid: GridCell[][] = [];
  const months: { week: number; name: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w += 1) {
    const week: GridCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      const key = dayKey(day);
      week.push({ key, counted: counted.has(key) && key <= today, future: key > today });
    }
    grid.push(week);
    const first = parse(week[0]?.key ?? today);
    if (first.getMonth() !== lastMonth) {
      months.push({ week: w, name: MONTHS[first.getMonth()] ?? "" });
      lastMonth = first.getMonth();
    }
  }
  return { weeks: grid, months };
}

/** This week, Monday to Sunday, for the week row. */
export function thisWeek(days: Iterable<string>, today: string): { key: string; counted: boolean; today: boolean; future: boolean }[] {
  const week = yearGrid(days, today, 1).weeks[0] ?? [];
  return week.map((c) => ({ ...c, today: c.key === today }));
}

/** "28 days read since May": the grid's one-line summary for VoiceOver. */
export function gridSummary(grid: YearGrid): string {
  const n = grid.weeks.flat().filter((c) => c.counted).length;
  const since = grid.months[0]?.name ?? "";
  return `${n} ${n === 1 ? "day" : "days"} read since ${since}`;
}
