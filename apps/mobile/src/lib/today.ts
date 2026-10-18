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

/** When a day's morning or evening begins and ends, so the watch turns them over on its own (AW-01). */
export function partSpan(day: Date, part: Part): { from: Date; until: Date } {
  const at = (offset: number, hour: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset, hour);
  return part === "morning" ? { from: at(0, DAY_TURNS_AT), until: at(0, EVENING_FROM) } : { from: at(0, EVENING_FROM), until: at(1, DAY_TURNS_AT) };
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

/** "2026-10-18", a day as a route parameter. */
export function dayParam(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

export function parseDayParam(value: string | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value ?? "");
  if (m === null) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(year, month, day);
  // Date rolls 2026-02-31 over to 3 March; a day that does not exist is no day, not a different one (code review).
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

/**
 * When a day's verse was, as DR-16 and DR-19 label it: "Today", "This evening", "Yesterday", "Last night", then the
 * date. `today` is Today's own day (dayOf), so 1 am still names the evening just past "This evening".
 */
export function whenLabel(day: Date, part: Part, today: Date): string {
  const days = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (days === 0) return part === "morning" ? "Today" : "This evening";
  if (days === 1) return part === "morning" ? "Yesterday" : "Last night";
  return dayLabel(day);
}

/**
 * Earlier days (DR-19): this month's days up to today, newest first, each morning and, once it has come, evening.
 * The psalter repeats each month, so the list starts again on the 1st.
 */
export function earlierDays(now: Date): Array<{ day: Date; part: Part }> {
  const today = dayOf(now);
  const out: Array<{ day: Date; part: Part }> = [];
  for (let d = today.getDate(); d >= 1; d -= 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), d);
    if (d < today.getDate() || partOf(now) === "evening") out.push({ day, part: "evening" });
    out.push({ day, part: "morning" });
  }
  return out;
}

/**
 * The Later / Earlier row (DR-11, DR-12): "This evening · Psalms 6–8" over "and Spurgeon for the evening" in the
 * morning; "This morning" over "Psalms 1–5 · Spurgeon" in the evening. Spurgeon is named only when there is an entry.
 */
export function laterRow(part: Part, psalms: string, spurgeon: boolean): { title: string; subtitle?: string; label: string } {
  if (part === "morning")
    return spurgeon
      ? { title: `This evening · ${psalms}`, subtitle: "and Spurgeon for the evening", label: `This evening: ${psalms} and Spurgeon` }
      : { title: `This evening · ${psalms}`, label: `This evening: ${psalms}` };
  return spurgeon
    ? { title: "This morning", subtitle: `${psalms} · Spurgeon`, label: `This morning: ${psalms} and Spurgeon` }
    : { title: "This morning", subtitle: psalms, label: `This morning: ${psalms}` };
}
