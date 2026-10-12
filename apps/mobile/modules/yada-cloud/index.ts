/**
 * The iCloud key-value store (ios/YadaCloudModule.swift), or null where there
 * is none: Android, web, vitest, or a binary built before this module. Null
 * means the app runs local-only, exactly as it did before sync existed.
 */

import { NativeModule, requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

/** NSUbiquitousKeyValueStoreChangeReasonKey's values. */
export const CloudChangeReason = { server: 0, initialSync: 1, quotaViolation: 2, accountChange: 3 } as const;

export interface CloudChange {
  reason: number;
  keys: string[];
}

declare class YadaCloudModule extends NativeModule<{ onChange: (change: CloudChange) => void }> {
  get(key: string): string | null;
  set(key: string, value: string): void;
  synchronize(): boolean;
}

export const cloudStore: YadaCloudModule | null = Platform.OS === "ios" ? requireOptionalNativeModule<YadaCloudModule>("YadaCloud") : null;
