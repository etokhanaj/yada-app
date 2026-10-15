/**
 * Reading plans' progress (lib/plans.ts), in thread_progress so iCloud carries it as it carries John's
 * passages: one row per finished portion, and the plan's own row holding the last one finished.
 *
 * Rows are never removed (sync merges them as a union), so "Start again from reading 1" (DN-03) begins a
 * new round under its own thread name rather than clearing the old one.
 */

import type { SQLiteDatabase } from "expo-sqlite";

import { keyOf, MCHEYNE_READINGS, MCHEYNE_THREAD, type PlanProgress, type PortionKey } from "../lib/plans";
import { loadReadPassages, loadSettings, loadThreadStep, markPassageRead, saveSetting, saveThreadStep } from "./user";

const ROUND_THREAD = `${MCHEYNE_THREAD}-round`;
const roundThread = (round: number) => (round <= 1 ? MCHEYNE_THREAD : `${MCHEYNE_THREAD}-${round}`);

export interface McheyneState extends PlanProgress {
  readonly round: number;
  /** When this round's first portion was read (MM-12: "Begun 3 Sep"). */
  readonly begun: string | null;
}

export async function loadMcheyne(user: SQLiteDatabase): Promise<McheyneState> {
  const round = Math.max(1, await loadThreadStep(user, ROUND_THREAD));
  const thread = roundThread(round);
  const [keys, step, first] = await Promise.all([
    loadReadPassages(user, `${thread}/read/`),
    loadThreadStep(user, thread),
    user.getFirstAsync<{ at: string | null }>("SELECT MIN(updated_at) AS at FROM thread_progress WHERE thread LIKE ? || '%'", [`${thread}/read/`]),
  ]);
  const read = new Set<PortionKey>(keys.filter((k): k is PortionKey => /^\d+\.\d+$/.test(k)));
  const per = MCHEYNE_READINGS[0]?.length ?? 4;
  // The step is the finished portion's place in the year, counted from 1.
  const last = step > 0 ? { reading: Math.floor((step - 1) / per), portion: (step - 1) % per } : null;
  return { round, read, last, begun: first?.at ?? null };
}

/** A portion finished: reaching its chapter's end in the reader, or its row in the plan. Idempotent. */
export function markPortionRead(user: SQLiteDatabase, round: number, reading: number, portion: number): Promise<void> {
  const thread = roundThread(round);
  const per = MCHEYNE_READINGS[0]?.length ?? 4;
  return Promise.all([
    saveSetting(user, "yourPlan", "mcheyne"),
    markPassageRead(user, thread, `${thread}/read/${keyOf(reading, portion)}`, reading * per + portion + 1),
  ]).then(() => undefined);
}

/** DN-03: a new round from reading 1; the finished year stays in the record. */
export function restartMcheyne(user: SQLiteDatabase, round: number): Promise<void> {
  return saveThreadStep(user, ROUND_THREAD, round + 1);
}

export type PlanId = "john" | "mcheyne";

/** Home's "Your plan" (IA-14): the plan last read in, John until another is begun. */
export async function loadYourPlan(user: SQLiteDatabase): Promise<PlanId> {
  return (await loadSettings(user))["yourPlan"] === "mcheyne" ? "mcheyne" : "john";
}

export function chooseYourPlan(user: SQLiteDatabase, plan: PlanId): Promise<void> {
  return saveSetting(user, "yourPlan", plan);
}
