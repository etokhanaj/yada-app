/**
 * The side of "back after a while" (lib/lapse.ts has the rules): when the app was last open, whether RT-01 was shown,
 * and whether this open came through the app icon alone. Kept per device and never synced: a lapse is about this phone.
 */

import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import type { SQLiteDatabase } from "expo-sqlite";

import { showReturn } from "../lib/lapse";
import { loadSettings, saveSetting } from "./user";

/** Stamped when the app is left and after each cold open decides: "away" is measured from the last time it was in use. */
export function stampOpen(user: SQLiteDatabase, at = new Date()): Promise<void> {
  return saveSetting(user, "lastOpenAt", at.toISOString());
}

/**
 * Whether nothing carried this launch in: no notification tap, no widget or Siri link (rule 1). Read once, as this module
 * loads: the root layout clears the notification response once it has opened it, and Home decides after its own reads,
 * so asking later could take a notification launch for a plain one (review, 18 Oct 2026). A Siri or Spotlight door
 * arrives a moment later and closes whatever is open (navigation.ts openFromOutside), so RT-01 can never trap one.
 */
const plainIconOpen: Promise<boolean> = Promise.all([
  Notifications.getLastNotificationResponseAsync().catch(() => null),
  Linking.getInitialURL().catch(() => null),
]).then(([response, url]) => response === null && url === null);

/** Decides RT-01 for this cold launch. Always stamps the open afterwards, so a lapse is shown once. */
export async function decideReturn(user: SQLiteDatabase, hasPlace: boolean, now = new Date()): Promise<boolean> {
  const stored = await loadSettings(user);
  const show = showReturn({
    now: now.getTime(),
    lastOpenAt: stored["lastOpenAt"],
    shownAt: stored["returnShownAt"],
    hasPlace,
    plainOpen: await plainIconOpen,
  });
  if (show) await saveSetting(user, "returnShownAt", now.toISOString());
  await stampOpen(user, now);
  return show;
}
