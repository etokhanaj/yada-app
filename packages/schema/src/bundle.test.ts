import { describe, expect, it } from "vitest";

import {
  BundleInfoSchema,
  decodeMorphemes,
  encodeMorphemes,
  ordToParts,
  verseOrd,
  type BundleMorpheme,
} from "./bundle.js";

describe("verse ordering", () => {
  it("orders across books, chapters and verses as integers", () => {
    expect(verseOrd("GEN", 1, 1)).toBeLessThan(verseOrd("GEN", 1, 2));
    expect(verseOrd("GEN", 1, 31)).toBeLessThan(verseOrd("GEN", 2, 1));
    expect(verseOrd("MAL", 4, 6)).toBeLessThan(verseOrd("MAT", 1, 1));
  });

  it("places a psalm superscription before verse 1", () => {
    expect(verseOrd("PSA", 23, 0)).toBeLessThan(verseOrd("PSA", 23, 1));
  });

  it("round-trips through its parts, including the longest chapter", () => {
    for (const [book, chapter, verse] of [["GEN", 1, 1], ["PSA", 119, 176], ["PSA", 51, 0], ["REV", 22, 21]] as const) {
      expect(ordToParts(verseOrd(book, chapter, verse))).toEqual({ book, chapter, verse });
    }
  });
});

describe("morpheme tuples", () => {
  const bereshit: BundleMorpheme[] = [
    { surface: "בְּ", role: "prefix", lemma_ref: "b", morph: "R", gloss: "in" },
    { surface: "רֵאשִׁ֖ית", role: "stem", lemma_ref: "7225", strongs: "H7225", morph: "Ncfsa", gloss: "beginning" },
  ];

  it("round-trips without losing a field", () => {
    expect(decodeMorphemes(encodeMorphemes(bereshit))).toEqual(bereshit);
  });

  it("keeps a gap when a middle field is absent, so positions do not shift", () => {
    // The prefix has no Strong's number but does have morph and gloss after it.
    const decoded = decodeMorphemes(encodeMorphemes(bereshit));
    expect(decoded?.[0]?.strongs).toBeUndefined();
    expect(decoded?.[0]?.morph).toBe("R");
  });

  it("is materially smaller than object JSON", () => {
    expect(encodeMorphemes(bereshit).length).toBeLessThan(JSON.stringify(bereshit).length * 0.6);
  });

  it("reads an absent value as no morphemes", () => {
    expect(decodeMorphemes(null)).toBeUndefined();
    expect(decodeMorphemes("")).toBeUndefined();
  });
});

describe("bundle manifest entries", () => {
  it("require a review gate, so an unreviewed bundle cannot pass as reviewed by omission", () => {
    const base = {
      name: "jhn", kind: "understand", book: "JHN", version: 1, file: "jhn.v1.db",
      sha256: "a".repeat(64), bytes: 1, format: 2, schema_version: "1.3.0", entries: 1,
    };
    expect(BundleInfoSchema.safeParse(base).success).toBe(false);
    expect(BundleInfoSchema.safeParse({ ...base, review_gate: "unreviewed-dev" }).success).toBe(true);
  });

  it("refuse a file that is not the bundle's own name and version, so publish cannot be pointed elsewhere", () => {
    const base = {
      name: "jhn", kind: "understand", book: "JHN", version: 3, file: "jhn.v3.db", review_gate: "reviewed",
      sha256: "a".repeat(64), bytes: 1, format: 2, schema_version: "1.3.0", entries: 1,
    };
    expect(BundleInfoSchema.safeParse(base).success).toBe(true);
    expect(BundleInfoSchema.safeParse({ ...base, name: "JHN" }).success).toBe(true);
    for (const file of ["../jhn.v3.db", "jhn.v2.db", "core.v3.db", "/etc/passwd", "jhn.v3.db/../x"]) {
      expect(BundleInfoSchema.safeParse({ ...base, file }).success).toBe(false);
    }
    expect(BundleInfoSchema.safeParse({ ...base, name: "../jhn", file: "../jhn.v3.db" }).success).toBe(false);
  });
});
