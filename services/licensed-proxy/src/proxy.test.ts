/**
 * The proxy with API.Bible and the limiter mocked: nothing here reaches the network. The
 * passage is made-up placeholder text, not any licensed translation.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CACHE_CONTROL_OK, handle, upstreamUrl, type Deps, type Env } from "./proxy";
import { servedSet } from "./translations";

const KEY = "test-key-never-forwarded";
const CONTENT = "     [1] Alpha “beta,” gamma.\n     [2] Line one;\n  line two. ";
const NOTICE = "Placeholder Text®, Copyright © 2000 by Example House. All rights reserved.";

function upstream(body: unknown, status = 200): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}

let allow: boolean;
let limiterKeys: string[];
let fetchMock: ReturnType<typeof vi.fn<Deps["fetch"]>>;

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
  fetchMock = vi.fn<Deps["fetch"]>(async () =>
    upstream({ data: { id: "JHN.3", bibleId: "x", content: CONTENT, copyright: NOTICE }, meta: { fums: "tracking" } }),
  );
});

describe("GET /v1/chapter/{translation}/{BOOK}.{chapter}", () => {
  it("returns the content and notice unaltered, cacheable by the app only, for 30 days", async () => {
    const res = await handle(get("/v1/chapter/NKJV/JHN.3"), env(), { fetch: fetchMock });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ translation: "NKJV", chapter: "JHN.3", content: CONTENT, copyright: NOTICE });
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL_OK);
    expect(CACHE_CONTROL_OK).toBe(`private, max-age=${30 * 24 * 60 * 60}`);
    expect(res.headers.get("Yada-Served")).toBe("NKJV,NLT,MSG");
  });

  it("asks API.Bible for plain text with the key in a header, never in the URL", async () => {
    await handle(get("/v1/chapter/NLT/1CO.13"), env(), { fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(upstreamUrl("https://upstream.example.test", "d6e14a625393b4da-01", "1CO.13"));
    expect(url).toContain("content-type=text");
    expect(url).not.toContain(KEY);
    expect((init?.headers as Record<string, string>)["api-key"]).toBe(KEY);
  });

  it("serves The Message from its API.Bible id", async () => {
    const res = await handle(get("/v1/chapter/MSG/PSA.23"), env(), { fetch: fetchMock });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ translation: "MSG", chapter: "PSA.23", content: CONTENT, copyright: NOTICE });
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(upstreamUrl("https://upstream.example.test", "6f11a7de016f942e-01", "PSA.23"));
  });

  it("never serves NIV while it is off the allowlist, and serves it once the var names it", async () => {
    const off = await handle(get("/v1/chapter/NIV/JHN.3"), env(), { fetch: fetchMock });
    expect(off.status).toBe(404);
    expect(await off.json()).toEqual({ error: "not-served", served: ["NKJV", "NLT", "MSG"] });
    expect(fetchMock).not.toHaveBeenCalled();

    const on = await handle(get("/v1/chapter/NIV/JHN.3"), env({ SERVED: "NIV,NKJV,NLT,MSG" }), { fetch: fetchMock });
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
      const res = await handle(get(p), env(), { fetch: fetchMock });
      expect(res.status, p).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows GET only", async () => {
    const res = await handle(get("/v1/chapter/NKJV/JHN.3", { method: "POST" }), env(), { fetch: fetchMock });
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET");
  });

  it("rate-limits per client on a hash of the IP, never the IP itself", async () => {
    allow = false;
    const res = await handle(get("/v1/chapter/NKJV/JHN.3"), env(), { fetch: fetchMock });
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
      const res = await handle(get("/v1/chapter/NKJV/JHN.3"), env(), { fetch: fetchMock });
      expect(res.status).toBe(status);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      const text = await res.text();
      expect(text).not.toContain(KEY);
      expect(text).not.toMatch(/bad key|missing|slow down/);
    }
  });

  it("says it is unconfigured rather than calling upstream without a key", async () => {
    const res = await handle(get("/v1/chapter/NKJV/JHN.3"), env({ API_BIBLE_KEY: "" }), { fetch: fetchMock });
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
  const files = ["index.ts", "proxy.ts", "translations.ts"].map((f) => readFileSync(path.join(dir, f), "utf8"));

  it("logs nothing (no client IP or identifier is ever written by this code)", () => {
    for (const text of files) expect(text).not.toMatch(/console\.|\.log\(/);
  });

  it("imports nothing but itself and @yada/schema's book table (no AI, rule 9)", () => {
    const imports = files.flatMap((text) => [...text.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]));
    expect(new Set(imports)).toEqual(new Set(["./proxy", "./translations", "@yada/schema"]));
  });

  it("ships NIV off and MSG on in wrangler.toml, and no secret", () => {
    const toml = readFileSync(path.join(dir, "../wrangler.toml"), "utf8");
    expect(toml).toMatch(/^SERVED = "NKJV,NLT,MSG"$/m);
    expect(toml).not.toMatch(/^\s*API_BIBLE_KEY\s*=/m);
    expect(toml).toMatch(/\[observability\]\s*\nenabled = false/);
  });
});

describe("GET /v1/search/{translation}?q=", () => {
  const found = { data: { query: "church", total: 2, verses: [{ id: "MAT.16.18", orgId: "x", reference: "Matthew 16:18", text: "Placeholder alpha." }, { id: "ACT.5.11", reference: "Acts 5:11", text: "Placeholder beta." }] } };
  const bible = { data: { id: "x", copyright: NOTICE } };
  const routed = () =>
    vi.fn<Deps["fetch"]>(async (url) => upstream(String(url).includes("/search?") ? found : bible));

  it("returns the verses and the Bible's notice unaltered, and lets nothing keep them", async () => {
    const fetch = routed();
    const res = await handle(get("/v1/search/NKJV?q=church"), env(), { fetch });
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
    expect((await handle(get("/v1/search/NIV?q=church"), env(), { fetch })).status).toBe(404);
    expect((await handle(get("/v1/search/NKJV?q=%7B%22a%22%7D"), env(), { fetch })).status).toBe(400);
    expect((await handle(get("/v1/search/NKJV?q=church&limit=500"), env(), { fetch })).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards no upstream body on failure", async () => {
    const fetch = vi.fn<Deps["fetch"]>(async () => upstream({ secret: "x" }, 500));
    const res = await handle(get("/v1/search/NKJV?q=church"), env(), { fetch });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "upstream" });
  });
});
