import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

import { normalizeHebrew } from "@yada/schema";

import { parseOshb } from "./parsers.js";
import { RAW } from "./paths.js";

const HAVE = existsSync(path.join(RAW, "Ps.xml"));
const describeIfIngested = HAVE ? describe : describe.skip;

/**
 * When two Hebrew verse elements fold into one English verse, word positions
 * must continue rather than restart. Restarting produced duplicate keys that
 * staging's INSERT OR REPLACE resolved by silently dropping words — 56 of them,
 * including the opening of Psalm 51's superscription.
 */
describeIfIngested("token positions across folded verses", () => {
  it("keeps the whole of a superscription that spans two Hebrew verses", () => {
    const { tokens } = parseOshb("Ps.xml");
    const title = tokens.filter((t) => t.verse_id === "PSA.51.0");
    // Hebrew 51:1 has 3 words ("For the director. A Psalm of David") and 51:2 has 9.
    expect(title).toHaveLength(12);
    // Compared as consonants: the source and a typed literal can store the same
    // pointed word with its combining marks in a different order, which makes
    // them unequal as strings while rendering identically.
    expect(normalizeHebrew(title[0]?.surface ?? "")).toBe("למנצח");
    expect(title.map((t) => t.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("never produces two words at the same position in any book", () => {
    for (const file of ["Ps.xml", "Gen.xml", "Exod.xml", "Lev.xml", "Num.xml", "1Kgs.xml", "Joel.xml", "Mal.xml"]) {
      const { tokens } = parseOshb(file);
      const keys = new Set(tokens.map((t) => `${t.verse_id}#${t.position}`));
      expect(keys.size, file).toBe(tokens.length);
    }
  });
});
