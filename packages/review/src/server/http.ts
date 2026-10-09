/**
 * The JSON API, plus the built client when there is one.
 *
 *   GET  /api/meta
 *   GET  /api/queues/:queue
 *   GET  /api/entries/:verseId
 *   POST /api/entries/:verseId/approve   { rating, payload_sha256, reason?, queue? }
 *   POST /api/entries/:verseId/reject    { reason, rating?, queue?, payload_sha256? }
 *
 * Loopback binding keeps other machines out. The Host check keeps out a web
 * page that rebinds its own hostname to 127.0.0.1, and requiring a JSON content
 * type keeps out a plain cross-site form post, so nothing but this client can
 * record a review decision.
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

import type { DecisionResponse, ErrorResponse, MetaResponse } from "../shared/api.js";
import { isReviewQueue } from "../shared/api.js";
import { approve, decisionsPath, RefusedError, reject, type DecisionContext } from "./actions.js";
import { buildEntry, buildQueue, queueCounts } from "./queues.js";

export interface ServerContext extends DecisionContext {
  dbPath: string;
  sampleRate: number;
  /** Built client directory, or null when Vite serves the client (dev). */
  staticDir: string | null;
}

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);
const MAX_BODY_BYTES = 64 * 1024;

function hostAllowed(req: IncomingMessage): boolean {
  const host = req.headers.host;
  if (host === undefined) return false;
  const name = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : (host.split(":")[0] ?? "");
  return LOCAL_HOSTNAMES.has(name);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new RefusedError("Request body too large.", 413);
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  let parsed: unknown;
  try {
    parsed = raw.trim() === "" ? {} : (JSON.parse(raw) as unknown);
  } catch {
    throw new RefusedError("Request body is not valid JSON.", 400);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new RefusedError("Request body must be a JSON object.", 400);
  }
  return parsed as Record<string, unknown>;
}

export function createHandler(ctx: ServerContext): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    handle(ctx, req, res).catch((error: unknown) => {
      if (error instanceof RefusedError) {
        sendJson(res, error.httpStatus, { error: error.message } satisfies ErrorResponse);
        return;
      }
      console.error(error);
      sendJson(res, 500, { error: (error as Error).message ?? "internal error" } satisfies ErrorResponse);
    });
  };
}

async function handle(ctx: ServerContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!hostAllowed(req)) {
    sendJson(res, 403, { error: "The review tool only answers requests addressed to localhost." });
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  let parts: string[];
  try {
    parts = url.pathname.split("/").filter((part) => part !== "").map(decodeURIComponent);
  } catch {
    throw new RefusedError("Malformed URL encoding.", 400);
  }
  const options = { sampleSeed: ctx.sampleSeed, sampleRate: ctx.sampleRate };

  if (parts[0] === "api") {
    const method = req.method ?? "GET";

    if (method === "GET" && parts[1] === "meta" && parts.length === 2) {
      const { counts, total } = queueCounts(ctx.db, options);
      const meta: MetaResponse = {
        db_path: ctx.dbPath,
        review_dir: ctx.reviewDir,
        reviewer: ctx.reviewer,
        sample: { seed: ctx.sampleSeed, rate: ctx.sampleRate },
        counts,
        total_entries: total,
      };
      sendJson(res, 200, meta);
      return;
    }

    if (method === "GET" && parts[1] === "queues" && parts.length === 3) {
      const queue = parts[2];
      if (!isReviewQueue(queue)) throw new RefusedError(`Unknown queue "${queue ?? ""}".`, 404);
      sendJson(res, 200, buildQueue(ctx.db, queue, options));
      return;
    }

    if (parts[1] === "entries" && parts[2] !== undefined) {
      const verseId = parts[2];

      if (method === "GET" && parts.length === 3) {
        const entry = buildEntry(ctx.db, verseId);
        if (entry === null) throw new RefusedError(`No entry for ${verseId} in staging.db.`, 404);
        sendJson(res, 200, entry);
        return;
      }

      const action = parts[3];
      if (method === "POST" && parts.length === 4 && (action === "approve" || action === "reject")) {
        const contentType = req.headers["content-type"] ?? "";
        if (!contentType.startsWith("application/json")) {
          throw new RefusedError("Decisions must be posted as application/json.", 415);
        }
        const body = await readJsonBody(req);
        const state = action === "approve" ? approve(ctx, verseId, body) : reject(ctx, verseId, body);
        sendJson(res, 200, { state, logged_to: decisionsPath(ctx.reviewDir) } satisfies DecisionResponse);
        return;
      }
    }

    sendJson(res, 404, { error: `No endpoint ${method} ${url.pathname}.` });
    return;
  }

  if (ctx.staticDir === null || (req.method !== "GET" && req.method !== "HEAD")) {
    sendJson(res, 404, { error: "Not found." });
    return;
  }
  serveStatic(ctx.staticDir, url.pathname, res);
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

function serveStatic(root: string, pathname: string, res: ServerResponse): void {
  const base = path.resolve(root);
  let file = path.resolve(base, `.${path.posix.normalize(decodeURIComponent(pathname))}`);
  if (file !== base && !file.startsWith(`${base}${path.sep}`)) {
    sendJson(res, 403, { error: "Forbidden." });
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(base, "index.html");
  if (!existsSync(file)) {
    sendJson(res, 503, {
      error: "The client is not built. Run `pnpm --filter @yada/review build`, or use `dev`.",
    });
    return;
  }
  res.writeHead(200, {
    "content-type": CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream",
  });
  createReadStream(file).pipe(res);
}
