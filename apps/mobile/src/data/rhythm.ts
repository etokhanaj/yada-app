/**
 * What counts a day for the streak (build 7 plan §2 row 8 and §6): reading, counted by the reader when a passage
 * or a chapter is read to its end, and listening, counted here after two minutes of playing in the day.
 */

import type { SQLiteDatabase } from "expo-sqlite";

import { todayKey } from "../lib/rhythm";
import { useAudio } from "../state/audio";
import { countDay } from "./user";

const LISTEN_COUNTS_AFTER_MS = 2 * 60 * 1000;
const TICK_MS = 15 * 1000;

/** Started once at launch; sampling the player is enough at this grain. */
export function countListening(user: SQLiteDatabase): void {
  let day = "";
  let played = 0;
  setInterval(() => {
    if (useAudio.getState().session?.status !== "playing") return;
    const now = todayKey(new Date());
    if (now !== day) {
      day = now;
      played = 0;
    }
    played += TICK_MS;
    if (played === LISTEN_COUNTS_AFTER_MS) void countDay(user).catch(() => undefined);
  }, TICK_MS);
}
