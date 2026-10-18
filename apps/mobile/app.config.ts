import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Was app.json. A TypeScript config so the API.Bible key is injected from the
 * build's environment and never lives in source (CLAUDE.md rule 1).
 *
 * `extra` is embedded in the app binary, so the key is extractable from any
 * build that carries it: internal dev builds only (docs/licensed-translations.md).
 * Builds for testers read licensed text through the proxy URL instead.
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

/**
 * `extra.licensedProxy`: the URL of Yada's licensed-translation proxy (services/licensed-proxy),
 * from EXPO_PUBLIC_LICENSED_PROXY_URL. It is a URL, not a secret: the proxy holds the API.Bible key,
 * so this is what lets a TestFlight build read NKJV and NLT without carrying the key (rule 1).
 * Refused when it could carry a credential or point anywhere but a proxy, and plain http only for
 * a local `wrangler dev` in a non-Release build.
 */
export function licensedProxyExtra(env: Readonly<Record<string, string | undefined>>): { url: string } {
  const raw = (env.EXPO_PUBLIC_LICENSED_PROXY_URL ?? "").trim();
  if (raw === "") return { url: "" };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("EXPO_PUBLIC_LICENSED_PROXY_URL is not a URL.");
  }
  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    throw new Error("EXPO_PUBLIC_LICENSED_PROXY_URL must carry no credentials, query or fragment: it ships in the binary.");
  }
  if (/(^|\.)api\.bible$/i.test(url.hostname)) {
    throw new Error("EXPO_PUBLIC_LICENSED_PROXY_URL must be Yada's proxy, not API.Bible itself.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local && env.CONFIGURATION !== "Release")) {
    throw new Error("EXPO_PUBLIC_LICENSED_PROXY_URL must be https (http only for localhost in a non-Release build).");
  }
  return { url: `${url.origin}${url.pathname.replace(/\/+$/, "")}` };
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
      // From the release script's environment (release-ios.sh); the extension targets need it to sign.
      ...(process.env.APPLE_TEAM_ID === undefined ? {} : { appleTeamId: process.env.APPLE_TEAM_ID }),
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
        // CloudKit for Pray and Circles (build 8; John, 18 Oct 2026). The build 7 archive failed when the profile
        // lacked the container (16 Oct 2026): the App ID studio.yada.reader must have iCloud with CloudKit and
        // iCloud.studio.yada.reader ticked in the developer portal before the next archive, or it fails the same way.
        "com.apple.developer.icloud-services": ["CloudKit"],
        "com.apple.developer.icloud-container-identifiers": ["iCloud.studio.yada.reader"],
        // Shared with the widgets (WL-01): the reading place and today's psalm, nothing else. The App ID
        // needs the App Groups capability with this group for a device build.
        "com.apple.security.application-groups": ["group.studio.yada.reader"],
      },
      // Audio read-along keeps reading with the screen locked (AU-02; modules/yada-speech).
      infoPlist: {
        // Circles (build 8): an invitation link opens Yada and hands it the share.
        CKSharingSupported: true,
        UIBackgroundModes: ["audio"],
        // The listening Live Activity (WL-02, WL-03).
        NSSupportsLiveActivities: true,
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
      // The reminder (NT-01–10): local only, asked once after a passage is finished, never at launch.
      "expo-notifications",
      "@react-native-community/datetimepicker",
      // Widgets and the listening Live Activity (WL-01–04): targets/widget.
      "@bacons/apple-targets",
      // Siri, App Shortcuts and the Live Activity's controls, in the app target (MS-02, MS-03).
      "./plugins/withAppIntents",
    ],
    experiments: {
      typedRoutes: false,
    },
    extra: {
      ...config.extra,
      apiBible: apiBibleExtra(process.env),
      licensedProxy: licensedProxyExtra(process.env),
    },
  };
};
