/** Paths and settings, each overridable from the environment. */

import { existsSync, readdirSync } from "node:fs";
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

/** The debate positions John approves one by one (the "Debate positions" queue). */
export function debatesPath(env: Env = process.env): string {
  const override = nonEmpty(env["YADA_DEBATES"]);
  return override === undefined
    ? path.join(REPO_ROOT, "packages", "pipeline", "prototypes", "data", "debates.json")
    : path.resolve(override);
}

/** John's hand decisions on passage summaries (the "Passage summaries" queue). */
export function passageReviewsPath(env: Env = process.env): string {
  const override = nonEmpty(env["YADA_PASSAGE_REVIEWS"]);
  return override === undefined
    ? path.join(REPO_ROOT, "packages", "pipeline", "prototypes", "data", "passage_reviews.json")
    : path.resolve(override);
}

/** Where book_intros.json and grammar.json live (the "Extracts" queue, build 6). */
export function extractsDir(env: Env = process.env): string {
  const override = nonEmpty(env["YADA_EXTRACTS_DIR"]);
  return override === undefined ? path.join(REPO_ROOT, "packages", "pipeline", "prototypes", "data") : path.resolve(override);
}

/** The pipeline script that lists the flagged summaries, run as a child process (read-only). */
export const FLAGGED_SUMMARIES_SCRIPT = path.join(REPO_ROOT, "packages", "pipeline", "src", "understand", "flagged.ts");

/**
 * The core bundle the debate cards read BSB text from. Defaults to the newest
 * `core.vN.db` in content/bundles, so a rebuilt bundle needs no config change.
 */
export function coreDbPath(env: Env = process.env): string {
  const override = nonEmpty(env["YADA_CORE_DB"]);
  if (override !== undefined) return path.resolve(override);
  const dir = path.join(REPO_ROOT, "content", "bundles");
  const versions = existsSync(dir)
    ? readdirSync(dir)
        .map((file) => /^core\.v(\d+)\.db$/.exec(file)?.[1])
        .filter((v): v is string => v !== undefined)
        .map(Number)
        .sort((a, b) => b - a)
    : [];
  return path.join(dir, `core.v${versions[0] ?? 5}.db`);
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
