import { request as httpRequest } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import type { EntryResponse, MetaResponse, QueueResponse } from "../shared/api.js";
import { startReviewServer, type RunningServer } from "./main.js";
import { createTempStaging, type TempStaging } from "./test-staging.js";

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const fn of cleanups.splice(0).reverse()) await fn();
});

async function serve(): Promise<{ t: TempStaging; running: RunningServer }> {
  const t = createTempStaging();
  cleanups.push(() => t.cleanup());
  const running = await startReviewServer({
    port: 0,
    staticDir: null,
    env: { YADA_STAGING_DB: t.dbPath, YADA_REVIEW_DIR: t.reviewDir, YADA_REVIEWER: "tester" },
  });
  cleanups.push(() => new Promise<void>((resolve) => running.server.close(() => resolve())));
  return { t, running };
}

function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("review server", () => {
  it("binds to loopback and serves the queues and entries", async () => {
    const { t, running } = await serve();
    expect(running.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const meta = (await (await fetch(`${running.url}/api/meta`)).json()) as MetaResponse;
    expect(meta.db_path).toBe(t.dbPath);
    expect(meta.counts).toEqual({ flagged: 7, adversary_disagreement: 0, random_sample: 7, targeted_expert: 7 });

    const queue = (await (await fetch(`${running.url}/api/queues/targeted_expert`)).json()) as QueueResponse;
    expect(queue.items).toHaveLength(7);

    const entry = (await (await fetch(`${running.url}/api/entries/1CO.14.34`)).json()) as EntryResponse;
    expect(entry.entry?.claims).toHaveLength(9);

    expect((await fetch(`${running.url}/api/queues/nope`)).status).toBe(404);
    expect((await fetch(`${running.url}/api/entries/JHN.3.16`)).status).toBe(404);
  });

  it("refuses bad decisions with a reason and records good ones", async () => {
    const { running } = await serve();
    const base = `${running.url}/api/entries/JHN.1.1`;

    const low = await post(`${base}/approve`, { rating: 3 });
    expect(low.status).toBe(422);
    expect(((await low.json()) as { error: string }).error).toContain("rated 3");

    const noReason = await post(`${base}/reject`, { rating: 2 });
    expect(noReason.status).toBe(422);

    const form = await fetch(`${base}/approve`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "rating=5",
    });
    expect(form.status).toBe(415);

    const ok = await post(`${base}/approve`, { rating: 4, queue: "flagged" });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { state: { status: string } }).state.status).toBe("human_reviewed");
  });

  it("refuses requests addressed to any host but localhost", async () => {
    const { running } = await serve();
    const { port } = new URL(running.url);
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(
        { host: "127.0.0.1", port: Number(port), path: "/api/meta", headers: { host: "attacker.example" } },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on("error", reject);
      req.end();
    });
    expect(status).toBe(403);
  });
});
