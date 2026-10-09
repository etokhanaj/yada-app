import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

import { maxTokensFor, generatePericope } from "./submit.js";
import { RAW } from "./paths.js";

const HAVE_SOURCES = existsSync(path.join(RAW, "TBESG.txt"));
const describeIfIngested = HAVE_SOURCES ? describe : describe.skip;

/**
 * A client that answers the token count and then explodes if anything tries to
 * generate. The point of the no-confirm test is that `stream` is never reached,
 * so a silent pass would be worthless — this makes reaching it a loud failure.
 */
function refusingClient(inputTokens = 5000): any {
  return {
    messages: {
      countTokens: async () => ({ input_tokens: inputTokens }),
      stream: () => {
        throw new Error("stream() was called — the confirm gate did not hold");
      },
    },
  };
}

describe("max_tokens", () => {
  it("scales with verse count and keeps a fixed head-room", () => {
    expect(maxTokensFor(0)).toBe(24000);
    expect(maxTokensFor(15)).toBe(84000);
    expect(maxTokensFor(15)).toBeGreaterThan(maxTokensFor(5));
  });
});

describeIfIngested("submission", () => {
  const pericope = { id: "GEN.1.1-1.5", label: "The first day" };

  it("sends nothing without --confirm", async () => {
    await expect(
      generatePericope("GEN", pericope, "claude-opus-5", {
        confirm: false,
        client: refusingClient(),
      }),
    ).rejects.toThrow(/--confirm not given/);
  });

  it("checks the ceiling before it checks confirm, so an oversized run stops either way", async () => {
    // 6M input tokens on Opus is $30 before a single output token. The confirm
    // flag must not be the only thing standing between a mistake and the bill.
    await expect(
      generatePericope("GEN", pericope, "claude-opus-5", {
        confirm: true,
        client: refusingClient(6_000_000),
      }),
    ).rejects.toThrow(/refusing to submit/);
  });

  it("refuses a pericope that has no tokens in staging.db", async () => {
    await expect(
      generatePericope("GEN", { id: "GEN.99.1-99.2", label: "nowhere" }, "claude-opus-5", {
        confirm: true,
        client: refusingClient(),
      }),
    ).rejects.toThrow(/no tokens in staging.db|does not parse/);
  });
});
