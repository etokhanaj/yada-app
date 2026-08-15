/**
 * Source manifest. PRD §11.2.
 *
 * Every Yada entry is traceable to an exact source snapshot: dataset, version,
 * commit, license, attribution. Source updates are deliberate migrations, never
 * silent drift, which is why version and commit_hash are required fields rather
 * than nice-to-haves.
 */

import { z } from "zod";

export const LicenseSchema = z.enum([
  "PUBLIC_DOMAIN",
  "CC0-1.0",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "OFL-1.1",
  "CC-BY-NC-ND-4.0",
]);
export type License = z.infer<typeof LicenseSchema>;

/**
 * Licenses excluded from commercial builds (PRD §11.1: BY-NC-ND excluded).
 * Enforced at ingest, not later.
 */
const NON_COMMERCIAL_LICENSES: ReadonlySet<License> = new Set<License>(["CC-BY-NC-ND-4.0"]);

export function isCommercialSafe(license: License): boolean {
  return !NON_COMMERCIAL_LICENSES.has(license);
}

export const SourceManifestEntrySchema = z.object({
  /** Upstream owner, e.g. "SBL" or "OpenScriptures". */
  source: z.string().min(1),
  /** The specific dataset, e.g. "SBLGNT" or "morphhb". */
  dataset: z.string().min(1),
  version: z.string().min(1),
  commit_hash: z.string().min(1),
  license: LicenseSchema,
  attribution_text: z.string().min(1),
  url: z.string().url(),
  retrieved_at: z.string().datetime({ offset: true }),
  /** What the pipeline changed on ingest. "none" when untouched. */
  modifications: z.string().min(1),
});
export type SourceManifestEntry = z.infer<typeof SourceManifestEntrySchema>;

export const SourceManifestSchema = z.array(SourceManifestEntrySchema);
export type SourceManifest = z.infer<typeof SourceManifestSchema>;

/** Datasets that must not reach a commercial build. */
export function nonCommercialEntries(manifest: SourceManifest): SourceManifestEntry[] {
  return manifest.filter((entry) => !isCommercialSafe(entry.license));
}
