import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  isCommercialSafe,
  LicenseSchema,
  nonCommercialEntries,
  SourceManifestEntrySchema,
  SourceManifestSchema,
  type SourceManifestEntry,
} from "./manifest.js";

const sblgnt: SourceManifestEntry = {
  source: "SBL",
  dataset: "SBLGNT",
  version: "2020-05-01",
  commit_hash: "0000000000000000000000000000000000000000",
  license: "CC-BY-4.0",
  attribution_text: "SBL Greek New Testament, © Society of Biblical Literature, CC BY 4.0.",
  url: "https://github.com/LogosBible/SBLGNT",
  retrieved_at: "2026-08-16T09:00:00Z",
  modifications: "none",
};

describe("isCommercialSafe", () => {
  it("excludes BY-NC-ND and bespoke terms, allows the rest", () => {
    const blocked = ["CC-BY-NC-ND-4.0", "CUSTOM_EULA"];
    for (const license of LicenseSchema.options) {
      expect(isCommercialSafe(license), license).toBe(!blocked.includes(license));
    }
  });
});

describe("the repo's own source manifest", () => {
  const manifest = SourceManifestSchema.parse(
    JSON.parse(
      readFileSync(new URL("../../../sources.manifest.json", import.meta.url), "utf8"),
    ) as unknown,
  );

  it("parses, and every dataset is pinned and attributed", () => {
    expect(manifest.length).toBeGreaterThan(0);
    for (const entry of manifest) {
      expect(entry.commit_hash.length, entry.dataset).toBeGreaterThan(0);
      expect(entry.attribution_text.length, entry.dataset).toBeGreaterThan(0);
    }
  });

  it("keeps the SBLGNT text and its annotations as separate entries with their own licences", () => {
    // The text moved from a bespoke EULA to CC BY 4.0 (read from sblgnt.com/license, 10 Oct 2026);
    // the MorphGNT annotations stay CC BY-SA 3.0. Two entries, so neither verdict hides the other.
    const byName = new Map(manifest.map((e) => [e.dataset, e.license]));
    expect(byName.get("SBLGNT (Greek text)")).toBe("CC-BY-4.0");
    expect(byName.get("morphgnt/sblgnt (morphological annotations)")).toBe("CC-BY-SA-3.0");
    expect(nonCommercialEntries(manifest)).toEqual([]);
  });
});

describe("SourceManifestEntrySchema", () => {
  it("accepts a fully pinned source", () => {
    const result = SourceManifestEntrySchema.safeParse(sblgnt);
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });

  it("requires a version and a commit hash", () => {
    expect(SourceManifestEntrySchema.safeParse({ ...sblgnt, version: "" }).success).toBe(false);
    expect(SourceManifestEntrySchema.safeParse({ ...sblgnt, commit_hash: "" }).success).toBe(false);
  });

  it("rejects an unknown license", () => {
    expect(SourceManifestEntrySchema.safeParse({ ...sblgnt, license: "MIT" }).success).toBe(false);
  });

  it("reports which datasets must not reach a commercial build", () => {
    const manifest = SourceManifestSchema.parse([
      sblgnt,
      { ...sblgnt, dataset: "some-nc-lexicon", license: "CC-BY-NC-ND-4.0" },
    ]);
    expect(nonCommercialEntries(manifest).map((e) => e.dataset)).toEqual(["some-nc-lexicon"]);
  });
});
