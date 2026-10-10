/**
 * The app side of licensed translations: the dev-flag accessor and the hook
 * the reader and Compare use. The logic and its terms live in licensed.ts.
 *
 * The flag and key come from app.config.ts `extra.apiBible`, set at build time
 * from YADA_DEV_LICENSED, API_BIBLE_URL and API_BIBLE_KEY. Internal dev builds
 * only: `extra` ships inside the binary.
 */

import type { BookCode } from "@yada/schema";
import Constants from "expo-constants";

import { useSettings } from "../state/settings";
import { useAppData, useQuery } from "./AppData";
import {
  getLicensedChapter,
  isLicensedCode,
  type LicensedChapter,
  type LicensedCode,
  type LicensedConfig,
} from "./licensed";
import { ONLINE_PLACEHOLDERS, registerOnlineProvider } from "./online";

const OFF: LicensedConfig = { url: "", key: "", enabled: false };

export function licensedConfig(): LicensedConfig {
  if (!__DEV__) return OFF;
  const value: unknown = Constants.expoConfig?.extra?.["apiBible"];
  if (typeof value !== "object" || value === null) return OFF;
  const { url, key, enabled } = value as Partial<Record<keyof LicensedConfig, unknown>>;
  if (typeof url !== "string" || typeof key !== "string" || enabled !== true) return OFF;
  return { url, key, enabled };
}

/**
 * Whether licensed translations may be offered at all in this build. Never in a release
 * build, whatever its config carries: code review, 10 Oct 2026 found a key could reach a
 * TestFlight build, and without this the Online group would show (release-ios.sh guards the
 * build itself).
 */
export function licensedEnabled(): boolean {
  if (!__DEV__) return false;
  const config = licensedConfig();
  return config.enabled && config.url !== "" && config.key !== "";
}

/** One chapter of a licensed translation; undefined while it loads, or when `translation` is null. */
export function useLicensedChapter(translation: LicensedCode | null, book: BookCode, chapter: number): LicensedChapter | undefined {
  const { user } = useAppData();
  const { data } = useQuery(
    async () =>
      translation === null
        ? undefined
        : getLicensedChapter(
            { db: user, config: licensedConfig(), fetch: (url, init) => fetch(url, init) },
            translation,
            book,
            chapter,
          ),
    [translation, book, chapter],
  );
  return data;
}

/**
 * Fills the Translations sheet's Online group (data/online.ts) when this build
 * may offer licensed versions, and returns their codes; otherwise registers
 * nothing and returns none. Choosing one only makes it current: the reader
 * fetches it through useLicensedChapter, which owns the cache and the notice.
 */
export function registerLicensedProvider(): string[] {
  if (!licensedEnabled()) return [];
  const translations = ONLINE_PLACEHOLDERS.filter((t) => isLicensedCode(t.code));
  registerOnlineProvider({
    translations,
    choose: (code) => {
      if (isLicensedCode(code)) useSettings.getState().setTranslation(code);
    },
  });
  return translations.map((t) => t.code);
}
