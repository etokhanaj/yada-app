import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { Claim, VerseEntry } from "@yada/schema";

import { MissingApiKey } from "./budget.js";
import type { OracleResult } from "./derive.js";
import { GOLDEN } from "./paths.js";
import {
  claimCountTolerance,
  compareStructure,
  judgeLiveResponse,
  rawSourcesPresent,
  runCiTier,
  runLiveRegress,
} from "./regress.js";
import { loadGolden } from "./test-staging.js";

const temps: string[] = [];
function temp(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const absentRaw = () => path.join(tmpdir(), "yada-regress-no-raw-here");

describe("regress: CI tier", () => {
  it("passes the real golden corpus and says plainly that the oracle was skipped", () => {
    const checks = runCiTier({ rawDir: absentRaw() });
    expect(checks.filter((c) => c.status === "fail")).toEqual([]);
    const oracle = checks.find((c) => c.name === "oracle");
    expect(oracle?.status).toBe("skip");
    expect(oracle?.detail.join(" ")).toMatch(/NOT compared/);
  });

  it("treats an empty content/raw as absent, because ensureDirs creates one on every stage", () => {
    const raw = temp("yada-raw-");
    expect(rawSourcesPresent(raw)).toBe(false);
    writeFileSync(path.join(raw, "TBESG.txt"), "x");
    expect(rawSourcesPresent(raw)).toBe(true);
  });

  it("fails a fixture that claims a human review, one that breaks the schema, and one the oracle does not cover", () => {
    const golden = temp("yada-golden-");
    for (const name of ["1co.14.34", "jhn.1.1", "gen.1.1", "psa.23.1", "lev.19.18", "isa.53.5", "rev.13.18"]) {
      writeFileSync(path.join(golden, `${name}.json`), readFileSync(path.join(GOLDEN, `${name}.json`)));
    }
    const reviewed = loadGolden("jhn.1.1");
    reviewed.review.status = "human_reviewed";
    writeFileSync(path.join(golden, "jhn.1.1.json"), JSON.stringify(reviewed));
    const broken = loadGolden("gen.1.1") as unknown as Record<string, unknown>;
    delete broken["claims"];
    writeFileSync(path.join(golden, "gen.1.1.json"), JSON.stringify(broken));
    writeFileSync(path.join(golden, "mat.5.1.json"), readFileSync(path.join(GOLDEN, "lev.19.18.json")));

    const failed = runCiTier({ goldenDir: golden, rawDir: absentRaw() }).filter((c) => c.status === "fail");
    const byName = new Map(failed.map((c) => [c.name, c.detail.join(" ")]));
    expect(byName.get("golden/jhn.1.1.json")).toMatch(/provenance.*human_reviewed/);
    expect(byName.get("golden/gen.1.1.json")).toMatch(/schema claims/);
    expect(byName.get("oracle covers every fixture")).toMatch(/mat\.5\.1/);
  });

  it("runs the oracle when raw sources exist, and fails on any mismatch", () => {
    const raw = temp("yada-raw-");
    writeFileSync(path.join(raw, "TBESG.txt"), "x");
    const oracle = (fixture: string): OracleResult => ({
      fixture, verse_id: "X", derivedWords: 1, fixtureWords: 1, translitAgreement: 1,
      surfaceMismatches: [], morphemeMismatches: [],
      strongsMismatches: fixture === "jhn.1.1" ? ["#2 derived G0746 != fixture G0747"] : [],
      ok: fixture !== "jhn.1.1",
    });
    const checks = runCiTier({ rawDir: raw, oracle });
    expect(checks.filter((c) => c.status === "fail").map((c) => c.name)).toEqual(["oracle jhn.1.1"]);
  });

  it("fails rather than skips when sources are present but staging.db is not", () => {
    const raw = temp("yada-raw-");
    writeFileSync(path.join(raw, "TBESG.txt"), "x");
    const checks = runCiTier({ rawDir: raw, stagingDb: path.join(raw, "missing.db") });
    expect(checks.find((c) => c.name === "oracle")?.status).toBe("fail");
  });
});

describe("regress: structural equivalence", () => {
  const golden = () => loadGolden("1co.14.34");
  const clone = (e: VerseEntry) => JSON.parse(JSON.stringify(e)) as VerseEntry;

  it("states its tolerance: 30% or 2 claims, whichever is larger", () => {
    expect(claimCountTolerance(9)).toBe(3);
    expect(claimCountTolerance(4)).toBe(2);
  });

  it("accepts an entry with the same structure and entirely different wording", () => {
    const candidate = clone(golden());
    for (const claim of candidate.claims) claim.claim = `Reworded claim ${claim.id.slice(-2)}.`;
    candidate.whats_happening = "Different prose.";
    const result = compareStructure(golden(), candidate);
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("fails when a debated claim is lost", () => {
    const candidate = clone(golden());
    candidate.claims = candidate.claims.filter((c) => c.id !== "1CO.14.34.c9");
    expect(compareStructure(golden(), candidate).problems.join(" ")).toMatch(/a dispute was lost/);
  });

  it("fails when a category disappears or appears", () => {
    const candidate = clone(golden());
    candidate.claims = candidate.claims.filter((c) => c.category !== "context");
    const interpretation: Claim = {
      ...candidate.claims[0]!, id: "1CO.14.34.c20", category: "interpretation",
      evidence_strength: "supported", display_rank: 3,
    };
    candidate.claims.push(interpretation);
    const problems = compareStructure(golden(), candidate).problems.join(" ");
    expect(problems).toMatch(/category context is missing/);
    expect(problems).toMatch(/category interpretation is new/);
  });

  it("fails on a new compound claim", () => {
    const candidate = clone(golden());
    candidate.claims[0]!.claim = "The verb is imperative; its subject is the women.";
    expect(compareStructure(golden(), candidate).problems.join(" ")).toMatch(/compound claims: 1CO\.14\.34\.c1/);
  });

  it("fails when the claim count drifts past the tolerance", () => {
    const candidate = clone(golden());
    candidate.claims = candidate.claims.filter((c) => !["1CO.14.34.c2", "1CO.14.34.c3", "1CO.14.34.c5", "1CO.14.34.c6"].includes(c.id));
    expect(compareStructure(golden(), candidate).problems.join(" ")).toMatch(/claim count 5, golden 9 \(tolerance ±3\)/);
  });

  it("fails a regenerated entry that claims to be reviewed", () => {
    const candidate = clone(golden());
    candidate.review.status = "human_reviewed";
    expect(compareStructure(golden(), candidate).ok).toBe(false);
  });

  it("judges a truncated or entry-less response as a failure, not a pass", () => {
    expect(judgeLiveResponse(golden(), JSON.stringify([golden()]), "max_tokens").ok).toBe(false);
    expect(judgeLiveResponse(golden(), JSON.stringify({ verses: [loadGolden("jhn.1.1")] }), "end_turn").problems.join(" ")).toMatch(/no entry for 1CO\.14\.34/);
    expect(judgeLiveResponse(golden(), JSON.stringify({ pericope: {}, verses: [golden()] }), "end_turn").ok).toBe(true);
  });
});

describe("regress --live gate", () => {
  const exploding: any = new Proxy({}, { get: () => { throw new Error("client touched — the gate did not hold"); } });

  it("sends nothing without --confirm, and does not even touch the client", async () => {
    await expect(runLiveRegress({ confirm: false, client: exploding })).rejects.toThrow(/--confirm not given/);
  });

  it("refuses without a key", async () => {
    const saved = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];
    try {
      const out = temp("yada-live-");
      mkdirSync(out, { recursive: true });
      await expect(runLiveRegress({ confirm: true, responsesDir: out })).rejects.toThrow(MissingApiKey);
    } finally {
      if (saved !== undefined) process.env["ANTHROPIC_API_KEY"] = saved;
    }
  });
});
