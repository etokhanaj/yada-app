import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BUNDLE_FORMAT, SCHEMA_VERSION, type BundleInfo } from "@yada/schema";

import { PublishRefused, planPublish, publish, type ObjectStore } from "./publish.js";
import { gzipTranslation } from "./translations.js";

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

function manifest(bundles: BundleInfo[], translations?: unknown[]): void {
  writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify({ format: BUNDLE_FORMAT, generated_at: "2026-09-13T00:00:00Z", min_app_version: "1.0.0", schema_versions: [SCHEMA_VERSION], bundles, translations }),
  );
}

/** `existing` maps a key to its recorded sha256, or to that and the encoding it is served with. */
function fakeStore(existing: Record<string, string | { sha256: string; encoding?: string }> = {}) {
  const sent: Array<{ type: "head" | "put"; key: string }> = [];
  const puts: PutObjectCommand["input"][] = [];
  const client = {
    send: async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        const key = command.input.Key as string;
        sent.push({ type: "head", key });
        const object = existing[key];
        if (object === undefined) throw Object.assign(new Error("not found"), { name: "NotFound" });
        return typeof object === "string"
          ? { Metadata: { sha256: object } }
          : { Metadata: { sha256: object.sha256 }, ContentEncoding: object.encoding };
      }
      if (command instanceof PutObjectCommand) {
        sent.push({ type: "put", key: command.input.Key as string });
        puts.push(command.input);
        return {};
      }
      throw new Error("unexpected command");
    },
  } as unknown as ObjectStore;
  return { client, sent, puts };
}

/** A translation entry as `yada package translation` writes it, over a file of `content`. */
function translation(content: string | Buffer, overrides: Record<string, unknown> = {}) {
  writeFileSync(path.join(dir, "translation-ylt.v1.db"), content);
  return {
    code: "YLT",
    name: "Young's Literal Translation",
    year: 1898,
    version: 1,
    file: "translation-ylt.v1.db",
    sha256: createHash("sha256").update(content).digest("hex"),
    bytes: Buffer.byteLength(content),
    download_bytes: gzipTranslation(Buffer.from(content)).length,
    format: BUNDLE_FORMAT,
    license: "PUBLIC_DOMAIN",
    attribution: "Young's Literal Translation, by Robert Young. Public domain.",
    cover: "paper",
    verses: 31102,
    missing: [],
    ...overrides,
  };
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

  it("uploads and verifies downloadable translations before the manifest", async () => {
    const ylt = translation("ylt bytes");
    manifest([bundle("core", "core bytes")], [ylt]);
    const { client, sent } = fakeStore();
    await publish({ confirm: true, dir, client, env: ENV });
    expect(sent.filter((s) => s.type === "put").map((s) => s.key)).toEqual([
      "core.v1.db",
      "translation-ylt.v1.db",
      "manifest.json",
    ]);

    manifest([bundle("core", "core bytes")], [{ ...ylt, bytes: 1 }]);
    expect(() => planPublish(dir)).toThrow(/translation-ylt\.v1\.db is 9 bytes/);
  });

  it("uploads translations gzipped, keeping the decompressed file's digest, and bundles as they are", async () => {
    const content = Buffer.from("In the beginning was the Word. ".repeat(500));
    const ylt = translation(content);
    manifest([bundle("core", "core bytes")], [ylt]);
    const { client, puts } = fakeStore();
    await publish({ confirm: true, dir, client, env: ENV });

    const core = puts.find((p) => p.Key === "core.v1.db");
    expect(core?.ContentEncoding).toBeUndefined();
    expect(Buffer.from(core?.Body as Uint8Array).toString()).toBe("core bytes");

    const put = puts.find((p) => p.Key === "translation-ylt.v1.db");
    expect(put).toMatchObject({ ContentEncoding: "gzip", ContentType: "application/vnd.sqlite3", Metadata: { sha256: ylt.sha256 } });
    const body = put?.Body as Uint8Array;
    expect(body.length).toBe(ylt.download_bytes);
    expect(body.length).toBeLessThan(content.length);
    expect(gunzipSync(body).equals(content)).toBe(true);
  });

  it("uploads a book's study bundle gzipped, before the manifest, checked like a translation", async () => {
    const content = Buffer.from("1:1 Echoing Gen 1:1, John's Gospel introduces Jesus Christ. ".repeat(200));
    writeFileSync(path.join(dir, "study-jhn.v1.db"), content);
    const study = {
      book: "JHN",
      version: 1,
      file: "study-jhn.v1.db",
      sha256: createHash("sha256").update(content).digest("hex"),
      bytes: content.length,
      download_bytes: gzipTranslation(content).length,
      format: 1,
      licenses: ["CC-BY-SA-4.0", "CC-BY-4.0"],
      notes: 1,
      xrefs: 0,
    };
    const write = (entry: Record<string, unknown>) =>
      writeFileSync(
        path.join(dir, "manifest.json"),
        JSON.stringify({ format: BUNDLE_FORMAT, generated_at: "2026-10-11T00:00:00Z", min_app_version: "1.0.0", schema_versions: [SCHEMA_VERSION], bundles: [bundle("core", "core bytes")], study: [entry] }),
      );
    write(study);
    const { client, sent, puts } = fakeStore();
    await publish({ confirm: true, dir, client, env: ENV });
    expect(sent.filter((s) => s.type === "put").map((s) => s.key)).toEqual(["core.v1.db", "study-jhn.v1.db", "manifest.json"]);
    const put = puts.find((p) => p.Key === "study-jhn.v1.db");
    expect(put).toMatchObject({ ContentEncoding: "gzip", Metadata: { sha256: study.sha256 } });
    expect(gunzipSync(put?.Body as Uint8Array).equals(content)).toBe(true);

    write({ ...study, download_bytes: 1 });
    expect(() => planPublish(dir)).toThrow(/study-jhn\.v1\.db gzips to \d+ bytes, manifest says 1/);
    write({ ...study, file: "../study-jhn.v1.db" });
    expect(() => planPublish(dir)).toThrow(/does not match the bundle manifest schema/);
  });

  it("refuses the entire publish when a translation's gzipped size is not the manifest's", async () => {
    manifest([bundle("core", "core bytes")], [translation("ylt bytes", { download_bytes: 1 })]);
    const { client, sent } = fakeStore();
    await expect(publish({ confirm: true, dir, client, env: ENV })).rejects.toThrow(/translation-ylt\.v1\.db gzips to \d+ bytes, manifest says 1/);
    expect(sent).toEqual([]);
  });

  it("still publishes a translation entry written before download_bytes existed", async () => {
    const { download_bytes: _absent, ...ylt } = translation("ylt bytes");
    manifest([bundle("core", "core bytes")], [ylt]);
    const { client, puts } = fakeStore();
    await publish({ confirm: true, dir, client, env: ENV });
    expect(puts.find((p) => p.Key === "translation-ylt.v1.db")?.ContentEncoding).toBe("gzip");
  });

  it("skips a translation already in the bucket gzipped, and refuses one uploaded whole", async () => {
    const ylt = translation("ylt bytes");
    manifest([bundle("core", "core bytes")], [ylt]);
    const gzipped = fakeStore({ "translation-ylt.v1.db": { sha256: ylt.sha256, encoding: "gzip" } });
    expect((await publish({ confirm: true, dir, client: gzipped.client, env: ENV })).unchanged).toEqual(["translation-ylt.v1.db"]);

    const whole = fakeStore({ "translation-ylt.v1.db": ylt.sha256 });
    await expect(publish({ confirm: true, dir, client: whole.client, env: ENV })).rejects.toThrow(/uncompressed/);
    expect(whole.sent.filter((s) => s.type === "put")).toEqual([]);
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
