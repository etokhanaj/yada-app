/**
 * iCloud sync end to end against in-memory user.dbs: two devices, one shared
 * key-value store standing in for iCloud. The merge rules themselves are
 * tested in lib/cloudSync.test.ts; this checks the SQL around them.
 */

import { DatabaseSync } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ AppState: { addEventListener: () => ({ remove: () => undefined }) } }));
vi.mock("../../modules/yada-cloud", () => ({ cloudStore: null, CloudChangeReason: {} }));

const { KIND_BUDGET_BYTES, syncWithCloud } = await import("./cloud");
const user = await import("./user");

type Params = Array<string | number | null>;

function device(onRead?: (sql: string) => void): SQLiteDatabase {
  const db = new DatabaseSync(":memory:");
  db.exec(user.USER_DDL);
  const adapter = {
    getAllAsync: async (sql: string, params: Params = []) => {
      onRead?.(sql);
      return db.prepare(sql).all(...params);
    },
    getFirstAsync: async (sql: string, params: Params = []) => db.prepare(sql).get(...params) ?? null,
    runAsync: async (sql: string, params: Params = []) => db.prepare(sql).run(...params),
    withTransactionAsync: async (task: () => Promise<void>) => {
      db.exec("BEGIN");
      try {
        await task();
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return adapter as unknown as SQLiteDatabase;
}

function memoryStore() {
  const values = new Map<string, string>();
  return {
    values,
    get: (key: string) => values.get(key) ?? null,
    set: (key: string, value: string) => void values.set(key, value),
    synchronize: () => true,
  };
}

const READ = "start-here-john/read/";
const finished = async (db: SQLiteDatabase) => (await user.loadReadPassages(db, READ)).sort();

const bookmarks = async (db: SQLiteDatabase) => (await user.listBookmarks(db)).map((r) => r.verse_id).sort();
const highlights = async (db: SQLiteDatabase) => (await user.listHighlights(db)).map((r) => `${r.verse_id}:${r.color}`).sort();
const notes = async (db: SQLiteDatabase) => (await user.listNotes(db)).map((r) => `${r.target}:${r.body}`).sort();

describe("iCloud sync between two devices", () => {
  it("leaves an empty store empty when there is nothing to keep", async () => {
    const store = memoryStore();
    await syncWithCloud(device(), store);
    expect(store.values.size).toBe(0);
  });

  it("brings a reinstalled or second device everything but the event log and downloads", async () => {
    const store = memoryStore();
    const phone = device();
    await user.toggleBookmark(phone, "JHN.3.16");
    await user.savePosition(phone, "ROM.8.1");
    await user.saveThreadStep(phone, "start-here-john", 3);
    await user.saveSetting(phone, "appearance", "dark");
    await user.saveSetting(phone, "launched", "1");
    await user.logEvent(phone, "search");
    await syncWithCloud(phone, store);

    const pad = device();
    await syncWithCloud(pad, store, true);
    expect(await bookmarks(pad)).toEqual(["JHN.3.16"]);
    expect(await user.loadPosition(pad)).toBe("ROM.8.1");
    expect(await user.loadThreadStep(pad, "start-here-john")).toBe(3);
    expect(await user.loadSettings(pad)).toEqual({ appearance: "dark" });
    expect([...store.values.keys()].sort()).toEqual(["v1.bookmarks", "v1.position", "v1.settings", "v1.threads"]);
  });

  it("carries a removal on one device to the other, and keeps adds from both", async () => {
    const store = memoryStore();
    const phone = device();
    const pad = device();
    await user.toggleBookmark(phone, "JHN.3.16");
    await syncWithCloud(phone, store);
    await syncWithCloud(pad, store);

    await user.removeBookmark(pad, "JHN.3.16");
    await user.toggleBookmark(pad, "PSA.23.1");
    await user.toggleBookmark(phone, "ROM.8.28");
    await syncWithCloud(pad, store);
    await syncWithCloud(phone, store);
    await syncWithCloud(pad, store);

    expect(await bookmarks(phone)).toEqual(["PSA.23.1", "ROM.8.28"]);
    expect(await bookmarks(pad)).toEqual(["PSA.23.1", "ROM.8.28"]);
  });

  it("re-adds a bookmark removed elsewhere when the add comes after the removal", async () => {
    const store = memoryStore();
    const phone = device();
    const pad = device();
    await user.toggleBookmark(phone, "JHN.3.16");
    await syncWithCloud(phone, store);
    await syncWithCloud(pad, store);
    await user.removeBookmark(pad, "JHN.3.16");
    await syncWithCloud(pad, store);
    await syncWithCloud(phone, store);
    expect(await bookmarks(phone)).toEqual([]);

    await user.toggleBookmark(phone, "JHN.3.16");
    await syncWithCloud(phone, store);
    await syncWithCloud(pad, store);
    expect(await bookmarks(pad)).toEqual(["JHN.3.16"]);
  });

  it("follows a setting changed on the other device and reports it", async () => {
    const store = memoryStore();
    const phone = device();
    const pad = device();
    await user.saveSetting(phone, "textScale", "1.1");
    await syncWithCloud(phone, store);
    expect(await syncWithCloud(pad, store)).toBe(true);
    expect((await user.loadSettings(pad))["textScale"]).toBe("1.1");
    // Nothing new the second time.
    expect(await syncWithCloud(pad, store)).toBe(false);
  });

  it("does not let re-saving an unchanged value push it back as newer", async () => {
    const store = memoryStore();
    const phone = device();
    const pad = device();
    await user.saveSetting(phone, "appearance", "dark");
    await syncWithCloud(phone, store);
    await syncWithCloud(pad, store);
    const before = store.values.get("v1.settings");
    // The settings store re-saves what it was just given.
    await user.saveSetting(pad, "appearance", "dark");
    await syncWithCloud(pad, store);
    expect(store.values.get("v1.settings")).toBe(before);
  });

  it("ignores unreadable iCloud values without failing the sync", async () => {
    const store = memoryStore();
    store.values.set("v1.bookmarks", "{not json");
    store.values.set("v1.settings", JSON.stringify({ appearance: ["sepia", 1], textScale: ["1.1", 1] }));
    const phone = device();
    await user.toggleBookmark(phone, "JHN.3.16");
    await syncWithCloud(phone, store);
    expect(await bookmarks(phone)).toEqual(["JHN.3.16"]);
    // "sepia" is text, so it passes the shape check; hydrate in state/settings.ts falls back.
    expect(await user.loadSettings(phone)).toEqual({ appearance: "sepia", textScale: "1.1" });
    expect(JSON.parse(store.values.get("v1.bookmarks") ?? "{}")).toHaveProperty(["JHN.3.16"]);
  });

  it("keeps the passages finished on both devices: one register per passage, so the set is the union", async () => {
    const store = memoryStore();
    const phone = device();
    const pad = device();
    await user.markPassageRead(phone, "start-here-john", `${READ}JHN.1.1-1.18`, 1);
    await user.markPassageRead(pad, "start-here-john", `${READ}JHN.1.19-1.34`, 2);
    await syncWithCloud(phone, store);
    await syncWithCloud(pad, store);
    await syncWithCloud(phone, store);

    expect(await finished(phone)).toEqual(["JHN.1.1-1.18", "JHN.1.19-1.34"]);
    expect(await finished(pad)).toEqual(["JHN.1.1-1.18", "JHN.1.19-1.34"]);
    // The next step is one register: the later write, the pad's.
    expect(await user.loadThreadStep(phone, "start-here-john")).toBe(2);
  });

  it("keeps a bookmark made while a sync is merging, against an older removal from iCloud", async () => {
    const store = memoryStore();
    const pad = device();
    await user.toggleBookmark(pad, "JHN.3.16");
    await user.removeBookmark(pad, "JHN.3.16");
    await syncWithCloud(pad, store);

    // The phone bookmarks the verse while its sync is reading user.db, before it writes the merge.
    let toggled: Promise<boolean> | undefined;
    const phone = device((sql) => {
      if (toggled === undefined && sql.includes("FROM bookmark_removals")) toggled = user.toggleBookmark(phone, "JHN.3.16");
    });
    await syncWithCloud(phone, store);
    expect(await toggled).toBe(true);
    expect(await bookmarks(phone)).toEqual(["JHN.3.16"]);
  });

  it("stamps a passage finished again after the copy it replaces, so a slow clock cannot lose it", async () => {
    const store = memoryStore();
    const phone = device();
    await user.markPassageRead(phone, "start-here-john", `${READ}JHN.1.1-1.18`, 1);
    await syncWithCloud(phone, store);
    const first = JSON.parse(store.values.get("v1.threads") ?? "{}")[`${READ}JHN.1.1-1.18`][1] as number;
    vi.spyOn(Date, "now").mockReturnValue(first - 60_000);
    await user.markPassageRead(phone, "start-here-john", `${READ}JHN.1.1-1.18`, 1);
    vi.restoreAllMocks();
    await syncWithCloud(phone, store);
    const second = JSON.parse(store.values.get("v1.threads") ?? "{}")[`${READ}JHN.1.1-1.18`][1] as number;
    expect(second).toBeGreaterThan(first);
  });

  it("carries a highlight cleared on one device to the other: the cleared mark beats the stale colour", async () => {
    const store = memoryStore();
    const phone = device();
    const pad = device();
    await user.setHighlight(phone, ["JHN.3.16", "JHN.3.17"], "yellow");
    await syncWithCloud(phone, store);
    await syncWithCloud(pad, store);
    expect(await highlights(pad)).toEqual(["JHN.3.16:yellow", "JHN.3.17:yellow"]);

    await user.setHighlight(pad, ["JHN.3.16"], null);
    await user.setHighlight(pad, ["JHN.3.17"], "blue");
    await syncWithCloud(pad, store);
    // The phone still holds yellow on both; its sync must not send them back.
    await syncWithCloud(phone, store);
    await syncWithCloud(pad, store);

    expect(await highlights(phone)).toEqual(["JHN.3.17:blue"]);
    expect(await highlights(pad)).toEqual(["JHN.3.17:blue"]);
  });

  it("carries a note deleted on one device to the other, and keeps a newer note from either", async () => {
    const store = memoryStore();
    const phone = device();
    const pad = device();
    await user.saveNote(phone, "JHN.3.16", "For God so loved");
    await user.saveNote(phone, "JHN.3", "Nicodemus at night");
    await syncWithCloud(phone, store);
    await syncWithCloud(pad, store);

    await user.saveNote(pad, "JHN.3.16", "");
    await user.saveNote(pad, "JHN.3", "Born again, from above");
    await syncWithCloud(pad, store);
    await syncWithCloud(phone, store);
    await syncWithCloud(pad, store);

    expect(await notes(phone)).toEqual(["JHN.3:Born again, from above"]);
    expect(await notes(pad)).toEqual(["JHN.3:Born again, from above"]);
  });

  it("keeps a kind past its iCloud budget on this device, and still syncs the rest", async () => {
    const store = memoryStore();
    const phone = device();
    const body = "a".repeat(1900);
    const count = Math.ceil(KIND_BUDGET_BYTES / body.length) + 5;
    for (let i = 0; i < count; i++) await user.saveNote(phone, `PSA.${1 + Math.floor(i / 5)}.${1 + (i % 5)}`, body);
    await user.toggleBookmark(phone, "JHN.3.16");
    await syncWithCloud(phone, store);

    expect(store.values.has("v1.notes")).toBe(false);
    expect(store.values.has("v1.bookmarks")).toBe(true);
    expect((await user.listNotes(phone)).length).toBe(count);
  });
});
