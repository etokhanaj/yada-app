/**
 * CloudKit Web Services for the Reports queue (Build 11a, docs/build-11a-plan.md): the public database of
 * iCloud.studio.yada.reader, signed with the server-to-server key John made on 17 Oct 2026. The key is read from
 * .env.local into this process only and is never logged, returned or sent to the client (CLAUDE.md rule 1).
 * Signing follows Apple's "Composing Web Service Requests": ECDSA P-256 over
 * `<ISO8601 date>:<base64 SHA-256 of the body>:<subpath>`, sent with the key id and date headers.
 */

import { createHash, createPrivateKey, sign, type KeyObject } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

type Env = Record<string, string | undefined>;

export interface CloudKitConfig {
  keyId: string;
  key: KeyObject;
  container: string;
  /** TestFlight and the App Store write to production; the queue reads production unless told otherwise. */
  environment: "production" | "development";
}

/** Only these lines are read from .env.local, so no other key enters the review server's environment. */
const KEYS = ["CLOUDKIT_KEY_ID", "CLOUDKIT_PRODUCTION_KEY_ID", "CLOUDKIT_KEY_PATH", "CLOUDKIT_CONTAINER", "YADA_REPORTS_ENVIRONMENT"] as const;

export function readEnvLocal(file: string): Env {
  if (!existsSync(file)) return {};
  const out: Env = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const name = line.slice(0, eq).trim();
    if ((KEYS as readonly string[]).includes(name)) out[name] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/**
 * Why the queue can't reach CloudKit, or the config. A server-to-server key belongs to one environment: the key John
 * made on 17 Oct 2026 is Development's (CLOUDKIT_KEY_ID); Production needs its own (CLOUDKIT_PRODUCTION_KEY_ID),
 * registered with the same public key.
 */
export function cloudKitConfig(env: Env): CloudKitConfig | { missing: string } {
  const environment = env["YADA_REPORTS_ENVIRONMENT"] === "development" ? "development" : "production";
  const keyId = environment === "production" ? env["CLOUDKIT_PRODUCTION_KEY_ID"] : env["CLOUDKIT_KEY_ID"];
  if (keyId === undefined || keyId === "")
    return { missing: environment === "production" ? "No Production server-to-server key yet (CLOUDKIT_PRODUCTION_KEY_ID in .env.local)." : "No CLOUDKIT_KEY_ID in .env.local." };
  const keyPath = env["CLOUDKIT_KEY_PATH"];
  const file = keyPath === undefined || keyPath === "" ? "" : keyPath.startsWith("~") ? path.join(os.homedir(), keyPath.slice(1)) : keyPath;
  if (file === "" || !existsSync(file)) return { missing: "CLOUDKIT_KEY_PATH in .env.local doesn't point at a key file." };
  return { keyId, key: createPrivateKey(readFileSync(file, "utf8")), container: env["CLOUDKIT_CONTAINER"] || "iCloud.studio.yada.reader", environment };
}

export interface CkRecord {
  recordName: string;
  recordType: string;
  recordChangeTag?: string;
  created?: { timestamp: number };
  fields: Record<string, { value: unknown; type?: string }>;
}

export interface CkError {
  recordName?: string;
  serverErrorCode: string;
  reason?: string;
}

export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export class CloudKitClient {
  constructor(
    private readonly config: CloudKitConfig,
    private readonly fetchImpl: Fetch = fetch as unknown as Fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get environment(): string {
    return this.config.environment;
  }

  private async post(op: string, payload: unknown): Promise<Record<string, unknown>> {
    const subpath = `/database/1/${this.config.container}/${this.config.environment}/public/${op}`;
    const body = JSON.stringify(payload);
    const date = this.now().toISOString().replace(/\.\d{3}Z$/, "Z");
    const bodyHash = createHash("sha256").update(body).digest("base64");
    const signature = sign("sha256", Buffer.from(`${date}:${bodyHash}:${subpath}`), this.config.key).toString("base64");
    const res = await this.fetchImpl(`https://api.apple-cloudkit.com${subpath}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Apple-CloudKit-Request-KeyID": this.config.keyId,
        "X-Apple-CloudKit-Request-ISO8601Date": date,
        "X-Apple-CloudKit-Request-SignatureV1": signature,
      },
      body,
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error(`CloudKit ${op}: ${String(json["serverErrorCode"] ?? res.status)} ${String(json["reason"] ?? "")}`.trim());
    return json;
  }

  /** Every record of a type matching the filters, following continuation markers. */
  async queryAll(recordType: string, filterBy: unknown[] = [], sortBy: unknown[] = []): Promise<CkRecord[]> {
    const out: CkRecord[] = [];
    let marker: string | undefined;
    do {
      const json = await this.post("records/query", {
        query: { recordType, filterBy, sortBy },
        resultsLimit: 200,
        ...(marker === undefined ? {} : { continuationMarker: marker }),
      });
      out.push(...((json["records"] as CkRecord[] | undefined) ?? []));
      marker = json["continuationMarker"] as string | undefined;
    } while (marker !== undefined);
    return out;
  }

  async lookup(recordNames: string[]): Promise<CkRecord[]> {
    if (recordNames.length === 0) return [];
    const json = await this.post("records/lookup", { records: recordNames.map((recordName) => ({ recordName })) });
    return ((json["records"] as (CkRecord | CkError)[] | undefined) ?? []).filter((r): r is CkRecord => "recordType" in r);
  }

  /** Applies the operations; throws with the first record's error, so a decision is never logged as done when it wasn't. */
  async modify(operations: unknown[]): Promise<CkRecord[]> {
    const json = await this.post("records/modify", { operations, atomic: false });
    const records = (json["records"] as (CkRecord | CkError)[] | undefined) ?? [];
    const failed = records.find((r): r is CkError => "serverErrorCode" in r);
    if (failed !== undefined) throw new Error(`CloudKit refused ${failed.recordName ?? "a record"}: ${failed.serverErrorCode} ${failed.reason ?? ""}`.trim());
    return records as CkRecord[];
  }
}
