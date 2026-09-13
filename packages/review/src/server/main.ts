/** `pnpm --filter @yada/review start`: the API plus the built client on 127.0.0.1. */

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { pathToFileURL } from "node:url";

import {
  CLIENT_DIST,
  HOST,
  reviewDir,
  reviewerName,
  reviewPort,
  SAMPLE_RATE,
  sampleSeed,
  stagingDbPath,
} from "./config.js";
import { openReviewDb } from "./db.js";
import { createHandler, type ServerContext } from "./http.js";

export interface StartOptions {
  port?: number;
  /** Built client directory; null to serve the API only. Defaults to dist/client. */
  staticDir?: string | null;
  env?: Record<string, string | undefined>;
}

export interface RunningServer {
  server: Server;
  url: string;
  ctx: ServerContext;
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
    `  sample seed  ${ctx.sampleSeed} (${Math.round(ctx.sampleRate * 100)}% per book, at least one)`,
  ].join("\n");
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const running = await startReviewServer();
  console.log(describe(running));
}
