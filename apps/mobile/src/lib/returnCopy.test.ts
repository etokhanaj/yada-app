import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Build 10a's rule, held in code: nothing the reader sees speaks of days missed, a lost run, falling behind or restoring
// (docs/build-10-plan.md "Never used: shame"; docs/build-10-ux-pass.md). Comments may name the words they reject.
const SCREENS = [
  "app/return.tsx",
  "app/start-small.tsx",
  "app/remind-ask.tsx",
  "app/rhythm.tsx",
  "components/ChapterClose.tsx",
  "components/ChapterPages.tsx",
  "lib/lapse.ts",
];
const SHAME = /\b(missed|misses|lost|broken|falling behind|behind|restore|start over|reset)\b/iu;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "").replace(/\s\/\/ .*$/gmu, "");
}

describe("the return screens use no shame words", () => {
  for (const file of SCREENS) {
    it(file, () => {
      const code = stripComments(readFileSync(resolve(__dirname, "..", file), "utf8"));
      expect(code.match(SHAME)?.[0]).toBeUndefined();
    });
  }
});

describe("the welcome-back carries no count and no reader text", () => {
  it("is the place alone", async () => {
    const { welcomeBackTitle } = await import("./lapse");
    expect(welcomeBackTitle("Psalm 23")).not.toMatch(/day|week|month|missed/iu);
  });
});
