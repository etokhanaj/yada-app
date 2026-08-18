/** Repo-relative paths. Everything under content/ is gitignored working data. */

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** packages/pipeline/src -> repo root */
export const REPO_ROOT = path.resolve(here, "../../..");

export const CONTENT = path.join(REPO_ROOT, "content");
export const RAW = path.join(CONTENT, "raw");
export const REQUESTS = path.join(CONTENT, "requests");
export const RESPONSES = path.join(CONTENT, "responses");
export const STAGING_DB = path.join(CONTENT, "staging.db");
export const GOLDEN = path.join(REPO_ROOT, "golden");
export const DOCS = path.join(REPO_ROOT, "docs");
export const MANIFEST = path.join(REPO_ROOT, "sources.manifest.json");
export const PROMPTS = path.join(REPO_ROOT, "packages/pipeline/prompts");
export const PIPELINE_DATA = path.join(REPO_ROOT, "packages/pipeline/data");

export function ensureDirs(): void {
  for (const dir of [CONTENT, RAW, REQUESTS, RESPONSES]) mkdirSync(dir, { recursive: true });
}
