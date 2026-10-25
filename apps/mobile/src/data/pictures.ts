/**
 * The day's picture: one per day of the month for the morning and one for the evening (pictures-plan.md, 30 + 30),
 * the 31st reusing the 30th's. The evening's switches in at 17:00 with the evening psalms (DR-12).
 */

import { pictureDay, type Part } from "../lib/today";
import { type DayPicture, DAY_PICTURES } from "./pictures.generated";

/**
 * Every photograph comes through here (build-12-plan.md, Pictures). A date gives the day's picture; a number is a fixed
 * day for a thing that keeps its own picture, a mood or a plan (decisions 3 and 5, John 24 Oct 2026), so the pool can
 * grow without code changes.
 */
export function pictureFor(day: Date | number, part: Part): DayPicture | undefined {
  const n = typeof day === "number" ? Math.min(Math.max(Math.round(day), 1), 30) : pictureDay(day);
  return DAY_PICTURES.find((p) => p.day === n && p.part === part);
}
