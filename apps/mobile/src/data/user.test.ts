/** Search's Recent (SE-30) against an in-memory user.db, through the same adapter shape as removeData.test.ts. */

import { DatabaseSync } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import { describe, expect, it } from "vitest";

import { listRecentSearches, rememberSearch, USER_DDL } from "./user";

type Params = Array<string | number | null>;

function device(): SQLiteDatabase {
  const raw = new DatabaseSync(":memory:");
  raw.exec(USER_DDL);
  return {
    getAllAsync: async (sql: string, params: Params = []) => raw.prepare(sql).all(...params),
    runAsync: async (sql: string, params: Params = []) => raw.prepare(sql).run(...params),
  } as unknown as SQLiteDatabase;
}

const at = (minute: number) => new Date(Date.UTC(2026, 9, 25, 9, minute));

describe("recent searches (SE-30)", () => {
  it("lists the newest first, once each whatever the capitals", async () => {
    const db = device();
    await rememberSearch(db, "peace", at(1));
    await rememberSearch(db, "Psalm 23", at(2));
    await rememberSearch(db, " Peace ", at(3));
    expect(await listRecentSearches(db)).toEqual(["Peace", "Psalm 23"]);
  });

  it("ignores an empty search and keeps twenty", async () => {
    const db = device();
    await rememberSearch(db, "  ", at(0));
    for (let i = 0; i < 25; i++) await rememberSearch(db, `word ${i}`, at(i + 1));
    const all = await listRecentSearches(db, 100);
    expect(all).toHaveLength(20);
    expect(all[0]).toBe("word 24");
    expect(all.at(-1)).toBe("word 5");
  });
});
