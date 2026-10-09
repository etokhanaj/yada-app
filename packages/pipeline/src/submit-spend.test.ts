import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * What submit.ts records once money may have been spent. Separate from
 * submit.test.ts because everything here runs against a temp content/ —
 * staging.db, usage.jsonl and responses — so it needs no sources, no key and
 * no network, and never touches the real spend log.
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
  tempDir = mkdtempSync(path.join(tmpdir(), "yada-submit-"));
  vi.resetModules();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const PERICOPE = { id: "GEN.1.1-1.2", label: "The first day" };

async function load() {
  const submit = await import("./submit.js");
  const budget = await import("./budget.js");
  const db = await import("./db.js");
  const staging = await import("./test-staging.js");
  const seeded = db.openStaging();
  staging.seedVerse(seeded, "GEN.1.1", [{ surface: "בְּרֵאשִׁית", lemma: "b/7225", strongs: "H7225" }]);
  staging.seedVerse(seeded, "GEN.1.2", [{ surface: "וְהָאָרֶץ", lemma: "c/d/776", strongs: "H0776" }]);
  seeded.close();
  return { ...submit, ...budget };
}

function usageLines(): Array<Record<string, unknown>> {
  const file = path.join(tempDir, "usage.jsonl");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

/** Counts tokens, opens a stream, and then either fails it or answers it. */
function streamingClient(finalMessage: () => Promise<unknown>): any {
  return {
    messages: {
      countTokens: async () => ({ input_tokens: 4000 }),
      stream: () => ({ finalMessage }),
    },
  };
}

describe("spend records", () => {
  it("logs the worst case when the stream dies, then rethrows", async () => {
    const { generatePericope, maxTokensFor, priceUsage, spentSoFar } = await load();
    const client = streamingClient(() => Promise.reject(new Error("socket hang up")));

    await expect(
      generatePericope("GEN", PERICOPE, "claude-opus-5", { confirm: true, client, stage: "regress-live" }),
    ).rejects.toThrow(/socket hang up/);

    // No usage comes back from a dead stream, but the request may have been
    // billed: the ceiling has to count the most it could have cost.
    const maxTokens = maxTokensFor(2);
    expect(usageLines()).toEqual([
      expect.objectContaining({
        model: "claude-opus-5",
        pericope_id: PERICOPE.id,
        verses: 2,
        input_tokens: 4000,
        output_tokens: maxTokens,
        thinking_tokens: 0,
        cost_usd: priceUsage("claude-opus-5", 4000, maxTokens),
        estimated: true,
        stage: "regress-live",
      }),
    ]);
    expect(spentSoFar()).toBeCloseTo(priceUsage("claude-opus-5", 4000, maxTokens), 6);
  });

  it("records real usage even when the response file cannot be written", async () => {
    const { generatePericope, priceUsage } = await load();
    const client = streamingClient(async () => ({
      content: [{ type: "text", text: "{}" }],
      usage: { input_tokens: 4000, output_tokens: 9000, output_tokens_details: { thinking_tokens: 2000 } },
      stop_reason: "end_turn",
    }));

    await expect(
      generatePericope("GEN", PERICOPE, "claude-opus-5", {
        confirm: true,
        client,
        responsesDir: path.join(tempDir, "no-such-dir"),
      }),
    ).rejects.toThrow(/ENOENT/);

    expect(usageLines()).toEqual([
      expect.objectContaining({
        output_tokens: 9000,
        thinking_tokens: 2000,
        cost_usd: priceUsage("claude-opus-5", 4000, 9000),
        stage: "generate",
      }),
    ]);
    expect(usageLines()[0]).not.toHaveProperty("estimated");
  });

  it("records nothing when it refuses before sending", async () => {
    const { generatePericope } = await load();
    const client = streamingClient(() => Promise.reject(new Error("stream reached")));
    await expect(generatePericope("GEN", PERICOPE, "claude-opus-5", { confirm: false, client })).rejects.toThrow(
      /--confirm not given/,
    );
    expect(usageLines()).toEqual([]);
  });
});
