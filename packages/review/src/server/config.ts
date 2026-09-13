/** Paths and settings, each overridable from the environment. */

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** packages/review/src/server -> packages/review */
export const PACKAGE_ROOT = path.resolve(here, "../..");
/** packages/review -> repo root */
export const REPO_ROOT = path.resolve(PACKAGE_ROOT, "../..");

export const CLIENT_DIST = path.join(PACKAGE_ROOT, "dist", "client");

/** Loopback only. The review tool is never reachable from another machine. */
export const HOST = "127.0.0.1";
export const DEFAULT_PORT = 4317;

/**
 * 7% of each book, at least one entry. Inside the build plan's 5-10% band for
 * any book with ten or more entries; a book with fewer still gets one.
 */
export const SAMPLE_RATE = 0.07;

/**
 * The per-book sample is a pure function of this seed and the verse ids, so the
 * same entries come back on every load. Changing it draws a new sample; the seed
 * in force is written into every decision taken from that queue.
 */
export const DEFAULT_SAMPLE_SEED = "yada-review-sample-1";

type Env = Record<string, string | undefined>;

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

export function stagingDbPath(env: Env = process.env): string {
  const override = nonEmpty(env["YADA_STAGING_DB"]);
  return override === undefined ? path.join(REPO_ROOT, "content", "staging.db") : path.resolve(override);
}

/** Where decisions.jsonl and review_state.jsonl live: `<repo>/review`, committed. */
export function reviewDir(env: Env = process.env): string {
  const override = nonEmpty(env["YADA_REVIEW_DIR"]);
  return override === undefined ? path.join(REPO_ROOT, "review") : path.resolve(override);
}

export function sampleSeed(env: Env = process.env): string {
  return nonEmpty(env["YADA_SAMPLE_SEED"]) ?? DEFAULT_SAMPLE_SEED;
}

export function reviewerName(env: Env = process.env): string {
  return nonEmpty(env["YADA_REVIEWER"]) ?? "john";
}

export function reviewPort(env: Env = process.env): number {
  const raw = nonEmpty(env["YADA_REVIEW_PORT"]);
  if (raw === undefined) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`YADA_REVIEW_PORT must be a port number, got "${raw}"`);
  }
  return port;
}
