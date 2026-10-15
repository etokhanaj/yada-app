import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * The batch path, end to end against a temp content/ (staging.db, usage.jsonl,
 * responses) and a fake client. No key, no network, and the real spend log is
 * never touched. The fake throws if create() is reached on a path that must
 * refuse, because a refusal test that never got near the gate proves nothing.
 */

let tempDir: string;

vi.mock("./paths.js", async () => {
  const actual = await vi.importActual<typeof import("./paths.js")>("./paths.js");
  return {
    ...actual,
    get CONTENT() { return tempDir; },
    get STAGING_DB() { return path.join(tempDir, "staging.db"); },
    get RESPONSES() { return path.join(tempDir, "responses"); },
    ensureDirs: () => mkdirSync(path.join(tempDir, "responses"), { recursive: true }),
  };
});

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "yada-batch-"));
  vi.resetModules();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const GEN_1 = { id: "GEN.1.1-1.1", label: "In the beginning" };
const GEN_2 = { id: "GEN.1.2-1.2", label: "Formless and void" };
const CORINTHIANS = { id: "1CO.14.26-14.40", label: "Order in worship" };
const OPUS = "claude-opus-5";

async function load() {
  const batch = await import("./batch.js");
  const budget = await import("./budget.js");
  const db = await import("./db.js");
  const generate = await import("./generate.js");
  const submit = await import("./submit.js");
  const responses = await import("./responses.js");
  const staging = await import("./test-staging.js");
  const handle = db.openStaging();
  staging.seedVerse(handle, "GEN.1.1", [{ surface: "בְּרֵאשִׁית", lemma: "b/7225", strongs: "H7225" }]);
  staging.seedVerse(handle, "GEN.1.2", [{ surface: "וְהָאָרֶץ", lemma: "c/d/776", strongs: "H0776" }]);
  return { ...batch, ...budget, ...generate, ...submit, ...responses, ...staging, db: handle };
}

function usageLines(): Array<Record<string, unknown>> {
  const file = path.join(tempDir, "usage.jsonl");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

interface FakeOptions {
  inputTokens?: number;
  status?: "in_progress" | "canceling" | "ended";
  results?: unknown[];
}

/** A Message Batches client that records what it was sent. */
function fakeClient(options: FakeOptions = {}) {
  const created: any[] = [];
  const client: any = {
    messages: {
      countTokens: async () => ({ input_tokens: options.inputTokens ?? 4000 }),
      stream: () => {
        throw new Error("stream() was called — the batch path must not generate synchronously");
      },
      batches: {
        create: async (params: unknown) => {
          created.push(params);
          return { id: "msgbatch_test1", processing_status: "in_progress" };
        },
        retrieve: async (id: string) => ({
          id,
          processing_status: options.status ?? "ended",
          request_counts: { processing: 0, succeeded: 1, errored: 1, canceled: 0, expired: 0 },
          created_at: "2026-10-10T00:00:00Z",
          ended_at: options.status === "in_progress" ? null : "2026-10-10T01:00:00Z",
        }),
        results: async () =>
          (async function* () {
            for (const item of options.results ?? []) yield item;
          })(),
      },
    },
  };
  return { client, created };
}

function refusingClient(inputTokens: number) {
  const { client } = fakeClient({ inputTokens });
  client.messages.batches.create = () => {
    throw new Error("batches.create() was called — the gate did not hold");
  };
  return client;
}

function succeeded(customId: string, text: string, output = 9000, thinking = 2000) {
  return {
    custom_id: customId,
    result: {
      type: "succeeded",
      message: {
        content: [{ type: "text", text }],
        stop_reason: "end_turn",
        usage: { input_tokens: 4100, output_tokens: output, output_tokens_details: { thinking_tokens: thinking } },
      },
    },
  };
}

function errored(customId: string) {
  return {
    custom_id: customId,
    result: { type: "errored", error: { type: "error", error: { type: "api_error", message: "overloaded" } } },
  };
}

describe("batch custom ids", () => {
  it("replaces the dots custom_id forbids and stays readable", async () => {
    const { batchCustomId } = await load();
    expect(batchCustomId(OPUS, "GEN.1.1-1.5")).toBe("claude-opus-5__GEN_1_1-1_5");
    expect(batchCustomId("claude-sonnet-5", "1CO.14.26-14.40")).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it("refuses an id longer than the API allows rather than truncating it into a collision", async () => {
    const { batchCustomId } = await load();
    expect(() => batchCustomId(OPUS, `GEN.${"1".repeat(60)}`)).toThrow(/cannot make a batch custom_id/);
  });
});

describe("generate --batch: the gate", () => {
  it("sends nothing and records nothing without --confirm", async () => {
    const { submitBatch, db } = await load();
    await expect(
      submitBatch(db, "GEN", [GEN_1], [OPUS], { confirm: false, client: refusingClient(4000) }),
    ).rejects.toThrow(/--confirm not given/);
    expect(usageLines()).toEqual([]);
    expect(db.prepare("SELECT * FROM batches").all()).toEqual([]);
    db.close();
  });

  it("checks the whole batch against the ceiling, not each request alone", async () => {
    const { submitBatch, priceBatchUsage, maxTokensFor, CEILING_USD, db } = await load();
    // 28M input tokens: one request is ~$71 at the batch rate and fits; two
    // are ~$141 and do not. Checking request by request would let both through.
    const one = priceBatchUsage(OPUS, 28_000_000, maxTokensFor(1));
    expect(one).toBeLessThan(CEILING_USD);
    expect(2 * one).toBeGreaterThan(CEILING_USD);

    await expect(
      submitBatch(db, "GEN", [GEN_1], [OPUS], { confirm: false, client: refusingClient(28_000_000) }),
    ).rejects.toThrow(/--confirm not given/);
    await expect(
      submitBatch(db, "GEN", [GEN_1, GEN_2], [OPUS], { confirm: true, client: refusingClient(28_000_000) }),
    ).rejects.toThrow(/refusing to submit: .* this batch of 2 requests could cost/);
    expect(usageLines()).toEqual([]);
    db.close();
  });

  it("prices the batch at the discount, so a request too big to send synchronously can be batched", async () => {
    const { submitBatch, priceUsage, maxTokensFor, CEILING_USD, db } = await load();
    expect(priceUsage(OPUS, 30_000_000, maxTokensFor(1))).toBeGreaterThan(CEILING_USD);
    await expect(
      submitBatch(db, "GEN", [GEN_1], [OPUS], { confirm: false, client: refusingClient(30_000_000) }),
    ).rejects.toThrow(/--confirm not given/);
    db.close();
  });

  it("counts money already reserved by an uncollected batch", async () => {
    const { submitBatch, recordUsage, CEILING_USD, db } = await load();
    // $5 under the ceiling already reserved, whatever the ceiling is.
    recordUsage({
      at: "2026-10-10T00:00:00Z", model: OPUS, pericope_id: "JHN.1.1-1.18", verses: 18,
      input_tokens: 1, output_tokens: 1, thinking_tokens: 0, cost_usd: CEILING_USD - 5,
      estimated: true, reservation: true, batch_id: "msgbatch_earlier", custom_id: "x",
    });
    await expect(
      submitBatch(db, "GEN", [GEN_1], [OPUS], { confirm: true, client: refusingClient(2_000_000) }),
    ).rejects.toThrow(new RegExp(`\\$${(CEILING_USD - 5).toFixed(2)} already spent`));
    db.close();
  });
});

describe("generate --batch --confirm", () => {
  it("submits the same requests the synchronous path streams, and reserves their worst case", async () => {
    const { submitBatch, buildRequest, maxTokensFor, priceBatchUsage, spentSoFar, db } = await load();
    const { client, created } = fakeClient();
    const { batchId, plan } = await submitBatch(db, "GEN", [GEN_1, GEN_2], [OPUS], { confirm: true, client });

    expect(batchId).toBe("msgbatch_test1");
    expect(created).toHaveLength(1);
    expect(created[0].requests).toEqual([
      {
        custom_id: "claude-opus-5__GEN_1_1-1_1",
        params: {
          model: OPUS,
          max_tokens: maxTokensFor(1),
          messages: [{ role: "user", content: buildRequest("GEN", GEN_1)?.body }],
          thinking: { type: "adaptive" },
        },
      },
      expect.objectContaining({ custom_id: "claude-opus-5__GEN_1_2-1_2" }),
    ]);

    const worst = priceBatchUsage(OPUS, 4000, maxTokensFor(1));
    expect(plan.worstCaseUsd).toBeCloseTo(2 * worst, 6);
    expect(usageLines()).toEqual([
      expect.objectContaining({ batch_id: batchId, custom_id: "claude-opus-5__GEN_1_1-1_1", reservation: true, estimated: true, cost_usd: worst }),
      expect.objectContaining({ batch_id: batchId, custom_id: "claude-opus-5__GEN_1_2-1_2", reservation: true, estimated: true, cost_usd: worst }),
    ]);
    expect(spentSoFar()).toBeCloseTo(2 * worst, 6);

    expect(db.prepare("SELECT batch_id, book, state, models, requests FROM batches").all()).toEqual([
      { batch_id: batchId, book: "GEN", state: "in_progress", models: OPUS, requests: 2 },
    ]);
    expect(db.prepare("SELECT pericope_id, verses, collected_at FROM batch_requests ORDER BY custom_id").all()).toEqual([
      { pericope_id: "GEN.1.1-1.1", verses: 1, collected_at: null },
      { pericope_id: "GEN.1.2-1.2", verses: 1, collected_at: null },
    ]);
    db.close();
  });

  it("skips a pericope with no tokens instead of holding back the book", async () => {
    const { submitBatch, db } = await load();
    const { client, created } = fakeClient();
    const { plan } = await submitBatch(db, "GEN", [GEN_1, { id: "GEN.2.1-2.3", label: "nowhere" }], [OPUS], {
      confirm: true,
      client,
    });
    expect(plan.skipped).toEqual([{ pericopeId: "GEN.2.1-2.3", reason: "no tokens in staging.db" }]);
    expect(created[0].requests).toHaveLength(1);
    db.close();
  });
});

describe("batch status and collect", () => {
  it("refuses a batch this repo did not submit", async () => {
    const { batchStatus, db } = await load();
    await expect(batchStatus(db, "msgbatch_stranger", { client: fakeClient().client })).rejects.toThrow(
      /not in staging.db/,
    );
    db.close();
  });

  it("status records the processing state", async () => {
    const { submitBatch, batchStatus, db } = await load();
    await submitBatch(db, "GEN", [GEN_1], [OPUS], { confirm: true, client: fakeClient().client });
    const status = await batchStatus(db, "msgbatch_test1", { client: fakeClient({ status: "ended" }).client });
    expect(status.processingStatus).toBe("ended");
    expect(db.prepare("SELECT state FROM batches").get()).toEqual({ state: "ended" });
    db.close();
  });

  it("collect refuses a batch that has not ended", async () => {
    const { submitBatch, collectBatch, db } = await load();
    await submitBatch(db, "GEN", [GEN_1], [OPUS], { confirm: true, client: fakeClient().client });
    await expect(
      collectBatch(db, "msgbatch_test1", { client: fakeClient({ status: "in_progress" }).client }),
    ).rejects.toThrow(/in_progress/);
    db.close();
  });

  it("measures succeeded results, keeps the reservation for failed ones, and is safe to re-run", async () => {
    const { submitBatch, collectBatch, maxTokensFor, priceBatchUsage, spentSoFar, db } = await load();
    await submitBatch(db, "GEN", [GEN_1, GEN_2], [OPUS], { confirm: true, client: fakeClient().client });

    // Out of submission order, as the API returns them.
    const results = [errored("claude-opus-5__GEN_1_2-1_2"), succeeded("claude-opus-5__GEN_1_1-1_1", "{}"), succeeded("stranger", "{}")];
    const { client } = fakeClient({ results });
    const report = await collectBatch(db, "msgbatch_test1", { client });

    expect(report.collected.map((r) => `${r.pericopeId} ${r.result}`)).toEqual(["GEN.1.2-1.2 errored", "GEN.1.1-1.1 succeeded"]);
    expect(report.collected[0]?.error).toBe("overloaded");
    expect(report.unknown).toEqual(["stranger"]);
    expect(report.missing).toEqual([]);

    const measured = priceBatchUsage(OPUS, 4100, 9000);
    const reserved = priceBatchUsage(OPUS, 4000, maxTokensFor(1));
    expect(usageLines().at(-1)).toEqual(
      expect.objectContaining({ custom_id: "claude-opus-5__GEN_1_1-1_1", output_tokens: 9000, thinking_tokens: 2000, cost_usd: measured }),
    );
    expect(usageLines().at(-1)).not.toHaveProperty("reservation");
    expect(spentSoFar()).toBeCloseTo(measured + reserved, 6);

    const file = JSON.parse(readFileSync(path.join(tempDir, "responses", "GEN.1.1-1.1.claude-opus-5.json"), "utf8"));
    expect(file).toEqual(expect.objectContaining({ pericope_id: "GEN.1.1-1.1", model: OPUS, stop_reason: "end_turn", text: "{}", batch_id: "msgbatch_test1" }));
    expect(existsSync(path.join(tempDir, "responses", "GEN.1.2-1.2.claude-opus-5.json"))).toBe(false);
    expect(db.prepare("SELECT state FROM batches").get()).toEqual({ state: "collected" });

    const lines = usageLines().length;
    const again = await collectBatch(db, "msgbatch_test1", { client: fakeClient({ results }).client });
    expect(again.collected).toEqual([]);
    expect(again.alreadyCollected).toBe(2);
    expect(usageLines()).toHaveLength(lines);
    expect(spentSoFar()).toBeCloseTo(measured + reserved, 6);
    db.close();
  });

  it("counts a measurement once even if a crashed collect wrote it twice", async () => {
    const { recordUsage, spentSoFar } = await load();
    const base = {
      at: "2026-10-10T00:00:00Z", model: OPUS, pericope_id: "GEN.1.1-1.1", verses: 1,
      input_tokens: 1, output_tokens: 1, thinking_tokens: 0, batch_id: "b", custom_id: "c",
    };
    recordUsage({ ...base, cost_usd: 10, estimated: true, reservation: true });
    recordUsage({ ...base, cost_usd: 2 });
    recordUsage({ ...base, cost_usd: 2 });
    expect(spentSoFar()).toBeCloseTo(2, 6);
  });

  it("leaves a batch uncollected while any request has no result", async () => {
    const { submitBatch, collectBatch, db } = await load();
    await submitBatch(db, "GEN", [GEN_1, GEN_2], [OPUS], { confirm: true, client: fakeClient().client });
    const report = await collectBatch(db, "msgbatch_test1", {
      client: fakeClient({ results: [succeeded("claude-opus-5__GEN_1_1-1_1", "{}")] }).client,
    });
    expect(report.missing).toEqual(["claude-opus-5__GEN_1_2-1_2"]);
    expect(db.prepare("SELECT state FROM batches").get()).toEqual({ state: "ended" });
    db.close();
  });

  it("writes responses that ingest-responses stores, flagged, unchanged", async () => {
    const { submitBatch, collectBatch, ingestResponses, seedVerse, composed1Co14, db } = await load();
    seedVerse(db, "1CO.14.34", [{ surface: "σιγάτωσαν", lemma: "σιγάω", strongs: "G4601" }]);
    await submitBatch(db, "1CO", [CORINTHIANS], [OPUS], { confirm: true, client: fakeClient().client });
    await collectBatch(db, "msgbatch_test1", {
      client: fakeClient({ results: [succeeded("claude-opus-5__1CO_14_26-14_40", JSON.stringify(composed1Co14()))] }).client,
    });

    const report = ingestResponses(db);
    expect(report.rejected).toEqual([]);
    expect(report.stored.map((s) => `${s.kind} ${s.id}`)).toEqual(["pericope 1CO.14.26-14.40", "verse 1CO.14.34"]);
    expect(db.prepare("SELECT status FROM review_state").all()).toEqual([{ status: "flagged" }]);
    db.close();
  });

  it("batches every part of a long pericope and writes each part as the synchronous path would", async () => {
    const { submitBatch, collectBatch, seedVerse, db } = await load();
    for (let verse = 1; verse <= 44; verse += 1) {
      seedVerse(db, `JHN.11.${verse}`, [{ surface: "καὶ", lemma: "καί", strongs: "G2532", morph: "C- --------" }]);
    }
    const long = { id: "JHN.11.1-11.44", label: "The raising of Lazarus" };
    const { client, created } = fakeClient();
    const { plan } = await submitBatch(db, "JHN", [long], [OPUS], { confirm: true, client });

    expect(plan.requests.map((r) => [r.customId, r.part, r.parts, r.verses])).toEqual([
      ["claude-opus-5__JHN_11_1-11_44_part1of3", 1, 3, 15],
      ["claude-opus-5__JHN_11_1-11_44_part2of3", 2, 3, 15],
      ["claude-opus-5__JHN_11_1-11_44_part3of3", 3, 3, 14],
    ]);
    expect(created[0].requests).toHaveLength(3);

    const results = plan.requests.map((r) => succeeded(r.customId, "{}"));
    await collectBatch(db, "msgbatch_test1", { client: fakeClient({ results }).client });
    const file = JSON.parse(readFileSync(path.join(tempDir, "responses", "JHN.11.1-11.44.part2of3.claude-opus-5.json"), "utf8"));
    expect(file).toEqual(expect.objectContaining({ pericope_id: long.id, part: 2, parts: 3, batch_id: "msgbatch_test1" }));
    expect(file.verses[0]).toBe("JHN.11.16");
    expect(file.verses).toHaveLength(15);
    db.close();
  });
});

/**
 * Code review, 10 Oct 2026: a failure after batches.create() returned left a
 * paid batch that collect refused. These run the failure, then recover, then
 * collect, and check the money stays counted throughout.
 */
describe("batch recover", () => {
  const LONG = { id: "JHN.11.1-11.44", label: "The raising of Lazarus" };

  function seedJohn11(seedVerse: (db: any, id: string, tokens: any[]) => void, db: unknown) {
    for (let verse = 1; verse <= 44; verse += 1) {
      seedVerse(db, `JHN.11.${verse}`, [{ surface: "καὶ", lemma: "καί", strongs: "G2532", morph: "C- --------" }]);
    }
  }

  afterEach(() => {
    vi.doUnmock("./budget.js");
  });

  it("a reservation that fails mid-loop still stages the batch, reports it, and recover re-reserves it", async () => {
    let calls = 0;
    vi.doMock("./budget.js", async () => {
      const actual = await vi.importActual<typeof import("./budget.js")>("./budget.js");
      return {
        ...actual,
        recordUsage: (record: Parameters<typeof actual.recordUsage>[0]) => {
          calls += 1;
          if (calls === 2) throw new Error("ENOSPC: no space left on device");
          actual.recordUsage(record);
        },
      };
    });
    const { submitBatch, recoverBatch, collectBatch, spentSoFar, BatchNotRecorded, db } = await load();
    const { client, created } = fakeClient();

    const submitted = submitBatch(db, "GEN", [GEN_1, GEN_2], [OPUS], { confirm: true, client });
    await expect(submitted).rejects.toThrow(BatchNotRecorded);
    await expect(submitted).rejects.toThrow(
      /msgbatch_test1 WAS SUBMITTED[\s\S]*reservation for claude-opus-5__GEN_1_2-1_2: ENOSPC[\s\S]*yada batch recover msgbatch_test1/,
    );
    expect(created).toHaveLength(1);
    // The loop kept going and the staging write was still attempted.
    expect(db.prepare("SELECT custom_id FROM batch_requests ORDER BY custom_id").all()).toHaveLength(2);
    const before = spentSoFar();

    const report = recoverBatch(db, "msgbatch_test1");
    expect(report).toEqual({ batchId: "msgbatch_test1", restaged: [], reserved: ["claude-opus-5__GEN_1_2-1_2"], batchRow: false });
    expect(spentSoFar()).toBeCloseTo(2 * before, 6);
    expect(recoverBatch(db, "msgbatch_test1")).toEqual({ batchId: "msgbatch_test1", restaged: [], reserved: [], batchRow: false });

    const results = [succeeded("claude-opus-5__GEN_1_1-1_1", "{}"), succeeded("claude-opus-5__GEN_1_2-1_2", "{}")];
    const collected = await collectBatch(db, "msgbatch_test1", { client: fakeClient({ results }).client });
    expect(collected.missing).toEqual([]);
    expect(collected.collected.map((r) => r.result)).toEqual(["succeeded", "succeeded"]);
    db.close();
  });

  it("a staging write that rolls back is rebuilt from the reservations, split parts and verses included", async () => {
    const { submitBatch, recoverBatch, collectBatch, spentSoFar, seedVerse, db } = await load();
    seedJohn11(seedVerse, db);
    db.exec("CREATE TRIGGER fail_staging BEFORE INSERT ON batch_requests BEGIN SELECT RAISE(ABORT, 'disk I/O error'); END");
    const { client } = fakeClient();

    await expect(submitBatch(db, "JHN", [LONG], [OPUS], { confirm: true, client })).rejects.toThrow(
      /WAS SUBMITTED[\s\S]*staging\.db: disk I\/O error/,
    );
    expect(db.prepare("SELECT * FROM batches").all()).toEqual([]);
    const reserved = spentSoFar();
    expect(reserved).toBeGreaterThan(0);
    await expect(collectBatch(db, "msgbatch_test1", { client: fakeClient().client })).rejects.toThrow(
      /not in staging.db.*yada batch recover/,
    );

    db.exec("DROP TRIGGER fail_staging");
    const report = recoverBatch(db, "msgbatch_test1");
    expect(report.batchRow).toBe(true);
    expect(report.restaged).toHaveLength(3);
    expect(report.reserved).toEqual([]);
    expect(spentSoFar()).toBeCloseTo(reserved, 6);
    expect(db.prepare("SELECT book, state, models, requests FROM batches").get()).toEqual({
      book: "JHN",
      state: "recovered",
      models: OPUS,
      requests: 3,
    });

    const results = report.restaged.map((id) => succeeded(id, "{}"));
    const collected = await collectBatch(db, "msgbatch_test1", { client: fakeClient({ results }).client });
    expect(collected.missing).toEqual([]);
    const file = JSON.parse(readFileSync(path.join(tempDir, "responses", "JHN.11.1-11.44.part3of3.claude-opus-5.json"), "utf8"));
    expect(file).toEqual(expect.objectContaining({ pericope_id: LONG.id, part: 3, parts: 3 }));
    expect(file.verses[0]).toBe("JHN.11.31");
    expect(file.verses).toHaveLength(14);
    db.close();
  });

  it("rebuilds a reservation written before it carried parts, but only if today's split reproduces it", async () => {
    const { recoverBatch, recordUsage, collectBatch, seedVerse, db } = await load();
    seedJohn11(seedVerse, db);
    const old = {
      at: "2026-10-09T00:00:00Z", model: OPUS, input_tokens: 4000, output_tokens: 128_000, thinking_tokens: 0,
      cost_usd: 1, estimated: true, reservation: true, batch_id: "msgbatch_old", stage: "generate" as const,
    };
    recordUsage({ ...old, pericope_id: "GEN.1.1-1.1", verses: 1, custom_id: "claude-opus-5__GEN_1_1-1_1" });
    const report = recoverBatch(db, "msgbatch_old");
    expect(report.restaged).toEqual(["claude-opus-5__GEN_1_1-1_1"]);
    expect(db.prepare("SELECT part, parts, verse_ids FROM batch_requests WHERE batch_id = 'msgbatch_old'").get()).toEqual({
      part: 1,
      parts: 1,
      verse_ids: JSON.stringify(["GEN.1.1"]),
    });
    const collected = await collectBatch(db, "msgbatch_old", {
      client: fakeClient({ results: [succeeded("claude-opus-5__GEN_1_1-1_1", "{}")] }).client,
    });
    expect(collected.missing).toEqual([]);
    expect(existsSync(path.join(tempDir, "responses", "GEN.1.1-1.1.claude-opus-5.json"))).toBe(true);

    // Sent under the old 33-verse limit as 2 x 22: today's split is 3 parts, so the id does not exist.
    recordUsage({ ...old, batch_id: "msgbatch_older", pericope_id: LONG.id, verses: 22, custom_id: "claude-opus-5__JHN_11_1-11_44_part1of2" });
    expect(() => recoverBatch(db, "msgbatch_older")).toThrow(/cannot rebuild claude-opus-5__JHN_11_1-11_44_part1of2/);
    expect(db.prepare("SELECT * FROM batches WHERE batch_id = 'msgbatch_older'").all()).toEqual([]);
    db.close();
  });

  it("refuses a batch with nothing recorded on either side", async () => {
    const { recoverBatch, db } = await load();
    expect(() => recoverBatch(db, "msgbatch_unknown")).toThrow(/nothing to rebuild it from/);
    db.close();
  });
});
