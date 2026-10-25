import { BOOK_CODES } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { ALL_NEEDS, MORE_NEEDS, PRAYER_NEEDS, PRAYERS_OF_THE_BIBLE, prayerLength, prayerRef, prayersFor } from "./prayersOfTheBible";

describe("Prayers of the Bible (PR-08)", () => {
  it("writes each reference as the frame does", () => {
    expect(prayerRef({ title: "", need: "Every day", book: "MAT", chapter: 6, from: 9, to: 13 })).toBe("Matthew 6:9–13");
    expect(prayerRef({ title: "", need: "Trust", book: "PSA", chapter: 51, from: 1, to: 1 })).toBe("Psalm 51:1");
  });

  // John approved 39 on 18 Oct 2026 and 10 on 25 Oct 2026 (docs/review-2026-10-18-henry-prayers.md,
  // docs/review-2026-10-25-naves-needs.md); an entry added or lost here is not his.
  it("holds the 49 John approved, each once", () => {
    expect(PRAYERS_OF_THE_BIBLE).toHaveLength(49);
    expect(new Set(PRAYERS_OF_THE_BIBLE.map((p) => `${p.book}.${p.chapter}.${p.from}`)).size).toBe(49);
  });

  // Whatever John approves must open somewhere real: every one of the 39 sits inside one chapter.
  // Bible order, as the list shows them (PT-43).
  it("keeps them in Bible order", () => {
    const order = Object.keys(BOOK_CODES);
    const keys = PRAYERS_OF_THE_BIBLE.map((p) => order.indexOf(p.book) * 1e6 + p.chapter * 1e3 + p.from);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
  });

  it("holds only titled passages inside one chapter of a real book", () => {
    for (const p of PRAYERS_OF_THE_BIBLE) {
      expect(p.title.trim()).not.toBe("");
      expect(p.chapter).toBeGreaterThanOrEqual(1);
      expect(p.chapter).toBeLessThanOrEqual(BOOK_CODES[p.book].chapters);
      expect(p.from).toBeGreaterThanOrEqual(1);
      expect(p.to).toBeGreaterThanOrEqual(p.from);
    }
  });

  // PT-42: the Lord's Prayer alone leads as Every day, and every need John approved has prayers in it.
  it("gives every prayer a need, and every need some prayers", () => {
    expect(PRAYERS_OF_THE_BIBLE.filter((p) => p.need === "Every day").map((p) => p.title)).toEqual(["The Lord’s Prayer"]);
    for (const need of [...PRAYER_NEEDS, ...MORE_NEEDS]) expect(PRAYERS_OF_THE_BIBLE.filter((p) => p.need === need).length).toBeGreaterThan(0);
  });

  // BN-30, BN-31: every need is listed with the prayers it holds; together they are all but the Lord's Prayer.
  it("finds each need's prayers and their lengths", () => {
    expect(ALL_NEEDS.reduce((n, need) => n + prayersFor(need).length, 0)).toBe(PRAYERS_OF_THE_BIBLE.length - 1);
    expect(prayersFor("Afraid").map(({ prayer }) => prayer.title)[0]).toBe("Jacob before meeting Esau");
    expect(prayerLength({ title: "", need: "Afraid", book: "GEN", chapter: 32, from: 9, to: 12 })).toBe("4 verses");
    expect(prayerLength({ title: "", need: "Afraid", book: "MAT", chapter: 26, from: 39, to: 39 })).toBe("1 verse");
  });
});
