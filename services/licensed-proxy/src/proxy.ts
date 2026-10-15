/**
 * Two routes: GET /v1/chapter/{translation}/{BOOK}.{chapter}, and GET /v1/search/{translation}?q=…
 * (John, 12 Oct 2026: search follows the translation, EG-06; results are display-only, never stored).
 *
 * Why a proxy: Expo `extra` is embedded in the app binary, so a key shipped in a build can be
 * extracted by anyone holding it (docs/licensed-translations.md). The key lives here, as a Worker
 * secret, and never reaches a build (CLAUDE.md rule 1).
 *
 * What it may and may not do (API.Bible terms, read 10 Oct 2026; CLAUDE.md rule 9):
 * - §4.1 never alter the text: `content` and `copyright` are passed through as API.Bible sent
 *   them. Nothing else from the upstream body is forwarded.
 * - §11 offline cache at most 30 days: the response says the app may keep it that long, and only
 *   the app (`private`), so no shared cache holds a copy. This Worker stores nothing.
 * - Display-only: no AI anywhere near this; the Worker imports nothing but the book table.
 * - Privacy: no logging at all. The client IP is used only as a hashed rate-limit key, held by
 *   Cloudflare's limiter counter, and never written anywhere by this code.
 *
 * Pure: the upstream fetch and the limiter come in through `env` and `deps`, so tests run with
 * both mocked and never touch the network.
 */

import { BOOK_CODES, isBookCode } from "@yada/schema";

import { BIBLES, isLicensedCode, servedSet, type LicensedCode } from "./translations";

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  /** Worker secret (`wrangler secret put API_BIBLE_KEY`); never in wrangler.toml. */
  readonly API_BIBLE_KEY?: string;
  /** API.Bible's base, e.g. https://rest.api.bible. */
  readonly API_BIBLE_URL?: string;
  /** Comma-separated codes this Worker serves, e.g. "NKJV,NLT". */
  readonly SERVED?: string;
  readonly LIMITER: RateLimiter;
}

export interface Deps {
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
}

/** The app may keep a chapter 30 days (§11) and no longer; it enforces the same limit itself. */
export const CACHE_CONTROL_OK = "private, max-age=2592000";
/** Read by the app to learn the served set, so a change here needs no app update. */
export const SERVED_HEADER = "Yada-Served";

const ROUTE = /^\/v1\/chapter\/([A-Za-z]+)\/([1-4A-Z][A-Z0-9]{2})\.([1-9]\d{0,2})$/;
const SEARCH_ROUTE = /^\/v1\/search\/([A-Za-z]+)$/;
/** Words, spaces, apostrophes and hyphens: a reader's search, never a query language. */
const QUERY = /^[\p{L}\p{N}][\p{L}\p{N} '’-]{1,79}$/u;
export const SEARCH_LIMIT = 20;

export interface SearchBody {
  readonly translation: LicensedCode;
  readonly query: string;
  readonly total: number;
  /** Each verse as API.Bible sent it (§4.1), with its USFM id ("JHN.3.16"), which is Yada's verse id. */
  readonly verses: ReadonlyArray<{ readonly id: string; readonly reference: string; readonly text: string }>;
  /** The Bible's copyright notice, shown under the results (§7). */
  readonly copyright: string;
}

export interface ChapterBody {
  readonly translation: LicensedCode;
  /** API.Bible's chapter id, `{BOOK}.{chapter}` with USFM book ids. */
  readonly chapter: string;
  /** Verbatim `content-type=text` content (§4.1). */
  readonly content: string;
  /** Verbatim copyright notice, shown under the chapter (§7). */
  readonly copyright: string;
}

export async function handle(request: Request, env: Env, deps: Deps): Promise<Response> {
  const served = servedSet(env.SERVED);
  const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        [SERVED_HEADER]: served.join(","),
        ...headers,
      },
    });

  // Before anything else, so a flood of bad paths cannot spend the Worker either.
  const { success } = await env.LIMITER.limit({ key: await limiterKey(request) });
  if (!success) return reply(429, { error: "rate-limited" }, { "Retry-After": "60" });

  if (request.method !== "GET") return reply(405, { error: "method" }, { Allow: "GET" });
  const url = new URL(request.url);
  const search = SEARCH_ROUTE.exec(url.pathname);
  if (search !== null) return searchRoute(search[1] ?? "", url, env, deps, served, reply);
  const match = ROUTE.exec(url.pathname);
  if (match === null || url.search !== "") return reply(404, { error: "not-found" });

  const translation = (match[1] ?? "").toUpperCase();
  if (!isLicensedCode(translation) || !served.includes(translation)) {
    return reply(404, { error: "not-served", served });
  }
  const book = match[2] ?? "";
  const chapter = Number(match[3]);
  if (!isBookCode(book) || chapter > BOOK_CODES[book].chapters) return reply(404, { error: "no-chapter" });

  const key = env.API_BIBLE_KEY ?? "";
  const base = (env.API_BIBLE_URL ?? "").replace(/\/+$/, "");
  if (key === "" || base === "") return reply(503, { error: "unconfigured" });

  const chapterId = `${book}.${chapter}`;
  let upstream: Response;
  try {
    upstream = await deps.fetch(upstreamUrl(base, BIBLES[translation], chapterId), {
      headers: { "api-key": key, Accept: "application/json" },
      // The Worker keeps no copy; caching is the app's, under its own 30-day rule.
      cache: "no-store",
    });
  } catch {
    return reply(502, { error: "upstream" });
  }
  // Upstream bodies are never forwarded on failure: only a status the app can act on.
  if (upstream.status === 404) return reply(404, { error: "no-chapter" });
  if (upstream.status === 429) return reply(503, { error: "busy" }, { "Retry-After": "60" });
  if (!upstream.ok) return reply(502, { error: "upstream" });

  let parsed: unknown;
  try {
    parsed = await upstream.json();
  } catch {
    return reply(502, { error: "upstream" });
  }
  const data = typeof parsed === "object" && parsed !== null ? (parsed as { data?: unknown }).data : undefined;
  if (typeof data !== "object" || data === null) return reply(502, { error: "upstream" });
  const { content, copyright } = data as { content?: unknown; copyright?: unknown };
  if (typeof content !== "string" || typeof copyright !== "string") return reply(502, { error: "upstream" });

  const body: ChapterBody = { translation, chapter: chapterId, content, copyright };
  return reply(200, body, { "Cache-Control": CACHE_CONTROL_OK });
}

type Reply = (status: number, body: unknown, headers?: Record<string, string>) => Response;

/**
 * Search in one licensed translation: verses as API.Bible sends them, and the Bible's copyright line.
 * `no-store`, unlike a chapter: John's ruling is that search results are never kept (12 Oct 2026).
 */
async function searchRoute(code: string, url: URL, env: Env, deps: Deps, served: LicensedCode[], reply: Reply): Promise<Response> {
  const translation = code.toUpperCase();
  if (!isLicensedCode(translation) || !served.includes(translation)) return reply(404, { error: "not-served", served });
  const query = (url.searchParams.get("q") ?? "").trim();
  if ([...url.searchParams.keys()].some((k) => k !== "q") || !QUERY.test(query)) return reply(400, { error: "query" });

  const key = env.API_BIBLE_KEY ?? "";
  const base = (env.API_BIBLE_URL ?? "").replace(/\/+$/, "");
  if (key === "" || base === "") return reply(503, { error: "unconfigured" });
  const bibleId = BIBLES[translation];
  const init: RequestInit = { headers: { "api-key": key, Accept: "application/json" }, cache: "no-store" };

  let found: Response;
  let bible: Response;
  try {
    [found, bible] = await Promise.all([deps.fetch(searchUrl(base, bibleId, query), init), deps.fetch(`${base}/v1/bibles/${encodeURIComponent(bibleId)}`, init)]);
  } catch {
    return reply(502, { error: "upstream" });
  }
  if (found.status === 429 || bible.status === 429) return reply(503, { error: "busy" }, { "Retry-After": "60" });
  if (!found.ok || !bible.ok) return reply(502, { error: "upstream" });

  let results: unknown;
  let info: unknown;
  try {
    [results, info] = await Promise.all([found.json(), bible.json()]);
  } catch {
    return reply(502, { error: "upstream" });
  }
  const data = (results as { data?: { total?: unknown; verses?: unknown } } | null)?.data;
  const copyright = (info as { data?: { copyright?: unknown } } | null)?.data?.copyright;
  if (data === undefined || typeof copyright !== "string") return reply(502, { error: "upstream" });
  const verses = (Array.isArray(data.verses) ? data.verses : []).flatMap((v: unknown) => {
    const { id, reference, text } = (v ?? {}) as { id?: unknown; reference?: unknown; text?: unknown };
    return typeof id === "string" && typeof reference === "string" && typeof text === "string" ? [{ id, reference, text }] : [];
  });
  const body: SearchBody = { translation, query, total: typeof data.total === "number" ? data.total : verses.length, verses, copyright };
  return reply(200, body);
}

function searchUrl(base: string, bibleId: string, query: string): string {
  return `${base}/v1/bibles/${encodeURIComponent(bibleId)}/search?query=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}&sort=canonical`;
}

/** The same request the app's dev path makes (apps/mobile/src/data/licensed.ts chapterUrl). */
export function upstreamUrl(base: string, bibleId: string, chapterId: string): string {
  return (
    `${base}/v1/bibles/${encodeURIComponent(bibleId)}/chapters/${encodeURIComponent(chapterId)}` +
    "?content-type=text&include-notes=false&include-titles=false&include-verse-numbers=true"
  );
}

/**
 * Per-IP, as the limiter needs some key, but hashed so the raw address is not what Cloudflare's
 * limiter holds. Cloudflare's own edge still sees the IP; see docs/licensed-translations.md.
 */
async function limiterKey(request: Request): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`yada-licensed:${ip}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
