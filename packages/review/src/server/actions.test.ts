import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ADVERSARY_FLAGS_DDL, migrateReviewSchema, tableColumns } from "./db.js";
import {
  approve,
  decisionsPath,
  exportReviewState,
  RefusedError,
  reject,
  type DecisionContext,
  type DecisionRecord,
} from "./actions.js";
import { loadEntry, payloadDigest } from "./queues.js";
import { asVerse, createTempStaging, golden, type TempStaging } from "./test-staging.js";

const open: TempStaging[] = [];
afterEach(() => {
  for (const t of open.splice(0)) t.cleanup();
});

function setup(): { t: TempStaging; ctx: DecisionContext } {
  const t = createTempStaging();
  open.push(t);
  const ctx: DecisionContext = {
    db: t.db,
    reviewDir: t.reviewDir,
    reviewer: "tester",
    sampleSeed: "seed-under-test",
    now: () => new Date("2026-09-13T10:00:00.000Z"),
  };
  return { t, ctx };
}

/** The digest the client sends for the entry it has on screen. */
function seen(ctx: DecisionContext, verseId: string): string {
  const stored = loadEntry(ctx.db, verseId);
  if (stored === null) throw new Error(`no entry ${verseId}`);
  return payloadDigest(stored.payload);
}

function refusal(fn: () => unknown): RefusedError {
  try {
    fn();
  } catch (error) {
    if (error instanceof RefusedError) return error;
    throw error;
  }
  throw new Error("expected the decision to be refused");
}

function logLines(dir: string): DecisionRecord[] {
  const file = decisionsPath(dir);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as DecisionRecord);
}

describe("approve", () => {
  it.each([1, 2, 3])("refuses approval rated %i, says why, and writes nothing", (rating) => {
    const { t, ctx } = setup();
    const error = refusal(() => approve(ctx, "JHN.1.1", { payload_sha256: seen(ctx, "JHN.1.1"), rating }));
    expect(error.message).toContain(`rated ${rating}`);
    expect(error.message).toContain("4 or better");
    expect(error.httpStatus).toBe(422);

    const state = loadEntry(t.db, "JHN.1.1")?.state;
    expect(state?.status).toBe("flagged");
    expect(state?.decision).toBeNull();
    expect(state?.rating).toBeNull();
    expect(logLines(t.reviewDir)).toEqual([]);
  });

  it.each([undefined, null, 0, 6, 4.5, "four"])("refuses a missing or malformed rating (%s)", (rating) => {
    const { t, ctx } = setup();
    refusal(() => approve(ctx, "JHN.1.1", { payload_sha256: seen(ctx, "JHN.1.1"), rating }));
    expect(loadEntry(t.db, "JHN.1.1")?.state.status).toBe("flagged");
    expect(logLines(t.reviewDir)).toEqual([]);
  });

  it.each([4, 5])("approves at %i: human_reviewed, decision approved", (rating) => {
    const { t, ctx } = setup();
    const state = approve(ctx, "JHN.1.1", { payload_sha256: seen(ctx, "JHN.1.1"), rating, reason: "  clean  " });
    expect(state).toEqual({
      verse_id: "JHN.1.1",
      status: "human_reviewed",
      decision: "approved",
      rating,
      reason: "clean",
      updated_at: "2026-09-13T10:00:00.000Z",
    });
    expect(loadEntry(t.db, "JHN.1.1")?.state.status).toBe("human_reviewed");
  });

  it("refuses to approve an entry that fails the quality contract", () => {
    const { t, ctx } = setup();
    const payload = asVerse(golden("JHN.1.1"), "JHN.1.2");
    const claims = payload["claims"] as Array<Record<string, unknown>>;
    const first = claims[0];
    if (first === undefined) throw new Error("fixture has no claims");
    first["claim"] = "One assertion; and a second one.";
    t.insert(payload);

    const error = refusal(() => approve(ctx, "JHN.1.2", { payload_sha256: seen(ctx, "JHN.1.2"), rating: 5 }));
    expect(error.message).toContain("quality contract");
    expect(error.message).toContain("claim-atomicity");
    expect(logLines(t.reviewDir)).toEqual([]);
  });

  it("refuses to downgrade an expert_reviewed entry", () => {
    const { t, ctx } = setup();
    t.insert(asVerse(golden("JHN.1.1"), "JHN.1.3"), "expert_reviewed");
    expect(refusal(() => approve(ctx, "JHN.1.3", { payload_sha256: seen(ctx, "JHN.1.3"), rating: 5 })).httpStatus).toBe(409);
    expect(loadEntry(t.db, "JHN.1.3")?.state.status).toBe("expert_reviewed");
  });

  it("refuses an unknown verse", () => {
    const { ctx } = setup();
    expect(refusal(() => approve(ctx, "JHN.3.16", { rating: 5 })).httpStatus).toBe(404);
  });

  it("refuses an approval that does not say which text was read", () => {
    const { t, ctx } = setup();
    expect(refusal(() => approve(ctx, "JHN.1.1", { rating: 5 })).httpStatus).toBe(400);
    expect(loadEntry(t.db, "JHN.1.1")?.state.status).toBe("flagged");
    expect(logLines(t.reviewDir)).toEqual([]);
  });

  it("refuses to approve text that changed after the reviewer opened it", () => {
    // The entry is regenerated while it sits open on screen: approving with the
    // old digest would record a review of words the reviewer never read.
    const { t, ctx } = setup();
    const opened = seen(ctx, "JHN.1.1");
    const regenerated = { ...golden("JHN.1.1"), whats_happening: "Regenerated prose." };
    t.db.prepare("UPDATE entries SET payload = ? WHERE verse_id = 'JHN.1.1'").run(JSON.stringify(regenerated));

    const error = refusal(() => approve(ctx, "JHN.1.1", { rating: 5, payload_sha256: opened }));
    expect(error.httpStatus).toBe(409);
    expect(error.message).toContain("changed after it was opened");
    expect(loadEntry(t.db, "JHN.1.1")?.state.status).toBe("flagged");
    expect(logLines(t.reviewDir)).toEqual([]);
  });
});

describe("reject", () => {
  it.each([undefined, null, "", "   \n "])("refuses a rejection without a reason (%j)", (reason) => {
    const { t, ctx } = setup();
    const error = refusal(() => reject(ctx, "1CO.14.34", { reason, rating: 2 }));
    expect(error.message).toContain("needs a reason");
    const state = loadEntry(t.db, "1CO.14.34")?.state;
    expect(state?.decision).toBeNull();
    expect(state?.rating).toBeNull();
    expect(logLines(t.reviewDir)).toEqual([]);
  });

  it("keeps the entry flagged and records decision rejected with the reason", () => {
    const { ctx } = setup();
    const state = reject(ctx, "1CO.14.34", { reason: "c6 overstates the evidence", rating: 2 });
    expect(state.status).toBe("flagged");
    expect(state.decision).toBe("rejected");
    expect(state.reason).toBe("c6 overstates the evidence");
    expect(state.rating).toBe(2);
  });

  it("refuses a rejection naming text that has since changed", () => {
    const { t, ctx } = setup();
    const error = refusal(() => reject(ctx, "1CO.14.34", { reason: "c6 overstates", payload_sha256: "0".repeat(64) }));
    expect(error.httpStatus).toBe(409);
    expect(logLines(t.reviewDir)).toEqual([]);
  });

  it("can reject an approved entry back to flagged", () => {
    const { ctx } = setup();
    approve(ctx, "JHN.1.1", { payload_sha256: seen(ctx, "JHN.1.1"), rating: 5 });
    expect(reject(ctx, "JHN.1.1", { reason: "second look: c9 is not hedged" }).status).toBe("flagged");
  });
});

describe("decisions.jsonl", () => {
  it("appends every decision, never rewriting earlier lines", () => {
    const { t, ctx } = setup();
    approve(ctx, "JHN.1.1", { payload_sha256: seen(ctx, "JHN.1.1"), rating: 5, queue: "targeted_expert" });
    reject(ctx, "1CO.14.34", { reason: "c9 needs an apparatus source", queue: "random_sample" });
    const afterTwo = readFileSync(decisionsPath(t.reviewDir), "utf8");
    reject(ctx, "JHN.1.1", { reason: "changed my mind" });

    const text = readFileSync(decisionsPath(t.reviewDir), "utf8");
    expect(text.startsWith(afterTwo)).toBe(true);
    expect(decisionsPath(t.reviewDir)).toBe(path.join(t.reviewDir, "decisions.jsonl"));

    const lines = logLines(t.reviewDir);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({
      at: "2026-09-13T10:00:00.000Z",
      verse_id: "JHN.1.1",
      decision: "approved",
      status: "human_reviewed",
      previous_status: "flagged",
      rating: 5,
      reason: null,
      reviewer: "tester",
      queue: "targeted_expert",
      sample_seed: null,
      prompt_version: String(golden("JHN.1.1")["prompt_version"]),
      schema_version: String(golden("JHN.1.1")["schema_version"]),
    });
    expect(lines[1]).toMatchObject({
      verse_id: "1CO.14.34",
      decision: "rejected",
      status: "flagged",
      reason: "c9 needs an apparatus source",
      queue: "random_sample",
      sample_seed: "seed-under-test",
    });
    expect(lines[2]).toMatchObject({ verse_id: "JHN.1.1", previous_status: "human_reviewed", queue: null });
  });

  it("rolls back the database write when the log cannot be written", () => {
    const { t, ctx } = setup();
    // A directory where the log file should be makes the append fail.
    mkdirSync(decisionsPath(t.reviewDir), { recursive: true });
    expect(() => approve(ctx, "JHN.1.1", { payload_sha256: seen(ctx, "JHN.1.1"), rating: 5 })).toThrow();
    const state = loadEntry(t.db, "JHN.1.1")?.state;
    expect(state?.status).toBe("flagged");
    expect(state?.decision).toBeNull();
  });
});

describe("export", () => {
  it("regenerates review_state.jsonl from the database, in verse order, byte-stable", () => {
    const { t, ctx } = setup();
    approve(ctx, "JHN.1.1", { payload_sha256: seen(ctx, "JHN.1.1"), rating: 4 });

    const first = exportReviewState(t.db, t.reviewDir);
    const bytes = readFileSync(first.file, "utf8");
    expect(first.rows).toBe(7);
    expect(path.basename(first.file)).toBe("review_state.jsonl");

    const rows = bytes
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(rows.map((r) => r["verse_id"])).toEqual([
      "GEN.1.1",
      "LEV.19.18",
      "PSA.23.1",
      "ISA.53.5",
      "JHN.1.1",
      "1CO.14.34",
      "REV.13.18",
    ]);
    expect(Object.keys(rows[4] ?? {})).toEqual(["verse_id", "status", "decision", "rating", "reason", "updated_at"]);
    expect(rows[4]).toMatchObject({ status: "human_reviewed", decision: "approved", rating: 4 });

    exportReviewState(t.db, t.reviewDir);
    expect(readFileSync(first.file, "utf8")).toBe(bytes);
  });
});

describe("schema migration", () => {
  it("adds review_state.decision and the adversary_flags contract additively, and is idempotent", () => {
    const { t } = setup();
    expect([...tableColumns(t.db, "review_state")]).toEqual([
      "verse_id",
      "status",
      "rating",
      "reason",
      "updated_at",
      "decision",
    ]);
    expect([...tableColumns(t.db, "adversary_flags")]).toEqual([
      "verse_id",
      "claim_id",
      "verdict",
      "severity",
      "note",
      "model",
      "created_at",
    ]);
    const pk = t.db
      .prepare("SELECT name FROM pragma_table_info('adversary_flags') WHERE pk > 0 ORDER BY pk")
      .all()
      .map((row) => row["name"]);
    expect(pk).toEqual(["verse_id", "claim_id", "model"]);
    expect(ADVERSARY_FLAGS_DDL).toContain("CREATE TABLE IF NOT EXISTS");

    migrateReviewSchema(t.db);
    migrateReviewSchema(t.db);
    expect(tableColumns(t.db, "review_state").size).toBe(6);
  });
});
