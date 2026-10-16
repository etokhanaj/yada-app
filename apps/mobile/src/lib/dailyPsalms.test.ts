import { describe, expect, it } from "vitest";

import { PSALTER, label, nextInSet, parsePsalter, setFor, setForChoice } from "./dailyPsalms";
import { psalmForDay } from "./reminder";

const L = (m: number, d: number, p: "morning" | "evening", y = 2026) => label(setFor(new Date(y, m - 1, d), p));

describe("the 1662 Psalter by day", () => {
  it("day 1 reads 1-5 in the morning and 6-8 in the evening", () => {
    expect(L(1, 1, "morning")).toBe("Psalms 1–5");
    expect(L(1, 1, "evening")).toBe("Psalms 6–8");
  });
  it("day 30 ends the Psalter at 150", () => {
    expect(L(4, 30, "morning")).toBe("Psalms 144–146");
    expect(L(4, 30, "evening")).toBe("Psalms 147–150");
  });
  it("repeats day 30 on the 31st", () => {
    expect(setFor(new Date(2026, 0, 31), "morning")).toEqual(setFor(new Date(2026, 0, 30), "morning"));
    expect(setFor(new Date(2026, 9, 31), "evening")).toEqual(setFor(new Date(2026, 9, 30), "evening"));
  });
  it("reads only to the 28th or 29th in February", () => {
    expect(setFor(new Date(2026, 1, 28), "morning")).toBe(PSALTER[27]!.morning);
    expect(setFor(new Date(2028, 1, 29), "evening")).toBe(PSALTER[28]!.evening);
    expect(L(3, 1, "morning")).toBe("Psalms 1–5");
  });
  it("splits Psalm 119 by the printed sections", () => {
    expect(L(1, 24, "evening")).toBe("Psalm 119:1–32");
    expect(L(1, 25, "morning")).toBe("Psalm 119:33–72");
    expect(L(1, 25, "evening")).toBe("Psalm 119:73–104");
    expect(L(1, 26, "morning")).toBe("Psalm 119:105–144");
    expect(L(1, 26, "evening")).toBe("Psalm 119:145–176");
  });
  it("covers every psalm exactly once and Psalm 119 verses 1-176 without a gap", () => {
    const all = PSALTER.flatMap((d) => [...d.morning, ...d.evening]);
    expect([...new Set(all.map((r) => r.psalm))].sort((a, b) => a - b)).toEqual(Array.from({ length: 150 }, (_, i) => i + 1));
    const r119 = all.filter((r) => r.psalm === 119);
    expect(r119[0]!.from).toBe(1);
    for (let i = 1; i < r119.length; i++) expect(r119[i]!.from).toBe(r119[i - 1]!.to! + 1);
    expect(r119.at(-1)!.to).toBe(176);
  });
});

describe("Settings › Daily psalms (DR-04) and next in the set (DR-02)", () => {
  const d = new Date(2026, 9, 15); // psalter day 15: morning 75–77, evening 78
  it("reads the stored choice, 1662 by default", () => {
    expect(parsePsalter(undefined)).toBe("1662");
    expect(parsePsalter("one")).toBe("one");
    expect(parsePsalter("nonsense")).toBe("1662");
  });
  it("gives the set for each choice", () => {
    expect(setForChoice(d, "morning", "1662")).toEqual(setFor(d, "morning"));
    expect(setForChoice(d, "evening", "one")).toEqual([{ psalm: psalmForDay(d) }]);
    expect(setForChoice(d, "morning", "off")).toBeNull();
  });
  it("names the next psalm in the set, and none after the last", () => {
    const set = setFor(d, "morning");
    expect(nextInSet(set, 75)).toEqual({ psalm: 76 });
    expect(nextInSet(set, 77)).toBeNull();
    expect(nextInSet(set, 1)).toBeNull();
  });
});
