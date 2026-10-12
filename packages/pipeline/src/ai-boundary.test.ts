/**
 * CLAUDE.md rule 9: Tyndale's study notes quote the NLT, so they never enter an AI call: not a
 * prompt, grounding, the adversary, regression or evaluation. The study bundles are built straight
 * from content/raw (study.ts) and never pass through staging.db; this holds the other half, that
 * nothing which builds or sends a model request can reach the study code or its files.
 *
 * Static, over the source: every module reachable by relative import from the code that talks to
 * a model is read, and none may import study.ts, any study export from @yada/schema, or name the
 * study files and sources.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_STUDY = path.join(SRC, "../../schema/src/study.ts");

/** Everything that assembles, sends, checks or replays a model request. */
const MODEL_ENTRIES = ["generate.ts", "submit.ts", "batch.ts", "adversary.ts", "regress.ts", "assemble.ts", "budget.ts"];

function source(file: string): string {
  return readFileSync(path.join(SRC, file), "utf8");
}

function relativeImports(text: string): string[] {
  return [...text.matchAll(/from\s+"\.\/([^"]+)\.js"/g)].map((m) => `${m[1]}.ts`);
}

function reachable(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift() ?? "";
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...relativeImports(source(file)));
  }
  return seen;
}

/** Names imported from @yada/schema, type imports included. */
function schemaImports(text: string): string[] {
  return [...text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"@yada\/schema"/g)].flatMap((m) =>
    (m[1] ?? "")
      .split(",")
      .map((name) => name.replace(/^\s*type\s+/, "").split(/\s+as\s+/)[0]?.trim() ?? "")
      .filter((name) => name !== ""),
  );
}

const STUDY_EXPORTS = [...readFileSync(SCHEMA_STUDY, "utf8").matchAll(/export\s+(?:const|function|type|interface)\s+(\w+)/g)].map(
  (m) => m[1] ?? "",
);

describe("the model boundary (rule 9)", () => {
  const modules = reachable(MODEL_ENTRIES);

  it("finds the modules it guards", () => {
    // A rename that empties this set would pass every check below; it must fail here instead.
    expect(modules.has("generate.ts")).toBe(true);
    expect(modules.has("derive.ts")).toBe(true);
    expect(STUDY_EXPORTS).toContain("STUDY_DDL");
    expect(STUDY_EXPORTS).toContain("studyBookFileName");
  });

  it("never reaches the study, MACULA, Glyssen or translation packaging code", () => {
    // Each says nothing it reads goes into staging.db or a prompt; this holds them to it (gate review, 11 Oct 2026).
    const packaging = ["study.ts", "macula.ts", "glyssen.ts", "translations.ts"];
    expect([...modules].filter((file) => packaging.includes(file))).toEqual([]);
  });

  it("imports nothing of the study layer from @yada/schema", () => {
    const leaks = [...modules].flatMap((file) =>
      schemaImports(source(file))
        .filter((name) => STUDY_EXPORTS.includes(name))
        .map((name) => `${file}: ${name}`),
    );
    expect(leaks).toEqual([]);
  });

  it("never names the study files or their sources", () => {
    const named = [...modules].filter((file) => /tosn|openbible|study[-.]|\bstudy\b|notes\s+table/i.test(source(file)));
    expect(named).toEqual([]);
  });
});
