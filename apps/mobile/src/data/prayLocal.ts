/**
 * What Pray keeps on this iPhone, in the settings store. These keys are not SYNCED_SETTINGS (lib/cloudSync.ts), so
 * iCloud does not carry them to the reader's other devices: the private prayer list with the dates each was added and answered (PR-07), the requests prayed for, so
 * none comes round again (XT-03), and the askers blocked. Nothing here is posted anywhere.
 */

import type { SQLiteDatabase } from "expo-sqlite";

import { type ListItem, parseList } from "../lib/pray";
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

export async function loadPrayLocal(user: SQLiteDatabase): Promise<{ list: ListItem[]; prayed: Set<string>; blocked: Set<string>; hidden: Set<string> }> {
  const s = await loadSettings(user);
  return { list: parseList(s[LIST]), prayed: new Set(strings(s[PRAYED])), blocked: new Set(strings(s[BLOCKED])), hidden: new Set(strings(s[HIDDEN])) };
}

/** PR-07's "Added 2 Oct": each new item keeps the moment it was added. */
export async function addToList(user: SQLiteDatabase, text: string, now = Date.now()): Promise<void> {
  const { list } = await loadPrayLocal(user);
  await saveSetting(user, LIST, JSON.stringify([{ text, added: now }, ...list]));
}

/** PR-07's "Answered 12 Oct": the reader marks it; the item stays on the list with its date. */
export async function markListAnswered(user: SQLiteDatabase, index: number, now = Date.now()): Promise<void> {
  const { list } = await loadPrayLocal(user);
  await saveSetting(user, LIST, JSON.stringify(list.map((item, i) => (i === index ? { ...item, answered: now } : item))));
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

/** PC-11: Edit keeps the item's dates and changes its words. */
export async function editListItem(user: SQLiteDatabase, index: number, text: string): Promise<void> {
  const { list } = await loadPrayLocal(user);
  await saveSetting(user, LIST, JSON.stringify(list.map((item, i) => (i === index ? { ...item, text } : item))));
}

/** PC-11: Undo puts a removed item back where it was. */
export async function restoreListItem(user: SQLiteDatabase, index: number, item: ListItem): Promise<void> {
  const { list } = await loadPrayLocal(user);
  await saveSetting(user, LIST, JSON.stringify([...list.slice(0, index), item, ...list.slice(index)]));
}

const RULES = "prayRulesAgreed";

/** Guideline 1.2: a reader agrees to Pray's rules once, before their first request in Pray or a circle. */
export async function agreedToRules(user: SQLiteDatabase): Promise<boolean> {
  return (await loadSettings(user))[RULES] !== undefined;
}

export async function agreeToRules(user: SQLiteDatabase, now = Date.now()): Promise<void> {
  await saveSetting(user, RULES, String(now));
}
