/**
 * Pray together's rules (PC-14 to PC-22, Build 11 canvas), pure so they can be tested: a circle's one planned time, who
 * is coming that week, who is praying now, and the words of the two notices before a time (PC-19), which never carry
 * any request text.
 */

import type { Coming, Gathering, TogetherMark } from "../../modules/yada-pray";

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
/** PC-17's "For about": a time to pray, not a meeting. */
export const LENGTHS = [10, 20, 30, 45] as const;
/** A Together mark older than this is a call that ended without saying so (the phone died, Yada was closed). */
export const TOGETHER_HOURS = 3;
/** PC-19: those coming hear this long before. */
export const NOTICE_MINUTES = 10;

/** PC-19's notices are scheduled under this, so the reading reminder leaves them alone when it schedules itself again. */
export const GATHER_PREFIX = "gather-";

/** "8:00 pm", as the frames write a planned time. */
export function clock(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

/** Monday first, 1 to 7, as Gathering stores it. */
export function weekdayOf(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

/** The ISO week a date falls in, "2026-W43": "coming this week" is counted per week. */
export function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() === 0 ? 7 : t.getUTCDay();
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const start = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - start) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const WEEK = 7 * 86_400_000;

/**
 * The next time it happens from `now`, still on while it runs so a late joiner sees today's; null for a one-off that
 * has passed. `once` holds the first time as one moment for every phone, so a member in another time zone sees it in
 * their own clock (code review, 18 Oct 2026: the planner's weekday and hour were read as local everywhere). Weekly
 * steps are seven days of milliseconds, so across a clock change the time moves by that hour for everyone.
 */
export function nextTime(plan: Pick<Gathering, "weekly" | "once" | "minutes">, now: Date): Date | null {
  const runs = plan.minutes * 60_000;
  if (!plan.weekly) return plan.once + runs > now.getTime() ? new Date(plan.once) : null;
  const k = Math.max(0, Math.ceil((now.getTime() - runs - plan.once) / WEEK));
  return new Date(plan.once + k * WEEK);
}

/** "Every Tuesday · 8:00 pm", or for a one-off "Tuesday 21 Oct · 8:00 pm", in this phone's clock. */
export function planLine(plan: Pick<Gathering, "weekly">, at: Date): string {
  const time = clock(at.getHours(), at.getMinutes());
  const day = DAY_NAMES[weekdayOf(at) - 1];
  if (plan.weekly) return `Every ${day} · ${time}`;
  return `${day} ${at.getDate()} ${at.toLocaleString("en-GB", { month: "short" })} · ${time}`;
}

/** PC-18 and PC-22: "4 of 6 coming this week", and the reader's own can't-make-it said back to them. */
export function comingLine(coming: readonly Coming[], week: string, people: number): string {
  const thisWeek = coming.filter((c) => c.week === week);
  const going = thisWeek.filter((c) => c.going).length;
  const notMe = thisWeek.some((c) => c.mine && !c.going);
  return notMe ? `${going} of ${people} coming · you can’t make it this week` : `${going} of ${people} coming this week`;
}

export function myAnswer(coming: readonly Coming[], week: string): boolean | null {
  return coming.find((c) => c.mine && c.week === week)?.going ?? null;
}

/** Who is praying together now, by member id, freshest first; never the reader. */
export function onNow(marks: readonly TogetherMark[], now: number, kind: TogetherMark["kind"] = "on"): string[] {
  return marks
    .filter((m) => m.kind === kind && !m.mine && now - m.at < TOGETHER_HOURS * 3_600_000)
    .sort((a, b) => b.at - a.at)
    .map((m) => m.member);
}

/** "Sam and Ada are praying together"; names come from the circle's share, and someone unnamed is "Someone". */
export function liveLine(names: readonly string[]): string | null {
  const n = names.map((x) => (x === "" ? "Someone" : x));
  if (n.length === 0) return null;
  if (n.length === 1) return `${n[0]} is praying together`;
  const list = n.length === 2 ? `${n[0]} and ${n[1]}` : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
  return `${list} are praying together`;
}

/** PC-19, ten minutes before, to those coming. */
export function comingNotice(circle: string, at: Date, planner: string): { title: string; body: string } {
  return {
    title: `${circle} prays together at ${clock(at.getHours(), at.getMinutes())}`,
    body: planner === "" ? "You’ll be rung on FaceTime." : `${planner} will ring you on FaceTime.`,
  };
}

/** PC-19, at the time, to the one who planned it: how many said they'd come when Yada last looked. */
export function ringNotice(circle: string, going: number): { title: string; body: string } {
  return { title: `Time to ring ${circle}`, body: going === 0 ? "No one has said they’d come yet." : `${going} ${going === 1 ? "person" : "people"} said they’d come.` };
}
