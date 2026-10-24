import { BOOK_CODES } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { PRAYER_NEEDS, PRAYERS_OF_THE_BIBLE, prayerRef } from "./prayersOfTheBible";

describe("Prayers of the Bible (PR-08)", () => {
  it("writes each reference as the frame does", () => {
    expect(prayerRef({ title: "", need: "Every day", book: "MAT", chapter: 6, from: 9, to: 13 })).toBe("Matthew 6:9–13");
    expect(prayerRef({ title: "", need: "Trust", book: "PSA", chapter: 51, from: 1, to: 1 })).toBe("Psalm 51:1");
  });

  // John approved 39 on 18 Oct 2026 (docs/review-2026-10-18-henry-prayers.md); an entry added or lost here is not his.
  it("holds the 39 John approved, each once", () => {
    expect(PRAYERS_OF_THE_BIBLE).toHaveLength(39);
    expect(new Set(PRAYERS_OF_THE_BIBLE.map((p) => `${p.book}.${p.chapter}.${p.from}`)).size).toBe(39);
  });

  // Whatever John approves must open somewhere real: every one of the 39 sits inside one chapter.
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
    for (const need of PRAYER_NEEDS) expect(PRAYERS_OF_THE_BIBLE.filter((p) => p.need === need).length).toBeGreaterThan(0);
  });
});
