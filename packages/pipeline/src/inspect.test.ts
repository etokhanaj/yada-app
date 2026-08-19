import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { checkProvenance, collectEntries, extractJson, inspectAll } from "./inspect.js";
import { GOLDEN } from "./paths.js";

/**
 * The harness is proven against the golden fixtures — real entries whose
 * validity is already established — and against deliberately broken input.
 * A validator that has only ever seen good data is not known to work.
 */

function responseDir(entries: unknown, model = "claude-opus-5"): string {
  const dir = mkdtempSync(path.join(tmpdir(), "yada-inspect-"));
  writeFileSync(
    path.join(dir, `TEST.1.1-1.2.${model}.json`),
    JSON.stringify({ text: typeof entries === "string" ? entries : JSON.stringify(entries) }),
  );
  return dir;
}

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(GOLDEN, name), "utf8")) as Record<string, unknown>;

describe("extracting JSON from a response", () => {
  it("reads a bare JSON body", () => {
    expect(extractJson('{"a":1}')?.value).toEqual({ a: 1 });
    expect(extractJson('{"a":1}')?.recovered).toBeNull();
  });

  it("recovers from a code fence, and says it had to", () => {
    const got = extractJson('```json\n{"a":1}\n```');
    expect(got?.value).toEqual({ a: 1 });
    expect(got?.recovered).toBe("wrapped in a code fence");
  });

  it("recovers from surrounding prose, and says it had to", () => {
    const got = extractJson('Here you go:\n{"a":1}\nHope that helps.');
    expect(got?.value).toEqual({ a: 1 });
    expect(got?.recovered).toBe("surrounded by prose");
  });

  it("gives up rather than guessing", () => {
    expect(extractJson("no json here at all")).toBeNull();
  });
});

describe("collecting entries from whatever container arrived", () => {
  it("handles a bare entry, an array, and a {pericope, verses} wrapper", () => {
    expect(collectEntries({ verse_id: "GEN.1.1" })).toHaveLength(1);
    expect(collectEntries([{ verse_id: "GEN.1.1" }, { verse_id: "GEN.1.2" }])).toHaveLength(2);
    expect(
      collectEntries({ pericope: { pericope_id: "GEN.1.1-1.5" }, verses: [{ verse_id: "GEN.1.1" }] }),
    ).toHaveLength(2);
  });
});

describe("provenance", () => {
  it("rejects a generated entry that claims a human reviewed it", () => {
    const problems = checkProvenance(
      { review: { status: "human_reviewed" }, prompt_version: "p@1" },
      "claude-opus-5",
    );
    expect(problems.join(" ")).toMatch(/nothing generated has been reviewed/);
  });

  it("rejects expert_reviewed for the same reason", () => {
    expect(
      checkProvenance({ review: { status: "expert_reviewed" }, prompt_version: "p@1" }, "claude-opus-5"),
    ).not.toHaveLength(0);
  });

  it("accepts a correctly flagged entry", () => {
    expect(
      checkProvenance({ review: { status: "flagged" }, prompt_version: "p@1" }, "claude-opus-5"),
    ).toHaveLength(0);
  });

  it("notices a missing prompt_version", () => {
    expect(
      checkProvenance({ review: { status: "flagged" } }, "claude-opus-5").join(" "),
    ).toMatch(/prompt_version/);
  });
});

describe("inspecting responses", () => {
  it("validates a real fixture cleanly", () => {
    // lev.19.18 passes every rule, so any finding here is the harness's fault.
    const dir = responseDir(fixture("lev.19.18.json"));
    try {
      const report = inspectAll(dir);
      expect(report.parsed).toBe(1);
      expect(report.parseFailures).toBe(0);
      expect(report.entries[0]?.findings).toHaveLength(0);
      expect(report.entries[0]?.provenance).toHaveLength(0);
      expect(report.entries[0]?.model).toBe("claude-opus-5");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("counts a schema violation rather than repairing it", () => {
    const broken = fixture("lev.19.18.json");
    delete broken["close_rendering"];
    const dir = responseDir(broken);
    try {
      const report = inspectAll(dir);
      expect(report.parseFailures).toBe(1);
      expect(report.entries[0]?.parseError).toMatch(/close_rendering/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("attributes a rule violation to its rule", () => {
    const broken = fixture("lev.19.18.json") as any;
    // Two sentences in one claim is the atomicity rule's whole point.
    broken.claims[0].claim = "The verb is an imperative. Paul is addressing the assembly.";
    const dir = responseDir(broken);
    try {
      const report = inspectAll(dir);
      expect([...report.byRule.keys()]).toContain("claim-atomicity");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records an unreadable response instead of throwing", () => {
    const dir = responseDir("I'm sorry, I can't help with that.");
    try {
      const report = inspectAll(dir);
      expect(report.unreadable).toHaveLength(1);
      expect(report.entries).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports nothing when no responses exist yet", () => {
    const report = inspectAll(path.join(tmpdir(), "yada-inspect-does-not-exist"));
    expect(report.responses).toBe(0);
  });
});
