import { describe, expect, it } from "vitest";

import { aboutMinutes, breathSplit, stepLine, timeLeft, wordAtLocation, wordSpans } from "./sit";

const PSALM_46_10 = "Be still, and know that I am God; I will be exalted among the nations, I will be exalted over the earth.";

describe("Breathe the verse (PR-04)", () => {
  it("breathes the first clause at its own comma, as the frame draws Psalm 46:10", () => {
    expect(breathSplit(PSALM_46_10)).toEqual(["Be still", "and know that I am God"]);
  });

  it("splits at the semicolon when the first clause has no comma to breathe at", () => {
    expect(breathSplit("The LORD is my shepherd; I shall not want and more")).toEqual(["The LORD is my shepherd;", "I shall not want and more"]);
  });

  it("skips a verse with no break, or one that would leave a scrap", () => {
    expect(breathSplit("Jesus wept.")).toBeNull();
    expect(breathSplit("He is like a tree planted by streams of water")).toBeNull();
    expect(breathSplit("Amen; so be it and more words here")).toBeNull();
  });
});

describe("the first page (PR-02)", () => {
  it("says how long Begin takes, from the steps' real timings", () => {
    expect(aboutMinutes(["settle", "breathe", "sit", "silence"], PSALM_46_10)).toBe(8);
    expect(aboutMinutes(["settle", "sit", "silence"], "Jesus wept.")).toBe(7);
  });

  it("gives each step one line", () => {
    expect(stepLine("settle")).toBe("Breathe, about 1 min");
    expect(stepLine("silence")).toBe("3, 5, 10 or 20 min");
  });
});

describe("Sit with it's read-along (PR-05)", () => {
  it("marks the word the voice is saying", () => {
    const spans = wordSpans("He is like a tree");
    expect(wordAtLocation(spans, 0)).toBe(0);
    expect(wordAtLocation(spans, 6)).toBe(2);
    expect(wordAtLocation(spans, 99)).toBeNull();
  });
});

describe("Silence (PR-06)", () => {
  it("counts down in whole minutes", () => {
    expect(timeLeft(4 * 60_000)).toBe("4 min left");
    expect(timeLeft(3 * 60_000 + 1)).toBe("4 min left");
    expect(timeLeft(40_000)).toBe("Less than a minute");
  });
});
