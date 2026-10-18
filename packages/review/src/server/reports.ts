/**
 * The Reports queue (Build 11a, docs/build-11a-plan.md). Reads Report records and the requests they point at from
 * CloudKit's public database. Keep deletes a request's reports, so the app's three-report filter shows it again; Remove
 * sets the request's `hidden` to 1, which the app's query already excludes (YadaPrayModule `open`), so no schema or app
 * change is needed. The log keeps record names and the decision, never a request's words: review/ is committed, and the
 * privacy page says Yada stores no request.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import type { ReportAction, ReportItem, ReportsResponse } from "../shared/api.js";
import type { CkRecord, CloudKitClient } from "./cloudkit.js";

export function reportsLogPath(reviewDir: string): string {
  return path.join(reviewDir, "reports.jsonl");
}

const requestOf = (r: CkRecord): string | undefined => (r.fields["request"]?.value as { recordName?: string } | undefined)?.recordName;

function item(request: CkRecord, reports: CkRecord[]): ReportItem {
  const reasons = [...new Set(reports.map((r) => String(r.fields["reason"]?.value ?? "")).filter((r) => r !== ""))];
  return {
    id: request.recordName,
    text: String(request.fields["text"]?.value ?? ""),
    first_name: String(request.fields["firstName"]?.value ?? ""),
    reports: reports.length,
    reasons,
    last_reported: Math.max(0, ...reports.map((r) => r.created?.timestamp ?? 0)),
    removed: request.fields["hidden"]?.value === 1,
  };
}

async function reportsByRequest(ck: CloudKitClient): Promise<Map<string, CkRecord[]>> {
  const out = new Map<string, CkRecord[]>();
  for (const r of await ck.queryAll("Report")) {
    const id = requestOf(r);
    if (id !== undefined) out.set(id, [...(out.get(id) ?? []), r]);
  }
  return out;
}

export async function buildReports(ck: CloudKitClient | { missing: string }): Promise<ReportsResponse> {
  if ("missing" in ck) return { state: "unavailable", reason: ck.missing };
  const byRequest = await reportsByRequest(ck);
  const ids = [...byRequest.keys()];
  const requests: CkRecord[] = [];
  for (let i = 0; i < ids.length; i += 200) requests.push(...(await ck.lookup(ids.slice(i, i + 200))));
  const items = requests.map((r) => item(r, byRequest.get(r.recordName) ?? [])).sort((a, b) => b.last_reported - a.last_reported);
  return { state: "ready", environment: ck.environment, items };
}

export async function decideReport(ck: CloudKitClient, id: string, action: ReportAction, reviewDir: string, reviewer: string): Promise<ReportItem> {
  const reports = (await reportsByRequest(ck)).get(id) ?? [];
  const [request] = await ck.lookup([id]);
  if (request === undefined) throw new Error(`No request ${id} in CloudKit.`);
  if (action === "keep") {
    if (reports.length > 0) await ck.modify(reports.map((r) => ({ operationType: "forceDelete", record: { recordName: r.recordName } })));
    if (request.fields["hidden"]?.value === 1)
      await ck.modify([{ operationType: "forceUpdate", record: { recordName: id, recordType: "PrayerRequest", fields: { hidden: { value: 0 } } } }]);
  } else {
    await ck.modify([{ operationType: "forceUpdate", record: { recordName: id, recordType: "PrayerRequest", fields: { hidden: { value: 1 } } } }]);
  }
  mkdirSync(reviewDir, { recursive: true });
  appendFileSync(
    reportsLogPath(reviewDir),
    JSON.stringify({ at: new Date().toISOString(), reviewer, environment: ck.environment, request: id, action, reports: reports.length }) + "\n",
  );
  const kept = action === "keep";
  return { ...item(request, kept ? [] : reports), removed: !kept };
}
