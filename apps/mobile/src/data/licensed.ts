/**
 * Licensed translations (NKJV, NLT, MSG; NIV known but off the account) read live: in a release or TestFlight build through
 * Yada's proxy (services/licensed-proxy), which holds the API.Bible key; in John's flagged dev
 * builds straight from API.Bible with the key, as before.
 *
 * Display-only (CLAUDE.md rule 9): nothing here may be imported by
 * packages/pipeline or reach any AI call. The terms bind this file
 * (docs/licensed-translations.md):
 * - §4.1 never alter the text: verses are sliced out of the returned chapter at
 *   its verse markers and nothing else; no word, letter or punctuation mark is
 *   changed, and line breaks inside a verse (NLT poetry) are kept.
 * - §7 attribution: the chapter's copyright notice is passed through verbatim.
 * - §11 offline cache: a chapter is kept at most 30 days from when API.Bible sent it
 *   (the proxy's `fetchedAt`: it keeps one shared copy, 18 Oct 2026, so a chapter can
 *   reach the phone already days old). An older copy is never shown, even offline; it
 *   is refetched, or the reader is told to connect.
 *
 * Pure: the database, fetch and clock are passed in, so tests run against
 * node:sqlite with a mocked fetch and never touch the network.
 */

import type { BookCode } from "@yada/schema";

export type LicensedCode = "NIV" | "NKJV" | "NLT" | "MSG";

export const LICENSED: ReadonlyArray<{ code: LicensedCode; name: string; bibleId: string }> = [
  { code: "NIV", name: "New International Version", bibleId: "78a9f6124f344018-01" },
  { code: "NKJV", name: "New King James Version", bibleId: "63097d2a0a2f7db3-01" },
  { code: "NLT", name: "New Living Translation", bibleId: "d6e14a625393b4da-01" },
  { code: "MSG", name: "The Message", bibleId: "6f11a7de016f942e-01" },
];

export function isLicensedCode(value: unknown): value is LicensedCode {
  return LICENSED.some((t) => t.code === value);
}

/**
 * What the API.Bible account holds, which the dev path (keyed, no proxy) offers. John swapped NIV
 * for MSG on the account on 12 Oct 2026, so a dev build offering NIV would only get API.Bible errors.
 */
export const ON_ACCOUNT: readonly LicensedCode[] = ["NKJV", "NLT", "MSG"];

/**
 * What the app assumes the proxy serves until it has heard otherwise: the proxy's SERVED var as
 * deployed (services/licensed-proxy/wrangler.toml). NIV is off the account since 12 Oct 2026 (Biblica's
 * licence excludes products with AI features) and MSG replaced it. The proxy's allowlist is the
 * authority, and every proxy response names the current set in this header, so any version can be
 * switched on or off on the server with no app update.
 */
export const DEFAULT_SERVED: readonly LicensedCode[] = ["NKJV", "NLT", "MSG"];
export const SERVED_HEADER = "Yada-Served";

/** "NKJV,NLT,MSG" to known codes; anything else is dropped. Null when the header is missing. */
export function parseServed(raw: string | null | undefined): LicensedCode[] | null {
  if (raw === null || raw === undefined) return null;
  const named = new Set(raw.split(",").map((s) => s.trim().toUpperCase()));
  return LICENSED.map((t) => t.code).filter((code) => named.has(code));
}

/**
 * API.Bible chapter ids are `{book}.{chapter}` with USFM book ids (GEN, 1CO,
 * JHN, PSA, SNG, EZK, JOL, NAM, PHP, JAS, JUD...). Yada's book codes are the
 * same USFM codes (packages/schema refs.ts), so the mapping is the identity;
 * it is a function so a translation that ever differs has one place to say so.
 */
export function apiBibleChapterId(book: BookCode, chapter: number): string {
  return `${book}.${chapter}`;
}

export const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const LICENSED_DDL = `
CREATE TABLE IF NOT EXISTS licensed_chapters (
  translation TEXT NOT NULL,
  chapter_id  TEXT NOT NULL,
  content     TEXT NOT NULL,
  copyright   TEXT NOT NULL,
  fetched_at  TEXT NOT NULL,
  PRIMARY KEY (translation, chapter_id)
);

-- This calendar month's searches in a licensed version (LICENSED_SEARCHES_A_MONTH).
CREATE TABLE IF NOT EXISTS licensed_search_month (
  id    INTEGER PRIMARY KEY CHECK (id = 1),
  month TEXT NOT NULL,
  count INTEGER NOT NULL
);

-- The proxy's served set as last heard (SERVED_HEADER). No row: DEFAULT_SERVED.
CREATE TABLE IF NOT EXISTS licensed_served (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  codes   TEXT NOT NULL,
  seen_at TEXT NOT NULL
);
`;

export interface LicensedVerse {
  readonly verse: number;
  /** Last verse of a bridged span ("[1-2]"); equal to `verse` otherwise. */
  readonly through: number;
  readonly text: string;
}

export type LicensedChapter =
  | {
      readonly status: "ok";
      readonly translation: LicensedCode;
      readonly verses: readonly LicensedVerse[];
      /** Verbatim from API.Bible; shown at the chapter foot (§7). */
      readonly copyright: string;
      readonly fetchedAt: string;
      readonly fromCache: boolean;
    }
  | { readonly status: "needs-connection"; readonly translation: LicensedCode }
  | { readonly status: "disabled"; readonly translation: LicensedCode }
  | { readonly status: "error"; readonly translation: LicensedCode; readonly reason: "http"; readonly httpStatus: number }
  // A 2xx whose body is not a chapter. Was reported as httpStatus 200 (review, 10 Oct 2026).
  | { readonly status: "error"; readonly translation: LicensedCode; readonly reason: "malformed" | "timeout" }
  // The proxy has spent this month's API.Bible calls (services/licensed-proxy/src/budget.ts): trying
  // again will not help until the plan month turns.
  | { readonly status: "error"; readonly translation: LicensedCode; readonly reason: "budget" };

/**
 * Where chapters come from. `api-bible` carries the key and exists only in a flagged dev build
 * (useLicensedChapter.ts checks __DEV__). `proxy` carries no key: a binary's `extra` can be
 * extracted, so a build that reaches testers holds only the proxy's URL (CLAUDE.md rule 1).
 */
export type LicensedConfig =
  | { readonly via: "api-bible"; readonly url: string; readonly key: string; readonly enabled: boolean }
  | { readonly via: "proxy"; readonly url: string; readonly enabled: boolean };

export function licensedConfigUsable(config: LicensedConfig): boolean {
  return config.enabled && config.url !== "" && (config.via === "proxy" || config.key !== "");
}

/** The slice of expo-sqlite's database this file uses; node:sqlite is wrapped to it in tests. */
export interface LicensedDb {
  getFirstAsync<T>(sql: string, params: Array<string | number | null>): Promise<T | null>;
  runAsync(sql: string, params: Array<string | number | null>): Promise<unknown>;
}

export interface LicensedDeps {
  readonly db: LicensedDb;
  readonly config: LicensedConfig;
  readonly fetch: (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
    readonly headers?: { get(name: string): string | null };
  }>;
  readonly now?: () => Date;
  /** The proxy named its served set; called on every proxy response that carries one. */
  readonly onServed?: (codes: LicensedCode[]) => void;
  /** How long a load may take before the page says it needs a connection (US-07); tests shorten it. */
  readonly timeoutMs?: number;
}

/**
 * Review §3 B4: a slow licensed load showed a blank page for up to about 60 s. After this long the page
 * says what it would say offline (US-07), with no skeleton (CLAUDE.md design rules).
 */
export const LICENSED_LOAD_TIMEOUT_MS = 8_000;

/** Yada's proxy: the translation code and chapter id, and nothing about the reader. */
export function proxyChapterUrl(baseUrl: string, translation: LicensedCode, chapterId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/v1/chapter/${encodeURIComponent(translation)}/${encodeURIComponent(chapterId)}`;
}

export function chapterUrl(baseUrl: string, bibleId: string, chapterId: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return (
    `${base}/v1/bibles/${encodeURIComponent(bibleId)}/chapters/${encodeURIComponent(chapterId)}` +
    "?content-type=text&include-notes=false&include-titles=false&include-verse-numbers=true"
  );
}

const MARKER = /\[(\d+)(?:-(\d+))?\]/g;

/**
 * Split a `content-type=text` chapter at its `[n]` markers. Each verse is the
 * returned text between one marker and the next, with only the separating
 * whitespace at its two ends removed; everything inside is kept as sent.
 */
export function parseChapterText(content: string): LicensedVerse[] {
  const marks = Array.from(content.matchAll(MARKER));
  return marks.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = marks[i + 1]?.index ?? content.length;
    const verse = Number(m[1]);
    return {
      verse,
      through: m[2] === undefined ? verse : Number(m[2]),
      text: content.slice(start, end).replace(/^[ \t]+/, "").replace(/\s+$/, ""),
    };
  });
}

interface ChapterText {
  content: string;
  copyright: string;
  /** The proxy's: when API.Bible sent this copy. Absent on the dev path, which fetches it now. */
  fetchedAt?: string;
}

/**
 * API.Bible wraps the chapter in `data`; the proxy sends `{ translation, chapter, content,
 * copyright }` with both strings passed through unaltered (services/licensed-proxy).
 */
function chapterText(value: unknown, via: LicensedConfig["via"]): ChapterText | null {
  if (typeof value !== "object" || value === null) return null;
  const body = via === "api-bible" ? (value as { data?: unknown }).data : value;
  if (typeof body !== "object" || body === null) return null;
  const { content, copyright, fetchedAt } = body as { content?: unknown; copyright?: unknown; fetchedAt?: unknown };
  if (typeof content !== "string" || typeof copyright !== "string") return null;
  return typeof fetchedAt === "string" ? { content, copyright, fetchedAt } : { content, copyright };
}

/** The proxy's fetch time, or now: never later than now, so a bad clock cannot stretch the 30 days. */
function fetchedTime(text: ChapterText, now: Date): string {
  const at = text.fetchedAt === undefined ? Number.NaN : Date.parse(text.fetchedAt);
  return Number.isNaN(at) || at > now.getTime() ? now.toISOString() : new Date(at).toISOString();
}

interface CacheRow {
  content: string;
  copyright: string;
  fetched_at: string;
}

export async function getLicensedChapter(
  deps: LicensedDeps,
  translation: LicensedCode,
  book: BookCode,
  chapter: number,
): Promise<LicensedChapter> {
  const { db, config } = deps;
  if (!licensedConfigUsable(config)) return { status: "disabled", translation };
  const now = (deps.now ?? (() => new Date()))();
  const chapterId = apiBibleChapterId(book, chapter);

  const cached = await db.getFirstAsync<CacheRow>(
    "SELECT content, copyright, fetched_at FROM licensed_chapters WHERE translation = ? AND chapter_id = ?",
    [translation, chapterId],
  );
  if (cached !== null) {
    if (now.getTime() - Date.parse(cached.fetched_at) < CACHE_MAX_AGE_MS) return ok(translation, cached, true);
    // §11: a copy past 30 days may not be kept or shown, even offline.
    await db.runAsync("DELETE FROM licensed_chapters WHERE translation = ? AND chapter_id = ?", [translation, chapterId]);
  }

  const bible = LICENSED.find((t) => t.code === translation);
  if (bible === undefined) return { status: "disabled", translation };

  let response: Awaited<ReturnType<LicensedDeps["fetch"]>>;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deps.timeoutMs ?? LICENSED_LOAD_TIMEOUT_MS);
  try {
    response =
      config.via === "proxy"
        ? await deps.fetch(proxyChapterUrl(config.url, translation, chapterId), { headers: { Accept: "application/json" }, signal: controller.signal })
        : await deps.fetch(chapterUrl(config.url, bible.bibleId, chapterId), { headers: { "api-key": config.key }, signal: controller.signal });
  } catch {
    clearTimeout(timer);
    // A slow load online is a failure to try again, not an offline page with no Try again (US-07).
    return timedOut ? { status: "error", translation, reason: "timeout" } : { status: "needs-connection", translation };
  }
  if (config.via === "proxy") {
    const served = parseServed(response.headers?.get(SERVED_HEADER));
    if (served !== null) deps.onServed?.(served);
  }
  if (!response.ok) {
    clearTimeout(timer);
    if (config.via === "proxy" && response.status === 503 && (await errorOf(response)) === "budget") return { status: "error", translation, reason: "budget" };
    return { status: "error", translation, reason: "http", httpStatus: response.status };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: "error", translation, reason: timedOut ? "timeout" : "malformed" };
  } finally {
    clearTimeout(timer);
  }
  const text = chapterText(body, config.via);
  if (text === null) return { status: "error", translation, reason: "malformed" };

  const row: CacheRow = { content: text.content, copyright: text.copyright, fetched_at: fetchedTime(text, now) };
  await db.runAsync(
    `INSERT INTO licensed_chapters (translation, chapter_id, content, copyright, fetched_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(translation, chapter_id) DO UPDATE SET content = excluded.content, copyright = excluded.copyright, fetched_at = excluded.fetched_at`,
    [translation, chapterId, row.content, row.copyright, row.fetched_at],
  );
  return ok(translation, row, false);
}

async function errorOf(response: { json(): Promise<unknown> }): Promise<string | null> {
  try {
    const { error } = ((await response.json()) ?? {}) as { error?: unknown };
    return typeof error === "string" ? error : null;
  } catch {
    return null;
  }
}

function ok(translation: LicensedCode, row: CacheRow, fromCache: boolean): LicensedChapter {
  return {
    status: "ok",
    translation,
    verses: parseChapterText(row.content),
    copyright: row.copyright,
    fetchedAt: row.fetched_at,
    fromCache,
  };
}

/** §18.8: everything cached must go within 24 hours of a request or termination. */
export async function clearLicensedCache(db: LicensedDb): Promise<void> {
  await db.runAsync("DELETE FROM licensed_chapters", []);
}

/**
 * Run at launch. Code review, 10 Oct 2026: an expired chapter was deleted only when that
 * chapter was asked for again, so an unread one could outlive §11's 30 days, and nothing
 * ever called clearLicensedCache. Now every launch drops chapters past 30 days, and a build
 * that may not offer licensed text (the flag removed, or any release build) keeps none, which
 * is how a deletion request or termination (§18.8) is honoured within a day. A version the
 * proxy no longer serves (`served`) keeps nothing either.
 */
export async function pruneLicensedCache(
  db: LicensedDb,
  enabled: boolean,
  now: Date = new Date(),
  served: readonly LicensedCode[] = LICENSED.map((t) => t.code),
): Promise<void> {
  if (!enabled || served.length === 0) return clearLicensedCache(db);
  // fetched_at is always toISOString(), so the strings order as the instants do. Kept rows
  // match getLicensedChapter's test: younger than CACHE_MAX_AGE_MS.
  const oldest = new Date(now.getTime() - CACHE_MAX_AGE_MS).toISOString();
  await db.runAsync("DELETE FROM licensed_chapters WHERE fetched_at <= ?", [oldest]);
  await db.runAsync(`DELETE FROM licensed_chapters WHERE translation NOT IN (${served.map(() => "?").join(", ")})`, [...served]);
}

/** The served set as last heard from the proxy, or DEFAULT_SERVED before it has answered. */
export async function loadServed(db: LicensedDb): Promise<LicensedCode[]> {
  const row = await db.getFirstAsync<{ codes: string }>("SELECT codes FROM licensed_served WHERE id = 1", []);
  return row === null ? [...DEFAULT_SERVED] : (parseServed(row.codes) ?? []);
}

export async function saveServed(db: LicensedDb, codes: readonly LicensedCode[], now: Date = new Date()): Promise<void> {
  await db.runAsync(
    `INSERT INTO licensed_served (id, codes, seen_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET codes = excluded.codes, seen_at = excluded.seen_at`,
    [codes.join(","), now.toISOString()],
  );
}

export type LicensedSearch =
  | {
      readonly status: "ok";
      readonly translation: LicensedCode;
      readonly total: number;
      readonly verses: ReadonlyArray<{ readonly verseId: string; readonly reference: string; readonly text: string }>;
      /** Shown under the results, verbatim (§7). */
      readonly copyright: string;
    }
  | { readonly status: "needs-connection" | "error" | "disabled"; readonly translation: LicensedCode }
  // This phone's searches for the month are used (LICENSED_SEARCHES_A_MONTH), or the proxy's are.
  | { readonly status: "limit"; readonly translation: LicensedCode };

/**
 * Searches in a licensed version per phone per calendar month. Each costs an API.Bible call from the
 * proxy's 800 a month, shared by every reader (docs/licensed-online-plan.md, stress test), so one
 * phone may not spend them all. References and the BSB search on the phone are never counted.
 */
export const LICENSED_SEARCHES_A_MONTH = 10;

async function searchesUsed(db: LicensedDb, month: string): Promise<number> {
  const row = await db.getFirstAsync<{ month: string; count: number }>("SELECT month, count FROM licensed_search_month WHERE id = 1", []);
  return row !== null && row.month === month ? row.count : 0;
}

export async function licensedSearchLeft(db: LicensedDb, now: Date = new Date()): Promise<boolean> {
  return (await searchesUsed(db, now.toISOString().slice(0, 7))) < LICENSED_SEARCHES_A_MONTH;
}

/** Counted only once the proxy has answered: an offline or failed search spends no API.Bible call. */
export async function countLicensedSearch(db: LicensedDb, now: Date = new Date()): Promise<void> {
  const month = now.toISOString().slice(0, 7);
  await db.runAsync(
    `INSERT INTO licensed_search_month (id, month, count) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET month = excluded.month, count = excluded.count`,
    [month, (await searchesUsed(db, month)) + 1],
  );
}

/**
 * Search in a licensed version (John, 12 Oct 2026; EG-06): through the proxy's search route, or straight
 * to API.Bible on the dev path. Display-only: nothing here is written anywhere, unlike a chapter, which
 * may be cached for 30 days. A failed search falls back to the BSB on screen (EG-07).
 */
export async function searchLicensed(deps: Omit<LicensedDeps, "db">, translation: LicensedCode, query: string): Promise<LicensedSearch> {
  const { config } = deps;
  if (!licensedConfigUsable(config)) return { status: "disabled", translation };
  const bible = LICENSED.find((t) => t.code === translation);
  if (bible === undefined) return { status: "disabled", translation };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? LICENSED_LOAD_TIMEOUT_MS);
  try {
    if (config.via === "proxy") {
      const url = `${config.url.replace(/\/+$/, "")}/v1/search/${encodeURIComponent(translation)}?q=${encodeURIComponent(query)}`;
      const response = await deps.fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) return { status: response.status === 503 && (await errorOf(response)) === "budget" ? "limit" : "error", translation };
      const body = (await response.json()) as { total?: unknown; verses?: unknown; copyright?: unknown };
      return searchResult(translation, body.total, body.verses, body.copyright);
    }
    const base = config.url.replace(/\/+$/, "");
    const init = { headers: { "api-key": config.key }, signal: controller.signal };
    const [found, info] = await Promise.all([
      deps.fetch(`${base}/v1/bibles/${encodeURIComponent(bible.bibleId)}/search?query=${encodeURIComponent(query)}&limit=20&sort=canonical`, init),
      deps.fetch(`${base}/v1/bibles/${encodeURIComponent(bible.bibleId)}`, init),
    ]);
    if (!found.ok || !info.ok) return { status: "error", translation };
    const data = ((await found.json()) as { data?: { total?: unknown; verses?: unknown } }).data;
    const copyright = ((await info.json()) as { data?: { copyright?: unknown } }).data?.copyright;
    return searchResult(translation, data?.total, data?.verses, copyright);
  } catch {
    return { status: "needs-connection", translation };
  } finally {
    clearTimeout(timer);
  }
}

function searchResult(translation: LicensedCode, total: unknown, verses: unknown, copyright: unknown): LicensedSearch {
  if (typeof copyright !== "string" || !Array.isArray(verses)) return { status: "error", translation };
  const rows = verses.flatMap((v: unknown) => {
    const { id, reference, text } = (v ?? {}) as { id?: unknown; reference?: unknown; text?: unknown };
    return typeof id === "string" && typeof reference === "string" && typeof text === "string" ? [{ verseId: id, reference, text }] : [];
  });
  return { status: "ok", translation, total: typeof total === "number" ? total : rows.length, verses: rows, copyright };
}
