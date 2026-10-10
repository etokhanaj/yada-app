/**
 * Licensed translations against an in-memory user.db, with fetch mocked
 * throughout: no test here, and nothing in CI, may call API.Bible.
 * The passages below are made-up placeholder text, not any licensed translation.
 */

import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CACHE_MAX_AGE_MS,
  LICENSED_DDL,
  apiBibleChapterId,
  chapterUrl,
  clearLicensedCache,
  getLicensedChapter,
  parseChapterText,
  pruneLicensedCache,
  type LicensedConfig,
  type LicensedDb,
  type LicensedDeps,
} from "./licensed";

const CONFIG: LicensedConfig = { url: "https://api.example.test/", key: "test-key", enabled: true };
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
