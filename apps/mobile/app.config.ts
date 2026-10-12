import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Was app.json. A TypeScript config so the API.Bible key is injected from the
 * build's environment and never lives in source (CLAUDE.md rule 1).
 *
 * `extra` is embedded in the app binary, so the key is extractable from any
 * build that carries it: internal dev builds only (docs/licensed-translations.md).
 */
const build = require("./build.json") as { buildNumber: string };

/**
 * `extra.apiBible`, from the environment this config is evaluated in.
 *
 * Code review, 10 Oct 2026: expo-constants' Xcode build phase evaluates this file during
 * `xcodebuild archive` with the inherited environment, after @expo/env has loaded
 * apps/mobile/.env, .env.local and .env.production, so a flag left in the shell or in any of
 * those files put the key into a TestFlight build. Xcode sets CONFIGURATION for every script
 * phase, so a Release build with the flag fails here. release-ios.sh also refuses the names,
 * strips them from the archive step and checks the archive afterwards.
 */
export function apiBibleExtra(env: Readonly<Record<string, string | undefined>>): { url: string; key: string; enabled: boolean } {
  const licensed = env.YADA_DEV_LICENSED === "1";
  if (licensed && env.CONFIGURATION === "Release") {
    throw new Error("YADA_DEV_LICENSED is set in a Release build: the API.Bible key must never ship (docs/licensed-translations.md).");
  }
  // Without the dev flag the key is not read at all, so an ordinary build carries none.
  return {
    url: licensed ? (env.API_BIBLE_URL ?? "") : "",
    key: licensed ? (env.API_BIBLE_KEY ?? "") : "",
    enabled: licensed,
  };
}

// newArchEnabled is no longer in SDK 57's ExpoConfig type; kept from app.json unchanged.
export default ({ config }: ConfigContext): ExpoConfig & { newArchEnabled: boolean } => {
  return {
    ...config,
    // Placeholder identity: 'Yada' is not yet trademark-cleared (PRD 0E). studio.yada.reader and the
    // display name are John's working choices; revisit both before any App Store submission.
    name: "Yada",
    slug: "yada",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "yada",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "studio.yada.reader",
      // release-ios.sh bumps this file on each upload; config can no longer be rewritten as JSON.
      buildNumber: build.buildNumber,
      supportsTablet: false,
      config: {
        usesNonExemptEncryption: false,
      },
      // iCloud key-value storage (modules/yada-cloud): bookmarks, reading place and settings
      // kept in the reader's own iCloud. The App ID needs the iCloud capability to match.
      entitlements: {
        "com.apple.developer.ubiquity-kvstore-identifier": "$(TeamIdentifierPrefix)$(CFBundleIdentifier)",
      },
      // Audio read-along keeps reading with the screen locked (AU-02; modules/yada-speech).
      infoPlist: {
        UIBackgroundModes: ["audio"],
      },
      icon: {
        light: "./assets/brand/icon.png",
        dark: "./assets/brand/icon-dark.png",
        tinted: "./assets/brand/icon-tinted.png",
      },
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-sqlite",
      [
        "expo-splash-screen",
        {
          image: "./assets/brand/splash-symbol-dark.png",
          imageWidth: 125,
          resizeMode: "contain",
          backgroundColor: "#0E1814",
        },
      ],
    ],
    experiments: {
      typedRoutes: false,
    },
    extra: {
      ...config.extra,
      apiBible: apiBibleExtra(process.env),
    },
  };
};
