/**
 * The proxy with API.Bible and the limiter mocked: nothing here reaches the network. The
 * passage is made-up placeholder text, not any licensed translation.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { Gate, upstreamUrl, type ChapterStore, type CountStore, type GateDeps, type Stored } from "./gate";
import { handle, type AttestClient, type Env } from "./proxy";
import { servedSet } from "./translations";

const KEY = "test-key-never-forwarded";
const CONTENT = "     [1] Alpha “beta,” gamma.\n     [2] Line one;\n  line two. ";
const NOTICE = "Placeholder Text®, Copyright © 2000 by Example House. All rights reserved.";

function upstream(body: unknown, status = 200): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}

let allow: boolean;
let limiterKeys: string[];
type Fetch = GateDeps["fetch"];
let fetchMock: ReturnType<typeof vi.fn<Fetch>>;

const NOW = new Date("2026-10-18T12:00:00Z");

function memoryStore(): ChapterStore & { readonly map: Map<string, Stored> } {
  const map = new Map<string, Stored>();
  return { map, get: async (k) => map.get(k) ?? null, put: async (k, v) => void map.set(k, v) };
}

function memoryCounts(): CountStore & { readonly months: Map<string, { total: number; search: number }> } {
  const months = new Map<string, { total: number; search: number }>();
  return {
    months,
    reserve: async (month, kind, allow) => {
      const now = months.get(month) ?? { total: 0, search: 0 };
      if (!allow(now)) return false;
      months.set(month, { total: now.total + 1, search: now.search + (kind === "search" ? 1 : 0) });
      return true;
    },
  };
}

/** Stands in for the per-key Durable Objects (attest/keys.ts, tested in attest/attest.test.ts): "good" signs. */
function fakeAttest(): AttestClient & { readonly seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    challenge: async () => "challenge",
    register: async (_keyId, attestation) => attestation === "good",
    assert: async (_keyId, clientData, assertion) => {
      seen.push(clientData);
      return assertion === "good";
    },
  };
}

/** A real Gate over memory stores, so the tests exercise the same miss path as the Durable Object. */
function deps(fetch: Fetch, store = memoryStore(), counts = memoryCounts(), now = () => NOW, attest = fakeAttest()) {
  const gate = new Gate({ fetch, store, counts, now, key: KEY, base: "https://upstream.example.test", planDay: 10 });
  return { gate, attest, store, now };
}

const env = (over: Partial<Env> = {}): Env => ({
  API_BIBLE_KEY: KEY,
  API_BIBLE_URL: "https://upstream.example.test/",
  SERVED: "NKJV,NLT,MSG",
  LIMITER: {
    limit: async ({ key }) => {
      limiterKeys.push(key);
      return { success: allow };
    },
  },
  ...over,
});

const get = (p: string, init: RequestInit = {}) =>
  new Request(`https://proxy.example.test${p}`, { headers: { "CF-Connecting-IP": "203.0.113.7" }, ...init });

beforeEach(() => {
  allow = true;
  limiterKeys = [];
  fetchMock = vi.fn<Fetch>(async () =>
    upstream({ data: { id: "JHN.3", bibleId: "x", content: CONTENT, copyright: NOTICE }, meta: { fums: "tracking" } }),
  );
});

describe("GET /v1/chapter/{translation}/{BOOK}.{chapter}", () => {
  it("returns the content and notice unaltered, with when API.Bible sent it, cacheable by the app only", async () => {
    const res = await handle(get("/v1/chapter/NKJV/JHN.3"), env(), deps(fetchMock));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ translation: "NKJV", chapter: "JHN.3", content: CONTENT, copyright: NOTICE, fetchedAt: NOW.toISOString() });
    expect(res.headers.get("Cache-Control")).toBe(`private, max-age=${30 * 24 * 60 * 60}`);
    expect(res.headers.get("Yada-Served")).toBe("NKJV,NLT,MSG");
  });

  it("asks API.Bible for plain text with the key in a header, never in the URL", async () => {
    await handle(get("/v1/chapter/NLT/1CO.13"), env(), deps(fetchMock));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(upstreamUrl("https://upstream.example.test", "d6e14a625393b4da-01", "1CO.13"));
    expect(url).toContain("content-type=text");
    expect(url).not.toContain(KEY);
    expect((init?.headers as Record<string, string>)["api-key"]).toBe(KEY);
  });

  it("serves The Message from its API.Bible id", async () => {
    const res = await handle(get("/v1/chapter/MSG/PSA.23"), env(), deps(fetchMock));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ translation: "MSG", chapter: "PSA.23", content: CONTENT, copyright: NOTICE });
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(upstreamUrl("https://upstream.example.test", "6f11a7de016f942e-01", "PSA.23"));
  });

  it("never serves NIV while it is off the allowlist, and serves it once the var names it", async () => {
    const off = await handle(get("/v1/chapter/NIV/JHN.3"), env(), deps(fetchMock));
    expect(off.status).toBe(404);
    expect(await off.json()).toEqual({ error: "not-served", served: ["NKJV", "NLT", "MSG"] });
    expect(fetchMock).not.toHaveBeenCalled();

    const on = await handle(get("/v1/chapter/NIV/JHN.3"), env({ SERVED: "NIV,NKJV,NLT,MSG" }), deps(fetchMock));
    expect(on.status).toBe(200);
    expect(on.headers.get("Yada-Served")).toBe("NIV,NKJV,NLT,MSG");
  });

  it("refuses books, chapters and paths that do not exist, without calling upstream", async () => {
    for (const p of [
      "/v1/chapter/NKJV/XYZ.1",
      "/v1/chapter/NKJV/JHN.22",
      "/v1/chapter/NKJV/JHN.0",
      "/v1/chapter/NKJV/JHN.3?x=1",
      "/v1/chapter/NKJV/JHN.3/extra",
      "/v1/bibles/63097d2a0a2f7db3-01/chapters/JHN.3",
      "/v1/chapter/ESV/JHN.3",
      "/",
    ]) {
      const res = await handle(get(p), env(), deps(fetchMock));
      expect(res.status, p).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows GET only", async () => {
    const res = await handle(get("/v1/chapter/NKJV/JHN.3", { method: "POST" }), env(), deps(fetchMock));
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET");
  });

  it("rate-limits per client on a hash of the IP, never the IP itself", async () => {
    allow = false;
    const res = await handle(get("/v1/chapter/NKJV/JHN.3"), env(), deps(fetchMock));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(limiterKeys).toHaveLength(1);
    expect(limiterKeys[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(limiterKeys[0]).not.toContain("203.0.113.7");
  });

  it("forwards no upstream body or key on failure", async () => {
    const cases: Array<[Response | Error, number]> = [
      [upstream({ message: `bad key ${KEY}` }, 401), 502],
      [upstream({ message: "missing" }, 404), 404],
      [upstream({ message: "slow down" }, 429), 503],
      [upstream("not json"), 502],
      [upstream({ data: { content: 1 } }), 502],
      [new Error("offline"), 502],
    ];
    for (const [result, status] of cases) {
      fetchMock.mockImplementationOnce(async () => {
        if (result instanceof Error) throw result;
        return result;
      });
      const res = await handle(get("/v1/chapter/NKJV/JHN.3"), env(), deps(fetchMock));
      expect(res.status).toBe(status);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      const text = await res.text();
      expect(text).not.toContain(KEY);
      expect(text).not.toMatch(/bad key|missing|slow down/);
    }
  });

  it("says it is unconfigured rather than calling upstream without a key", async () => {
    const res = await handle(get("/v1/chapter/NKJV/JHN.3"), env({ API_BIBLE_KEY: "" }), deps(fetchMock));
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("servedSet", () => {
  it("keeps only codes the account holds, in a stable order", () => {
    expect(servedSet("nlt, msg, NKJV ,ESV")).toEqual(["NKJV", "NLT", "MSG"]);
    expect(servedSet("")).toEqual([]);
    expect(servedSet(undefined)).toEqual([]);
  });
});

describe("the Worker's source", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const files = ["index.ts", "proxy.ts", "translations.ts", "gate.ts", "budget.ts", "attest/cbor.ts", "attest/der.ts", "attest/keys.ts", "attest/verify.ts"].map((f) => readFileSync(path.join(dir, f), "utf8"));

  it("logs nothing (no client IP or identifier is ever written by this code)", () => {
    for (const text of files) expect(text).not.toMatch(/console\.|\.log\(/);
  });

  it("imports nothing but itself, @yada/schema's book table and the Workers runtime (no AI, rule 9)", () => {
    const imports = files.flatMap((text) => [...text.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]));
    expect(new Set(imports)).toEqual(new Set(["./proxy", "./translations", "./gate", "./budget", "./attest/keys", "./verify", "./cbor", "./der", "@yada/schema", "cloudflare:workers"]));
  });

  it("ships NIV off and MSG on in wrangler.toml, and no secret", () => {
    const toml = readFileSync(path.join(dir, "../wrangler.toml"), "utf8");
    expect(toml).toMatch(/^SERVED = "NKJV,NLT,MSG"$/m);
    expect(toml).not.toMatch(/^\s*API_BIBLE_KEY\s*=/m);
    expect(toml).toMatch(/\[observability\]\s*\nenabled = false/);
    expect(toml).toMatch(/^PLAN_MONTH_DAY = "\d{1,2}"$/m);
    expect(toml).toMatch(/new_sqlite_classes = \["GateObject"\]/);
  });
});

describe("GET /v1/search/{translation}?q=", () => {
  const found = { data: { query: "church", total: 2, verses: [{ id: "MAT.16.18", orgId: "x", reference: "Matthew 16:18", text: "Placeholder alpha." }, { id: "ACT.5.11", reference: "Acts 5:11", text: "Placeholder beta." }] } };
  const bible = { data: { id: "x", copyright: NOTICE } };
  const routed = () =>
    vi.fn<Fetch>(async (url) => upstream(String(url).includes("/search?") ? found : bible));

  it("returns the verses and the Bible's notice unaltered, and lets nothing keep them", async () => {
    const fetch = routed();
    const res = await handle(get("/v1/search/NKJV?q=church"), env(), deps(fetch));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      translation: "NKJV",
      query: "church",
      total: 2,
      verses: [
        { id: "MAT.16.18", reference: "Matthew 16:18", text: "Placeholder alpha." },
        { id: "ACT.5.11", reference: "Acts 5:11", text: "Placeholder beta." },
      ],
      copyright: NOTICE,
    });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(fetch.mock.calls.every(([, init]) => (init.headers as Record<string, string>)["api-key"] === KEY)).toBe(true);
  });

  it("refuses a version it does not serve, a query that is not words, and extra parameters", async () => {
    const fetch = routed();
    expect((await handle(get("/v1/search/NIV?q=church"), env(), deps(fetch))).status).toBe(404);
    expect((await handle(get("/v1/search/NKJV?q=%7B%22a%22%7D"), env(), deps(fetch))).status).toBe(400);
    expect((await handle(get("/v1/search/NKJV?q=church&limit=500"), env(), deps(fetch))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards no upstream body on failure", async () => {
    const fetch = vi.fn<Fetch>(async () => upstream({ secret: "x" }, 500));
    const res = await handle(get("/v1/search/NKJV?q=church"), env(), deps(fetch));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "upstream" });
  });
});

describe("the call budget (docs/licensed-online-plan.md, stress test)", () => {
  const chapterBody = () => upstream({ data: { content: CONTENT, copyright: NOTICE } });
  const bibleBody = () => upstream({ data: { copyright: NOTICE } });
  const searchBody = () => upstream({ data: { total: 1, verses: [{ id: "JHN.3.16", reference: "John 3:16", text: "Placeholder." }] } });
  const routedFetch = () =>
    vi.fn<Fetch>(async (url) => (String(url).includes("/search?") ? searchBody() : String(url).includes("/chapters/") ? chapterBody() : bibleBody()));

  it("keeps one shared copy: many readers of a chapter cost one call", async () => {
    const fetch = routedFetch();
    const d = deps(fetch);
    for (let i = 0; i < 5; i++) expect((await handle(get("/v1/chapter/NKJV/JHN.3"), env(), d)).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(d.store.map.has("ch/NKJV/JHN.3.json")).toBe(true);
  });

  it("fetches a chapter once when fifty readers open it together", async () => {
    const fetch = routedFetch();
    const d = deps(fetch);
    const all = await Promise.all(Array.from({ length: 50 }, () => handle(get("/v1/chapter/NLT/JHN.1"), env(), d)));
    expect(all.every((r) => r.status === 200)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("serves the stored copy with its first fetch time until 30 days, then fetches again", async () => {
    const fetch = routedFetch();
    let now = new Date("2026-10-10T00:00:00Z");
    const d = deps(fetch, memoryStore(), memoryCounts(), () => now);
    await handle(get("/v1/chapter/NKJV/JHN.3"), env(), d);
    now = new Date("2026-11-08T23:00:00Z");
    const later = await handle(get("/v1/chapter/NKJV/JHN.3"), env(), d);
    expect(await later.json()).toMatchObject({ fetchedAt: "2026-10-10T00:00:00.000Z" });
    // The app may keep it only for the hour left of the 30 days.
    expect(later.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(fetch).toHaveBeenCalledTimes(1);
    now = new Date("2026-11-09T00:00:00Z");
    await handle(get("/v1/chapter/NKJV/JHN.3"), env(), d);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("stops reading at 4,900 calls but still serves what is stored", async () => {
    const fetch = routedFetch();
    const counts = memoryCounts();
    counts.months.set("2026-10-10", { total: 4_899, search: 0 });
    const d = deps(fetch, memoryStore(), counts);
    expect((await handle(get("/v1/chapter/NKJV/JHN.3"), env(), d)).status).toBe(200);
    const out = await handle(get("/v1/chapter/NKJV/JHN.4"), env(), d);
    expect(out.status).toBe(503);
    expect(await out.json()).toEqual({ error: "budget" });
    expect((await handle(get("/v1/chapter/NKJV/JHN.3"), env(), d)).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("caps search at 800 a month without touching reading's share", async () => {
    const fetch = routedFetch();
    const counts = memoryCounts();
    counts.months.set("2026-10-10", { total: 1_000, search: 800 });
    const d = deps(fetch, memoryStore(), counts);
    const res = await handle(get("/v1/search/NKJV?q=love"), env(), d);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "budget" });
    expect((await handle(get("/v1/chapter/NKJV/JHN.3"), env(), d)).status).toBe(200);
  });

  it("costs one call a search once the copyright line is stored, and stores no results", async () => {
    const fetch = routedFetch();
    const d = deps(fetch);
    await handle(get("/v1/search/NKJV?q=love"), env(), d);
    expect(fetch).toHaveBeenCalledTimes(2);
    await handle(get("/v1/search/NKJV?q=faith"), env(), d);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect([...d.store.map.keys()]).toEqual(["bible/NKJV.json"]);
  });

  it("starts the count afresh each plan month", async () => {
    const fetch = routedFetch();
    const counts = memoryCounts();
    counts.months.set("2026-10-10", { total: 4_900, search: 0 });
    let now = new Date("2026-11-09T12:00:00Z");
    const d = deps(fetch, memoryStore(), counts, () => now);
    expect((await handle(get("/v1/chapter/NKJV/JHN.3"), env(), d)).status).toBe(503);
    now = new Date("2026-11-10T00:00:01Z");
    expect((await handle(get("/v1/chapter/NKJV/JHN.3"), env(), d)).status).toBe(200);
    expect(counts.months.get("2026-11-10")).toEqual({ total: 1, search: 0 });
  });
});

describe("App Attest at the door (attest/)", () => {
  const signed = (p: string, assertion = "good") =>
    get(p, { headers: { "CF-Connecting-IP": "203.0.113.7", "Yada-Key-Id": `${"A".repeat(43)}=`, "Yada-Assertion": assertion } });
  const post = (p: string, body: unknown) =>
    new Request(`https://proxy.example.test${p}`, { method: "POST", headers: { "CF-Connecting-IP": "203.0.113.7" }, body: JSON.stringify(body) });
  const on = () => env({ APP_ATTEST_ID: "TEAM.app", ATTEST_REQUIRED: "on" });

  it("while off, still serves a GET with no assertion (older builds)", async () => {
    expect((await handle(get("/v1/chapter/NKJV/JHN.3"), env({ APP_ATTEST_ID: "TEAM.app" }), deps(fetchMock))).status).toBe(200);
  });

  it("when on, refuses a GET with no assertion before any call upstream", async () => {
    const res = await handle(get("/v1/chapter/NKJV/JHN.3"), on(), deps(fetchMock));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "attest" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks the assertion over the method, path and query, and refuses a bad one even while off", async () => {
    const d = deps(fetchMock);
    expect((await handle(signed("/v1/chapter/NKJV/JHN.3"), on(), d)).status).toBe(200);
    expect(d.attest.seen).toEqual(["GET /v1/chapter/NKJV/JHN.3"]);
    expect((await handle(signed("/v1/chapter/NKJV/JHN.3", "bad"), env({ APP_ATTEST_ID: "TEAM.app" }), d)).status).toBe(401);
    const half = get("/v1/chapter/NKJV/JHN.3", { headers: { "Yada-Assertion": "good" } });
    expect((await handle(half, on(), d)).status).toBe(401);
  });

  it("hands out a challenge and registers a key, and refuses malformed bodies", async () => {
    const keyId = `${"B".repeat(43)}=`;
    const challenge = await handle(post("/v1/attest/challenge", { keyId }), on(), deps(fetchMock));
    expect(await challenge.json()).toEqual({ challenge: "challenge" });
    expect((await handle(post("/v1/attest", { keyId, attestation: "good" }), on(), deps(fetchMock))).status).toBe(204);
    expect((await handle(post("/v1/attest", { keyId, attestation: "bad" }), on(), deps(fetchMock))).status).toBe(401);
    expect((await handle(post("/v1/attest", { keyId: "short", attestation: "good" }), on(), deps(fetchMock))).status).toBe(400);
    expect((await handle(post("/v1/attest/other", { keyId }), on(), deps(fetchMock))).status).toBe(404);
  });

  it("says it is unconfigured without an app id", async () => {
    expect((await handle(post("/v1/attest/challenge", { keyId: `${"B".repeat(43)}=` }), env(), deps(fetchMock))).status).toBe(503);
  });

  it("ships the team's app id and the check off in wrangler.toml", () => {
    const toml = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../wrangler.toml"), "utf8");
    expect(toml).toMatch(/^APP_ATTEST_ID = "7X984JHGT2\.studio\.yada\.reader"$/m);
    expect(toml).toMatch(/^ATTEST_REQUIRED = "off"$/m);
  });
});
