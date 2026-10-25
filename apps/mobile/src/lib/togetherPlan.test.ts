import { describe, expect, it } from "vitest";

import { nextPlace, packPlace, roundOrder, unpackPlace } from "./togetherPlan";

describe("Pray together's shared place (PC-36 to PC-38)", () => {
  it("packs and unpacks what is prayed, which prayer and the step", () => {
    for (const p of [
      { mode: "choose", choice: 0, index: 0 },
      { mode: "requests", choice: 0, index: 3 },
      { mode: "round", choice: 0, index: 1 },
      { mode: "prayer", choice: 12, index: 4 },
      { mode: "end", choice: 0, index: 0 },
    ] as const)
      expect(unpackPlace(packPlace(p))).toEqual(p);
  });

  it("reads a Build 11 phone's plain index as the requests", () => {
    expect(unpackPlace(2)).toEqual({ mode: "requests", choice: 0, index: 2 });
    expect(unpackPlace(0)).toEqual({ mode: "choose", choice: 0, index: 0 });
  });

  it("goes round everyone here once, in the same order on every phone", () => {
    expect(roundOrder(["c", "a", "b", "a"])).toEqual(["a", "b", "c"]);
  });

  it("ends after the last step", () => {
    expect(nextPlace({ mode: "round", choice: 0, index: 1 }, 3)).toEqual({ mode: "round", choice: 0, index: 2 });
    expect(nextPlace({ mode: "round", choice: 0, index: 2 }, 3)).toEqual({ mode: "end", choice: 0, index: 0 });
  });
});
