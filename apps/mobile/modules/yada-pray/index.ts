/**
 * Pray for others in CloudKit's public database (ios/YadaPrayModule.swift), or null where there is none: Android,
 * web, vitest, or a binary built before this module. Null hides Pray for someone and Ask; the private list still works.
 */

import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export interface PrayerRequest {
  readonly id: string;
  readonly text: string;
  readonly firstName: string;
  readonly creator: string;
  readonly expiresAt: number;
  readonly createdAt?: number;
  readonly answeredAt?: number;
  /** Only on the asker's own requests. */
  readonly prayed?: number;
}

export type AccountStatus = "available" | "noAccount" | "restricted" | "temporarilyUnavailable" | "couldNotDetermine";

interface YadaPrayModule {
  accountStatus(): Promise<AccountStatus>;
  ask(text: string, firstName: string): Promise<string>;
  open(skip: string[], limit: number): Promise<PrayerRequest[]>;
  prayed(id: string): Promise<void>;
  mine(): Promise<PrayerRequest[]>;
  markAnswered(id: string): Promise<void>;
  renew(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  report(id: string, reason: string): Promise<void>;
  fetch(ids: string[]): Promise<PrayerRequest[]>;
  watchAnswered(id: string): Promise<void>;
  /** `before` is in seconds since 1970. */
  unwatchAnswered(before: number): Promise<void>;
  /** Remove my data: the reader's own requests, prayed marks, reports and watches. */
  removeMine(): Promise<void>;
}

export const prayCloud: YadaPrayModule | null = Platform.OS === "ios" ? requireOptionalNativeModule<YadaPrayModule>("YadaPray") : null;

/** A circle (build 8 plan §I): one shared zone, its creator's or one you joined. `owner` routes calls to the right database. */
export interface Circle {
  readonly id: string;
  readonly owner: string;
  readonly owned: boolean;
  readonly name: string;
  readonly people: number;
  /** The day picture (1 to 30) chosen at New circle; 0 for a circle made before Build 12. */
  readonly picture: number;
}

export interface CircleRequest {
  readonly id: string;
  readonly text: string;
  readonly firstName: string;
  readonly creator: string;
  readonly mine: boolean;
  readonly expiresAt: number;
  /** Members see how many, never who (plan §I.3). */
  readonly prayed: number;
  readonly createdAt: number;
}

/** Someone in a circle (PC-08): the first name iCloud shares with the circle, empty when it shares none. */
export interface CircleMember {
  readonly id: string;
  readonly name: string;
  readonly joined: boolean;
  readonly creator: boolean;
  readonly me: boolean;
}

/** A circle's one planned time to pray together (PC-17, PC-18). `once` is its first time, as one moment; `weekday`, `hour` and `minute` are the planner's own, for changing it. */
export interface Gathering {
  readonly weekday: number;
  readonly hour: number;
  readonly minute: number;
  readonly weekly: boolean;
  readonly minutes: number;
  readonly once: number;
  readonly by: string;
  readonly mine: boolean;
}

export interface Coming {
  readonly member: string;
  readonly week: string;
  readonly going: boolean;
  readonly mine: boolean;
}

/** "on": praying together now; "ask": asked to join those who are (PC-14, PC-21). */
export interface TogetherMark {
  readonly member: string;
  readonly kind: "on" | "ask";
  readonly at: number;
  readonly mine: boolean;
}

export interface CircleLive {
  readonly plan?: Gathering;
  readonly coming: Coming[];
  readonly together: TogetherMark[];
}

interface YadaCirclesModule {
  /** FL-06: CloudKit's own notice when a circle you're in has a new request, in fixed words; off removes it. */
  watchCircles(on: boolean): Promise<void>;
  list(): Promise<Circle[]>;
  create(name: string, picture: number): Promise<string>;
  /** Resolves when the invite sheet closes: true only if someone was invited. */
  invite(id: string): Promise<boolean>;
  requests(id: string, owner: string): Promise<CircleRequest[]>;
  ask(id: string, owner: string, text: string, firstName: string): Promise<void>;
  prayed(id: string, owner: string, request: string): Promise<void>;
  report(id: string, owner: string, request: string): Promise<void>;
  renew(id: string, owner: string, request: string): Promise<void>;
  remove(id: string, owner: string, request: string): Promise<void>;
  leave(id: string, owner: string): Promise<void>;
  members(id: string, owner: string): Promise<CircleMember[]>;
  removeMember(id: string, member: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  /** Circles' zone names, and an ask's as "ask-…|owner", accepted since last asked. */
  takeAccepted(): Promise<string[]>;
  addListener(name: "onAccepted", listener: () => void): { remove(): void };
  /** Ask someone (AO-01 to AO-04): one request shared with one person by its link. */
  askOne(text: string, to: string): Promise<{ id: string; url: string }>;
  /** Your asks of one person, newest first; `answeredAt` 0 when not answered. */
  asks(): Promise<OneAsk[]>;
  answerAsk(id: string): Promise<void>;
  /** Remove my data: circles you made go for everyone; in ones you joined, what you wrote goes and you leave. */
  removeAll(): Promise<void>;
  live(id: string, owner: string): Promise<CircleLive>;
  plan(id: string, owner: string, weekday: number, hour: number, minute: number, weekly: boolean, minutes: number, once: number): Promise<void>;
  unplan(id: string, owner: string): Promise<void>;
  coming(id: string, owner: string, week: string, going: boolean): Promise<void>;
  together(id: string, owner: string, kind: "on" | "ask" | "off"): Promise<void>;
}

export const circlesCloud: YadaCirclesModule | null = Platform.OS === "ios" ? requireOptionalNativeModule<YadaCirclesModule>("YadaCircles") : null;

/** Pray together over FaceTime (ios/YadaTogetherModule.swift): SharePlay carries where the circle is in its requests. */
export type TogetherEvents = {
  onSession(e: { circle: string; name: string }): void;
  onStep(e: { index: number }): void;
  onHere(e: { member: string }): void;
  onPeople(e: { count: number }): void;
  onEnded(): void;
  onEligible(e: { eligible: boolean }): void;
};

interface YadaTogetherModule {
  eligible(): Promise<boolean>;
  /** "started" in a call, "sheet" when FaceTime's own sheet opened to ring people, else "cancelled" or "disabled". */
  start(circle: string, name: string): Promise<"started" | "sheet" | "cancelled" | "disabled">;
  step(index: number): Promise<void>;
  here(member: string): Promise<void>;
  leave(): Promise<void>;
  addToCalendar(title: string, start: number, minutes: number, weekly: boolean): Promise<void>;
  addListener<K extends keyof TogetherEvents>(name: K, listener: TogetherEvents[K]): { remove(): void };
}

export const together: YadaTogetherModule | null = Platform.OS === "ios" ? requireOptionalNativeModule<YadaTogetherModule>("YadaTogether") : null;

/** An ask of one person (AO-01 to AO-04), as the asker sees it; `answeredAt` 0 when not answered. */
export interface OneAsk {
  readonly id: string;
  readonly text: string;
  readonly to: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly answeredAt: number;
  readonly prayed: number;
}

/** Ask someone's system sheets (ios/YadaAskModule.swift): the contact picker needs no access to the contacts. */
interface YadaAskModule {
  pickPerson(): Promise<{ name: string; first: string; phones: string[]; emails: string[] } | null>;
  sendText(to: string[], body: string): Promise<"sent" | "cancelled" | "unavailable">;
  shareText(body: string): Promise<boolean>;
}

export const askNative: YadaAskModule | null = Platform.OS === "ios" ? requireOptionalNativeModule<YadaAskModule>("YadaAsk") : null;
