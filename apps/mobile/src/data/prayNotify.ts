/**
 * The prayer notifications (PA-01 to PA-03, FL-06; lib/pray.ts has the rules). None ever carries what was asked:
 * Pray again is a local notification Yada schedules when you ask for it after praying, one a day at most; an answered
 * prayer is CloudKit's own notice from a watch made when you prayed, and a circle's new request CloudKit's own notice
 * from one watch per database (modules/yada-pray). Kept per device.
 */

import type { SQLiteDatabase } from "expo-sqlite";
import * as Notifications from "expo-notifications";

import { circlesCloud, prayCloud } from "../../modules/yada-pray";
import { ANSWERED_DAYS, parsePrayNotify, type PrayNotify, prayAgainAt } from "../lib/pray";
import { parseReminder } from "../lib/reminder";
import { loadSettings, saveSetting } from "./user";

const KEY = "prayNotify";
/** One identifier, so asking again replaces the one already set: one a day at most (PA-01). */
export const PRAY_AGAIN_ID = "pray-again";

export async function loadPrayNotify(user: SQLiteDatabase): Promise<PrayNotify> {
  return parsePrayNotify((await loadSettings(user))[KEY]);
}

export async function savePrayNotify(user: SQLiteDatabase, next: PrayNotify): Promise<void> {
  const before = await loadPrayNotify(user);
  await saveSetting(user, KEY, JSON.stringify(next));
  if (!next.answered) await prayCloud?.unwatchAnswered(Date.now() / 1000 + 1);
  if (!next.again) await Notifications.cancelScheduledNotificationAsync(PRAY_AGAIN_ID);
  if (next.circles !== before.circles) await watchCircles(user, next);
}

/**
 * FL-06: the circles' new-request notice follows its switch, and only where notifications are already allowed (a
 * circle never asks). Called when the switch changes and when Pray opens, so a circle joined since is covered.
 */
export async function watchCircles(user: SQLiteDatabase, prefs?: PrayNotify): Promise<void> {
  if (circlesCloud === null) return;
  const on = (prefs ?? (await loadPrayNotify(user))).circles;
  if (on && (await Notifications.getPermissionsAsync()).status !== "granted") return;
  await circlesCloud.watchCircles(on);
}

/** PA-01: asks iOS only here, at the tap; null when notifications are off for Yada. */
export async function prayAgain(user: SQLiteDatabase, request: string): Promise<Date | null> {
  let { status } = await Notifications.getPermissionsAsync();
  if (status === "undetermined") ({ status } = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }));
  if (status !== "granted") return null;
  const at = prayAgainAt(new Date(), parseReminder((await loadSettings(user))["reminder"]));
  await Notifications.scheduleNotificationAsync({
    identifier: PRAY_AGAIN_ID,
    content: { title: "Time to pray again", body: "For the request you held yesterday.", data: { pray: request } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
  return at;
}

/**
 * PA-02: after Prayed, a watch for that request's answer, only where notifications are already allowed (praying never
 * asks). Watches older than a request can live are dropped at the same time.
 */
export async function watchAnswer(user: SQLiteDatabase, request: string): Promise<void> {
  if (prayCloud === null || !(await loadPrayNotify(user)).answered) return;
  if ((await Notifications.getPermissionsAsync()).status !== "granted") return;
  await prayCloud.unwatchAnswered(Date.now() / 1000 - (ANSWERED_DAYS + 1) * 86_400);
  await prayCloud.watchAnswered(request);
}

/** The pray-again data a tapped notification carries, checked: it came back from iOS. */
export function prayAgainOf(data: unknown): string | null {
  const id = (data as { pray?: unknown } | null)?.pray;
  return typeof id === "string" && id !== "" ? id : null;
}
