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
  it("excludes BY-NC-ND and allows everything else in the union", () => {
    expect(isCommercialSafe("CC-BY-NC-ND-4.0")).toBe(false);
    for (const license of LicenseSchema.options) {
      if (license === "CC-BY-NC-ND-4.0") continue;
      expect(isCommercialSafe(license), license).toBe(true);
    }
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
