import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

import { greekStrongs, loadGreekLexicon } from "./lexicon.js";
import { RAW } from "./paths.js";

const HAVE_SOURCES = existsSync(path.join(RAW, "TBESG.txt"));
const describeIfIngested = HAVE_SOURCES ? describe : describe.skip;

/**
 * The two spellings are written as escapes on purpose: they are visually
 * identical, so a literal would make this test unreadable and easy to "fix"
 * into meaninglessness by a well-meaning normalisation pass.
 */
const LOGOS_OXIA = "λόγος"; // TBESG
const LOGOS_TONOS = "λόγος"; // MorphGNT

describeIfIngested("Greek lemma -> Strong's", () => {
  it("reconciles polytonic oxia with monotonic tonos", () => {
    // They render identically and compare unequal. Without NFC on both sides,
    // common vocabulary misses while shorter words happen to match — which is
    // the failure that looked like "TBESG is missing λόγος".
    expect(LOGOS_OXIA).not.toBe(LOGOS_TONOS);
    expect(LOGOS_OXIA.normalize("NFC")).toBe(LOGOS_TONOS);

    expect(greekStrongs(LOGOS_OXIA)).toBe("G3056");
    expect(greekStrongs(LOGOS_TONOS)).toBe("G3056");
  });

  it("maps the lemmas the fixtures depend on", () => {
    expect(greekStrongs("θεός")).toBe("G2316"); // θεός
    expect(greekStrongs("ἀρχή")).toBe("G0746"); // ἀρχή
  });

  it("returns padded numbers", () => {
    expect(greekStrongs("ἀρχή")).toMatch(/^G\d{4,5}[a-z]?$/);
  });

  it("leaves ambiguous lemmas unmapped rather than guessing", () => {
    const { map, report } = loadGreekLexicon();
    expect(report.ambiguous.length).toBeGreaterThan(0);
    for (const lemma of report.ambiguous) {
      expect(map.has(lemma)).toBe(false);
    }
    // A wrong Strong's number is indistinguishable from a right one downstream,
    // so ambiguity must stay small enough to be a reportable exception.
    expect(report.ambiguous.length / report.lemmas).toBeLessThan(0.01);
  });

  it("misses cleanly on a form that is not in the lexicon", () => {
    expect(greekStrongs("notaword")).toBeUndefined();
  });
});
