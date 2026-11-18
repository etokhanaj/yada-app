/**
 * Two routes: GET /v1/chapter/{translation}/{BOOK}.{chapter}, and GET /v1/search/{translation}?q=…
 * (John, 12 Oct 2026: search follows the translation, EG-06; results are display-only, never stored).
 * Two more prove the app with App Attest (attest/verify.ts): POST /v1/attest/challenge, POST /v1/attest.
 * Every GET then carries an assertion in Yada-Key-Id and Yada-Assertion; with ATTEST_REQUIRED = "on" a GET
 * without one is refused, so only genuine Yada can spend the plan's calls (John, 18 Nov 2026).
 *
 * Why a proxy: Expo `extra` is embedded in the app binary, so a key shipped in a build can be
 * extracted by anyone holding it (docs/licensed-translations.md), and §12 forbids making the key
 * available to anyone. The key lives here, as a Worker secret, and never reaches a build (rule 1).
 *
 * What it may and may not do (API.Bible terms, read 18 Oct 2026; CLAUDE.md rule 9):
 * - §4.1 never alter the text: `content` and `copyright` are passed through as API.Bible sent them.
 * - §11 a stored copy is at most 30 days old: one shared copy per chapter lives in R2 (John, 18 Oct
 *   2026), so reading costs about one call per chapter a month at any number of readers, and
 *   the app's own copy counts its 30 days from `fetchedAt`, when API.Bible sent it.
 * - Calls are counted and capped (budget.ts, gate.ts) so the 5,000-a-month Starter plan holds.
 * - Display-only: no AI anywhere near this.
 * - Privacy: no logging at all, and nothing about what anyone reads is stored: R2 holds Bible text, the
 *   gate's Durable Object two call counts, and each install's key object a random key's public half and a
 *   counter. The client IP is used only as a hashed rate-limit key.
 *
 * Pure: the gate, the store and the limiter come in through `env` and `deps`, so tests run with
 * all of them in memory and never touch the network.
 */

import { BOOK_CODES, isBookCode } from "@yada/schema";

import { expiresAt } from "./budget";
import { chapterKey, isFresh, type ChapterStore, type GateResult, type SearchFound, type Stored } from "./gate";
import { isLicensedCode, servedSet, type LicensedCode } from "./translations";

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
  /** Day of the month the API.Bible plan took effect (1–28): when the 5,000 calls reset. */
  readonly PLAN_MONTH_DAY?: string;
  readonly LIMITER: RateLimiter;
  /** `{TEAM_ID}.{bundle id}`: what App Attest's rpIdHash must match. */
  readonly APP_ATTEST_ID?: string;
  /**
   * "on": a GET without an assertion is refused. Off until a build that attests is the one testers have,
   * so older builds keep NKJV/NLT/MSG until then; a GET that does carry one is checked either way.
   */
  readonly ATTEST_REQUIRED?: string;
}

/** Every API.Bible call: the Durable Object in production (index.ts), a plain Gate in tests. */
export interface GateClient {
  chapter(code: LicensedCode, chapterId: string): Promise<GateResult<Stored>>;
  search(code: LicensedCode, query: string): Promise<GateResult<SearchFound>>;
}

/** One install's App Attest key (attest/keys.ts): a Durable Object per key id in production. */
export interface AttestClient {
  challenge(keyId: string): Promise<string>;
  register(keyId: string, attestation: string): Promise<boolean>;
  assert(keyId: string, clientData: string, assertion: string): Promise<boolean>;
}

export const KEY_HEADER = "Yada-Key-Id";
export const ASSERTION_HEADER = "Yada-Assertion";
/** A key id is the base64 SHA-256 of the key: 44 characters. */
const KEY_ID = /^[A-Za-z0-9+/]{43}=$/;
/** An attestation is a few kilobytes; anything far larger is not one. */
const MAX_BODY = 16_384;

export interface Deps {
  readonly gate: GateClient;
  readonly attest: AttestClient;
  /** Read directly for a fresh copy, so most readers never reach the Durable Object. */
  readonly store: ChapterStore;
  readonly now: () => Date;
}

/** Read by the app to learn the served set, so a change here needs no app update. */
export const SERVED_HEADER = "Yada-Served";

const ROUTE = /^\/v1\/chapter\/([A-Za-z]+)\/([1-4A-Z][A-Z0-9]{2})\.([1-9]\d{0,2})$/;
const SEARCH_ROUTE = /^\/v1\/search\/([A-Za-z]+)$/;
/** Words, spaces, apostrophes and hyphens: a reader's search, never a query language. */
const QUERY = /^[\p{L}\p{N}][\p{L}\p{N} '’-]{1,79}$/u;

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
  /** When API.Bible sent it (ISO); the app's 30 days run from here. */
  readonly fetchedAt: string;
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

  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname.startsWith("/v1/attest")) return attestRoute(request, url, env, deps, reply);
  if (request.method !== "GET") return reply(405, { error: "method" }, { Allow: "GET" });

  const keyId = request.headers.get(KEY_HEADER);
  const assertion = request.headers.get(ASSERTION_HEADER);
  if (keyId !== null || assertion !== null) {
    if (keyId === null || assertion === null || !KEY_ID.test(keyId) || (env.APP_ATTEST_ID ?? "") === "") return reply(401, { error: "attest" });
    if (!(await deps.attest.assert(keyId, `GET ${url.pathname}${url.search}`, assertion))) return reply(401, { error: "attest" });
  } else if (env.ATTEST_REQUIRED === "on") {
    return reply(401, { error: "attest" });
  }
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

  if ((env.API_BIBLE_KEY ?? "") === "" || (env.API_BIBLE_URL ?? "") === "") return reply(503, { error: "unconfigured" });

  const chapterId = `${book}.${chapter}`;
  let stored = await deps.store.get(chapterKey(translation, chapterId));
  if (stored === null || !isFresh(stored, deps.now())) {
    const result = await deps.gate.chapter(translation, chapterId);
    if (!result.ok) return failed(result, reply);
    stored = result.body;
  }
  const { content, copyright, fetchedAt } = stored;
  const body: ChapterBody = { translation, chapter: chapterId, content, copyright, fetchedAt };
  // The app may keep it only for what is left of its 30 days (§11), and only the app (`private`).
  const left = Math.max(0, Math.floor((expiresAt(new Date(fetchedAt)).getTime() - deps.now().getTime()) / 1000));
  return reply(200, body, { "Cache-Control": `private, max-age=${left}` });
}

function failed(result: { status: number; error: string }, reply: Reply): Response {
  return reply(result.status, { error: result.error }, result.status === 503 ? { "Retry-After": "60" } : {});
}

type Reply = (status: number, body: unknown, headers?: Record<string, string>) => Response;

/** POST /v1/attest/challenge {keyId} → {challenge}; POST /v1/attest {keyId, attestation} → 204, or 401. */
async function attestRoute(request: Request, url: URL, env: Env, deps: Deps, reply: Reply): Promise<Response> {
  if (url.pathname !== "/v1/attest/challenge" && url.pathname !== "/v1/attest") return reply(404, { error: "not-found" });
  if ((env.APP_ATTEST_ID ?? "") === "") return reply(503, { error: "unconfigured" });
  const text = await request.text();
  let body: { keyId?: unknown; attestation?: unknown };
  try {
    body = text.length > MAX_BODY ? {} : (JSON.parse(text) as typeof body);
  } catch {
    body = {};
  }
  const { keyId, attestation } = body;
  if (typeof keyId !== "string" || !KEY_ID.test(keyId)) return reply(400, { error: "key" });
  if (url.pathname === "/v1/attest/challenge") return reply(200, { challenge: await deps.attest.challenge(keyId) });
  if (typeof attestation !== "string" || attestation === "") return reply(400, { error: "attestation" });
  return (await deps.attest.register(keyId, attestation)) ? new Response(null, { status: 204 }) : reply(401, { error: "attest" });
}

/**
 * Search in one licensed translation: verses as API.Bible sends them, and the Bible's copyright line.
 * `no-store`, unlike a chapter: John's ruling is that search results are never kept (12 Oct 2026). Only the
 * search is counted against search's own cap (budget.ts); the copyright line comes from R2.
 */
async function searchRoute(code: string, url: URL, env: Env, deps: Deps, served: LicensedCode[], reply: Reply): Promise<Response> {
  const translation = code.toUpperCase();
  if (!isLicensedCode(translation) || !served.includes(translation)) return reply(404, { error: "not-served", served });
  const query = (url.searchParams.get("q") ?? "").trim();
  if ([...url.searchParams.keys()].some((k) => k !== "q") || !QUERY.test(query)) return reply(400, { error: "query" });

  if ((env.API_BIBLE_KEY ?? "") === "" || (env.API_BIBLE_URL ?? "") === "") return reply(503, { error: "unconfigured" });

  const result = await deps.gate.search(translation, query);
  if (!result.ok) return failed(result, reply);
  const body: SearchBody = { translation, query, ...result.body };
  return reply(200, body);
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
