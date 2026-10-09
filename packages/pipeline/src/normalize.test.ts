import { describe, expect, it } from "vitest";

import { duplicateKeys } from "./normalize.js";

describe("duplicateKeys", () => {
  it("names every repeat, so normalize refuses rather than letting INSERT OR REPLACE keep the last", () => {
    // Ps 51:0 lost its superscription this way: duplicate token keys, of which
    // staging kept only the second. Verse texts are held to the same rule.
    const rows = [
      { translation: "BSB", verse_id: "PSA.51.1" },
      { translation: "WEB", verse_id: "PSA.51.1" },
      { translation: "BSB", verse_id: "PSA.51.1" },
      { translation: "BSB", verse_id: "PSA.51.1" },
    ];
    expect(duplicateKeys(rows, (r) => `${r.translation} ${r.verse_id}`)).toEqual(["BSB PSA.51.1", "BSB PSA.51.1"]);
    expect(duplicateKeys(rows.slice(0, 2), (r) => `${r.translation} ${r.verse_id}`)).toEqual([]);
  });
});
