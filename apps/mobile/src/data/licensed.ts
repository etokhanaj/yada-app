/**
 * Licensed translations (NIV, NKJV, NLT) read live from API.Bible.
 *
 * Display-only (CLAUDE.md rule 9): nothing here may be imported by
 * packages/pipeline or reach any AI call. The terms bind this file
 * (docs/licensed-translations.md):
 * - §4.1 never alter the text: verses are sliced out of the returned chapter at
 *   its verse markers and nothing else; no word, letter or punctuation mark is
 *   changed, and line breaks inside a verse (NLT poetry) are kept.
 * - §7 attribution: the chapter's copyright notice is passed through verbatim.
 * - §11 offline cache: a chapter is kept at most 30 days. An older copy is never
 *   shown, even offline; it is refetched, or the reader is told to connect.
 *
 * Pure: the database, fetch and clock are passed in, so tests run against
 * node:sqlite with a mocked fetch and never touch the network.
 */

import type { BookCode } from "@yada/schema";

export type LicensedCode = "NIV" | "NKJV" | "NLT";

export const LICENSED: ReadonlyArray<{ code: LicensedCode; name: string; bibleId: string }> = [
  { code: "NIV", name: "New International Version", bibleId: "78a9f6124f344018-01" },
  { code: "NKJV", name: "New King James Version", bibleId: "63097d2a0a2f7db3-01" },
  { code: "NLT", name: "New Living Translation", bibleId: "d6e14a625393b4da-01" },
];

export function isLicensedCode(value: unknown): value is LicensedCode {
  return value === "NIV" || value === "NKJV" || value === "NLT";
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
  | { readonly status: "error"; readonly translation: LicensedCode; readonly reason: "malformed" };

export interface LicensedConfig {
  readonly url: string;
  readonly key: string;
  readonly enabled: boolean;
}

/** The slice of expo-sqlite's database this file uses; node:sqlite is wrapped to it in tests. */
export interface LicensedDb {
  getFirstAsync<T>(sql: string, params: Array<string | number | null>): Promise<T | null>;
  runAsync(sql: string, params: Array<string | number | null>): Promise<unknown>;
}

export interface LicensedDeps {
  readonly db: LicensedDb;
  readonly config: LicensedConfig;
  readonly fetch: (url: string, init: { headers: Record<string, string> }) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }>;
  readonly now?: () => Date;
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

interface ChapterResponse {
  data: { content: string; copyright: string };
}

function isChapterResponse(value: unknown): value is ChapterResponse {
  if (typeof value !== "object" || value === null) return false;
  const data = (value as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return false;
  const d = data as { content?: unknown; copyright?: unknown };
  return typeof d.content === "string" && typeof d.copyright === "string";
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
  if (!config.enabled || config.key === "" || config.url === "") return { status: "disabled", translation };
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
  try {
    response = await deps.fetch(chapterUrl(config.url, bible.bibleId, chapterId), { headers: { "api-key": config.key } });
  } catch {
    return { status: "needs-connection", translation };
  }
  if (!response.ok) return { status: "error", translation, reason: "http", httpStatus: response.status };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: "error", translation, reason: "malformed" };
  }
  if (!isChapterResponse(body)) return { status: "error", translation, reason: "malformed" };

  const row: CacheRow = { content: body.data.content, copyright: body.data.copyright, fetched_at: now.toISOString() };
  await db.runAsync(
    `INSERT INTO licensed_chapters (translation, chapter_id, content, copyright, fetched_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(translation, chapter_id) DO UPDATE SET content = excluded.content, copyright = excluded.copyright, fetched_at = excluded.fetched_at`,
    [translation, chapterId, row.content, row.copyright, row.fetched_at],
  );
  return ok(translation, row, false);
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
 * is how a deletion request or termination (§18.8) is honoured within a day.
 */
export async function pruneLicensedCache(db: LicensedDb, enabled: boolean, now: Date = new Date()): Promise<void> {
  if (!enabled) return clearLicensedCache(db);
  // fetched_at is always toISOString(), so the strings order as the instants do. Kept rows
  // match getLicensedChapter's test: younger than CACHE_MAX_AGE_MS.
  const oldest = new Date(now.getTime() - CACHE_MAX_AGE_MS).toISOString();
  await db.runAsync("DELETE FROM licensed_chapters WHERE fetched_at <= ?", [oldest]);
}
