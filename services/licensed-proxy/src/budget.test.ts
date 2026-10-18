import { describe, expect, it } from "vitest";

import { expiresAt, mayCall, parsePlanDay, planMonthStart, READ_STOP, SEARCH_CAP } from "./budget";
import { bibleKey, chapterKey, codeOfKey } from "./gate";

const d = (s: string) => new Date(s);

describe("plan months", () => {
  it("start on the plan's day, this month or last", () => {
    expect(planMonthStart(d("2026-10-18T12:00:00Z"), 10).toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(planMonthStart(d("2026-10-09T23:59:59Z"), 10).toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(planMonthStart(d("2026-01-05T00:00:00Z"), 10).toISOString()).toBe("2025-12-10T00:00:00.000Z");
  });

  it("end a copy 30 days after it was fetched", () => {
    expect(expiresAt(d("2026-10-25T00:00:00Z")).toISOString()).toBe("2026-11-24T00:00:00.000Z");
  });

  it("read a bad day as 1", () => {
    expect([parsePlanDay("10"), parsePlanDay("31"), parsePlanDay(undefined), parsePlanDay("x")]).toEqual([10, 1, 1, 1]);
  });
});

describe("mayCall", () => {
  it("lets reading use what search leaves, and search only its own share", () => {
    expect(mayCall("read", { total: READ_STOP - 1, search: SEARCH_CAP })).toBe(true);
    expect(mayCall("read", { total: READ_STOP, search: 0 })).toBe(false);
    expect(mayCall("search", { total: 100, search: SEARCH_CAP - 1 })).toBe(true);
    expect(mayCall("search", { total: 100, search: SEARCH_CAP })).toBe(false);
    expect(mayCall("search", { total: READ_STOP, search: 0 })).toBe(false);
  });
});

describe("codeOfKey (the daily prune keeps what is served)", () => {
  it("finds the version in a chapter key and in a copyright key", () => {
    expect(codeOfKey(chapterKey("NKJV", "JHN.3"))).toBe("NKJV");
    expect(codeOfKey(chapterKey("MSG", "1CO.13"))).toBe("MSG");
    expect(codeOfKey(bibleKey("NLT"))).toBe("NLT");
  });
});
