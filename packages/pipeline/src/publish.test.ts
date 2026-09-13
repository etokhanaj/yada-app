import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BUNDLE_FORMAT, SCHEMA_VERSION, type BundleInfo } from "@yada/schema";

import { PublishRefused, planPublish, publish, type ObjectStore } from "./publish.js";

/**
 * No R2 call is made here and no credential exists: the fake client records
 * every command so the ordering — bundles first, manifest last — is asserted
 * rather than assumed, and the refusals are asserted to have sent nothing.
 */

let dir: string;

const ENV = {
  R2_ACCOUNT_ID: "test-account",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-do-not-log",
  R2_BUCKET: "test-bucket",
};

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "yada-publish-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function bundle(name: string, content: string, overrides: Partial<BundleInfo> = {}): BundleInfo {
  const file = `${name}.v1.db`;
  writeFileSync(path.join(dir, file), content);
  return {
    name,
    kind: name === "core" ? "core" : "understand",
    version: 1,
    file,
    sha256: createHash("sha256").update(content).digest("hex"),
    bytes: Buffer.byteLength(content),
    format: BUNDLE_FORMAT,
    schema_version: SCHEMA_VERSION,
    review_gate: "reviewed",
    entries: 0,
    ...overrides,
  };
}

function manifest(bundles: BundleInfo[]): void {
  writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify({ format: BUNDLE_FORMAT, generated_at: "2026-09-13T00:00:00Z", min_app_version: "1.0.0", schema_versions: [SCHEMA_VERSION], bundles }),
  );
}

function fakeStore(existing: Record<string, string> = {}) {
  const sent: Array<{ type: "head" | "put"; key: string }> = [];
  const client = {
    send: async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        const key = command.input.Key as string;
        sent.push({ type: "head", key });
        if (existing[key] === undefined) throw Object.assign(new Error("not found"), { name: "NotFound" });
        return { Metadata: { sha256: existing[key] } };
      }
      if (command instanceof PutObjectCommand) {
        sent.push({ type: "put", key: command.input.Key as string });
        return {};
      }
      throw new Error("unexpected command");
    },
  } as unknown as ObjectStore;
  return { client, sent };
}

describe("publish", () => {
  it("uploads every bundle before the manifest, and the manifest last", async () => {
    manifest([bundle("core", "core bytes"), bundle("jhn", "john bytes")]);
    const { client, sent } = fakeStore();
    const report = await publish({ confirm: true, dir, client, env: ENV });
    const puts = sent.filter((s) => s.type === "put").map((s) => s.key);
    expect(puts).toEqual(["core.v1.db", "jhn.v1.db", "manifest.json"]);
    // Every existence check happens before the first upload.
    expect(sent.findIndex((s) => s.type === "put")).toBe(sent.filter((s) => s.type === "head").length);
    expect(report.uploaded.at(-1)).toBe("manifest.json");
  });

  it("uploads nothing on --dry-run and needs no credentials", async () => {
    manifest([bundle("core", "core bytes")]);
    const { client, sent } = fakeStore();
    const report = await publish({ confirm: false, dir, client, env: {} });
    expect(report.dryRun).toBe(true);
    expect(sent).toEqual([]);
  });

  it("refuses the entire publish if any bundle is unreviewed-dev", async () => {
    manifest([bundle("core", "core bytes"), bundle("jhn", "john bytes", { review_gate: "unreviewed-dev" })]);
    const { client, sent } = fakeStore();
    await expect(publish({ confirm: true, dir, client, env: ENV })).rejects.toThrow(/entire publish.*jhn\.v1\.db.*unreviewed-dev/s);
    expect(sent).toEqual([]);
  });

  it("refuses the entire publish on a sha256 mismatch", async () => {
    const good = bundle("core", "core bytes");
    const bad = bundle("jhn", "john bytes");
    writeFileSync(path.join(dir, bad.file), "john bytes, rebuilt");
    manifest([good, bad]);
    const { client, sent } = fakeStore();
    await expect(publish({ confirm: true, dir, client, env: ENV })).rejects.toThrow(/jhn\.v1\.db sha256/);
    expect(sent).toEqual([]);
  });

  it("refuses without credentials, naming the variables and never echoing a value", async () => {
    manifest([bundle("core", "core bytes")]);
    const { client, sent } = fakeStore();
    const error = await publish({
      confirm: true, dir, client,
      env: { R2_ACCOUNT_ID: ENV.R2_ACCOUNT_ID, R2_SECRET_ACCESS_KEY: ENV.R2_SECRET_ACCESS_KEY },
    }).then(
      () => new Error("publish did not refuse"),
      (e: unknown) => e as Error,
    );
    expect(error).toBeInstanceOf(PublishRefused);
    expect(error.message).toMatch(/R2_ACCESS_KEY_ID, R2_BUCKET/);
    expect(error.message).not.toContain(ENV.R2_SECRET_ACCESS_KEY);
    expect(error.message).not.toContain(ENV.R2_ACCOUNT_ID);
    expect(sent).toEqual([]);
  });

  it("refuses to overwrite an immutable bundle name holding different content", async () => {
    manifest([bundle("core", "core bytes"), bundle("jhn", "john bytes")]);
    const { client, sent } = fakeStore({ "jhn.v1.db": "0".repeat(64) });
    await expect(publish({ confirm: true, dir, client, env: ENV })).rejects.toThrow(/immutable/);
    expect(sent.filter((s) => s.type === "put")).toEqual([]);
  });

  it("skips a bundle already published with the same hash, and still writes the manifest", async () => {
    const core = bundle("core", "core bytes");
    manifest([core, bundle("jhn", "john bytes")]);
    const { client, sent } = fakeStore({ "core.v1.db": core.sha256 });
    const report = await publish({ confirm: true, dir, client, env: ENV });
    expect(report.unchanged).toEqual(["core.v1.db"]);
    expect(sent.filter((s) => s.type === "put").map((s) => s.key)).toEqual(["jhn.v1.db", "manifest.json"]);
  });

  it("refuses a missing or empty manifest", () => {
    expect(() => planPublish(dir)).toThrow(/no manifest\.json/);
    manifest([]);
    expect(() => planPublish(dir)).toThrow(/lists no bundles/);
  });

  it("publishes only what the manifest names, and reports the rest as ignored", () => {
    manifest([bundle("core", "core bytes")]);
    writeFileSync(path.join(dir, "jhn.building.db"), "temp");
    expect(planPublish(dir).ignored).toEqual(["jhn.building.db"]);
  });
});
