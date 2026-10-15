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

import { readdirSync, readFileSync } from "node:fs";
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

/**
 * Rule 9, licensed translations (12 Oct 2026): NKJV, NLT and MSG (NIV known, off the account) reach testers through Yada's proxy
 * (services/licensed-proxy) and the app's client for it (apps/mobile/src/data/licensed.ts). Both
 * are display-only, so nothing that talks to a model may name either, the translations, API.Bible
 * or its Bible ids, and no pipeline file may import from the app or the proxy at all.
 */
describe("the model boundary and licensed translations (rule 9)", () => {
  const modules = reachable(MODEL_ENTRIES);
  const LICENSED_CLIENT = path.join(SRC, "../../../apps/mobile/src/data/licensed.ts");
  const PROXY_BIBLES = path.join(SRC, "../../../services/licensed-proxy/src/translations.ts");
  const bibleIds = [readFileSync(LICENSED_CLIENT, "utf8"), readFileSync(PROXY_BIBLES, "utf8")].flatMap((text) =>
    [...text.matchAll(/"([0-9a-f]{16}-\d{2})"/g)].map((m) => m[1] ?? ""),
  );

  it("finds the client, the proxy and the four Bible ids it guards", () => {
    expect(new Set(bibleIds)).toEqual(
      new Set(["78a9f6124f344018-01", "63097d2a0a2f7db3-01", "d6e14a625393b4da-01", "6f11a7de016f942e-01"]),
    );
  });

  it("no model module names the licensed client, the proxy, API.Bible or the translations", () => {
    const pattern = /api\.bible|licensed-proxy|LICENSED_PROXY|useLicensedChapter|data\/licensed|\bNIV\b|\bNKJV\b|\bNLT\b|\bMSG\b|The Message/;
    const named = [...modules].filter((file) => pattern.test(source(file)) || bibleIds.some((id) => source(file).includes(id)));
    expect(named).toEqual([]);
  });

  it("no model module reaches Understand without AI, which reads Tyndale's notes (rule 9)", () => {
    const named = [...modules].filter((file) => /understand\//.test(source(file)));
    expect(named).toEqual([]);
  });

  it("Understand without AI reads only the public-domain texts and names no licensed source (12 Oct 2026)", () => {
    const dir = path.join(SRC, "understand");
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(files).toEqual(expect.arrayContaining(["package.ts", "passage.ts", "sources.ts", "text.ts", "verse.ts"]));
    const text = (f: string): string => readFileSync(path.join(dir, f), "utf8");
    const licensed = /api\.bible|licensed-proxy|LICENSED_PROXY|useLicensedChapter|data\/licensed|\bNIV\b|\bNKJV\b|\bMSG\b|The Message/;
    expect(files.filter((f) => licensed.test(text(f)) || bibleIds.some((id) => text(f).includes(id)))).toEqual([]);
    // NLT appears in code only as the "(NLT)" mark on Tyndale's quoted words, and the report's check for
    // it in beginner lines; comments aside.
    const code = (f: string): string => text(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(files.flatMap((f) => [...code(f).matchAll(/.{0,3}\bNLT\b.{0,1}/g)].map((m) => m[0])).filter((m) => m !== "” (NLT)" && m !== '("(NLT)')).toEqual([]);
    // Core's texts are read by name, the four public-domain translations only.
    expect(text("sources.ts")).toContain('PUBLIC_DOMAIN_TEXTS = ["BSB", "WEB", "KJV", "LSV"] as const');
    const queries = files.flatMap((f) => [...text(f).matchAll(/FROM texts[^"`]*/g)].map((m) => m[0]));
    expect(queries.length).toBeGreaterThan(0);
    // Core's texts are queried by name; the one other texts table is the JPS 1917 bundle (public domain).
    for (const q of queries) expect(q.includes("t.translation IN (${placeholders})") || q.startsWith("FROM texts WHERE ord BETWEEN")).toBe(true);
    expect(text("package.ts")).toContain('latest(paths.bundles, "translation-jps")');
  });

  it("no pipeline file imports from the app or the proxy", () => {
    const all = readdirSync(SRC).filter((f) => f.endsWith(".ts"));
    const crossing = all.filter((file) => /from\s+"[^"]*(?:apps\/mobile|services\/licensed-proxy|@yada\/mobile|@yada\/licensed-proxy)/.test(source(file)));
    expect(crossing).toEqual([]);
  });
});
