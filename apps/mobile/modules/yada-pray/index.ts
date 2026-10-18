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
}

export const prayCloud: YadaPrayModule | null = Platform.OS === "ios" ? requireOptionalNativeModule<YadaPrayModule>("YadaPray") : null;

/** A circle (build 8 plan §I): one shared zone, its creator's or one you joined. `owner` routes calls to the right database. */
export interface Circle {
  readonly id: string;
  readonly owner: string;
  readonly owned: boolean;
  readonly name: string;
  readonly people: number;
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
}

interface YadaCirclesModule {
  list(): Promise<Circle[]>;
  create(name: string): Promise<string>;
  invite(id: string): Promise<boolean>;
  requests(id: string, owner: string): Promise<CircleRequest[]>;
  ask(id: string, owner: string, text: string, firstName: string): Promise<void>;
  prayed(id: string, owner: string, request: string): Promise<void>;
  report(id: string, owner: string, request: string): Promise<void>;
  renew(id: string, owner: string, request: string): Promise<void>;
  remove(id: string, owner: string, request: string): Promise<void>;
  leave(id: string, owner: string): Promise<void>;
  takeAccepted(): Promise<string[]>;
}

export const circlesCloud: YadaCirclesModule | null = Platform.OS === "ios" ? requireOptionalNativeModule<YadaCirclesModule>("YadaCircles") : null;
