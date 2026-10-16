import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { RefusedError } from "./actions.js";
import { buildExtracts, decideExtract, type ExtractsContext } from "./extracts.js";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function setup(): ExtractsContext {
  const dir = mkdtempSync(path.join(tmpdir(), "yada-extracts-"));
  dirs.push(dir);
  const intros = {
    _why: "test",
    entries: [
      { book: "ROM", text: "Paul wrote this letter to the Christians in Rome.", ref: "en_tn/tn_ROM.tsv front:intro", paragraph: "Paul wrote this letter to the Christians in Rome. More.", note: "Weak.", status: "draft" },
    ],
  };
  const grammar = {
    _why: "test",
    entries: [
      { key: "greek:aorist", label: "aorist", language: "greek", text: "Aorist is a verb tense-form.", ref: "en_ugg/content/tense_aorist.rst Glossary", paragraph: "Aorist is a verb tense-form. More.", tokens: 3, status: "draft" },
    ],
  };
  writeFileSync(path.join(dir, "book_intros.json"), `${JSON.stringify(intros, null, 1)}\n`);
  writeFileSync(path.join(dir, "grammar.json"), `${JSON.stringify(grammar, null, 1)}\n`);
  return { extractsDir: dir, reviewDir: path.join(dir, "review"), reviewer: "tester", now: () => new Date("2026-10-15T10:00:00.000Z") };
}

describe("the Extracts queue (build 6)", () => {
  it("lists book introductions and grammar terms with the paragraph each was cut from", () => {
    const { groups } = buildExtracts(setup());
    expect(groups.map((g) => [g.kind, g.items.length, g.approved])).toEqual([["book_intro", 1, 0], ["grammar", 1, 0], ["devotional", 0, 0], ["daily_light", 0, 0]]);
    expect(groups[0]?.items[0]).toMatchObject({ id: "ROM", title: "Romans", note: "Weak.", context: expect.stringContaining("More.") });
    expect(groups[1]?.items[0]).toMatchObject({ id: "greek:aorist", title: "Greek · aorist" });
  });

  it("approves one item, rewrites only its status, and logs the decision", () => {
    const ctx = setup();
    const item = buildExtracts(ctx).groups[1]?.items[0];
    const before = readFileSync(path.join(ctx.extractsDir, "grammar.json"), "utf8");
    const after = decideExtract(ctx, "grammar", "greek:aorist", "approve", { text_sha256: item?.text_sha256 });
    expect(after.status).toBe("approved");
    const now = readFileSync(path.join(ctx.extractsDir, "grammar.json"), "utf8");
    expect(now).toBe(before.replace('"status": "draft"', '"status": "approved"'));
    const log = readFileSync(path.join(ctx.reviewDir, "decisions.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(log).toEqual([expect.objectContaining({ kind: "extract", extract: "grammar", id: "greek:aorist", decision: "approved", previous_status: "draft", reviewer: "tester" })]);
    expect(readdirSync(ctx.extractsDir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("refuses a decision on text other than what was read", () => {
    const ctx = setup();
    expect(() => decideExtract(ctx, "book_intro", "ROM", "approve", { text_sha256: "0".repeat(64) })).toThrow(RefusedError);
    expect(() => decideExtract(ctx, "book_intro", "ROM", "approve", {})).toThrow(/which text was read/);
  });

  it("refuses bulk bodies, unknown ids and a repeat decision", () => {
    const ctx = setup();
    const sha = buildExtracts(ctx).groups[0]?.items[0]?.text_sha256;
    expect(() => decideExtract(ctx, "book_intro", "ROM", "approve", { text_sha256: sha, all: true })).toThrow(/One item per request/);
    expect(() => decideExtract(ctx, "book_intro", "GEN", "approve", { text_sha256: sha })).toThrow(/No book_intro GEN/);
    decideExtract(ctx, "book_intro", "ROM", "reject", { text_sha256: sha });
    expect(() => decideExtract(ctx, "book_intro", "ROM", "reject", { text_sha256: sha })).toThrow(/already rejected/);
    expect(decideExtract(ctx, "book_intro", "ROM", "undo", { text_sha256: sha }).status).toBe("draft");
  });
});
