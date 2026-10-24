/**
 * The system surfaces (ios/YadaSystemModule.swift), or null where there are none: Android, web, vitest, or
 * a binary built before this module. Null means the app runs without widgets, Spotlight or Siri.
 */

import { NativeModule, requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

declare class YadaSystemModule extends NativeModule<{ onOpen: () => void }> {
  takePendingOpen(): string | null;
  /** lib/systemSurfaces.ts ContinueData and TodayData, as JSON. */
  setWidgetData(json: string): void;
  /** AW-01, AW-03: `{ parts: WatchPart[] }` (lib/systemSurfaces.ts) as JSON, for the watch app and its widgets. */
  setWatchData(json: string): void;
  /** lib/systemSurfaces.ts ListeningData as JSON, or "" when nothing plays. */
  setListening(json: string): void;
  indexVerses(items: Array<{ id: string; title: string; text: string; keywords: string }>): Promise<void>;
  /** SX-12: `name` is the first passage's, "The Lord is my shepherd", or "" where the book's passages are not here. */
  indexChapters(items: Array<{ id: string; title: string; name: string; text: string; keywords: string }>): Promise<void>;
  clearIndex(): Promise<void>;
  /** SX-11: tells Siri the chapters "Read Psalm 23 in Yada" may name. */
  updateShortcuts(): void;
  /** SX-13–16: one reminder, grouped in its thread at an ordinary relevance; lib/systemSurfaces.ts ReminderRequest as JSON. */
  scheduleReminder(json: string): Promise<void>;
  /** SX-15: the reminders already delivered, taken back. */
  removeDeliveredReminders(): Promise<void>;
}

export const system: YadaSystemModule | null = Platform.OS === "ios" ? requireOptionalNativeModule<YadaSystemModule>("YadaSystem") : null;
