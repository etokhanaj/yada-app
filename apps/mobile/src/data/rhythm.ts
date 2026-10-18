/**
 * What counts a day for the streak (build 7 plan §2 row 8 and §6): reading, counted by the reader when a passage
 * or a chapter is read to its end, and listening, counted here after two minutes of playing in the day.
 */

import type { SQLiteDatabase } from "expo-sqlite";

import { todayKey } from "../lib/rhythm";
import { useAudio } from "../state/audio";
import { countDay } from "./user";

const LISTEN_COUNTS_AFTER_MS = 2 * 60 * 1000;

/**
 * Started once at launch. It follows the player rather than sampling it: a timer runs only while audio plays, for
 * the time still needed to reach two minutes today. It sampled every 15 s from launch, even with nothing playing
 * (review, 18 Oct 2026; CLAUDE.md "no polling").
 */
export function countListening(user: SQLiteDatabase): void {
  let day = "";
  let played = 0;
  let since: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const today = () => {
    const now = todayKey(new Date());
    if (now !== day) {
      day = now;
      played = 0;
    }
  };
  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
    if (since !== null) played += Date.now() - since;
    since = null;
  };
  const start = () => {
    today();
    if (played >= LISTEN_COUNTS_AFTER_MS) return;
    since = Date.now();
    timer = setTimeout(() => {
      stop();
      void countDay(user).catch(() => undefined);
    }, LISTEN_COUNTS_AFTER_MS - played);
  };

  useAudio.subscribe((state, previous) => {
    const playing = state.session?.status === "playing";
    const was = previous.session?.status === "playing";
    if (playing && !was) start();
    else if (!playing && was) stop();
  });
}
