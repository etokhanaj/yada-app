import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { VerseEntry } from "@yada/schema";


/**
 * The adversary spends money, so it is held to the same standard as the
 * generation gate: every test here passes on a machine that has never had an
 * API key, with no network. usage.jsonl is redirected to a temp directory so
 * the ceiling can be pushed to its edge without touching real spend records.
 */

let tempDir: string;

vi.mock("./paths.js", async () => {
  const actual = await vi.importActual<typeof import("./paths.js")>("./paths.js");
  return { ...actual, get CONTENT() { return tempDir; } };
});

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "yada-adversary-"));
  vi.resetModules();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

async function load() {
  const adversary = await import("./adversary.js");
  const budget = await import("./budget.js");
  const staging = await import("./test-staging.js");
  const store = await import("./store.js");
  return { ...adversary, ...budget, ...staging, ...store };
}

function verdictsFor(entry: VerseEntry, contested: Record<string, [string, string]> = {}): string {
  return JSON.stringify({
    verse_id: entry.verse_id,
    verdicts: entry.claims.map((c) => {
      const [verdict, severity] = contested[c.id] ?? ["upheld", "none"];
      return { claim_id: c.id, verdict, severity, note: "checked against the supplied tokens", alternative: null };
    }),
  });
}

/** Answers count_tokens, and either returns `text` or explodes on stream(). */
function fakeClient(options: { inputTokens?: number; text?: string; stop?: string } = {}) {
  const calls = { count: 0, stream: 0 };
  const client: any = {
    messages: {
      countTokens: async () => {
        calls.count += 1;
        return { input_tokens: options.inputTokens ?? 5000 };
      },
      stream: () => {
        calls.stream += 1;
        if (options.text === undefined) throw new Error("stream() was called — the gate did not hold");
        return {
          finalMessage: async () => ({
            content: [{ type: "text", text: options.text }],
            usage: { input_tokens: 5000, output_tokens: 1200, output_tokens_details: { thinking_tokens: 300 } },
            stop_reason: options.stop ?? "end_turn",
          }),
        };
      },
    },
  };
  return { client, calls };
}

describe("parsing verdicts", () => {
  it("accepts one verdict per claim", async () => {
    const { parseAdversaryResponse, loadGolden } = await load();
    const entry = loadGolden("1co.14.34");
    const parsed = parseAdversaryResponse(verdictsFor(entry), entry.verse_id, entry.claims.map((c) => c.id));
    expect(parsed.ok).toBe(true);
  });

  it("rejects the whole response when a claim is missing, invented, or duplicated", async () => {
    const { parseAdversaryResponse, loadGolden } = await load();
    const entry = loadGolden("1co.14.34");
    const ids = entry.claims.map((c) => c.id);
    const body = JSON.parse(verdictsFor(entry)) as { verdicts: Array<Record<string, unknown>> };
    body.verdicts.pop();
    body.verdicts.push({ claim_id: "1CO.14.34.c99", verdict: "upheld", severity: "none", note: "x" });
    const parsed = parseAdversaryResponse(JSON.stringify({ ...body, verse_id: entry.verse_id }), entry.verse_id, ids);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.problems.join(" ")).toMatch(/unknown claim id "1CO.14.34.c99"/);
      expect(parsed.problems.join(" ")).toMatch(/no verdict for 1CO.14.34.c9/);
    }
  });

  it("rejects upheld-with-severity and contested-without-severity", async () => {
    const { parseAdversaryResponse, loadGolden } = await load();
    const entry = loadGolden("1co.14.34");
    const ids = entry.claims.map((c) => c.id);
    const text = verdictsFor(entry, { "1CO.14.34.c1": ["upheld", "critical"], "1CO.14.34.c2": ["compound", "none"] });
    const parsed = parseAdversaryResponse(text, entry.verse_id, ids);
    expect(parsed.ok).toBe(false);
  });

  it("rejects a verdict outside the contract's enum", async () => {
    const { parseAdversaryResponse, loadGolden } = await load();
    const entry = loadGolden("1co.14.34");
    const text = verdictsFor(entry, { "1CO.14.34.c1": ["wrong", "minor"] });
    expect(parseAdversaryResponse(text, entry.verse_id, entry.claims.map((c) => c.id)).ok).toBe(false);
  });
});

describe("the adversary request", () => {
  it("carries the prompt, every claim id, and source data for the verses the claims cite", async () => {
    const { tempStaging, seed1Co1434, buildAdversaryRequest } = await load();
    const staging = tempStaging();
    try {
      const entry = seed1Co1434(staging.db);
      const request = buildAdversaryRequest(staging.db, entry);
      expect(request.body).toMatch(/adversary@1\.0\.0/);
      for (const claim of entry.claims) expect(request.body).toContain(claim.id);
      expect(request.body).toMatch(/1CO\.14\.35\tἄνδρας\|ἀνήρ\|X\|G0435/);
      expect(request.body).toMatch(/1CO\.11\.5\t/);
    } finally {
      staging.cleanup();
    }
  });
});

describe("the adversary gate", () => {
  it("sends nothing without --confirm", async () => {
    const { tempStaging, seed1Co1434, buildAdversaryRequest, attackEntry, spentSoFar } = await load();
    const staging = tempStaging();
    try {
      const request = buildAdversaryRequest(staging.db, seed1Co1434(staging.db));
      const { client, calls } = fakeClient();
      await expect(attackEntry(request, "claude-sonnet-5", { confirm: false, client })).rejects.toThrow(/--confirm not given/);
      expect(calls.stream).toBe(0);
      expect(spentSoFar()).toBe(0);
    } finally {
      staging.cleanup();
    }
  });

  it("refuses without a key, before constructing a client", async () => {
    const { tempStaging, seed1Co1434, buildAdversaryRequest, attackEntry, MissingApiKey } = await load();
    const staging = tempStaging();
    const saved = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];
    try {
      const request = buildAdversaryRequest(staging.db, seed1Co1434(staging.db));
      await expect(attackEntry(request, "claude-sonnet-5", { confirm: true })).rejects.toThrow(MissingApiKey);
    } finally {
      if (saved !== undefined) process.env["ANTHROPIC_API_KEY"] = saved;
      staging.cleanup();
    }
  });

  it("respects the ceiling even with --confirm, counting spend from other stages", async () => {
    const { tempStaging, seed1Co1434, buildAdversaryRequest, attackEntry, recordUsage, BudgetExceeded } = await load();
    const staging = tempStaging();
    try {
      recordUsage({
        at: "2026-09-13T00:00:00Z", model: "claude-opus-5", pericope_id: "prior", verses: 1,
        input_tokens: 1, output_tokens: 1, thinking_tokens: 0, cost_usd: (await import("./budget.js")).CEILING_USD - 0.05, stage: "generate",
      });
      const request = buildAdversaryRequest(staging.db, seed1Co1434(staging.db));
      const { client, calls } = fakeClient();
      await expect(attackEntry(request, "claude-sonnet-5", { confirm: true, client })).rejects.toThrow(BudgetExceeded);
      expect(calls.stream).toBe(0);
    } finally {
      staging.cleanup();
    }
  });

  it("logs the worst case when the stream dies, so the ceiling still counts it", async () => {
    const { tempStaging, seed1Co1434, buildAdversaryRequest, attackEntry, maxAdversaryTokens, priceUsage, spentSoFar } =
      await load();
    const staging = tempStaging();
    try {
      const request = buildAdversaryRequest(staging.db, seed1Co1434(staging.db));
      const client: any = {
        messages: {
          countTokens: async () => ({ input_tokens: 5000 }),
          stream: () => ({ finalMessage: () => Promise.reject(new Error("socket hang up")) }),
        },
      };
      await expect(attackEntry(request, "claude-sonnet-5", { confirm: true, client })).rejects.toThrow(/socket hang up/);
      const worst = priceUsage("claude-sonnet-5", 5000, maxAdversaryTokens(request.claimIds.length));
      expect(spentSoFar()).toBeCloseTo(worst, 6);
    } finally {
      staging.cleanup();
    }
  });

  it("stops the run at the ceiling rather than skipping ahead", async () => {
    const { tempStaging, seed1Co1434, storeVerseEntry, runAdversary, recordUsage } = await load();
    const staging = tempStaging();
    try {
      storeVerseEntry(staging.db, seed1Co1434(staging.db), "flagged");
      recordUsage({
        at: "2026-09-13T00:00:00Z", model: "claude-opus-5", pericope_id: "prior", verses: 1,
        input_tokens: 1, output_tokens: 1, thinking_tokens: 0, cost_usd: (await import("./budget.js")).CEILING_USD - 0.01,
      });
      const { client, calls } = fakeClient();
      const run = await runAdversary(staging.db, "1CO", "claude-sonnet-5", { confirm: true, client });
      expect(run.stoppedOn?.error).toMatch(/refusing to submit/);
      expect(calls.stream).toBe(0);
      expect(staging.db.prepare("SELECT * FROM adversary_flags").all()).toEqual([]);
    } finally {
      staging.cleanup();
    }
  });
});

describe("a confirmed adversary run", () => {
  it("writes one verdict row per claim, re-flags a contested entry, records usage, and reports the 0C bar", async () => {
    const { tempStaging, seed1Co1434, storeVerseEntry, runAdversary, disagreement, spentSoFar } = await load();
    const staging = tempStaging();
    try {
      const entry = seed1Co1434(staging.db);
      storeVerseEntry(staging.db, entry, "flagged");
      staging.db.prepare("UPDATE review_state SET status = 'auto_passed'").run();

      const text = verdictsFor(entry, { "1CO.14.34.c7": ["overclaimed", "critical"] });
      const { client } = fakeClient({ text });
      const responsesDir = path.join(tempDir, "adversary");
      const run = await runAdversary(staging.db, "1CO", "claude-sonnet-5", { confirm: true, client, responsesDir });

      expect(run.sent).toBe(1);
      expect(run.unusable).toEqual([]);
      expect(staging.db.prepare("SELECT COUNT(*) AS n FROM adversary_flags").get()?.["n"]).toBe(entry.claims.length);
      const state = staging.db.prepare("SELECT status, reason FROM review_state").get();
      // auto_passed is a machine judgment; a second machine disagreeing sends it to a human.
      expect(state?.["status"]).toBe("flagged");
      expect(String(state?.["reason"])).toMatch(/1CO\.14\.34\.c7 overclaimed\/critical/);
      expect(spentSoFar()).toBeGreaterThan(0);
      expect(readdirSync(responsesDir)).toEqual(["1CO.14.34.claude-sonnet-5.json"]);

      const bar = disagreement(staging.db, "1CO", "claude-sonnet-5");
      expect(bar.contested).toBe(1);
      expect(bar.critical).toBe(1);
      expect(bar.rate).toBeCloseTo(1 / 9, 5);
      expect(bar.meetsBar).toBe(false);
    } finally {
      staging.cleanup();
    }
  });

  it("never promotes: an all-upheld entry keeps its flagged status", async () => {
    const { tempStaging, seed1Co1434, storeVerseEntry, runAdversary, disagreement } = await load();
    const staging = tempStaging();
    try {
      const entry = seed1Co1434(staging.db);
      storeVerseEntry(staging.db, entry, "flagged", "original reason");
      const { client } = fakeClient({ text: verdictsFor(entry) });
      await runAdversary(staging.db, "1CO", "claude-sonnet-5", { confirm: true, client, responsesDir: tempDir });
      expect(staging.db.prepare("SELECT status, reason FROM review_state").get()).toEqual({ status: "flagged", reason: "original reason" });
      expect(disagreement(staging.db, "1CO", "claude-sonnet-5").meetsBar).toBe(true);
    } finally {
      staging.cleanup();
    }
  });

  it("does not overwrite a human decision, but stores the verdicts for the reviewer", async () => {
    const { tempStaging, seed1Co1434, storeVerseEntry, runAdversary } = await load();
    const staging = tempStaging();
    try {
      const entry = seed1Co1434(staging.db);
      storeVerseEntry(staging.db, entry, "human_reviewed");
      const { client } = fakeClient({ text: verdictsFor(entry, { "1CO.14.34.c1": ["unsupported", "minor"] }) });
      const run = await runAdversary(staging.db, "1CO", "claude-sonnet-5", { confirm: true, client, responsesDir: tempDir });
      expect(run.humanDecisionsKept).toEqual([entry.verse_id]);
      expect(staging.db.prepare("SELECT status FROM review_state").get()?.["status"]).toBe("human_reviewed");
      expect(staging.db.prepare("SELECT COUNT(*) AS n FROM adversary_flags WHERE verdict != 'upheld'").get()?.["n"]).toBe(1);
    } finally {
      staging.cleanup();
    }
  });

  it("is resumable: an entry already judged by this model is not paid for twice", async () => {
    const { tempStaging, seed1Co1434, storeVerseEntry, runAdversary } = await load();
    const staging = tempStaging();
    try {
      const entry = seed1Co1434(staging.db);
      storeVerseEntry(staging.db, entry, "flagged");
      const { client, calls } = fakeClient({ text: verdictsFor(entry) });
      await runAdversary(staging.db, "1CO", "claude-sonnet-5", { confirm: true, client, responsesDir: tempDir });
      const again = await runAdversary(staging.db, "1CO", "claude-sonnet-5", { confirm: true, client, responsesDir: tempDir });
      expect(calls.stream).toBe(1);
      expect(again.skipped).toBe(1);
    } finally {
      staging.cleanup();
    }
  });

  it("treats a truncated response as unusable: no verdict rows, entry flagged with the reason", async () => {
    const { tempStaging, seed1Co1434, storeVerseEntry, runAdversary } = await load();
    const staging = tempStaging();
    try {
      const entry = seed1Co1434(staging.db);
      storeVerseEntry(staging.db, entry, "flagged");
      const { client } = fakeClient({ text: verdictsFor(entry), stop: "max_tokens" });
      const run = await runAdversary(staging.db, "1CO", "claude-sonnet-5", { confirm: true, client, responsesDir: tempDir });
      expect(run.unusable).toHaveLength(1);
      expect(staging.db.prepare("SELECT * FROM adversary_flags").all()).toEqual([]);
      expect(String(staging.db.prepare("SELECT reason FROM review_state").get()?.["reason"])).toMatch(/unusable.*max_tokens/);
    } finally {
      staging.cleanup();
    }
  });
});

describe("adversary --dry-run", () => {
  it("writes requests and needs neither a key nor a client", async () => {
    const { tempStaging, seed1Co1434, storeVerseEntry, adversaryDryRun } = await load();
    const staging = tempStaging();
    const saved = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];
    try {
      storeVerseEntry(staging.db, seed1Co1434(staging.db), "flagged");
      const out = path.join(tempDir, "requests");
      const requests = adversaryDryRun(staging.db, "1CO", out);
      expect(requests).toHaveLength(1);
      expect(existsSync(path.join(out, "1CO.14.34.json"))).toBe(true);
    } finally {
      if (saved !== undefined) process.env["ANTHROPIC_API_KEY"] = saved;
      staging.cleanup();
    }
  });
});
