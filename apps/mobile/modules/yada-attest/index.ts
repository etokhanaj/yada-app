/**
 * App Attest (ios/YadaAttestModule.swift), or null where there is none: Android, web, vitest, or a
 * binary built before this module. Null, or `isSupported()` false on the simulator, means proxy
 * requests go without a proof, which the proxy accepts only while ATTEST_REQUIRED is off.
 */

import { NativeModule, requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

declare class YadaAttestModule extends NativeModule {
  isSupported(): boolean;
  savedKeyId(): string | null;
  saveKeyId(keyId: string): void;
  forgetKeyId(): void;
  generateKey(): Promise<string>;
  attestKey(keyId: string, challenge: string): Promise<string>;
  generateAssertion(keyId: string, clientData: string): Promise<string>;
}

export const appAttest: YadaAttestModule | null = Platform.OS === "ios" ? requireOptionalNativeModule<YadaAttestModule>("YadaAttest") : null;
