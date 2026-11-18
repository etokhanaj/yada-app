/**
 * The app side of licensed translations: which source this build reads from, the served set,
 * and the hook the reader and Compare use. The logic and its terms live in licensed.ts.
 *
 * Two sources, from app.config.ts `extra`:
 * - `licensedProxy.url` (EXPO_PUBLIC_LICENSED_PROXY_URL at build time): Yada's proxy, which holds
 *   the API.Bible key server-side. Any build, TestFlight included. A URL, not a secret.
 * - `apiBible` (YADA_DEV_LICENSED, API_BIBLE_URL, API_BIBLE_KEY): straight to API.Bible with the
 *   key. John's internal dev builds only, and only while __DEV__: `extra` ships inside the binary.
 */

import { type BookCode, verseOrd } from "@yada/schema";
import Constants from "expo-constants";
import { create } from "zustand";

import { useSettings } from "../state/settings";
import { useAppData, useQuery } from "./AppData";
import {
  getLicensedChapter,
  isLicensedCode,
  LICENSED,
  licensedConfigUsable,
  loadServed,
  ON_ACCOUNT,
  saveServed,
  type LicensedChapter,
  type LicensedCode,
  type LicensedConfig,
  type LicensedDb,
  type LicensedSearch,
  countLicensedSearch,
  licensedSearchLeft,
  searchLicensed,
} from "./licensed";
import { appAttest } from "../../modules/yada-attest";
import { type Attestor, createAttestor } from "./attest";
import { ONLINE_PLACEHOLDERS, registerOnlineProvider } from "./online";
import { type InstalledTranslation, translationName } from "./translations";

/**
 * The full name of any version Compare can show, licensed ones included. Compare and its chooser each built this
 * the same way; one function keeps the two from naming a version differently. Here, not in translations.ts, so
 * the list of files that import data/licensed stays as rule 9's test allows (lib/licensedSurfaces.test.ts).
 */
export function versionName(code: string, installed: readonly InstalledTranslation[]): string {
  return isLicensedCode(code) ? (LICENSED.find((t) => t.code === code)?.name ?? code) : translationName(code, installed);
}

const OFF: LicensedConfig = { via: "proxy", url: "", enabled: false };

export function licensedConfig(): LicensedConfig {
  const extra: Record<string, unknown> | undefined = Constants.expoConfig?.extra;
  // Code review, 10 Oct 2026: a key could reach a TestFlight build, so the keyed path is never
  // taken outside __DEV__, whatever the config carries (release-ios.sh guards the build itself).
  if (__DEV__) {
    const value = extra?.["apiBible"];
    if (typeof value === "object" && value !== null) {
      const { url, key, enabled } = value as Partial<Record<"url" | "key" | "enabled", unknown>>;
      if (typeof url === "string" && typeof key === "string" && enabled === true && url !== "" && key !== "") {
        return { via: "api-bible", url, key, enabled };
      }
    }
  }
  const proxy = extra?.["licensedProxy"];
  if (typeof proxy === "object" && proxy !== null) {
    const { url } = proxy as { url?: unknown };
    if (typeof url === "string" && url !== "") return { via: "proxy", url, enabled: true };
  }
  return OFF;
}

let attestor: { url: string; value: Attestor } | null = null;

/** The proxy's App Attest proof (attest.ts), one per proxy URL; none on the dev path straight to API.Bible. */
function proxyAttest(): Attestor | undefined {
  const config = licensedConfig();
  if (config.via !== "proxy" || config.url === "") return undefined;
  if (attestor?.url !== config.url) attestor = { url: config.url, value: createAttestor(appAttest, config.url, (url, init) => fetch(url, init)) };
  return attestor.value;
}

/** Whether licensed translations may be offered at all in this build. */
export function licensedEnabled(): boolean {
  return licensedConfigUsable(licensedConfig());
}

/** The versions this build may offer now: the proxy's last-named set, or the account's on the dev path. */
const useServed = create<{ codes: readonly LicensedCode[] }>(() => ({ codes: [] }));

export function licensedCodes(): readonly LicensedCode[] {
  return useServed.getState().codes;
}

/** Run at launch, before settings hydrate: what may be offered, from user.db. */
export async function loadLicensedCodes(db: LicensedDb): Promise<LicensedCode[]> {
  const config = licensedConfig();
  if (!licensedConfigUsable(config)) return [];
  return config.via === "api-bible" ? [...ON_ACCOUNT] : loadServed(db);
}

/** The proxy named a different set: keep it for the next launch and redraw the Online group now. */
function followServed(db: LicensedDb, codes: LicensedCode[]): void {
  const current = useServed.getState().codes;
  if (codes.length === current.length && codes.every((c) => current.includes(c))) return;
  void saveServed(db, codes).catch(() => undefined);
  registerLicensedProvider(codes);
}

/** One chapter of a licensed translation; undefined while it loads, or when `translation` is null. */
export function useLicensedChapter(translation: LicensedCode | null, book: BookCode, chapter: number, attempt = 0): LicensedChapter | undefined {
  const { user } = useAppData();
  const { data } = useQuery(
    async () =>
      translation === null
        ? undefined
        : getLicensedChapter(
            {
              db: user,
              config: licensedConfig(),
              fetch: (url, init) => fetch(url, init),
              attest: proxyAttest(),
              onServed: (codes) => followServed(user, codes),
            },
            translation,
            book,
            chapter,
          ),
    // `attempt` changes on Try again (US-07), so the same chapter is asked for afresh.
    [translation, book, chapter, attempt],
  );
  return data;
}

/**
 * Fills the Translations sheet's Online group (data/online.ts) with `codes`, the versions this
 * build may offer, and returns them; with none it registers nothing. Choosing one only makes it
 * current: the reader fetches it through useLicensedChapter, which owns the cache and the notice.
 */
export function registerLicensedProvider(codes: readonly LicensedCode[]): LicensedCode[] {
  const served = licensedEnabled() ? [...codes] : [];
  useServed.setState({ codes: served });
  if (served.length === 0) {
    registerOnlineProvider(null);
    return [];
  }
  registerOnlineProvider({
    translations: ONLINE_PLACEHOLDERS.filter((t) => isLicensedCode(t.code) && served.includes(t.code)),
    choose: (code) => {
      if (isLicensedCode(code) && useServed.getState().codes.includes(code)) useSettings.getState().setTranslation(code);
    },
  });
  return served;
}

/**
 * Search in a licensed version; undefined while it runs, or when `translation` is null (EG-06).
 * `query` is the submitted search only, never each keystroke: every one costs an API.Bible call
 * (docs/licensed-online-plan.md, stress test), and this phone has LICENSED_SEARCHES_A_MONTH of them.
 */
export function useLicensedSearch(translation: LicensedCode | null, query: string): LicensedSearch | undefined {
  const { user } = useAppData();
  const { data } = useQuery(async () => {
    if (translation === null || query.length < 2) return undefined;
    if (!(await licensedSearchLeft(user))) return { status: "limit", translation } satisfies LicensedSearch;
    const result = await searchLicensed({ config: licensedConfig(), fetch: (url, init) => fetch(url, init), attest: proxyAttest() }, translation, query);
    if (result.status === "ok") await countLicensedSearch(user);
    return result;
  }, [translation, query]);
  return data;
}

/**
 * A licensed version's verses for Compare (CP-07, CP-09), chapter by chapter through the same 30-day
 * cache as the reader. Display only: these words are compared on screen and go nowhere else (rule 9).
 */
export async function loadLicensedVerses(
  db: LicensedDb,
  translation: LicensedCode,
  book: BookCode,
  chapters: readonly number[],
): Promise<{ texts: Map<number, string>; copyright: string | null; available: boolean }> {
  const texts = new Map<number, string>();
  let copyright: string | null = null;
  for (const chapter of chapters) {
    const result = await getLicensedChapter({ db, config: licensedConfig(), fetch: (url, init) => fetch(url, init), attest: proxyAttest() }, translation, book, chapter);
    if (result.status !== "ok") return { texts, copyright, available: false };
    copyright = result.copyright;
    for (const v of result.verses) texts.set(verseOrd(book, chapter, v.verse), v.text);
  }
  return { texts, copyright, available: true };
}
