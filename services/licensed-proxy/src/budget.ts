/**
 * The Starter plan's 5,000 calls a month (api.bible, read 18 Oct 2026; overage off), split so search
 * can never starve reading (docs/licensed-online-plan.md, stress test). Calls are counted per plan
 * month, which starts on the day of the month the plan took effect (§2 "Plan Month").
 */

/** Reading stops here, short of 5,000, leaving room for the counter being a little behind upstream. */
export const READ_STOP = 4_900;
/** Search's own share: unusual queries are rarely shared, so search grows with readers. */
export const SEARCH_CAP = 800;

export const DAY_MS = 24 * 60 * 60 * 1000;
/** §11: a stored copy may be no more than 30 days out of date. */
export const MAX_AGE_MS = 30 * DAY_MS;

export type CallKind = "read" | "search";

export interface Counts {
  readonly total: number;
  readonly search: number;
}

export function mayCall(kind: CallKind, counts: Counts): boolean {
  if (counts.total >= READ_STOP) return false;
  return kind === "read" || counts.search < SEARCH_CAP;
}

/** `day` 1–28 (the plan's start day; 29–31 would skip short months). UTC throughout. */
export function planMonthStart(now: Date, day: number): Date {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const thisMonth = Date.UTC(y, m, day);
  return new Date(now.getTime() >= thisMonth ? thisMonth : Date.UTC(y, m - 1, day));
}

/**
 * A copy expires 30 days after API.Bible sent it (§11). In a 31-day plan month a chapter read on its
 * first and last days is fetched twice; nothing can prevent that within §11, so the reading ceiling
 * (~3,567) plus search (800) is held under READ_STOP with ~500 calls to spare, and READ_STOP is the
 * hard stop. (The plan of 18 Oct also capped copies at the month's end; a test showed it saves nothing.)
 */
export function expiresAt(fetchedAt: Date): Date {
  return new Date(fetchedAt.getTime() + MAX_AGE_MS);
}

export function parsePlanDay(raw: string | undefined): number {
  const day = Number(raw);
  return Number.isInteger(day) && day >= 1 && day <= 28 ? day : 1;
}
