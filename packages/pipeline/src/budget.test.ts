import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * The gate is the one thing in this repo that must not be wrong, so it is
 * tested without a network and without a key: every test here would pass
 * identically on a machine that has never had API credentials.
 */

let tempDir: string;

vi.mock("./paths.js", async () => {
  const actual = await vi.importActual<typeof import("./paths.js")>("./paths.js");
  return { ...actual, get CONTENT() { return tempDir; } };
});

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "yada-budget-"));
  vi.resetModules();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

async function budget() {
  return await import("./budget.js");
}

describe("the spend gate", () => {
  it("prices without the batch discount, because this sample is not batched", async () => {
    const { priceUsage } = await budget();
    // Opus 5: $5/M input, $25/M output. 1M in + 1M out = $30 undiscounted.
    expect(priceUsage("claude-opus-5", 1_000_000, 1_000_000)).toBeCloseTo(30, 5);
  });

  it("refuses a model it has no published rate for", async () => {
    const { priceUsage } = await budget();
    expect(() => priceUsage("claude-imaginary-9", 1, 1)).toThrow(/no published rate/);
  });

  it("starts from zero when nothing has been spent", async () => {
    const { spentSoFar } = await budget();
    expect(spentSoFar()).toBe(0);
  });

  it("accumulates spend across recorded requests", async () => {
    const { recordUsage, spentSoFar } = await budget();
    for (const cost of [1.5, 2.25]) {
      recordUsage({
        at: "2026-08-17T00:00:00Z", model: "claude-opus-5", pericope_id: "GEN.1.1-1.5",
        verses: 5, input_tokens: 100, output_tokens: 200, thinking_tokens: 50, cost_usd: cost,
      });
    }
    expect(spentSoFar()).toBeCloseTo(3.75, 5);
  });

  it("allows a request that fits under the ceiling", async () => {
    const { assertWithinCeiling } = await budget();
    expect(() => assertWithinCeiling("claude-opus-5", 10_000, 40_000)).not.toThrow();
  });

  it("refuses a single request that would cross the ceiling on its own", async () => {
    const { assertWithinCeiling, BudgetExceeded } = await budget();
    // 5M output tokens on Opus is $125, over the $100 lifetime ceiling.
    expect(() => assertWithinCeiling("claude-opus-5", 1000, 5_000_000)).toThrow(BudgetExceeded);
  });

  it("refuses a request that only crosses the ceiling once prior spend is counted", async () => {
    const { assertWithinCeiling, recordUsage, BudgetExceeded } = await budget();
    recordUsage({
      at: "2026-08-17T00:00:00Z", model: "claude-opus-5", pericope_id: "prior",
      verses: 1, input_tokens: 1, output_tokens: 1, thinking_tokens: 0, cost_usd: 99.5,
    });
    // On its own this is about $1; against $99.50 already spent it crosses $100.
    expect(() => assertWithinCeiling("claude-opus-5", 1000, 40_000)).toThrow(BudgetExceeded);
  });

  it("prices the ceiling check against max_tokens, not a hoped-for length", async () => {
    const { assertWithinCeiling } = await budget();
    // The worst case is what is checked: the same request priced at its real
    // (unknown, smaller) output would pass, and that is exactly the reasoning
    // that lets a runaway loop through.
    expect(() => assertWithinCeiling("claude-opus-5", 1000, 4_100_000)).toThrow();
  });

  it("never writes the key anywhere, and says so when it is absent", async () => {
    const { requireApiKey, MissingApiKey } = await budget();
    const saved = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];
    try {
      expect(() => requireApiKey()).toThrow(MissingApiKey);
    } finally {
      if (saved !== undefined) process.env["ANTHROPIC_API_KEY"] = saved;
    }
  });

  it("treats an empty key as missing rather than sending an unauthenticated request", async () => {
    const { requireApiKey, MissingApiKey } = await budget();
    const saved = process.env["ANTHROPIC_API_KEY"];
    process.env["ANTHROPIC_API_KEY"] = "   ";
    try {
      expect(() => requireApiKey()).toThrow(MissingApiKey);
    } finally {
      if (saved === undefined) delete process.env["ANTHROPIC_API_KEY"];
      else process.env["ANTHROPIC_API_KEY"] = saved;
    }
  });
});
