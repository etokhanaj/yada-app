/**
 * The system surfaces (ios/YadaSystemModule.swift), or null where there are none: Android, web, vitest, or
 * a binary built before this module. Null means the app runs without widgets, Spotlight or Siri.
 */

import { NativeModule, requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

declare class YadaSystemModule extends NativeModule<{ onOpen: () => void; onControl: (e: { command: string }) => void }> {
  takePendingOpen(): string | null;
  /** lib/systemSurfaces.ts ContinueData and TodayData, as JSON. */
  setWidgetData(json: string): void;
  /** lib/systemSurfaces.ts ListeningData as JSON, or "" when nothing plays. */
  setListening(json: string): void;
  /** lib/systemSurfaces.ts ActivityState as JSON. */
  startReading(json: string): Promise<void>;
  endReading(): Promise<void>;
  indexVerses(items: Array<{ id: string; title: string; text: string; keywords: string }>): Promise<void>;
  indexChapters(items: Array<{ id: string; title: string; text: string; keywords: string }>): Promise<void>;
  clearIndex(): Promise<void>;
  /** SX-11: tells Siri the chapters "Read Psalm 23 in Yada" may name. */
  updateShortcuts(): void;
  /** SX-13–16: one reminder, grouped in its thread at an ordinary relevance; lib/systemSurfaces.ts ReminderRequest as JSON. */
  scheduleReminder(json: string): Promise<void>;
  /** SX-15: the reminders already delivered, taken back. */
  removeDeliveredReminders(): Promise<void>;
}

export const system: YadaSystemModule | null = Platform.OS === "ios" ? requireOptionalNativeModule<YadaSystemModule>("YadaSystem") : null;
