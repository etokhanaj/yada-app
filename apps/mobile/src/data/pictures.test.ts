import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Read as text: the generated file requires JPEGs, which only Metro resolves.
const generated = readFileSync(join(__dirname, "pictures.generated.ts"), "utf8");
const entries = [...generated.matchAll(/\{ day: (\d+), part: "(morning|evening)"/gu)].map((m) => `${m[1]}-${m[2]}`);

describe("the day's pictures (pictures-plan.md: 30 morning and 30 evening)", () => {
  it("has a morning and an evening picture for every day of the month, once each", () => {
    for (let day = 1; day <= 30; day += 1) {
      expect(entries.filter((e) => e === `${day}-morning`)).toHaveLength(1);
      expect(entries.filter((e) => e === `${day}-evening`)).toHaveLength(1);
    }
    expect(entries).toHaveLength(60);
  });
});
