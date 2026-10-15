/**
 * sources.manifest.json against the sources the pipeline reads (audit items 7 and 11, 12 Oct 2026): every
 * source has its entry, each entry says what is actually read, and core's credits leave out the spike's
 * excerpt. The pins are checked against the files where content/raw is present.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { SourceManifestSchema } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { NOT_IN_CORE } from "./package.js";
import { MANIFEST } from "./paths.js";
import { SOURCES } from "./sources.js";

const manifest = SourceManifestSchema.parse(JSON.parse(readFileSync(MANIFEST, "utf8")));
const entry = (prefix: string) => manifest.find((e) => e.dataset.startsWith(prefix));

describe("sources.manifest.json", () => {
  it("has an entry for MACULA and Glyssen, as their source definitions write it", () => {
    for (const key of ["macula-greek", "macula-hebrew", "glyssen"]) {
      const def = SOURCES.find((s) => s.key === key);
      const e = manifest.find((x) => x.dataset === def?.dataset);
      expect(e?.license, key).toBe(def?.license);
      expect(e?.commit_hash, key).toBe(def?.commit);
      expect(e?.attribution_text, key).toBe(def?.attribution_text);
    }
  });

  it("has the unfoldingWord sources, the Berean tables and the four commentaries behind the debate positions", () => {
    for (const name of ["Simplified Text", "Translation Notes", "Translation Questions", "Translation Words (", "Translation Word Links", "Open Bible Stories"]) {
      const e = manifest.find((x) => x.dataset.includes(name));
      expect(e?.license, name).toBe("CC-BY-SA-4.0");
      expect(e?.attribution_text, name).toContain("The original work by unfoldingWord is available from");
    }
    expect(entry("Berean Standard Bible translation tables")?.license).toBe("PUBLIC_DOMAIN");
    for (const name of ["Keil and Delitzsch", "Ellicott", "Driver and Neubauer", "Adam Clarke"]) expect(entry(name)?.license, name).toBe("PUBLIC_DOMAIN");
    expect(entry("Adam Clarke")?.modifications).toContain("DistributionLicense=Public Domain");
  });

  it("has Matthew Henry's Concise Commentary and Easton's dictionary, licences as their module .conf files state them", () => {
    for (const name of ["Matthew Henry's Concise", "Easton's Bible Dictionary"]) {
      expect(entry(name)?.license, name).toBe("PUBLIC_DOMAIN");
      expect(entry(name)?.modifications, name).toContain("DistributionLicense=Public Domain");
      expect(entry(name)?.modifications, name).toContain("Copyright Christian Classics Ethereal Library");
    }
  });

  it("says TBESG's Gloss column is read, as glosses.ts reads it", () => {
    const def = SOURCES.find((s) => s.key === "tbesg");
    expect(def?.modifications).toContain("Gloss column (column 6");
    expect(entry("TBESG")?.modifications).toBe(def?.modifications);
  });

  it("leaves the spike's bible-api excerpt out of core's credits", () => {
    expect(NOT_IN_CORE.has("World English Bible — John 1, Genesis 1, 1 Corinthians 14")).toBe(true);
  });
});

const RAW = path.join(process.env["YADA_ROOT"] ?? path.join(MANIFEST, ".."), "content/raw");

describe.skipIf(!existsSync(path.join(RAW, "sources-12oct.sha256")))("the manifest's pins against content/raw", () => {
  const sha = (file: string): string => createHash("sha256").update(readFileSync(file)).digest("hex");

  it("pins each unfoldingWord zip and the Berean tables at the digest in sources-12oct.sha256", () => {
    for (const line of readFileSync(path.join(RAW, "sources-12oct.sha256"), "utf8").split("\n").filter((l) => l.trim() !== "")) {
      const [digest, file] = line.split(/\s+/);
      expect(manifest.some((e) => e.commit_hash === `sha256:${digest}`), file).toBe(true);
    }
  });

  it("pins each commentary by its sha256.txt", () => {
    for (const dir of ["keil-delitzsch", "ellicott", "driver-neubauer", "clarke"]) {
      expect(manifest.some((e) => e.commit_hash === `sha256:${sha(path.join(RAW, dir, "sha256.txt"))}`), dir).toBe(true);
    }
  });

  it("pins Matthew Henry and Easton by their .sha256 files", () => {
    for (const file of ["matthew-henry.sha256", "easton.sha256"].filter((f) => existsSync(path.join(RAW, f)))) {
      expect(manifest.some((e) => e.commit_hash === `sha256:${sha(path.join(RAW, file))}`), file).toBe(true);
    }
  });
});
