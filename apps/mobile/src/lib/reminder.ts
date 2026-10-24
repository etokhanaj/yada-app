/**
 * The reading reminder (canvas NT-01–10), pure so it can be tested: when it comes and what it says.
 *
 * - One reminder, at a time and on days the reader picks; made on the phone, nothing sent anywhere (NT-02).
 * - It says the next passage by name and its first words (NT-04), or on M'Cheyne the next reading, never a
 *   day number (NT-07); or "A passage for today", one verse the same for everyone (NT-06).
 * - iOS repeats a scheduled notification's words unchanged, so each one is scheduled on its own, two weeks
 *   ahead, and scheduled again whenever Yada opens. Away longer than that, they run out: the reminder has
 *   paused itself, and Home says so once (NT-09). No catching up, no guilt.
 * - Public-domain words only: the BSB, whatever the reader's translation (rule 9; IA-13).
 */

import { dayKey, type Rhythm } from "./rhythm";

export type ReminderKind = "next" | "today";

export interface ReminderPrefs {
  readonly on: boolean;
  readonly hour: number;
  readonly minute: number;
  /** Monday first, as the picker shows them: M T W T F S S. */
  readonly days: readonly boolean[];
  readonly kind: ReminderKind;
  /** Build 7: a second time, for this evening's psalms (plan §0 step 5). Null is no evening reminder. */
  readonly evening: { readonly hour: number; readonly minute: number } | null;
  /** Build 8: Sunday's week in review, off by default (John, 17 Oct 2026). */
  readonly weekly: boolean;
}

export const DEFAULT_REMINDER: ReminderPrefs = { on: false, hour: 7, minute: 30, days: [true, true, true, true, true, true, true], kind: "next", evening: null, weekly: false };

/** When the evening reminder is first turned on: after the day's work, before Today's evening ends. */
export const DEFAULT_EVENING = { hour: 19, minute: 0 } as const;

/** Scheduled this far ahead each time Yada opens (NT-09: two weeks away and it has paused). */
export const HORIZON_DAYS = 14;

export function parseReminder(stored: string | undefined): ReminderPrefs {
  if (stored === undefined) return DEFAULT_REMINDER;
  try {
    const v = JSON.parse(stored) as Partial<ReminderPrefs>;
    const days = Array.isArray(v.days) && v.days.length === 7 ? v.days.map((d) => d === true) : DEFAULT_REMINDER.days;
    const ok = (n: unknown, max: number) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max;
    return {
      on: v.on === true,
      hour: ok(v.hour, 23) ? (v.hour as number) : DEFAULT_REMINDER.hour,
      minute: ok(v.minute, 59) ? (v.minute as number) : DEFAULT_REMINDER.minute,
      days,
      kind: v.kind === "today" ? "today" : "next",
      evening:
        typeof v.evening === "object" && v.evening !== null && ok(v.evening.hour, 23) && ok(v.evening.minute, 59)
          ? { hour: v.evening.hour, minute: v.evening.minute }
          : null,
      weekly: v.weekly === true,
    };
  } catch {
    return DEFAULT_REMINDER;
  }
}

/** "7:30", as the frames write it (NT-02). */
export function timeLabel(p: Pick<ReminderPrefs, "hour" | "minute">): string {
  return `${p.hour}:${String(p.minute).padStart(2, "0")}`;
}

/** "7:30 · every day", "7:30 · weekdays", "7:30 · Mon, Wed, Fri": Settings' value (ST-01). */
export function reminderSummary(p: ReminderPrefs): string {
  if (!p.on) return "Off";
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const on = p.days.flatMap((d, i) => (d ? [i] : []));
  const when = on.length === 7 ? "every day" : on.join() === "0,1,2,3,4" ? "weekdays" : on.join() === "5,6" ? "weekends" : on.map((i) => names[i]).join(", ");
  return `${timeLabel(p)}${p.evening === null ? "" : ` and ${timeLabel(p.evening)}`} · ${when}`;
}

/** The moments to schedule from `now`: the chosen days, at the chosen time, up to the horizon. */
export function upcomingTimes(now: Date, p: ReminderPrefs, horizon = HORIZON_DAYS): Date[] {
  const out: Date[] = [];
  for (let d = 0; d <= horizon; d++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, p.hour, p.minute, 0, 0);
    const monFirst = (at.getDay() + 6) % 7;
    if (at.getTime() > now.getTime() && p.days[monFirst] === true) out.push(at);
  }
  return out;
}

/** NT-09: the last one scheduled has passed and Yada was not opened to schedule more. */
export function pausedWhileAway(scheduledUntil: string | undefined, prefs: ReminderPrefs, now: Date): boolean {
  if (!prefs.on || scheduledUntil === undefined) return false;
  const until = Date.parse(scheduledUntil);
  return Number.isFinite(until) && until < now.getTime();
}

/**
 * "A passage for today" (NT-06): one verse the same for everyone that day, chosen from the data, never
 * written: the first verse of a psalm, going through the Psalter by the day of the year.
 */
export function psalmForDay(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 1);
  const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86_400_000);
  return (day % 150) + 1;
}

export interface ReminderText {
  readonly title: string;
  readonly body: string;
}

/** NT-04: "Next in John: Healing at the pool" over the passage's first words. */
export function nextInJohn(label: string, firstWords: string): ReminderText {
  return { title: `Next in John: ${label}`, body: firstWords };
}

/** NT-07: "The whole Bible · Reading 2" over the reading's portions (TD-22: the plan named for what it is); never a day number. */
export function nextInMcheyne(reading: number, portions: readonly string[]): ReminderText {
  return { title: `The whole Bible · Reading ${reading}`, body: portions.join(" · ") };
}

/** NT-06: the verse itself, then where it is. */
export function passageForToday(text: string, psalm: number): ReminderText {
  return { title: "A passage for today", body: `${text} Psalm ${psalm}:1` };
}

/**
 * When Yada asks to turn the reminder on (NP-01–03; John, 15 Oct 2026). iOS shows its own prompt once, so Yada
 * asks first in its own words: at the end of the first passage read, then on a return three days after a Not now,
 * then every fourteen days, four asks in all (John, 16 Oct 2026: "coming periodically when the notifications
 * aren't set"); after that the reminder lives in Settings. Never while it is on, and never once iOS has answered.
 */
export type AskState =
  | { readonly kind: "never" }
  | { readonly kind: "later"; readonly at: number; readonly times: number }
  | { readonly kind: "done" };

export const ASK_AGAIN_DAYS = 3;
export const ASK_EVERY_DAYS = 14;
export const ASK_TIMES = 4;

export function parseAsk(stored: string | undefined): AskState {
  if (stored === "done") return { kind: "done" };
  const [at, times] = stored?.startsWith("later:") === true ? stored.slice("later:".length).split(":").map(Number) : [NaN];
  // Stored before 16 Oct 2026 as "later:<at>": one Not now so far.
  return at !== undefined && Number.isFinite(at) ? { kind: "later", at, times: times !== undefined && Number.isFinite(times) ? times : 1 } : { kind: "never" };
}

export function storeAsk(state: AskState): string {
  return state.kind === "done" ? "done" : state.kind === "later" ? `later:${state.at}:${state.times}` : "";
}

export function askNow(
  where: "passage-end" | "home",
  state: AskState,
  context: { readonly readCount: number; readonly on: boolean; readonly permission: "granted" | "denied" | "undetermined"; readonly now: number },
): boolean {
  if (context.on || context.permission !== "undetermined" || context.readCount < 1) return false;
  if (where === "passage-end") return state.kind === "never";
  const wait = state.kind === "later" && state.times === 1 ? ASK_AGAIN_DAYS : ASK_EVERY_DAYS;
  return state.kind === "later" && context.now - state.at >= wait * 86_400_000;
}

/** Not now: later, until the fourth ask; then never again. */
export function afterNotNow(state: AskState, now: number): AskState {
  const times = state.kind === "later" ? state.times + 1 : 1;
  return state.kind === "done" || times >= ASK_TIMES ? { kind: "done" } : { kind: "later", at: now, times };
}

/**
 * The rhythm line on the next reminder (John, 17 Oct 2026: "honest, positive only"). Reminders are scheduled days
 * ahead, so only the first one carries it, and only once today counts: by rhythm.ts's rules the count then still
 * holds when that reminder arrives, later today or tomorrow. Never a loss, never a warning.
 */
export function rhythmLine(r: Rhythm): string | null {
  return r.lit && r.streak >= 2 ? `Your rhythm: ${r.streak} days` : null;
}

/** Sunday's week in review: days counted Monday to Saturday before `sunday`; nothing when none were. */
export function weekLine(days: Iterable<string>, sunday: Date): string | null {
  const counted = new Set(days);
  let n = 0;
  for (let back = 1; back <= 6; back += 1) {
    const d = new Date(sunday);
    d.setDate(d.getDate() - back);
    if (counted.has(dayKey(d))) n += 1;
  }
  return n === 0 ? null : `This week you read on ${n} ${n === 1 ? "day" : "days"}`;
}

/** The week in review on its own, when no morning reminder falls on that Sunday: one notification a day at most. */
export const WEEKLY_AT = { hour: 18, minute: 0 } as const;

/** A line over a reminder's own text: the rhythm or the week, never both (one notification, one line). */
export function withLine(text: ReminderText, line: string | null): ReminderText {
  return line === null ? text : { title: text.title, body: `${line}\n${text.body}` };
}

