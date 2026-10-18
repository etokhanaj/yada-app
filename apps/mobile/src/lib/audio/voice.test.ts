import { describe, expect, it } from "vitest";

import { playerMenu, speedMenu } from "./voice";

describe("speedMenu", () => {
  it("lists the speeds with the current one ticked, and nothing else (John, 13 Oct 2026)", () => {
    const menu = speedMenu(1.25);
    expect(menu.map((s) => s.title)).toEqual(["Speed"]);
    expect(menu[0]?.subtitle).toBe("1.25×");
    expect(menu[0]?.rows.map((r) => [r.title, r.on])).toEqual([
      ["0.8×", false],
      ["1×", false],
      ["1.25×", true],
      ["1.5×", false],
    ]);
  });
});

describe("playerMenu (LB-01, LB-02, LB-05, LB-07)", () => {
  const place = { verse: "1:5", passage: "1:1–18", chapter: "John 1", passageEnd: "1:18", chapterEnd: "1:51" };

  it("has Speed, Stop playing and Repeat, each showing its setting", () => {
    const menu = playerMenu(1, null, null, place, 0);
    expect(menu.map((s) => [s.title, s.subtitle])).toEqual([
      ["Speed", "1×"],
      ["Stop playing", "Off"],
      ["Repeat", "Off"],
    ]);
  });

  it("names where each break falls, and ticks Off", () => {
    const stop = playerMenu(1, null, null, place, 0)[1];
    expect(stop?.rows.map((r) => [r.title, r.subtitle ?? null, r.on])).toEqual([
      ["End of this passage", "After 1:18", false],
      ["End of this chapter", "After 1:51", false],
      ["In 15 minutes", null, false],
      ["In 30 minutes", null, false],
      ["In 1 hour", null, false],
      ["Off", null, true],
    ]);
  });

  it("a running timer shows what is left and ticks no time", () => {
    const stop = playerMenu(1, { kind: "time", until: 27 * 60_000 }, null, place, 0)[1];
    expect(stop?.subtitle).toBe("In 27 min");
    expect(stop?.rows.filter((r) => r.on)).toEqual([]);
  });

  it("repeating a verse offers only the times (LB-07)", () => {
    const menu = playerMenu(1, null, "verse", place, 0);
    expect(menu[1]?.rows.map((r) => r.title)).toEqual(["In 15 minutes", "In 30 minutes", "In 1 hour", "Off"]);
    expect(menu[2]?.subtitle).toBe("This verse");
  });

  it("offers the end of this evening's psalms while one of them plays, and calls a psalm a psalm (DR-08)", () => {
    const psalm8 = { verse: "8:5", passage: null, chapter: "Psalm 8", passageEnd: null, chapterEnd: "8:9", psalm: true, set: { part: "evening", psalm: 8, to: null } } as const;
    const stop = playerMenu(1, null, null, psalm8, 0)[1];
    expect(stop?.rows.slice(0, 2).map((r) => [r.title, r.subtitle])).toEqual([
      ["End of this evening’s psalms", "After Psalm 8"],
      ["End of this psalm", "After 8:9"],
    ]);
    const set = playerMenu(1, { kind: "set", part: "evening", psalm: 8, to: null }, null, psalm8, 0)[1];
    expect(set?.subtitle).toBe("End of this evening’s psalms");
    expect(set?.rows[0]?.on).toBe(true);
  });

  it("a book with no passages has no passage rows (US-02)", () => {
    const menu = playerMenu(1, null, null, { ...place, passage: null, passageEnd: null }, 0);
    expect(menu[1]?.rows.map((r) => r.title)).not.toContain("End of this passage");
    expect(menu[2]?.rows.map((r) => r.title)).toEqual(["This verse", "This chapter", "Off"]);
  });
});
