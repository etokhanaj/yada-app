/**
 * Pray together's side effects (lib/together.ts has the rules): the SharePlay session as the app sees it, the Together
 * marks that let the circle see who is praying now (PC-14), and the two notices before a planned time (PC-19), made
 * on this phone from the circle's own records.
 */

import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { AccessibilityInfo } from "react-native";
import { create } from "zustand";

import { circlesCloud, type Gathering, together } from "../../modules/yada-pray";
import { circlePicture } from "../lib/pray";
import { comingNotice, GATHER_PREFIX, NOTICE_MINUTES, nextTime, ringNotice } from "../lib/together";

/** PC-15 is shown once per person (settings store, this phone). */
export const TOGETHER_SEEN = "prayTogetherSeen";

interface Session {
  readonly circle: string;
  readonly owner: string;
  readonly name: string;
  /** The circle's picture (lib/pray.ts circlePicture), the call's ground. */
  readonly picture: number;
}

interface TogetherState {
  session: Session | null;
  /** Where the circle is in its requests; Next moves everyone (PC-16). */
  index: number;
  /** Member ids of the phones in the session, the reader's own included. */
  here: string[];
  people: number;
  startedAt: number;
  me: string;
}

const EMPTY = { session: null, index: 0, here: [], people: 0, startedAt: 0, me: "" };
export const useTogether = create<TogetherState>(() => EMPTY);

/** Once, at launch: SharePlay can start Yada from FaceTime, so the session is listened for from the first screen. */
export function followTogether(): () => void {
  if (together === null || circlesCloud === null) return () => undefined;
  const cloud = circlesCloud;
  const subs = [
    together.addListener("onSession", ({ circle, name }) => {
      void (async () => {
        // The activity carries only the zone's name: each phone finds the circle, and its owner, in its own iCloud.
        const found = (await cloud.list().catch(() => [])).find((c) => c.id === circle);
        if (found === undefined) return void together?.leave().catch(() => undefined);
        const me = (await cloud.members(found.id, found.owner).catch(() => [])).find((m) => m.me)?.id ?? "";
        useTogether.setState({ ...EMPTY, session: { circle, owner: found.owner, name: found.name || name, picture: circlePicture(found) }, startedAt: Date.now(), me, here: me === "" ? [] : [me] });
        await cloud.together(found.id, found.owner, "on").catch(() => undefined);
        if (me !== "") await together?.here(me).catch(() => undefined);
        router.push("/pray/together");
      })();
    }),
    together.addListener("onStep", ({ index }) => useTogether.setState({ index })),
    together.addListener("onHere", ({ member }) => useTogether.setState((s) => (s.here.includes(member) ? s : { here: [...s.here, member] }))),
    together.addListener("onPeople", ({ count }) => {
      const { me, people } = useTogether.getState();
      useTogether.setState({ people: count });
      // Someone new: say who is here again, so their screen shows everyone.
      if (count > people && me !== "") void together?.here(me).catch(() => undefined);
    }),
    together.addListener("onEnded", () => {
      const s = useTogether.getState().session;
      if (s !== null) void cloud.together(s.circle, s.owner, "off").catch(() => undefined);
      useTogether.setState(EMPTY);
    }),
  ];
  return () => subs.forEach((s) => s.remove());
}

/** Starts Pray together, saying so when SharePlay is off or it could not start (PC-15). */
export function startTogether(circle: string, name: string): void {
  void together
    ?.start(circle, name)
    .then((how) => {
      if (how === "disabled") AccessibilityInfo.announceForAccessibility("SharePlay is off in FaceTime settings.");
    })
    .catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t start praying together. Try again."));
}

/** Next, for everyone: the session's messenger tells the other phones, and this one moves at once. */
export function step(index: number): void {
  useTogether.setState({ index });
  void together?.step(index).catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t move everyone on. Try Next again."));
}

export function leaveTogether(): void {
  const s = useTogether.getState().session;
  void together?.leave().catch(() => undefined);
  if (s !== null) void circlesCloud?.together(s.circle, s.owner, "off").catch(() => undefined);
  useTogether.setState(EMPTY);
}

/** Asked only at a tap that wants a notice (Plan it, I'll be there), never on opening a circle. */
export async function allowNotices(): Promise<boolean> {
  let { status } = await Notifications.getPermissionsAsync();
  if (status === "undetermined") ({ status } = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }));
  return status === "granted";
}

/**
 * PC-19: the next time's notices, made again each time the circle opens, so a changed time or count is current. The one
 * who planned it is told to ring; those coming hear who will ring them, ten minutes before.
 */
export async function noticeGathering(circle: { id: string; name: string }, plan: Gathering | undefined, planner: string, coming: boolean, going: number): Promise<void> {
  const ring = `${GATHER_PREFIX}${circle.id}-ring`;
  const soon = `${GATHER_PREFIX}${circle.id}-soon`;
  await Promise.all([Notifications.cancelScheduledNotificationAsync(ring), Notifications.cancelScheduledNotificationAsync(soon)]);
  if (plan === undefined || (await Notifications.getPermissionsAsync()).status !== "granted") return;
  const at = nextTime(plan, new Date());
  if (at === null) return;
  const date = (d: Date) => ({ type: Notifications.SchedulableTriggerInputTypes.DATE, date: d }) as const;
  if (plan.mine && at.getTime() > Date.now()) {
    await Notifications.scheduleNotificationAsync({ identifier: ring, content: { ...ringNotice(circle.name, going), data: {} }, trigger: date(at) });
  }
  const before = new Date(at.getTime() - NOTICE_MINUTES * 60_000);
  if (!plan.mine && coming && before.getTime() > Date.now()) {
    await Notifications.scheduleNotificationAsync({ identifier: soon, content: { ...comingNotice(circle.name, at, planner), data: {} }, trigger: date(before) });
  }
}
