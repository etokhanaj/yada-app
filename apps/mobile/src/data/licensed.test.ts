/**
 * Licensed translations against an in-memory user.db, with fetch mocked
 * throughout: no test here, and nothing in CI, may call API.Bible.
 * The passages below are made-up placeholder text, not any licensed translation.
 */

import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CACHE_MAX_AGE_MS,
  DEFAULT_SERVED,
  LICENSED,
  LICENSED_DDL,
  ON_ACCOUNT,
  SERVED_HEADER,
  apiBibleChapterId,
  chapterUrl,
  clearLicensedCache,
  getLicensedChapter,
  searchLicensed,
  countLicensedSearch,
  licensedSearchLeft,
  LICENSED_SEARCHES_A_MONTH,
  isLicensedCode,
  licensedConfigUsable,
  loadServed,
  parseChapterText,
  parseServed,
  proxyChapterUrl,
  pruneLicensedCache,
  saveServed,
  type LicensedCode,
  type LicensedConfig,
  type LicensedDb,
  type LicensedDeps,
} from "./licensed";

const CONFIG: LicensedConfig = { via: "api-bible", url: "https://api.example.test/", key: "test-key", enabled: true };
const NOTICE = "Placeholder Text®, Copyright © 2000 by Example House. Used by permission. All rights reserved.";
const CONTENT = "     [1] Alpha beta “gamma,” delta. [2] Line one;\n     line two —\n  line three. \n     [3-4] Bridged ’verse’ text.  [5] Last.\n";

function memoryDb(): LicensedDb & { count(): number } {
  const db = new DatabaseSync(":memory:");
  db.exec(LICENSED_DDL);
  return {
    getFirstAsync: async <T,>(sql: string, params: Array<string | number | null>) =>
      (db.prepare(sql).get(...params) as T | undefined) ?? null,
    runAsync: async (sql: string, params: Array<string | number | null>) => db.prepare(sql).run(...params),
    count: () => (db.prepare("SELECT COUNT(*) AS n FROM licensed_chapters").get() as { n: number }).n,
  };
}

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const chapterBody = (content = CONTENT, copyright = NOTICE) => ({ data: { id: "JHN.3", content, copyright } });

// A stray real request fails loudly instead of reaching the network.
beforeAll(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("live fetch in a test");
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

describe("parseChapterText", () => {
  it("splits at verse markers and keeps every character of each verse", () => {
    const verses = parseChapterText(CONTENT);
    expect(verses).toEqual([
      { verse: 1, through: 1, text: "Alpha beta “gamma,” delta." },
      { verse: 2, through: 2, text: "Line one;\n     line two —\n  line three." },
      { verse: 3, through: 4, text: "Bridged ’verse’ text." },
      { verse: 5, through: 5, text: "Last." },
    ]);
  });

  it("drops only whitespace and markers: the rest of the content is untouched", () => {
    const squash = (s: string) => s.replace(/\s+/g, "");
    const joined = parseChapterText(CONTENT).map((v) => v.text).join("");
    expect(squash(joined)).toBe(squash(CONTENT.replace(/\[\d+(?:-\d+)?\]/g, "")));
  });
});

describe("request shape", () => {
  it("uses USFM book ids unchanged", () => {
    expect(apiBibleChapterId("1CO", 13)).toBe("1CO.13");
    expect(apiBibleChapterId("JHN", 3)).toBe("JHN.3");
    expect(apiBibleChapterId("SNG", 2)).toBe("SNG.2");
  });

  it("asks for plain text without notes or titles", () => {
    expect(chapterUrl("https://api.example.test/", "78a9f6124f344018-01", "GEN.1")).toBe(
      "https://api.example.test/v1/bibles/78a9f6124f344018-01/chapters/GEN.1?content-type=text&include-notes=false&include-titles=false&include-verse-numbers=true",
    );
  });
});

describe("getLicensedChapter", () => {
  let db: ReturnType<typeof memoryDb>;
  let fetchMock: ReturnType<typeof vi.fn<LicensedDeps["fetch"]>>;
  let clock: Date;
  const deps = (): LicensedDeps => ({ db, config: CONFIG, fetch: fetchMock, now: () => clock });

  beforeEach(() => {
    db = memoryDb();
    fetchMock = vi.fn<LicensedDeps["fetch"]>(async () => response(chapterBody()));
    clock = new Date("2026-10-10T12:00:00Z");
  });

  it("fetches with the api-key header and the NIV id, and passes the notice through verbatim", async () => {
    const result = await getLicensedChapter(deps(), "NIV", "JHN", 3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/v1/bibles/78a9f6124f344018-01/chapters/JHN.3?");
    expect(init.headers).toEqual({ "api-key": "test-key" });
    expect(result).toMatchObject({ status: "ok", translation: "NIV", copyright: NOTICE, fromCache: false });
    if (result.status === "ok") expect(result.verses[1]?.text).toBe("Line one;\n     line two —\n  line three.");
  });

  it("serves a fresh cache without fetching, identical to what was fetched", async () => {
    const first = await getLicensedChapter(deps(), "NLT", "PSA", 23);
    clock = new Date(clock.getTime() + CACHE_MAX_AGE_MS - 1000);
    const second = await getLicensedChapter(deps(), "NLT", "PSA", 23);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ status: "ok", fromCache: true, copyright: NOTICE });
    if (first.status === "ok" && second.status === "ok") expect(second.verses).toEqual(first.verses);
  });

  it("caches per translation and chapter", async () => {
    await getLicensedChapter(deps(), "NIV", "JHN", 3);
    await getLicensedChapter(deps(), "NKJV", "JHN", 3);
    await getLicensedChapter(deps(), "NIV", "JHN", 4);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(db.count()).toBe(3);
  });

  it("refetches a chapter cached 30 days ago", async () => {
    await getLicensedChapter(deps(), "NIV", "JHN", 3);
    clock = new Date(clock.getTime() + CACHE_MAX_AGE_MS);
    fetchMock.mockResolvedValueOnce(response(chapterBody("[1] Revised.", "New notice.")));
    const result = await getLicensedChapter(deps(), "NIV", "JHN", 3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: "ok", fromCache: false, copyright: "New notice.", fetchedAt: clock.toISOString() });
  });

  it("offline with no cache: needs a connection", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
    expect(await getLicensedChapter(deps(), "NIV", "JHN", 3)).toEqual({ status: "needs-connection", translation: "NIV" });
  });

  it("a load that hangs past the limit fails with Try again, never a blank page (US-07)", async () => {
    const hanging: LicensedDeps["fetch"] = (_url, init) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const result = await getLicensedChapter({ ...deps(), fetch: hanging, timeoutMs: 20 }, "NIV", "JHN", 3);
    // A failure to try again, not "needs a connection": the reader may well be online.
    expect(result).toEqual({ status: "error", translation: "NIV", reason: "timeout" });
    expect(db.count()).toBe(0);
  });

  it("offline with only an expired copy: needs a connection, and the copy is gone", async () => {
    await getLicensedChapter(deps(), "NIV", "JHN", 3);
    clock = new Date(clock.getTime() + CACHE_MAX_AGE_MS + 1);
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
    expect(await getLicensedChapter(deps(), "NIV", "JHN", 3)).toEqual({ status: "needs-connection", translation: "NIV" });
    expect(db.count()).toBe(0);
  });

  it("reports an HTTP failure and caches nothing", async () => {
    fetchMock.mockResolvedValueOnce(response({ statusCode: 401 }, 401));
    expect(await getLicensedChapter(deps(), "NIV", "JHN", 3)).toEqual({ status: "error", translation: "NIV", reason: "http", httpStatus: 401 });
    expect(db.count()).toBe(0);
  });

  it("reports a 200 that is not a chapter as malformed, not as an HTTP status", async () => {
    fetchMock.mockResolvedValueOnce(response({ data: { content: 3 } }));
    expect(await getLicensedChapter(deps(), "NIV", "JHN", 3)).toEqual({ status: "error", translation: "NIV", reason: "malformed" });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => JSON.parse("not json") as unknown });
    expect(await getLicensedChapter(deps(), "NIV", "JHN", 3)).toEqual({ status: "error", translation: "NIV", reason: "malformed" });
    expect(db.count()).toBe(0);
  });

  it("does nothing when the flag is off or the key is missing", async () => {
    const off = await getLicensedChapter({ ...deps(), config: { ...CONFIG, enabled: false } }, "NIV", "JHN", 3);
    const noKey = await getLicensedChapter({ ...deps(), config: { ...CONFIG, key: "" } }, "NIV", "JHN", 3);
    expect(off.status).toBe("disabled");
    expect(noKey.status).toBe("disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears the whole cache on request", async () => {
    await getLicensedChapter(deps(), "NIV", "JHN", 3);
    await clearLicensedCache(db);
    expect(db.count()).toBe(0);
  });
});

describe("pruneLicensedCache (at launch)", () => {
  const launch = new Date("2026-11-20T08:00:00Z");
  const at = (ms: number) => new Date(launch.getTime() - ms);

  async function seed(db: ReturnType<typeof memoryDb>, chapters: Array<[string, Date]>): Promise<void> {
    for (const [chapterId, fetched] of chapters) {
      await db.runAsync(
        "INSERT INTO licensed_chapters (translation, chapter_id, content, copyright, fetched_at) VALUES (?, ?, ?, ?, ?)",
        ["NIV", chapterId, "[1] Text.", NOTICE, fetched.toISOString()],
      );
    }
  }

  it("drops chapters 30 days old or more, unread or not, and keeps younger ones", async () => {
    const db = memoryDb();
    await seed(db, [
      ["JHN.1", at(CACHE_MAX_AGE_MS + 86_400_000)],
      ["JHN.2", at(CACHE_MAX_AGE_MS)],
      ["JHN.3", at(CACHE_MAX_AGE_MS - 1000)],
      ["JHN.4", at(0)],
    ]);
    await pruneLicensedCache(db, true, launch);
    const kept = await db.getFirstAsync<{ ids: string }>(
      "SELECT group_concat(chapter_id, ',') AS ids FROM (SELECT chapter_id FROM licensed_chapters ORDER BY chapter_id)",
      [],
    );
    expect(kept?.ids).toBe("JHN.3,JHN.4");
  });

  it("agrees with getLicensedChapter on the boundary: a kept row is still served from cache", async () => {
    const db = memoryDb();
    await seed(db, [["JHN.3", at(CACHE_MAX_AGE_MS - 1)]]);
    await pruneLicensedCache(db, true, launch);
    const fetchMock = vi.fn<LicensedDeps["fetch"]>();
    const result = await getLicensedChapter({ db, config: CONFIG, fetch: fetchMock, now: () => launch }, "NIV", "JHN", 3);
    expect(result).toMatchObject({ status: "ok", fromCache: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears everything when licensed text is not enabled in this build", async () => {
    const db = memoryDb();
    await seed(db, [["JHN.3", at(0)], ["JHN.4", at(1000)]]);
    await pruneLicensedCache(db, false, launch);
    expect(db.count()).toBe(0);
  });
});

describe("through Yada's proxy (release and TestFlight builds)", () => {
  const PROXY: LicensedConfig = { via: "proxy", url: "https://proxy.example.test/", enabled: true };
  const proxyBody = (content = CONTENT, copyright = NOTICE) => ({ translation: "NKJV", chapter: "JHN.3", content, copyright });
  const withServed = (body: unknown, served: string | null, status = 200) => ({
    ...response(body, status),
    headers: { get: (name: string) => (name === SERVED_HEADER ? served : null) },
  });
  let db: ReturnType<typeof memoryDb>;
  let fetchMock: ReturnType<typeof vi.fn<LicensedDeps["fetch"]>>;
  let served: LicensedCode[][];
  const deps = (): LicensedDeps => ({
    db,
    config: PROXY,
    fetch: fetchMock,
    now: () => new Date("2026-10-12T12:00:00Z"),
    onServed: (codes) => served.push(codes),
  });

  beforeEach(() => {
    db = memoryDb();
    served = [];
    fetchMock = vi.fn<LicensedDeps["fetch"]>(async () => withServed(proxyBody(), "NKJV,NLT"));
  });

  it("asks for the translation and chapter only: no key, no header about the reader", async () => {
    const result = await getLicensedChapter(deps(), "NKJV", "JHN", 3);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://proxy.example.test/v1/chapter/NKJV/JHN.3");
    expect(proxyChapterUrl("https://proxy.example.test", "NLT", "1CO.13")).toBe("https://proxy.example.test/v1/chapter/NLT/1CO.13");
    expect(init.headers).toEqual({ Accept: "application/json" });
    expect(result).toMatchObject({ status: "ok", translation: "NKJV", copyright: NOTICE, fromCache: false });
    if (result.status === "ok") expect(result.verses[1]?.text).toBe("Line one;\n     line two —\n  line three.");
  });

  it("is usable without a key, and is cached under the same 30-day rule", async () => {
    expect(licensedConfigUsable(PROXY)).toBe(true);
    expect(licensedConfigUsable({ ...PROXY, url: "" })).toBe(false);
    await getLicensedChapter(deps(), "NLT", "PSA", 23);
    const again = await getLicensedChapter(deps(), "NLT", "PSA", 23);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(again).toMatchObject({ status: "ok", fromCache: true });
  });

  it("learns the served set from every response, a refusal included", async () => {
    await getLicensedChapter(deps(), "NKJV", "JHN", 3);
    fetchMock.mockResolvedValueOnce(withServed({ error: "not-served", served: ["NKJV"] }, "NKJV", 404));
    const refused = await getLicensedChapter(deps(), "NLT", "JHN", 3);
    expect(refused).toEqual({ status: "error", translation: "NLT", reason: "http", httpStatus: 404 });
    expect(served).toEqual([["NKJV", "NLT"], ["NKJV"]]);
  });

  it("reads The Message through the proxy by its code, with the notice it sends", async () => {
    expect(isLicensedCode("MSG")).toBe(true);
    expect(LICENSED.find((t) => t.code === "MSG")).toEqual({ code: "MSG", name: "The Message", bibleId: "6f11a7de016f942e-01" });
    const result = await getLicensedChapter(deps(), "MSG", "PSA", 23);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://proxy.example.test/v1/chapter/MSG/PSA.23");
    expect(result).toMatchObject({ status: "ok", translation: "MSG", copyright: NOTICE });
  });

  it("the dev path offers only what the account holds: MSG, not NIV", () => {
    expect(ON_ACCOUNT).toEqual(["NKJV", "NLT", "MSG"]);
  });

  it("reads an API.Bible-shaped body from the proxy as malformed", async () => {
    fetchMock.mockResolvedValueOnce(withServed({ data: { content: CONTENT, copyright: NOTICE } }, "NKJV,NLT"));
    expect(await getLicensedChapter(deps(), "NKJV", "JHN", 3)).toEqual({ status: "error", translation: "NKJV", reason: "malformed" });
  });

  it("offline: needs a connection", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
    expect(await getLicensedChapter(deps(), "NKJV", "JHN", 3)).toEqual({ status: "needs-connection", translation: "NKJV" });
  });
});

describe("the served set", () => {
  it("parses only known codes, and tells a missing header from an empty set", () => {
    expect(parseServed("NLT, msg, nkjv,ESV")).toEqual(["NKJV", "NLT", "MSG"]);
    expect(parseServed("")).toEqual([]);
    expect(parseServed(null)).toBeNull();
  });

  it("assumes NKJV, NLT and MSG until the proxy answers, never NIV", async () => {
    const db = memoryDb();
    expect(DEFAULT_SERVED).toEqual(["NKJV", "NLT", "MSG"]);
    expect(await loadServed(db)).toEqual(["NKJV", "NLT", "MSG"]);
    await saveServed(db, ["NIV", "NKJV", "NLT"]);
    expect(await loadServed(db)).toEqual(["NIV", "NKJV", "NLT"]);
    await saveServed(db, []);
    expect(await loadServed(db)).toEqual([]);
  });

  it("drops cached chapters of a version no longer served, at launch", async () => {
    const db = memoryDb();
    const now = new Date("2026-10-12T12:00:00Z");
    for (const t of ["NIV", "NKJV", "NLT"]) {
      await db.runAsync(
        "INSERT INTO licensed_chapters (translation, chapter_id, content, copyright, fetched_at) VALUES (?, ?, ?, ?, ?)",
        [t, "JHN.3", "[1] Text.", NOTICE, now.toISOString()],
      );
    }
    await pruneLicensedCache(db, true, now, ["NKJV", "NLT"]);
    expect(db.count()).toBe(2);
    await pruneLicensedCache(db, true, now, []);
    expect(db.count()).toBe(0);
  });
});

describe("searchLicensed (EG-06, EG-07)", () => {
  const PROXY: LicensedConfig = { via: "proxy", url: "https://proxy.example.test", enabled: true };
  const body = { total: 1, verses: [{ id: "MAT.16.18", reference: "Matthew 16:18", text: "Placeholder." }], copyright: "Notice." };

  it("asks the proxy's search route and passes the verses and notice through", async () => {
    const fetch = vi.fn<LicensedDeps["fetch"]>(async () => ({ ok: true, status: 200, json: async () => body }));
    const result = await searchLicensed({ config: PROXY, fetch }, "NKJV", "church");
    expect(fetch.mock.calls[0]?.[0]).toBe("https://proxy.example.test/v1/search/NKJV?q=church");
    expect(result).toEqual({ status: "ok", translation: "NKJV", total: 1, verses: [{ verseId: "MAT.16.18", reference: "Matthew 16:18", text: "Placeholder." }], copyright: "Notice." });
  });

  it("offline, says it needs a connection, so the screen falls back to the BSB", async () => {
    const fetch = vi.fn<LicensedDeps["fetch"]>(async () => {
      throw new TypeError("Network request failed");
    });
    expect(await searchLicensed({ config: PROXY, fetch }, "NKJV", "church")).toEqual({ status: "needs-connection", translation: "NKJV" });
  });
});

describe("with the proxy's shared copy and call budget (18 Oct 2026)", () => {
  const PROXY: LicensedConfig = { via: "proxy", url: "https://proxy.example.test", enabled: true };
  const NOW = new Date("2026-10-18T12:00:00Z");
  const proxyBody = (fetchedAt?: string) => ({ translation: "NKJV", chapter: "JHN.3", content: CONTENT, copyright: NOTICE, ...(fetchedAt === undefined ? {} : { fetchedAt }) });

  it("counts the phone's 30 days from when API.Bible sent the chapter, not from the download", async () => {
    const db = memoryDb();
    const fetch = vi.fn(async () => response(proxyBody("2026-10-01T00:00:00.000Z")));
    const got = await getLicensedChapter({ db, config: PROXY, fetch, now: () => NOW }, "NKJV", "JHN", 3);
    expect(got).toMatchObject({ status: "ok", fetchedAt: "2026-10-01T00:00:00.000Z" });
    // 31 Oct is 30 days after 1 Oct: the copy is gone, though the phone downloaded it on the 18th.
    await getLicensedChapter({ db, config: PROXY, fetch, now: () => new Date("2026-10-31T00:00:00Z") }, "NKJV", "JHN", 3);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("never takes a fetch time later than now", async () => {
    const db = memoryDb();
    const fetch = vi.fn(async () => response(proxyBody("2027-01-01T00:00:00.000Z")));
    const got = await getLicensedChapter({ db, config: PROXY, fetch, now: () => NOW }, "NKJV", "JHN", 3);
    expect(got).toMatchObject({ status: "ok", fetchedAt: NOW.toISOString() });
  });

  it("says so when the month's calls are spent, so the reader offers no Try again", async () => {
    const db = memoryDb();
    const fetch = vi.fn(async () => response({ error: "budget" }, 503));
    const got = await getLicensedChapter({ db, config: PROXY, fetch, now: () => NOW }, "NKJV", "JHN", 3);
    expect(got).toEqual({ status: "error", translation: "NKJV", reason: "budget" });
    const busy = await getLicensedChapter({ db, config: PROXY, fetch: vi.fn(async () => response({ error: "busy" }, 503)), now: () => NOW }, "NKJV", "JHN", 3);
    expect(busy).toEqual({ status: "error", translation: "NKJV", reason: "http", httpStatus: 503 });
  });

  it("gives each phone a few licensed searches a month, afresh each month", async () => {
    const db = memoryDb();
    for (let i = 0; i < LICENSED_SEARCHES_A_MONTH; i++) {
      expect(await licensedSearchLeft(db, NOW)).toBe(true);
      await countLicensedSearch(db, NOW);
    }
    expect(await licensedSearchLeft(db, NOW)).toBe(false);
    expect(await licensedSearchLeft(db, new Date("2026-11-01T00:00:00Z"))).toBe(true);
  });

  it("reports the proxy's spent search share as a limit, not a failure", async () => {
    const fetch = vi.fn(async () => response({ error: "budget" }, 503));
    expect(await searchLicensed({ config: PROXY, fetch }, "NKJV", "love")).toEqual({ status: "limit", translation: "NKJV" });
  });
});
