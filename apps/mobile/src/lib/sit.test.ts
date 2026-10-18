import { describe, expect, it } from "vitest";

import { breathSplit } from "./sit";

describe("Breathe the verse (PR-04)", () => {
  it("splits only at the verse's own break", () => {
    expect(breathSplit("Be still, and know that I am God; I will be exalted among the nations, I will be exalted over the earth.")).toEqual([
      "Be still, and know that I am God;",
      "I will be exalted among the nations, I will be exalted over the earth.",
    ]);
  });

  it("skips a verse with no break, or one that would leave a scrap", () => {
    expect(breathSplit("Jesus wept.")).toBeNull();
    expect(breathSplit("He is like a tree planted by streams of water")).toBeNull();
    expect(breathSplit("Amen; so be it and more words here")).toBeNull();
  });
});
