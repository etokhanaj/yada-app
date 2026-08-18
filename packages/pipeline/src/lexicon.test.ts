import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

import { greekStrongs, loadGreekLexicon, matchGreekLemma } from "./lexicon.js";
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

  // MorphGNT and TBESG disagree in four distinct ways, and each fallback is
  // pinned separately so that removing one shows up here rather than as a quiet
  // coverage drop. Together they recover ~294 tokens across John, 1 Cor and Rev.
  it("resolves comma-separated spelling variants in one cell", () => {
    // TBESG stores `Μωϋσῆς, Μωσῆς` in a single cell; indexing it verbatim
    // matches neither spelling.
    const match = matchGreekLemma("Μωϋσῆς");
    expect(match?.strongs).toBe("G3475");
    expect(match?.route).toBe("direct");
  });

  it("resolves MorphGNT's parenthesised optional ending", () => {
    // MorphGNT writes οὕτω(ς); TBESG writes οὕτως.
    const match = matchGreekLemma("οὕτω(ς)");
    expect(match?.strongs).toBe("G3779");
    expect(match?.route).toBe("optional-segment");
  });

  it("resolves an iota subscript the two sources spell differently", () => {
    // MorphGNT ἀποθνῄσκω against TBESG ἀποθνήσκω — genuinely different letters,
    // so NFC cannot reconcile them.
    const match = matchGreekLemma("ἀποθνῄσκω");
    expect(match?.strongs).toBe("G0599");
    expect(match?.route).toBe("iota-subscript");
  });

  it("resolves a deponent against its active headword, and says that it did", () => {
    // The one route here that is a linguistic rule rather than a spelling fix:
    // TBESG cites ἀποκρίνω, MorphGNT cites ἀποκρίνομαι. It must stay labelled,
    // because it is the only route whose correctness is an argument rather than
    // an observation.
    const match = matchGreekLemma("ἀποκρίνομαι");
    expect(match?.strongs).toBe("G0611");
    expect(match?.route).toBe("deponent");

    // It must not fire where the direct lookup already succeeds.
    expect(matchGreekLemma("λόγος")?.route).toBe("direct");
  });

  it("refuses a proper noun that two Strong's numbers share", () => {
    // Βηθανία is G0962 and G0963 — Bethany beyond Jordan and Bethany near
    // Jerusalem. The distinction is a real one, so no number is better than a
    // coin toss between them.
    expect(greekStrongs("Βηθανία")).toBeUndefined();
  });
});
