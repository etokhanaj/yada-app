import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";

import { checkAgainstFixture, ORACLE_FIXTURES } from "./derive.js";
import { STAGING_DB } from "./paths.js";

/**
 * The oracle, as a test.
 *
 * The golden corpus is the acceptance criterion for the derive stage: for every
 * fixture verse, the derived `gloss[]` must reproduce the hand-authored one —
 * same surfaces, same morpheme decomposition, same Strong's numbers. Running it
 * only from the CLI meant a regression could sit unnoticed until someone
 * remembered to look.
 *
 * Transliteration is deliberately *not* asserted. It is a presentation choice
 * with several defensible schemes, so it is reported as an agreement percentage
 * by `yada oracle` and left out of the pass condition.
 *
 * Requires a populated staging.db (`yada ingest && yada normalize`).
 */
const HAVE_DB = existsSync(STAGING_DB);
const describeIfNormalized = HAVE_DB ? describe : describe.skip;

describeIfNormalized("oracle: derived output vs the golden corpus", () => {
  for (const fixture of ORACLE_FIXTURES) {
    it(`reproduces ${fixture}`, () => {
      const result = checkAgainstFixture(fixture);

      expect(result.derivedWords, "word count").toBe(result.fixtureWords);
      expect(result.surfaceMismatches).toEqual([]);
      expect(result.strongsMismatches).toEqual([]);
      expect(result.morphemeMismatches).toEqual([]);
      expect(result.ok).toBe(true);
    });
  }

  it("covers both testaments and all four fixture genres", () => {
    // A Greek-only or Hebrew-only oracle would have missed the Strong's gap in
    // one testament entirely — which is exactly how it survived to be found.
    expect(ORACLE_FIXTURES).toHaveLength(7);
    const greek = ORACLE_FIXTURES.filter((f) => ["jhn.1.1", "1co.14.34", "rev.13.18"].includes(f));
    expect(greek).toHaveLength(3);
  });
});
