/**
 * Remove my data (ST-03) against an in-memory user.db: everything the alert names goes, the reader's settings stay.
 * Downloads, audio, the reminder and iCloud are stubbed; their own modules own those rules. Pray's CloudKit module is a
 * fake that records what was asked of it, as on a phone signed in, signed out, or offline.
 */

import { DatabaseSync } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ AppState: { addEventListener: () => ({ remove: () => undefined }) } }));
vi.mock("expo-notifications", () => ({ cancelAllScheduledNotificationsAsync: async () => undefined }));
vi.mock("./audio", () => ({ endSession: () => undefined }));
vi.mock("./cloud", () => ({ clearCloud: () => undefined, cloudIdle: async () => undefined, setCloudPaused: () => undefined }));
vi.mock("./recordings", () => ({ removeAllReadings: () => undefined }));
vi.mock("./reminder", () => ({ useReminder: { setState: () => undefined } }));
vi.mock("./system", () => ({ updateWidgets: async () => undefined }));
const pray = { status: "available", fail: false, calls: [] as string[] };
vi.mock("../../modules/yada-pray", () => ({
  prayCloud: {
    accountStatus: async () => pray.status,
    removeMine: async () => {
      if (pray.fail) throw new Error("network unavailable");
      pray.calls.push("removeMine");
    },
  },
  circlesCloud: {
    removeAll: async () => {
      pray.calls.push("removeAll");
    },
  },
}));
const none = { getState: () => ({ downloading: {}, installed: {} }) };
vi.mock("./study", () => ({ cancelStudyDownloads: () => undefined, removeStudy: async () => undefined, useStudy: none }));
vi.mock("./translations", () => ({ cancelDownload: () => undefined, removeTranslation: async () => undefined, useTranslations: { getState: () => ({ downloading: {}, installed: [] }) } }));
vi.mock("./understand", () => ({ cancelUnderstandDownloads: () => undefined, removeUnderstand: async () => undefined, useUnderstand: none }));

const { prayRemovalLine, removeMyData } = await import("./removeData");
const user = await import("./user");

type Params = Array<string | number | null>;

function device(): { db: SQLiteDatabase; count: (table: string) => number } {
  const raw = new DatabaseSync(":memory:");
  raw.exec(user.USER_DDL);
  const adapter = {
    getAllAsync: async (sql: string, params: Params = []) => raw.prepare(sql).all(...params),
    getFirstAsync: async (sql: string, params: Params = []) => raw.prepare(sql).get(...params) ?? null,
    runAsync: async (sql: string, params: Params = []) => raw.prepare(sql).run(...params),
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec("BEGIN");
      try {
        await task();
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const count = (table: string) => (raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  return { db: adapter as unknown as SQLiteDatabase, count };
}

describe("Remove my data", () => {
  it("clears highlights, notes, saved images and chapters read, and keeps the reader's settings", async () => {
    const { db, count } = device();
    await user.setHighlight(db, ["JHN.3.16"], "yellow");
    await user.saveNote(db, "JHN.3", "Nicodemus at night");
    await user.recordVerseImage(db, { verse_id: "JHN.3.16", through: 16, translation: "BSB", ground: "white", picture_day: 1 });
    await db.runAsync("INSERT INTO chapters_read (chapter_key) VALUES (?)", ["JHN.3"]);
    await user.toggleBookmark(db, "PSA.23.1");
    await user.saveSetting(db, "appearance", "dark");
    for (const table of ["highlights", "notes", "verse_images", "chapters_read", "bookmarks"]) expect(count(table)).toBe(1);

    pray.calls = [];
    expect(await removeMyData(db, {} as never)).toBe("done");
    expect(pray.calls).toEqual(["removeMine", "removeAll"]);

    for (const table of ["highlights", "notes", "verse_images", "chapters_read", "bookmarks"]) expect(count(table)).toBe(0);
    expect(await user.loadSettings(db)).toEqual({ appearance: "dark" });
  });

  it("deletes the reader's prayer requests and circles in iCloud, and says so when it cannot (guideline 5.1.1(v))", async () => {
    const { db, count } = device();
    await user.setHighlight(db, ["JHN.3.16"], "yellow");

    Object.assign(pray, { status: "noAccount", fail: false, calls: [] });
    const signedOut = await removeMyData(db, {} as never);
    expect(signedOut).toBe("signedOut");
    expect(pray.calls).toEqual([]);
    expect(prayRemovalLine(signedOut)).toMatch(/Sign in to iCloud/);
    // The rest still goes: a reader offline or signed out is not left with everything.
    expect(count("highlights")).toBe(0);

    Object.assign(pray, { status: "available", fail: true, calls: [] });
    const offline = await removeMyData(db, {} as never);
    expect(offline).toBe("failed");
    expect(prayRemovalLine(offline)).toMatch(/connection/);
    expect(prayRemovalLine("done")).toBeNull();
  });
});
