/**
 * Remove my data (canvas ST-03, DN-04): exactly what the alert names, from this iPhone and from iCloud —
 * bookmarks, highlights, notes and saved images, the reading place, plan progress, the reminder and downloads. A download under way stops
 * first. Built-in texts stay: they are part of Yada (ST-02). So do the reader's settings (appearance, text
 * size, translation, Compare with): the alert does not name them, and clearing them would reset the
 * reader's other devices through iCloud (review, 13 Oct 2026).
 *
 * Downloaded files are marked removed, as Remove does one at a time; the launch sweep deletes them, never
 * a file with a connection open (data/bundles.ts rule 3). Readings are plain files and go at once.
 *
 * Pray's iCloud records go too (App Store guideline 5.1.1(v)): requests, prayed marks and reports the reader made in
 * the public database, circles they made, and what they wrote in circles they joined, which they then leave. That
 * needs iCloud and a connection, so it goes first; when it cannot, the rest is still removed and the result says so,
 * for Settings to tell the reader rather than claim everything went.
 */

import { isBookCode } from "@yada/schema";
import type { SQLiteDatabase } from "expo-sqlite";
import * as Notifications from "expo-notifications";

import { circlesCloud, prayCloud } from "../../modules/yada-pray";
import { endSession } from "./audio";
import { clearCloud, cloudIdle, setCloudPaused } from "./cloud";
import type { Db } from "./queries";
import { removeAllReadings } from "./recordings";
import { useReminder } from "./reminder";
import { cancelStudyDownloads, removeStudy, useStudy } from "./study";
import { updateWidgets } from "./system";
import { cancelDownload, removeTranslation, useTranslations } from "./translations";
import { cancelUnderstandDownloads, removeUnderstand, useUnderstand } from "./understand";
import { exclusiveWrite, loadSettings } from "./user";
import { parseReminder } from "../lib/reminder";

/** The user.db tables that are the reader's own record; the installed_* tables are handled by Remove. */
const READER_TABLES = ["bookmarks", "bookmark_removals", "position", "thread_progress", "events", "books_begun", "licensed_chapters", "rhythm_days", "chapters_read", "highlights", "notes", "verse_images"] as const;
/** The settings that are the reader's record rather than a preference: the reminder and the plan. */
// reminderOffered is build 5's key, still on phones that upgraded.
const READER_SETTINGS = ["reminder", "reminderUntil", "reminderAsk", "reminderOffered", "yourPlan", "lastOpenAt", "returnShownAt"] as const;

/** DN-04: the alert says the download stops first when one is under way. */
export function downloadUnderWay(): boolean {
  return Object.keys(useTranslations.getState().downloading).length > 0 || Object.keys(useStudy.getState().downloading).length > 0 || Object.keys(useUnderstand.getState().downloading).length > 0;
}

/** Every downloaded file: translations, study notes, Understand and readings (also Remove all downloads). */
export async function removeAllDownloads(user: SQLiteDatabase): Promise<void> {
  for (const code of Object.keys(useTranslations.getState().downloading)) cancelDownload(code);
  cancelStudyDownloads();
  cancelUnderstandDownloads();
  for (const t of useTranslations.getState().installed) await removeTranslation(user, t.code);
  for (const book of Object.keys(useStudy.getState().installed).filter(isBookCode)) await removeStudy(user, book);
  for (const book of Object.keys(useUnderstand.getState().installed).filter(isBookCode)) await removeUnderstand(user, book);
  removeAllReadings();
}

/** "done" also when there is no Pray on this phone (Android, an old binary): there is nothing of it to remove. */
export type PrayRemoval = "done" | "signedOut" | "failed";

export async function removePrayCloud(): Promise<PrayRemoval> {
  if (prayCloud === null) return "done";
  try {
    if ((await prayCloud.accountStatus()) !== "available") return "signedOut";
    await prayCloud.removeMine();
    await circlesCloud?.removeAll();
    return "done";
  } catch {
    return "failed";
  }
}

export async function removeMyData(user: SQLiteDatabase, core: Db): Promise<PrayRemoval> {
  const pray = await removePrayCloud();
  // No sync may read iCloud's copy while the rows go, or merge it back after (review, 13 Oct 2026).
  const icloudOff = (await loadSettings(user))["icloud"] === "off";
  setCloudPaused(true);
  await cloudIdle();
  endSession();
  await removeAllDownloads(user);
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  await exclusiveWrite(async () => {
    await user.withTransactionAsync(async () => {
      for (const table of READER_TABLES) await user.runAsync(`DELETE FROM ${table}`);
      await user.runAsync(`DELETE FROM settings WHERE key IN (${READER_SETTINGS.map(() => "?").join(", ")})`, [...READER_SETTINGS]);
    });
  });
  clearCloud();
  setCloudPaused(icloudOff);
  useReminder.setState({ prefs: parseReminder(undefined), paused: false });
  // The widget's Continue was this place: it goes too.
  await updateWidgets(user, core).catch(() => undefined);
  return pray;
}

/** What Settings says after Remove my data when Pray's iCloud records could not go; null when they did. */
export function prayRemovalLine(r: PrayRemoval): string | null {
  if (r === "signedOut") return "Your prayer requests and circles are still in iCloud. Sign in to iCloud, then remove your data again.";
  if (r === "failed") return "Your prayer requests and circles couldn’t be removed from iCloud. Check your connection, then remove your data again.";
  return null;
}
