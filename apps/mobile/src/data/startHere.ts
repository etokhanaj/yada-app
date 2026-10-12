/**
 * Start here's progress, read fresh from user.db each time Home or the list
 * comes into view, so progress synced from another device (iCloud, data/cloud.ts) shows
 * as soon as it lands (edge case 8).
 */

import type { SQLiteDatabase } from "expo-sqlite";

import type { PericopeRow } from "../lib/pericopes";
import { READ_PREFIX, readIndexes, START_HERE_BOOK, THREAD } from "../lib/startHere";
import { loadPericopes } from "./understand";
import { loadReadPassages, loadThreadStep } from "./user";

export interface Progress {
  readonly passages: readonly PericopeRow[];
  readonly read: ReadonlySet<number>;
  /** Index of the passage last finished, -1 for none. */
  readonly lastFinished: number;
}

export async function loadProgress(user: SQLiteDatabase): Promise<Progress> {
  const [passages, readIds, step] = await Promise.all([
    loadPericopes(START_HERE_BOOK),
    loadReadPassages(user, READ_PREFIX),
    loadThreadStep(user, THREAD),
  ]);
  return { passages, read: readIndexes(passages, readIds), lastFinished: step - 1 };
}
