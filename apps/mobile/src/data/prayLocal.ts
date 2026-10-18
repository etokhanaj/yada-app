/**
 * What Pray keeps on this iPhone, in the settings store (which iCloud key-value storage carries to the reader's other
 * devices): the private prayer list (PR-07), the requests prayed for, so none comes round again (XT-03), and the askers
 * blocked. Nothing here is posted anywhere.
 */

import type { SQLiteDatabase } from "expo-sqlite";

import { loadSettings, saveSetting } from "./user";

const LIST = "prayList";
const PRAYED = "prayPrayed";
const BLOCKED = "prayBlocked";
const HIDDEN = "prayHidden";

function strings(raw: string | undefined): string[] {
  try {
    const v = JSON.parse(raw ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function loadPrayLocal(user: SQLiteDatabase): Promise<{ list: string[]; prayed: Set<string>; blocked: Set<string>; hidden: Set<string> }> {
  const s = await loadSettings(user);
  return { list: strings(s[LIST]), prayed: new Set(strings(s[PRAYED])), blocked: new Set(strings(s[BLOCKED])), hidden: new Set(strings(s[HIDDEN])) };
}

export async function addToList(user: SQLiteDatabase, item: string): Promise<void> {
  const { list } = await loadPrayLocal(user);
  await saveSetting(user, LIST, JSON.stringify([item, ...list]));
}

export async function removeFromList(user: SQLiteDatabase, index: number): Promise<void> {
  const { list } = await loadPrayLocal(user);
  await saveSetting(user, LIST, JSON.stringify(list.filter((_, i) => i !== index)));
}

/** The last 500 are kept: enough that a request never comes round again within its 7 days. */
export async function markPrayed(user: SQLiteDatabase, id: string): Promise<void> {
  const { prayed } = await loadPrayLocal(user);
  await saveSetting(user, PRAYED, JSON.stringify([id, ...[...prayed].filter((p) => p !== id)].slice(0, 500)));
}

export async function block(user: SQLiteDatabase, creator: string): Promise<void> {
  const { blocked } = await loadPrayLocal(user);
  await saveSetting(user, BLOCKED, JSON.stringify([...new Set([creator, ...blocked])]));
}

/** A circle request you reported is hidden from you at once; two reports hide it from the circle (plan §I.8). */
export async function hide(user: SQLiteDatabase, id: string): Promise<void> {
  const { hidden } = await loadPrayLocal(user);
  await saveSetting(user, HIDDEN, JSON.stringify([id, ...[...hidden].filter((h) => h !== id)].slice(0, 500)));
}
