/** `pnpm --filter @yada/review start`: the API plus the built client on 127.0.0.1. */

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  CLIENT_DIST,
  coreDbPath,
  debatesPath,
  extractsDir,
  HOST,
  passageReviewsPath,
  REPO_ROOT,
  reviewDir,
  reviewerName,
  reviewPort,
  SAMPLE_RATE,
  sampleSeed,
  stagingDbPath,
} from "./config.js";
import { CloudKitClient, cloudKitConfig, readEnvLocal } from "./cloudkit.js";
import { openReviewDb } from "./db.js";
import { createHandler, type ServerContext } from "./http.js";
import { pipelineLoader, SummarySource, type SummaryLoader } from "./summaries.js";

export interface StartOptions {
  port?: number;
  /** Built client directory; null to serve the API only. Defaults to dist/client. */
  staticDir?: string | null;
  env?: Record<string, string | undefined>;
  /** Lists the flagged passage summaries. Defaults to the pipeline's flagged.ts. */
  summaryLoader?: SummaryLoader;
}

export interface RunningServer {
  server: Server;
  url: string;
  ctx: ServerContext;
}

/** The CloudKit lines of .env.local (YADA_ENV_FILE overrides, for a worktree), then the process env on top. */
function reportsClient(env: Record<string, string | undefined>): CloudKitClient | { missing: string } {
  const file = env["YADA_ENV_FILE"] ?? path.join(REPO_ROOT, ".env.local");
  const config = cloudKitConfig({ ...readEnvLocal(file), ...env });
  return "missing" in config ? config : new CloudKitClient(config);
}

export async function startReviewServer(options: StartOptions = {}): Promise<RunningServer> {
  const env = options.env ?? process.env;
  const dbPath = stagingDbPath(env);
  const db = openReviewDb(dbPath);
  const ctx: ServerContext = {
    db,
    dbPath,
    reviewDir: reviewDir(env),
    reviewer: reviewerName(env),
    sampleSeed: sampleSeed(env),
    sampleRate: SAMPLE_RATE,
    staticDir: options.staticDir === undefined ? CLIENT_DIST : options.staticDir,
    debatesPath: debatesPath(env),
    extractsDir: extractsDir(env),
    coreDbPath: coreDbPath(env),
    passageReviewsPath: passageReviewsPath(env),
    summaries: new SummarySource(options.summaryLoader ?? pipelineLoader()),
    cloudkit: reportsClient(env),
  };

  const server = createServer(createHandler(ctx));
  server.on("close", () => db.close());
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? reviewPort(env), HOST, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://${HOST}:${port}`, ctx };
}

export function describe(running: RunningServer): string {
  const { ctx, url } = running;
  return [
    `Yada review on ${url}`,
    `  staging.db   ${ctx.dbPath}`,
    `  decisions -> ${ctx.reviewDir}`,
    `  debates      ${ctx.debatesPath}`,
    `  extracts     ${ctx.extractsDir}`,
    `  BSB from     ${ctx.coreDbPath}`,
    `  summaries    ${ctx.passageReviewsPath}`,
    `  reports      ${"missing" in ctx.cloudkit ? ctx.cloudkit.missing : `CloudKit ${ctx.cloudkit.environment}`}`,
    `  sample seed  ${ctx.sampleSeed} (${Math.round(ctx.sampleRate * 100)}% per book, at least one)`,
  ].join("\n");
}

/** Building every book's summaries takes minutes: start at once, so the queue is ready when John opens it. */
export function announceSummaries(running: RunningServer): void {
  void running.ctx.summaries.settled().then(() => {
    const list = running.ctx.summaries.read();
    console.log(Array.isArray(list) ? `  ${list.length} passage summaries listed` : `  passage summaries: ${list.state === "error" ? list.error : list.state}`);
  });
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const running = await startReviewServer();
  console.log(describe(running));
  announceSummaries(running);
}
