import { verseOrd } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { lastLine, MOMENTS, momentNamed, opening, passageLabel, tilePassages } from "./moments";

describe("verses for a moment (VM-01 to VM-09)", () => {
  it("holds John's six moments and the 38 passages he kept, in his order", () => {
    expect(MOMENTS.map((m) => m.name)).toEqual(["Anxious", "Afraid", "Grieving", "Lonely", "Tired", "Thankful"]);
    expect(MOMENTS.flatMap((m) => m.passages)).toHaveLength(38);
    expect(momentNamed("Afraid")?.passages.some((q) => q.start === verseOrd("1JN", 4, 18))).toBe(false);
  });

  it("puts the helpline line on Anxious, Afraid, Grieving and Lonely only", () => {
    expect(MOMENTS.filter((m) => m.support).map((m) => m.name)).toEqual(["Anxious", "Afraid", "Grieving", "Lonely"]);
  });

  it("names a passage as the reader does, Psalms one at a time", () => {
    expect(passageLabel({ start: verseOrd("PHP", 4, 6), end: verseOrd("PHP", 4, 7) })).toBe("Philippians 4:6–7");
    expect(passageLabel({ start: verseOrd("PSA", 23, 1), end: verseOrd("PSA", 23, 6) })).toBe("Psalm 23:1–6");
    expect(passageLabel({ start: verseOrd("JHN", 14, 27), end: verseOrd("JHN", 14, 27) })).toBe("John 14:27");
  });

  it("shows a long passage's opening and a short one whole", () => {
    expect(opening("Cast all your anxiety on Him, because He cares for you.", 46)).toBe("Cast all your anxiety on Him, because He cares for you.");
    expect(opening("Therefore I tell you, do not worry about your life,", 5)).toBe("Therefore I tell you, do…");
  });

  it("never opens two tiles on the same passage", () => {
    const tiles = [...tilePassages().values()].map((q) => q.start);
    expect(new Set(tiles).size).toBe(6);
    const shared = tilePassages([
      { name: "A", support: false, passages: [{ start: 1, end: 1 }, { start: 2, end: 2 }] },
      { name: "B", support: false, passages: [{ start: 1, end: 1 }, { start: 3, end: 3 }] },
    ]);
    expect(shared.get("B")?.start).toBe(3);
  });

  it("says the last passage is the last, in words", () => {
    expect(lastLine(MOMENTS[4]!)).toBe("That’s all four for Tired.");
  });
});
