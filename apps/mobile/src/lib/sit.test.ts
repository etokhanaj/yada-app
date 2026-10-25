import { describe, expect, it } from "vitest";

import {
  breathAnnouncement,
  breathAt,
  breathSeconds,
  breathSplit,
  clock,
  quietSeconds,
  readSeconds,
  SIT_WORDS,
  sittable,
  timeLeft,
  wordAtLocation,
  wordSpans,
} from "./sit";

const PSALM_46_10 = "Be still, and know that I am God; I will be exalted among the nations, I will be exalted over the earth.";

describe("Breathe the verse (PR-04)", () => {
  it("breathes the first clause at its own comma, as the frame draws Psalm 46:10", () => {
    expect(breathSplit(PSALM_46_10)).toEqual(["Be still", "and know that I am God"]);
  });

  it("splits at the semicolon when the first clause has no comma to breathe at", () => {
    expect(breathSplit("The LORD is my shepherd; I shall not want and more")).toEqual(["The LORD is my shepherd;", "I shall not want and more"]);
  });

  it("never breathes a speech tag alone, so Jonah 2:4 is breathed whole at its semicolon", () => {
    expect(breathSplit("I said, ‘I have been banished from your sight; yet I will look again toward your holy temple.’")).toEqual([
      "I said, ‘I have been banished from your sight;",
      "yet I will look again toward your holy temple.’",
    ]);
  });

  it("skips a verse with no break, or one that would leave a scrap", () => {
    expect(breathSplit("Jesus wept.")).toBeNull();
    expect(breathSplit("He is like a tree planted by streams of water")).toBeNull();
    expect(breathSplit("Amen; so be it and more words here")).toBeNull();
  });
});

describe("the session's length (SW-01)", () => {
  it("reads at about two words a second, never under 8 seconds", () => {
    expect(readSeconds(PSALM_46_10)).toBe(11);
    expect(readSeconds("Jesus wept.")).toBe(8);
  });

  it("gives the quiet what is left after the breathing and both readings", () => {
    expect(breathSeconds()).toBe(60);
    expect(quietSeconds(5, PSALM_46_10)).toBe(300 - 60 - 22);
    expect(quietSeconds(10, PSALM_46_10)).toBe(600 - 60 - 22);
    expect(quietSeconds(15, "Jesus wept.")).toBe(900 - 60 - 16);
  });

  it("keeps at least a minute of quiet whatever the verse", () => {
    expect(quietSeconds(5, Array.from({ length: 400 }, () => "word").join(" "))).toBe(60);
  });
});

describe("the breathing (SW-03)", () => {
  it("counts down each half inside the orb, in for 4 and out for 6", () => {
    expect(breathAt(0)).toEqual({ phase: 0, left: 4, round: 0 });
    expect(breathAt(3)).toEqual({ phase: 0, left: 1, round: 0 });
    expect(breathAt(4)).toEqual({ phase: 1, left: 6, round: 0 });
    expect(breathAt(10)).toEqual({ phase: 0, left: 4, round: 1 });
  });

  it("holds on the last out-breath past the end", () => {
    expect(breathAt(500)).toEqual({ phase: 1, left: 1, round: 5 });
  });

  it("tells VoiceOver this half and the next", () => {
    expect(breathAnnouncement(0, 3)).toBe("Breathe in, 3 seconds. Then out for 6.");
    expect(breathAnnouncement(1, 1)).toBe("Breathe out, 1 second. Then in for 4.");
  });
});

describe("the quiet (SW-05)", () => {
  it("shows the time left as minutes and seconds", () => {
    expect(clock(134)).toBe("2:14");
    expect(clock(59.2)).toBe("1:00");
    expect(clock(-3)).toBe("0:00");
  });
});

describe("the read-along (SW-04)", () => {
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

describe("what Sit with this takes", () => {
  it("offers a verse or a short passage, not a long one or nothing", () => {
    expect(sittable("Jesus wept.")).toBe(true);
    expect(sittable(Array.from({ length: SIT_WORDS }, () => "word").join(" "))).toBe(true);
    expect(sittable(Array.from({ length: SIT_WORDS + 1 }, () => "word").join(" "))).toBe(false);
    expect(sittable("   ")).toBe(false);
  });
});
