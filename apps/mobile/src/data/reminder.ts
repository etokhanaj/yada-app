/**
 * The reading reminder's side effects (lib/reminder.ts has the rules): the permission, asked only from the
 * Reminder page's Turn on (NT-02, NT-03); the schedule, two weeks of single notifications made from the
 * reader's own progress on this phone; and what a tap or a long-press does (NT-05: Read, Listen).
 *
 * Kept per device, never synced: a reminder belongs to the phone it rings on.
 */

import { ordToParts, parseVerseId, type BookCode } from "@yada/schema";
import type { SQLiteDatabase } from "expo-sqlite";
import * as Notifications from "expo-notifications";
import { create } from "zustand";

import { system } from "../../modules/yada-system";
import { loadMcheyne, loadYourPlan } from "./plans";
import { type Db, getChapter, getTexts } from "./queries";
import { loadProgress } from "./startHere";
import { loadDays, loadPosition, loadSettings, saveSetting } from "./user";
import { label as psalmsLabel, parsePsalter, setForChoice } from "../lib/dailyPsalms";
import { MCHEYNE_READINGS, nextPortion, portionLabel } from "../lib/plans";
import { quietUntil, remindersBeforeWelcome, welcomeBackAt, welcomeBackTitle } from "../lib/lapse";
import { chapterTitle, excerptOf } from "../lib/reader";
import {
  afterNotNow,
  type AskState,
  askNow,
  nextInJohn,
  parseAsk,
  storeAsk,
  nextInMcheyne,
  parseReminder,
  passageForToday,
  pausedWhileAway,
  psalmForDay,
  type ReminderPrefs,
  type ReminderText,
  rhythmLine,
  weekLine,
  WEEKLY_AT,
  withLine,
  upcomingTimes,
} from "../lib/reminder";
import { nextPassage } from "../lib/startHere";
import { rangeRef, type ReminderRequest, type RichReminder, richVerses } from "../lib/systemSurfaces";
import { rhythmOf, todayKey } from "../lib/rhythm";

const CATEGORY = "reading";

export type Permission = "granted" | "denied" | "undetermined";

interface ReminderState {
  prefs: ReminderPrefs;
  permission: Permission;
  /** NT-09: Home's one line, until Resume or Turn off. */
  paused: boolean;
}

export const useReminder = create<ReminderState>(() => ({ prefs: parseReminder(undefined), permission: "undetermined", paused: false }));

/** Where a reminder opens: the next passage's guide, the plan's next portion, or today's psalm (IA-13). */
interface Target {
  readonly book: BookCode;
  readonly chapter: number;
  readonly verse: number;
  readonly guide?: string;
}

async function permission(): Promise<Permission> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

/** Once a launch, and on each return to the app: read the prefs, then reschedule or note the pause. */
export async function refreshReminder(user: SQLiteDatabase, core: Db): Promise<void> {
  const stored = await loadSettings(user);
  const prefs = parseReminder(stored["reminder"]);
  const now = permission().catch((): Permission => "undetermined");
  // Only a reminder that could ring has paused: refused or failing, it was never running (review, 13 Oct 2026).
  const paused = (await now) === "granted" && pausedWhileAway(stored["reminderUntil"], prefs, new Date());
  useReminder.setState({ prefs, permission: await now, paused });
  if (prefs.on && !paused && (await now) === "granted") await schedule(user, core, prefs);
}

/** Turn on (NT-02): iOS asks here and only here (NT-03); a no leaves the page's one line (NT-10). */
export async function turnOn(user: SQLiteDatabase, core: Db, prefs: ReminderPrefs): Promise<Permission> {
  let now = await permission();
  if (now === "undetermined") {
    const { status } = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    now = status === "granted" ? "granted" : "denied";
  }
  useReminder.setState({ permission: now });
  if (now !== "granted") return now;
  await save(user, { ...prefs, on: true });
  await schedule(user, core, { ...prefs, on: true });
  useReminder.setState({ paused: false });
  return now;
}

export async function turnOff(user: SQLiteDatabase): Promise<void> {
  const prefs = { ...useReminder.getState().prefs, on: false };
  await save(user, prefs);
  await Notifications.cancelAllScheduledNotificationsAsync();
  useReminder.setState({ paused: false });
}

/** A change of time, days or words while on: saved, and the schedule made again. */
export async function changeReminder(user: SQLiteDatabase, core: Db, prefs: ReminderPrefs): Promise<void> {
  await save(user, prefs);
  if (prefs.on && useReminder.getState().permission === "granted") await schedule(user, core, prefs);
}

async function save(user: SQLiteDatabase, prefs: ReminderPrefs): Promise<void> {
  useReminder.setState({ prefs });
  await saveSetting(user, "reminder", JSON.stringify(prefs));
}

/** What the next reminder says, opens and shows on a long-press, from this phone's progress, in the BSB only (rule 9). */
async function nextText(user: SQLiteDatabase, core: Db): Promise<{ text: ReminderText; target: Target; rich: RichReminder | null } | null> {
  if ((await loadYourPlan(user)) === "mcheyne") {
    const next = nextPortion(await loadMcheyne(user));
    const reading = next === null ? undefined : MCHEYNE_READINGS[next.reading];
    const portion = next === null ? undefined : reading?.[next.portion];
    const first = portion?.[0];
    if (next === null || reading === undefined || portion === undefined || first === undefined) return null;
    const text = nextInMcheyne(next.reading + 1, reading.map(portionLabel));
    const verses = (await getChapter(core, first.b, first.c, "BSB")).filter((v) => v.verse >= (first.vs ?? 1));
    const rich = richVerses(first.b, verses);
    return {
      text,
      target: { book: first.b, chapter: first.c, verse: first.vs ?? 1 },
      rich: { overline: text.title, title: portionLabel(portion), titleLine: rich.titleLine, ref: "BSB", verses: rich.verses },
    };
  }
  const p = await loadProgress(user);
  const index = nextPassage(p.passages.length, p.read, p.lastFinished);
  const passage = index === null ? undefined : p.passages[index];
  if (passage === undefined) return null;
  const texts = await getTexts(core, passage.start_ord);
  const start = ordToParts(passage.start_ord);
  const verses = (await getChapter(core, start.book, start.chapter, "BSB")).filter((v) => v.ord >= passage.start_ord && v.ord <= passage.end_ord);
  const rich = richVerses(start.book, verses);
  return {
    text: nextInJohn(passage.label, excerptOf(texts["BSB"] ?? "")),
    target: { book: start.book, chapter: start.chapter, verse: start.verse, guide: passage.pericope_id },
    rich: { overline: "Next in John", title: passage.label, titleLine: rich.titleLine, ref: `${rangeRef(passage.start_ord, passage.end_ord)} · BSB`, verses: rich.verses },
  };
}

/** NT-06, SX-16: the day's psalm, its first verse in the notification and its first two on a long-press. */
async function todayText(core: Db, at: Date): Promise<{ text: ReminderText; target: Target; rich: RichReminder }> {
  const psalm = psalmForDay(at);
  const verses = await getChapter(core, "PSA", psalm, "BSB");
  const rich = richVerses("PSA", verses);
  return {
    text: passageForToday(rich.verses[0]?.text ?? "", psalm),
    target: { book: "PSA", chapter: psalm, verse: 1 },
    rich: { overline: "A passage for today", title: `Psalm ${psalm}`, titleLine: rich.titleLine, ref: `Psalm ${psalm}:1–${rich.verses.length} · BSB`, verses: rich.verses },
  };
}

/** This evening's psalms: the set named, its first verse in the BSB (rule 9), as the morning's "today" text. */
async function eveningText(core: Db, at: Date): Promise<{ text: ReminderText; target: Target; rich: RichReminder } | null> {
  const set = setForChoice(at, "evening", "1662");
  const first = set?.[0];
  if (set === null || first === undefined) return null;
  const verses = (await getChapter(core, "PSA", first.psalm, "BSB")).filter((v) => v.verse >= (first.from ?? 1) && v.verse <= (first.to ?? Infinity));
  const rich = richVerses("PSA", verses);
  const title = `This evening · ${psalmsLabel(set)}`;
  return {
    text: { title, body: rich.verses[0]?.text ?? "" },
    target: { book: "PSA", chapter: first.psalm, verse: first.from ?? 1 },
    rich: { overline: "This evening", title: psalmsLabel(set), titleLine: rich.titleLine, ref: "BSB", verses: rich.verses },
  };
}

/**
 * One scheduling run at a time: the time picker changes on every tick and a return to the app refreshes,
 * and two interleaved cancel-then-schedule runs left both sets (review, 13 Oct 2026).
 */
let scheduling: Promise<void> = Promise.resolve();

function schedule(user: SQLiteDatabase, core: Db, prefs: ReminderPrefs): Promise<void> {
  scheduling = scheduling.then(() => scheduleNow(user, core, prefs)).catch(() => undefined);
  return scheduling;
}

async function scheduleNow(user: SQLiteDatabase, core: Db, prefs: ReminderPrefs): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  // Decision 4 (build-6-decisions.md): a reminder replaces yesterday's. iOS runs nothing of Yada's when a local
  // notification arrives, so the ones already delivered are taken back here, each time Yada opens.
  await system?.removeDeliveredReminders().catch(() => undefined);
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: "read", buttonTitle: "Read", options: { opensAppToForeground: true } },
    // NT-05: Listen reads the BSB, whatever the reader's translation (IA-13).
    { identifier: "listen", buttonTitle: "Listen", options: { opensAppToForeground: true } },
  ]);
  const start = new Date();
  // Build 10a: the ordinary reminders run for the week after this open, then one welcome back, then silence.
  const times = remindersBeforeWelcome(start, prefs);
  const welcomeAt = welcomeBackAt(start, prefs);
  const next = prefs.kind === "next" ? await nextText(user, core) : null;
  const days = await loadDays(user);
  const rhythm = rhythmLine(rhythmOf(days, todayKey(new Date())));
  for (const [i, at] of times.entries()) {
    const found = prefs.kind === "today" ? await todayText(core, at) : next;
    if (found === null) continue;
    // One line at most: Sunday's week in review, else the rhythm on the first reminder only (build 8 plan §H).
    const line = prefs.weekly && at.getDay() === 0 ? weekLine(days, at) : i === 0 ? rhythm : null;
    const one = { ...found, text: withLine(found.text, line) };
    // One per day: scheduling again replaces it rather than adding a second.
    const id = `reminder-${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`;
    if (system !== null) {
      // SX-14–16: the long-press content, the reminder thread and an ordinary relevance, which expo-notifications
      // cannot set on a scheduled notification.
      const request: ReminderRequest = { id, at: at.getTime(), title: one.text.title, body: one.text.body, data: { target: one.target, rich: one.rich } };
      // No nulls: they reach userInfo as NSNull, which is not a property-list type, and the reminder failed to
      // schedule (review, 15 Oct 2026; a John passage has no title line).
      await system.scheduleReminder(JSON.stringify(request, (_, v: unknown) => (v === null ? undefined : v)));
      continue;
    }
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title: one.text.title, body: one.text.body, categoryIdentifier: CATEGORY, data: { target: one.target } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  }
  // The evening reminder (build 7a step 5): this evening's 1662 psalms, on the same days. Only under the 1662
  // table: One a day has no evening set, and Off has none at all.
  const evening = prefs.evening;
  const choice = parsePsalter((await loadSettings(user))["dailyPsalms"]);
  if (evening !== null && choice === "1662") {
    for (const at of upcomingTimes(new Date(), { ...prefs, hour: evening.hour, minute: evening.minute }).filter((t) => t < welcomeAt)) {
      const one = await eveningText(core, at);
      if (one === null) continue;
      const id = `reminder-evening-${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`;
      if (system !== null) {
        const request: ReminderRequest = { id, at: at.getTime(), title: one.text.title, body: one.text.body, data: { target: one.target, rich: one.rich } };
        await system.scheduleReminder(JSON.stringify(request, (_, v: unknown) => (v === null ? undefined : v)));
        continue;
      }
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: { title: one.text.title, body: one.text.body, categoryIdentifier: CATEGORY, data: { target: one.target } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
  }
  // The week in review on its own only when no reminder falls on that Sunday: one notification a day at most,
  // besides the evening psalms (John, 17 Oct 2026).
  if (prefs.weekly) {
    const sundays = upcomingTimes(new Date(), { ...prefs, ...WEEKLY_AT, days: [false, false, false, false, false, false, true] });
    for (const at of sundays.filter((t) => t < welcomeAt)) {
      if (times.some((t) => t.toDateString() === at.toDateString())) continue;
      const line = weekLine(days, at);
      if (line === null) continue;
      const id = `reminder-week-${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`;
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: { title: "Your week", body: line, data: {} },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
  }
  await welcomeBack(user, welcomeAt);
  if (times.length > 0) await saveSetting(user, "reminderUntil", quietUntil(start).toISOString());
}

/**
 * RT-06: one "welcome back" a week after the last open, the place and nothing more (no notes, no count of days, rule 9).
 * Opening Yada schedules everything again, so it only rings for a reader who stayed away; a tap opens the reader at the
 * saved place, not RT-01 (docs/build-10-ux-pass.md rule 2).
 */
async function welcomeBack(user: SQLiteDatabase, at: Date): Promise<void> {
  const saved = await loadPosition(user);
  const place = saved === null ? null : parseVerseId(saved);
  if (place === null) return;
  await Notifications.scheduleNotificationAsync({
    identifier: "welcome-back",
    content: {
      title: welcomeBackTitle(chapterTitle(place.book, place.chapter)),
      categoryIdentifier: CATEGORY,
      data: { target: { book: place.book, chapter: place.chapter, verse: place.verse } },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

/** NT-02's preview: what the next reminder would say, for the words chosen. */
export async function previewReminder(user: SQLiteDatabase, core: Db, kind: ReminderPrefs["kind"]): Promise<ReminderText | null> {
  if (kind === "next") return (await nextText(user, core))?.text ?? null;
  return (await todayText(core, new Date())).text;
}

/** The target a tapped reminder carries, checked: it came back from iOS, not from this code. */
export function targetOf(data: unknown): Target | null {
  const t = (data as { target?: Partial<Target> } | null)?.target;
  if (t === undefined || typeof t.book !== "string" || typeof t.chapter !== "number" || typeof t.verse !== "number") return null;
  const id = parseVerseId(`${t.book}.${t.chapter}.${t.verse}`);
  if (id === null) return null;
  return { book: id.book, chapter: id.chapter, verse: id.verse, ...(typeof t.guide === "string" ? { guide: t.guide } : {}) };
}

export { CATEGORY as REMINDER_CATEGORY };

/** NP-01–03: whether to ask now, from what this phone has stored and iOS's answer so far. */
export async function shouldAsk(user: SQLiteDatabase, where: "passage-end" | "home"): Promise<boolean> {
  const [stored, progress, now] = await Promise.all([loadSettings(user), loadProgress(user), permission().catch((): Permission => "undetermined")]);
  const prefs = parseReminder(stored["reminder"]);
  return askNow(where, parseAsk(stored["reminderAsk"]), { readCount: progress.read.size, on: prefs.on, permission: now, now: Date.now() });
}

async function saveAsk(user: SQLiteDatabase, state: AskState): Promise<void> {
  await saveSetting(user, "reminderAsk", storeAsk(state));
}

/** Not now: asked once more later, then never (NP-03). */
export async function notNow(user: SQLiteDatabase): Promise<void> {
  const stored = await loadSettings(user);
  await saveAsk(user, afterNotNow(parseAsk(stored["reminderAsk"]), Date.now()));
}

/** Turn on from the ask: iOS asks, and whatever it answers, Yada never asks again (the Reminder page holds the rest). */
export async function turnOnFromAsk(user: SQLiteDatabase, core: Db, prefs: ReminderPrefs): Promise<Permission> {
  await saveAsk(user, { kind: "done" });
  return turnOn(user, core, prefs);
}
