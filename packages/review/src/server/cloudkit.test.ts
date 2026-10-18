import { createHash, generateKeyPairSync, verify } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CloudKitClient, cloudKitConfig, readEnvLocal, type Fetch } from "./cloudkit.js";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function keyFile(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ck-"));
  dirs.push(dir);
  const file = path.join(dir, "key.pem");
  writeFileSync(file, privateKey.export({ type: "sec1", format: "pem" }));
  return file;
}

describe("cloudKitConfig", () => {
  it("reads production by default, with the Production key id", () => {
    const c = cloudKitConfig({ CLOUDKIT_KEY_ID: "dev", CLOUDKIT_PRODUCTION_KEY_ID: "prod", CLOUDKIT_KEY_PATH: keyFile() });
    expect("missing" in c).toBe(false);
    if (!("missing" in c)) expect([c.environment, c.keyId, c.container]).toEqual(["production", "prod", "iCloud.studio.yada.reader"]);
  });
  it("says what is missing instead of failing", () => {
    expect(cloudKitConfig({ CLOUDKIT_KEY_ID: "dev", CLOUDKIT_KEY_PATH: keyFile() })).toEqual({ missing: expect.stringContaining("Production") });
    expect(cloudKitConfig({ YADA_REPORTS_ENVIRONMENT: "development", CLOUDKIT_KEY_ID: "dev", CLOUDKIT_KEY_PATH: "/nope" })).toEqual({ missing: expect.stringContaining("CLOUDKIT_KEY_PATH") });
  });
  it("takes only the CloudKit lines from .env.local", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "env-"));
    dirs.push(dir);
    writeFileSync(path.join(dir, ".env.local"), "ANTHROPIC_API_KEY=secret\nCLOUDKIT_KEY_ID=abc\nCLOUDKIT_CONTAINER=\"iCloud.x\"\n");
    expect(readEnvLocal(path.join(dir, ".env.local"))).toEqual({ CLOUDKIT_KEY_ID: "abc", CLOUDKIT_CONTAINER: "iCloud.x" });
  });
});

describe("CloudKitClient", () => {
  it("signs date:bodyhash:subpath with the key, as Apple's web services expect", async () => {
    const c = cloudKitConfig({ YADA_REPORTS_ENVIRONMENT: "development", CLOUDKIT_KEY_ID: "kid", CLOUDKIT_KEY_PATH: keyFile() });
    if ("missing" in c) throw new Error(c.missing);
    const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
    const fetchImpl: Fetch = async (url, init) => {
      calls.push({ url, headers: init.headers, body: init.body });
      return { ok: true, status: 200, json: async () => ({ records: [] }) };
    };
    await new CloudKitClient(c, fetchImpl, () => new Date("2026-10-18T09:00:00.123Z")).queryAll("Report");
    const [s] = calls;
    if (s === undefined) throw new Error("no request");
    const subpath = "/database/1/iCloud.studio.yada.reader/development/public/records/query";
    expect(s.url).toBe(`https://api.apple-cloudkit.com${subpath}`);
    expect(s.headers["X-Apple-CloudKit-Request-KeyID"]).toBe("kid");
    expect(s.headers["X-Apple-CloudKit-Request-ISO8601Date"]).toBe("2026-10-18T09:00:00Z");
    const message = `2026-10-18T09:00:00Z:${createHash("sha256").update(s.body).digest("base64")}:${subpath}`;
    expect(verify("sha256", Buffer.from(message), publicKey, Buffer.from(s.headers["X-Apple-CloudKit-Request-SignatureV1"] ?? "", "base64"))).toBe(true);
  });
  it("never puts the key in a request", async () => {
    const file = keyFile();
    const c = cloudKitConfig({ YADA_REPORTS_ENVIRONMENT: "development", CLOUDKIT_KEY_ID: "kid", CLOUDKIT_KEY_PATH: file });
    if ("missing" in c) throw new Error(c.missing);
    let sent = "";
    const fetchImpl: Fetch = async (_url, init) => {
      sent = JSON.stringify(init);
      return { ok: true, status: 200, json: async () => ({ records: [] }) };
    };
    await new CloudKitClient(c, fetchImpl).lookup(["x"]);
    const pem = readFileSync(file, "utf8").split("\n")[1] ?? "";
    expect(sent.includes(pem)).toBe(false);
  });
  it("throws on a refused record so a decision is never logged as done", async () => {
    const c = cloudKitConfig({ YADA_REPORTS_ENVIRONMENT: "development", CLOUDKIT_KEY_ID: "kid", CLOUDKIT_KEY_PATH: keyFile() });
    if ("missing" in c) throw new Error(c.missing);
    const fetchImpl: Fetch = async () => ({ ok: true, status: 200, json: async () => ({ records: [{ recordName: "r1", serverErrorCode: "ACCESS_DENIED" }] }) });
    await expect(new CloudKitClient(c, fetchImpl).modify([])).rejects.toThrow("ACCESS_DENIED");
  });
});
