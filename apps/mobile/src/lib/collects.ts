/**
 * The collect of the day for Daily prayer (Build 11; John, 22 Oct 2026: the 1979 Book of Common Prayer, traditional
 * wording; data/collects.generated.ts). The week comes from the same church calendar as the day's readings
 * (lib/office.ts officeKey). As the Prayer Book appoints, a Sunday's collect serves the weekdays after it, except where
 * a day has its own: Christmas and the Holy Name, the Epiphany, Ash Wednesday, Holy Week, Easter Week and Ascension Day.
 * Holy days that fall on a weekday (St Stephen, the Annunciation and the rest) are not in this set: that day keeps the
 * Sunday's collect, which the Prayer Book also allows when a lesser feast is not kept.
 */

import { COLLECTS } from "../data/collects.generated";
import { officeKey } from "./office";

export interface Collect {
  /** "Proper 25", "Second Sunday in Lent": what the day is called in the Prayer Book. */
  readonly name: string;
  readonly text: string;
}

const ORDINAL = ["", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth"];
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The Prayer Book's own name for a day, as the reader sees it under the collect. */
function title(key: string): string {
  const n = Number(key.split(" ")[1]);
  if (key.startsWith("Advent ")) return `${ORDINAL[n]} Sunday of Advent`;
  if (key.startsWith("Christmas ") && key !== "Christmas Day") return `${ORDINAL[n]} Sunday after Christmas Day`;
  if (key.startsWith("Epiphany ")) return `${ORDINAL[n]} Sunday after the Epiphany`;
  if (key === "Last Epiphany") return "Last Sunday after the Epiphany";
  if (key.startsWith("Lent ")) return `${ORDINAL[n]} Sunday in Lent`;
  if (key.startsWith("Holy ") && key !== "Holy Name" && key !== "Holy Saturday") return `${key.split(" ")[1]} in Holy Week`;
  if (/^Easter \d$/.test(key)) return `${ORDINAL[n]} Sunday of Easter`;
  if (/^Easter [A-Z]/.test(key) && key !== "Easter Day") return `${key.split(" ")[1]} in Easter Week`;
  if (key === "Pentecost") return "The Day of Pentecost";
  if (key === "Christmas Day") return "Christmas Day";
  return key;
}

/** Which collect a day takes: the key into COLLECTS, or null when the calendar cannot place it. */
export function collectKey(date: Date): string | null {
  const week = officeKey(date).split("|")[1] ?? "";
  const day = WEEKDAY[date.getDay()] as string;
  const m = date.getMonth();
  const d = date.getDate();
  let match: RegExpMatchArray | null;
  if ((match = /^Week of (\d) Advent$/.exec(week))) return `Advent ${match[1]}`;
  if (week === "Christmas Day and Following") {
    if (m === 11 && d === 25) return "Christmas Day";
    if (m === 0 && d === 1) return "Holy Name";
    // The first Sunday after 25 December, then (from 2 January) the second.
    const christmas = new Date(m === 11 ? date.getFullYear() : date.getFullYear() - 1, 11, 25);
    const first = new Date(christmas);
    first.setDate(christmas.getDate() + (7 - christmas.getDay()));
    const second = new Date(first);
    second.setDate(first.getDate() + 7);
    if (date >= second) return "Christmas 2";
    if (m === 0) return "Holy Name";
    return date >= first ? "Christmas 1" : "Christmas Day";
  }
  if (week === "The Epiphany and Following") return "Epiphany";
  if ((match = /^Week of (\d) Epiphany$/.exec(week))) return `Epiphany ${match[1]}`;
  if (week === "Week of Last Epiphany") return "Last Epiphany";
  if (week === "Ash Wednesday and Following") return "Ash Wednesday";
  if ((match = /^Week of (\d) Lent$/.exec(week))) return `Lent ${match[1]}`;
  if (week === "Holy Week") {
    return { Sunday: "Palm Sunday", Monday: "Holy Monday", Tuesday: "Holy Tuesday", Wednesday: "Holy Wednesday", Thursday: "Maundy Thursday", Friday: "Good Friday", Saturday: "Holy Saturday" }[day] ?? null;
  }
  if (week === "Easter Week") return day === "Sunday" ? "Easter Day" : `Easter ${day}`;
  if ((match = /^Week of (\d) Easter$/.exec(week))) {
    // Ascension Day is the Thursday of the sixth week; its collect serves the days to Sunday.
    if (match[1] === "6" && (day === "Thursday" || day === "Friday" || day === "Saturday")) return "Ascension Day";
    return `Easter ${match[1]}`;
  }
  if (week === "Pentecost") return "Pentecost";
  if (week === "Trinity Sunday") return "Trinity Sunday";
  if ((match = /^Proper (\d+)$/.exec(week))) return `Proper ${match[1]}`;
  return null;
}

export function collectFor(date: Date): Collect | null {
  const key = collectKey(date);
  const text = key === null ? undefined : COLLECTS[key];
  return key === null || text === undefined ? null : { name: title(key), text };
}
