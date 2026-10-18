/**
 * When the reader has been away (build 10a; docs/build-10-plan.md "10a Return", docs/build-10-ux-pass.md rules 1, 2, 3
 * and 9). Pure, so it is tested.
 *
 * - RT-01 appears only on a plain app-icon open after 30 days or more, once per lapse (not again for 14 days if it was
 *   closed). A widget, notification, Siri, Spotlight or link goes straight where it points: someone looking a verse up
 *   must never be stopped by a welcome (rule 1).
 * - No saved place, no RT-01 (rule 3): there is nothing to say "you were in" about.
 * - One "welcome back" notification, seven days after the last open, and nothing after it in that lapse. The ordinary
 *   reminders run until then (rule 9: readers who never allowed notifications are reached by RT-01 and the widget).
 * - Nothing here counts days missed: it returns a yes or no and a time, never a number to show.
 */

import { upcomingTimes, type ReminderPrefs } from "./reminder";

const DAY_MS = 86_400_000;

export const RETURN_AFTER_DAYS = 30;
export const RETURN_AGAIN_DAYS = 14;
export const WELCOME_BACK_DAYS = 7;

export interface ReturnInput {
  readonly now: number;
  /** ISO time the app was last opened or left; undefined on a phone with no history (new install, reinstall). */
  readonly lastOpenAt: string | undefined;
  /** ISO time RT-01 was last shown. */
  readonly shownAt: string | undefined;
  /** A reading place is saved: the last place read in the reader. */
  readonly hasPlace: boolean;
  /** Opened from the app icon with nothing carried in: no notification, widget, Siri, Spotlight or link. */
  readonly plainOpen: boolean;
}

function ago(now: number, iso: string | undefined): number | null {
  const at = iso === undefined ? Number.NaN : Date.parse(iso);
  return Number.isFinite(at) ? now - at : null;
}

export function showReturn(i: ReturnInput): boolean {
  if (!i.plainOpen || !i.hasPlace) return false;
  const away = ago(i.now, i.lastOpenAt);
  if (away === null || away < RETURN_AFTER_DAYS * DAY_MS) return false;
  const shown = ago(i.now, i.shownAt);
  return shown === null || shown >= RETURN_AGAIN_DAYS * DAY_MS;
}

/**
 * The moment of the one welcome-back notification: seven days on, at the reminder's time of day, moved to the next day
 * the reader allows reminders (a weekdays-only reader is never reached on a Saturday).
 */
export function welcomeBackAt(now: Date, prefs: Pick<ReminderPrefs, "hour" | "minute" | "days">): Date {
  for (let d = WELCOME_BACK_DAYS; d < WELCOME_BACK_DAYS + 7; d += 1) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, prefs.hour, prefs.minute, 0, 0);
    if (prefs.days[(at.getDay() + 6) % 7] === true) return at;
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + WELCOME_BACK_DAYS, prefs.hour, prefs.minute, 0, 0);
}

/**
 * Reminders count as paused (Home's NT-09 line) only after three weeks without an open, as the plan's "reminders ignored
 * 3 weeks" row says. The quiet week after the welcome-back is not a pause: the next open schedules everything again.
 */
export const PAUSED_AFTER_DAYS = 21;

export function quietUntil(now: Date): Date {
  return new Date(now.getTime() + PAUSED_AFTER_DAYS * DAY_MS);
}

/**
 * The ordinary reminders before the welcome-back, and none after it: "then silence". Scheduled again on every open,
 * so a reader who returns in time simply gets a new week.
 */
export function remindersBeforeWelcome(now: Date, prefs: ReminderPrefs): Date[] {
  const until = welcomeBackAt(now, prefs).getTime();
  return upcomingTimes(now, prefs).filter((t) => t.getTime() < until);
}

/** The welcome-back's words: the place and nothing else. No notes, no count of days, no verse (rule 9). */
export function welcomeBackTitle(placeName: string): string {
  return `You were in ${placeName}`;
}

export type SmallKind = "verse" | "psalm" | "continue";

export interface SmallOption {
  readonly kind: SmallKind;
  /** "The day’s verse", "A psalm", "Continue Mark 4". */
  readonly title: string;
  readonly minutes: number;
}

/**
 * Start small (RT-07): three ways in, each with how long it takes. The place is the saved one, if there is one;
 * without it there is nothing to continue.
 */
export function smallOptions(placeName: string | null): SmallOption[] {
  const base: SmallOption[] = [
    { kind: "verse", title: "The day’s verse", minutes: 1 },
    { kind: "psalm", title: "A psalm", minutes: 3 },
  ];
  return placeName === null ? base : [...base, { kind: "continue", title: `Continue ${placeName}`, minutes: 5 }];
}

export function minutesLabel(minutes: number): string {
  return `${minutes} min`;
}

export function minutesSpoken(minutes: number): string {
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

/** RT-05's four ways in: the time follows the answer, and the reader can still change it (the pill). */
export const ANCHORS = [
  { id: "wake", label: "After I wake up", hour: 7, minute: 30 },
  { id: "midday", label: "At midday", hour: 12, minute: 30 },
  { id: "work", label: "After work", hour: 18, minute: 0 },
  { id: "bed", label: "Before bed", hour: 21, minute: 0 },
] as const;

export type AnchorId = (typeof ANCHORS)[number]["id"];

/** The anchor whose default time is this one, or null once the reader has moved the time off all four. */
export function anchorAt(hour: number, minute: number): AnchorId | null {
  return ANCHORS.find((a) => a.hour === hour && a.minute === minute)?.id ?? null;
}
