import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { BUNDLE_FORMAT, SCHEMA_VERSION } from "@yada/schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { sha256File } from "../package.js";
import { PublishRefused, planPublish } from "../publish.js";
import { gzipTranslation } from "../translations.js";
import { stopped, understandManifestEntries } from "./package.js";

/**
 * The 66-book run (12 Oct 2026): a book over the 15% flag stop still writes its file for the report,
 * so the manifest and publish must each leave it out, on the file's own word.
 */

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "yada-understand-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function bundle(book: string, version: number, meta: Record<string, string>): string {
  const file = path.join(dir, `understand-${book.toLowerCase()}.v${version}.db`);
  const db = new DatabaseSync(file);
  db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE verses (ord INTEGER); CREATE TABLE passages (passage_id TEXT);");
  for (const [k, v] of Object.entries({ format: "1", book, ...meta })) db.prepare("INSERT INTO meta VALUES (?, ?)").run(k, v);
  db.exec("INSERT INTO verses VALUES (1), (2); INSERT INTO passages VALUES ('a');");
  db.close();
  return file;
}

describe("the 15% stop, read from the file", () => {
  it("passes at or under 15% and stops above it, from the counts", () => {
    const db = (meta: Record<string, string>) => new DatabaseSync(bundle("JHN", Math.floor(Math.random() * 1e6) + 1, meta), { readOnly: true });
    expect(stopped(db({ summaries: "20", flagged: "3" }))).toBe(false);
    expect(stopped(db({ summaries: "20", flagged: "4" }))).toBe(true);
  });

  it("trusts the counts over a rounded share that hides 0.1504", () => {
    const db = new DatabaseSync(bundle("JHN", 1, { flagged_share: "0.150", summaries: "1330", flagged: "200" }), { readOnly: true });
    expect(stopped(db)).toBe(true);
  });

  it("counts a file that does not say as stopped", () => {
    expect(stopped(new DatabaseSync(bundle("JHN", 1, {}), { readOnly: true }))).toBe(true);
  });
});

describe("yada manifest's understand list", () => {
  it("lists each book's newest file, leaves stopped books out, and names them", () => {
    bundle("JHN", 1, { summaries: "46", flagged: "0" });
    bundle("JHN", 2, { summaries: "46", flagged: "0" });
    bundle("JOL", 1, { summaries: "9", flagged: "9" });
    const skipped: string[] = [];
    const entries = understandManifestEntries(dir, skipped);
    expect(entries.map((e) => e.file)).toEqual(["understand-jhn.v2.db"]);
    expect(entries[0]).toMatchObject({ book: "JHN", version: 2, verses: 2, passages: 1, format: 1 });
    expect(skipped).toEqual(["JOL"]);
  });
});

describe("publish", () => {
  function manifest(understand: unknown[]): void {
    const core = path.join(dir, "core.v1.db");
    writeFileSync(core, "core");
    writeFileSync(
      path.join(dir, "manifest.json"),
      JSON.stringify({
        format: BUNDLE_FORMAT,
        generated_at: "2026-10-12T00:00:00Z",
        min_app_version: "1.0.0",
        schema_versions: [SCHEMA_VERSION],
        bundles: [{ name: "core", kind: "core", version: 1, file: "core.v1.db", sha256: sha256File(core), bytes: 4, format: BUNDLE_FORMAT, schema_version: SCHEMA_VERSION, review_gate: "reviewed", entries: 0 }],
        understand,
      }),
    );
  }
  const entry = (file: string, book: string) => ({
    book,
    version: 1,
    file: path.basename(file),
    sha256: sha256File(file),
    bytes: readFileSync(file).length,
    download_bytes: gzipTranslation(readFileSync(file)).length,
    format: 1,
    verses: 2,
    passages: 1,
  });

  it("uploads a passing book's file gzipped", () => {
    const file = bundle("JHN", 1, { summaries: "46", flagged: "0" });
    manifest([entry(file, "JHN")]);
    const plan = planPublish(dir);
    expect(plan.bundles.find((b) => b.info.file === "understand-jhn.v1.db")?.gzip).toBe(true);
  });

  it("refuses a stopped book even when the manifest lists it", () => {
    const file = bundle("JOL", 1, { summaries: "9", flagged: "9" });
    manifest([entry(file, "JOL")]);
    expect(() => planPublish(dir)).toThrow(PublishRefused);
    expect(() => planPublish(dir)).toThrow(/over the 15% flag stop/);
  });
});
