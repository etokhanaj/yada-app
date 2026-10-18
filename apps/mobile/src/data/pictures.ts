/**
 * The day's picture: one per day of the month for the morning and one for the evening (pictures-plan.md, 30 + 30),
 * the 31st reusing the 30th's. The evening's switches in at 17:00 with the evening psalms (DR-12).
 */

import { pictureDay, type Part } from "../lib/today";
import { type DayPicture, DAY_PICTURES } from "./pictures.generated";

export function pictureFor(day: Date, part: Part): DayPicture | undefined {
  const n = pictureDay(day);
  return DAY_PICTURES.find((p) => p.day === n && p.part === part);
}
