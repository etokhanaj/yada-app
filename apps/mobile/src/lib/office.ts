/**
 * Which morning of the 1979 Daily Office lectionary a date is (build 8, Daily prayer; John, 17 Oct 2026). Pure, so it
 * is tested. Keys match office.generated.ts: "<year>|<week>|<day>", year 1 or 2.
 *
 * - The church year begins on Advent Sunday, the fourth Sunday before Christmas; Year One starts the Advent before an
 *   odd-numbered year.
 * - Christmas Day to 5 January and the Epiphany until the first Sunday after it are kept by date; a Sunday in
 *   Christmastide is "Sunday".
 * - After Pentecost, a week takes the Proper whose appointed Sunday (11 May, then each week on) is nearest its own.
 * - A day the table has no entry for (St Stephen's, Trinity Sunday and other holy days) has no lessons; Daily prayer
 *   keeps its fixed parts then, never a guessed reading (rule 4).
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const DAY_MS = 86_400_000;

const at = (y: number, m: number, d: number): Date => new Date(y, m, d);
const days = (a: Date, b: Date): number => Math.round((at(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - at(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / DAY_MS);
const plus = (d: Date, n: number): Date => at(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Western Easter (the anonymous Gregorian computus). */
export function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return at(year, month - 1, ((h + l - 7 * m + 114) % 31) + 1);
}

export function adventSunday(year: number): Date {
  const christmas = at(year, 11, 25);
  const advent4 = plus(christmas, -(christmas.getDay() === 0 ? 7 : christmas.getDay()));
  return plus(advent4, -21);
}

export function officeKey(date: Date): string {
  const y = date.getFullYear();
  const day = DAYS[date.getDay()] as string;
  const churchYear = days(adventSunday(y), date) >= 0 ? y + 1 : y;
  const year = churchYear % 2 === 1 ? 1 : 2;
  const key = (week: string, d: string = day): string => `${year}|${week}|${d}`;
  const dated = (week: string): string => key(week, `${MONTHS[date.getMonth()]} ${date.getDate()}`);

  const advent = adventSunday(y);
  // Advent Sunday falls on 27 November to 3 December: Advent runs from it to Christmas Eve.
  if (days(advent, date) >= 0 && days(date, at(y, 11, 25)) > 0) return key(`Week of ${Math.floor(days(advent, date) / 7) + 1} Advent`);
  const m = date.getMonth();
  const d = date.getDate();
  if ((m === 11 && d >= 25) || (m === 0 && d <= 5)) return date.getDay() === 0 && !(m === 11 && d === 25) ? key("Christmas Day and Following", "Sunday") : dated("Christmas Day and Following");

  const epiphany = at(y, 0, 6);
  const epiphany1 = plus(epiphany, 7 - epiphany.getDay());
  if (days(epiphany, date) >= 0 && days(date, epiphany1) > 0) return dated("The Epiphany and Following");

  const e = easter(y);
  const ash = plus(e, -46);
  if (days(epiphany1, date) >= 0 && days(date, ash) > 0) {
    if (days(date, ash) <= 3) return key("Week of Last Epiphany");
    return key(`Week of ${Math.floor(days(epiphany1, date) / 7) + 1} Epiphany`);
  }
  if (days(ash, date) >= 0 && days(ash, date) < 4) return key("Ash Wednesday and Following");
  const lent1 = plus(ash, 4);
  if (days(lent1, date) >= 0 && days(date, e) > 0) {
    const week = Math.floor(days(lent1, date) / 7) + 1;
    return key(week === 6 ? "Holy Week" : `Week of ${week} Lent`);
  }
  const sinceEaster = days(e, date);
  if (sinceEaster >= 0 && sinceEaster < 49) return key(sinceEaster < 7 ? "Easter Week" : `Week of ${Math.floor(sinceEaster / 7) + 1} Easter`);
  if (sinceEaster === 49) return key("Pentecost");
  // Trinity Sunday has its own entry in the source, outside the weeks; it is left to the fixed parts.
  if (sinceEaster === 56) return key("Trinity Sunday");
  const sunday = plus(date, -date.getDay());
  const proper = Math.min(29, Math.max(1, Math.round(days(at(sunday.getFullYear(), 4, 11), sunday) / 7) + 1));
  return key(`Proper ${proper}`);
}
