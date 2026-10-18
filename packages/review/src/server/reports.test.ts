import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { CkRecord, CloudKitClient } from "./cloudkit.js";
import { buildReports, decideReport, reportsLogPath } from "./reports.js";

/** An in-memory public database, as the repo's other fake API clients. */
class FakeCloudKit {
  environment = "development";
  ops: unknown[] = [];
  constructor(public records: CkRecord[]) {}
  async queryAll(type: string): Promise<CkRecord[]> {
    return this.records.filter((r) => r.recordType === type);
  }
  async lookup(names: string[]): Promise<CkRecord[]> {
    return this.records.filter((r) => names.includes(r.recordName));
  }
  async modify(operations: { operationType: string; record: { recordName: string; fields?: Record<string, { value: unknown }> } }[]): Promise<CkRecord[]> {
    this.ops.push(...operations);
    for (const op of operations) {
      if (op.operationType === "forceDelete") this.records = this.records.filter((r) => r.recordName !== op.record.recordName);
      else this.records = this.records.map((r) => (r.recordName === op.record.recordName ? { ...r, fields: { ...r.fields, ...op.record.fields } } : r));
    }
    return [];
  }
}

const request = (id: string, text: string, hidden = 0): CkRecord => ({ recordName: id, recordType: "PrayerRequest", fields: { text: { value: text }, firstName: { value: "Anna" }, hidden: { value: hidden } } });
const report = (id: string, on: string, reason: string, at: number): CkRecord => ({ recordName: id, recordType: "Report", created: { timestamp: at }, fields: { request: { value: { recordName: on } }, reason: { value: reason } } });

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function dir(): string {
  const d = mkdtempSync(path.join(os.tmpdir(), "reports-"));
  dirs.push(d);
  return d;
}

describe("Reports queue", () => {
  const db = () =>
    new FakeCloudKit([
      request("q1", "Pray for my exam"),
      request("q2", "Something unkind"),
      report("r1", "q2", "reported", 100),
      report("r2", "q2", "reported", 300),
      report("r3", "q1", "reported", 200),
    ]);

  it("lists each reported request once, with its count, newest report first", async () => {
    const res = await buildReports(db() as unknown as CloudKitClient);
    expect(res.state).toBe("ready");
    if (res.state === "ready") expect(res.items.map((i) => [i.id, i.reports, i.last_reported])).toEqual([["q2", 2, 300], ["q1", 1, 200]]);
  });

  it("says why when there is no key", async () => {
    expect(await buildReports({ missing: "No Production server-to-server key yet." })).toEqual({ state: "unavailable", reason: "No Production server-to-server key yet." });
  });

  it("Keep deletes the request's reports, so the app's three-report filter shows it again", async () => {
    const ck = db();
    const item = await decideReport(ck as unknown as CloudKitClient, "q2", "keep", dir(), "John");
    expect(ck.records.filter((r) => r.recordType === "Report").map((r) => r.recordName)).toEqual(["r3"]);
    expect([item.reports, item.removed]).toEqual([0, false]);
  });

  it("Remove sets hidden, which the app's query already excludes", async () => {
    const ck = db();
    const item = await decideReport(ck as unknown as CloudKitClient, "q2", "remove", dir(), "John");
    expect(ck.records.find((r) => r.recordName === "q2")?.fields["hidden"]?.value).toBe(1);
    expect(item.removed).toBe(true);
  });

  it("logs the decision without the request's words", async () => {
    const d = dir();
    await decideReport(db() as unknown as CloudKitClient, "q2", "remove", d, "John");
    const log = readFileSync(reportsLogPath(d), "utf8");
    expect(JSON.parse(log)).toMatchObject({ reviewer: "John", request: "q2", action: "remove", reports: 2 });
    expect(log).not.toContain("unkind");
  });

  it("logs nothing when CloudKit refuses", async () => {
    const d = dir();
    const ck = db();
    ck.modify = async () => {
      throw new Error("CloudKit refused q2: ACCESS_DENIED");
    };
    await expect(decideReport(ck as unknown as CloudKitClient, "q2", "remove", d, "John")).rejects.toThrow("ACCESS_DENIED");
    expect(existsSync(reportsLogPath(d))).toBe(false);
  });
});
