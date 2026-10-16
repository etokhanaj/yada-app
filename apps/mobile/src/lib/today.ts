/**
 * Today's clock (build 7, docs/build-7-plan.md §0 and the UX stress test, 15 Oct 2026): pure, so it is tested.
 *
 * - The day turns at 03:00, not midnight: someone reading at 1 am is still in the evening they began, as the
 *   iPhone's sleep schedule treats it (stress test #3).
 * - The evening starts at 17:00 (DR-12).
 * - The greeting has no name: Yada has no accounts (John, 15 Oct 2026).
 */

export type Part = "morning" | "evening";

const DAY_TURNS_AT = 3;
const EVENING_FROM = 17;

/** The calendar date Today belongs to: before 03:00 it is still yesterday. */
export function dayOf(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() < DAY_TURNS_AT) d.setDate(d.getDate() - 1);
  return d;
}

export function partOf(now: Date): Part {
  const h = now.getHours();
  return h >= EVENING_FROM || h < DAY_TURNS_AT ? "evening" : "morning";
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h >= DAY_TURNS_AT && h < 12) return "Good morning";
  if (h >= 12 && h < EVENING_FROM) return "Good afternoon";
  return "Good evening";
}

/** "Sunday 1 November", as the frames write it. */
export function dayLabel(day: Date): string {
  return day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

/** "1101": the key Daily Light and Spurgeon use. */
export function mmdd(day: Date): string {
  return `${String(day.getMonth() + 1).padStart(2, "0")}${String(day.getDate()).padStart(2, "0")}`;
}

/** One picture per day of the month; the 31st reuses the 30th's (pictures-plan.md: 30 pictures). */
export function pictureDay(day: Date): number {
  return Math.min(day.getDate(), 30);
}

/**
 * The opening shown on the reading card: the psalm's own first clause, never "…". The superscription is
 * removed by the caller (reader.ts excerptOf); a clause over 70 characters ends at its first comma after 20.
 */
export function opening(text: string): string {
  const clause = text.split(/[;:.!?]/u, 1)[0] ?? text;
  if (clause.length <= 70) return clause.trim();
  const comma = clause.indexOf(",", 20);
  return (comma === -1 ? clause : clause.slice(0, comma)).trim();
}
