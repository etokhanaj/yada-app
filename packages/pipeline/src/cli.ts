#!/usr/bin/env node
/**
 * `yada` — the pipeline CLI. Every stage is idempotent and resumable.
 *
 * Network access is limited to `ingest` and to the gated stages — `generate`,
 * `adversary`, `regress --live` and `publish` — each of which does nothing
 * without an explicit `--confirm`, and whose model calls go through budget.ts.
 */

import { assertSchemaAlignment, openStaging } from "./db.js";
import { ORACLE_FIXTURES, checkAgainstFixture, coverage } from "./derive.js";
import { CEILING_USD, spentSoFar } from "./budget.js";
import { dryRun, loadPericopes } from "./generate.js";
import { inspectAll } from "./inspect.js";
import { packageCore, packageUnderstand, readBundleManifest, understandBooks, writeBundleManifest } from "./package.js";
import { importGolden } from "./store.js";
import { isBookCode, type BundleInfo } from "@yada/schema";
import { ensureDirs } from "./paths.js";
import { MILESTONE_0_MODELS, generatePericope, type GenerationResult } from "./submit.js";
import { normalize } from "./normalize.js";
import { ingest } from "./sources.js";
import { ingestResponses } from "./responses.js";
import { validateBook } from "./validate-book.js";
import { ADVERSARY_MODEL, ZERO_C_MAX_DISAGREEMENT, adversaryDryRun, disagreement, runAdversary } from "./adversary.js";
import { requireApiKey } from "./budget.js";
import { LIVE_MODEL, LIVE_VERSE, runCiTier, runLiveRegress } from "./regress.js";
import { PublishRefused, formatBytes, publish, totalBytes } from "./publish.js";

/** `--model claude-sonnet-5` -> "claude-sonnet-5" */
function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

/** Positional arguments, skipping flags and the values flags consume. */
function positional(args: readonly string[], valued: readonly string[] = ["--model"]): string[] {
  return args.filter((arg, i) => !arg.startsWith("--") && !valued.includes(args[i - 1] ?? ""));
}

function pct(part: number, whole: number): string {
  return whole === 0 ? "n/a" : `${((part / whole) * 100).toFixed(1)}%`;
}

/**
 * The spending path. Kept separate from the switch so that the thing which
 * costs money is one named function that can be read end to end.
 */
async function confirmedRun(book: string): Promise<number> {
  ensureDirs();
  const pericopes = loadPericopes(book);
  const spentBefore = spentSoFar();

  console.log(`generate --confirm ${book}: THIS WILL SPEND MONEY`);
  console.log(`  pericopes:     ${pericopes.length}`);
  console.log(`  models:        ${MILESTONE_0_MODELS.join(", ")}`);
  console.log(`  ceiling:       $${CEILING_USD} (already spent: $${spentBefore.toFixed(2)})`);
  console.log(`  usage log:     content/usage.jsonl\n`);

  const results: GenerationResult[] = [];
  for (const model of MILESTONE_0_MODELS) {
    for (const pericope of pericopes) {
      try {
        const result = await generatePericope(book, pericope, model, { confirm: true });
        results.push(result);
        const perVerse = Math.round(result.outputTokens / Math.max(result.verses.length, 1));
        console.log(
          `  ${model.padEnd(17)} ${result.pericopeId.padEnd(16)} ` +
            `in ${result.inputTokens} out ${result.outputTokens} ` +
            `(thinking ${result.thinkingTokens}, ${perVerse}/verse) ` +
            `$${result.costUsd.toFixed(3)} ${result.stopReason ?? "?"} ${Math.round(result.elapsedMs / 1000)}s`,
        );
        if (result.stopReason === "max_tokens") {
          console.log(`    TRUNCATED — max_tokens reached. This entry is incomplete.`);
        }
      } catch (error) {
        // A failure here has usually already cost money, so it is reported and
        // the run stops rather than pressing on into the ceiling.
        console.error(`  FAILED ${model} ${pericope.id}: ${(error as Error).message}`);
        console.error(`  stopping. $${(spentSoFar() - spentBefore).toFixed(2)} spent this run.`);
        return 1;
      }
    }
  }

  console.log(`\n  spent this run: $${(spentSoFar() - spentBefore).toFixed(2)}`);
  console.log(`  responses:      content/responses/`);
  console.log(`\n  Nothing here is reviewed. Every entry is flagged and must stay that way`);
  console.log(`  until a human has actually read it.`);
  return 0;
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "ingest": {
      console.log("ingest: fetching pinned sources\n");
      await ingest();
      return 0;
    }

    case "normalize": {
      const report = normalize();
      console.log(
        `normalize: ${report.tokens} tokens, ${report.verses} verses, books ${report.books.join(", ")}`,
      );
      console.log(`  chapters carrying a superscription (TVTMS): ${report.titledChapters}`);
      console.log(
        `  Hebrew -> English versification: ${report.versification.titles} titles at verse 0, ` +
          `${report.versification.renumbered} verses renumbered`,
      );
      if (report.versification.crossChapter.length > 0) {
        console.log(
          `  moved across a chapter boundary (${report.versification.crossChapter.length}): ` +
            `${report.versification.crossChapter.slice(0, 4).join(", ")}`,
        );
      }
      // Every route other than `direct` is an inference about orthography or
      // citation convention, so each is counted separately rather than folded
      // into a single coverage percentage that would hide them.
      const routes = [...report.lexicon.routes].sort((a, b) => b[1] - a[1]);
      const matched = routes.reduce((sum, [, n]) => sum + n, 0);
      console.log(
        `  Greek Strong's from TBESG: ${matched} matched ` +
          `(${routes.map(([route, n]) => `${route} ${n}`).join(", ")})`,
      );
      if (report.lexicon.unmatched.size > 0) {
        console.log(
          `  no TBESG entry (${report.lexicon.unmatched.size} lemma forms): ` +
            `${[...report.lexicon.unmatched].slice(0, 6).join(", ")}`,
        );
      }
      const g = report.glosses;
      console.log(
        `  glosses: TAGNT ${g.bySource.TAGNT}, TAHOT ${g.bySource.TAHOT}, TBESG fallback ${g.bySource.TBESG}, ` +
          `unglossed ${g.unglossed} of ${g.tokens} (${((1 - g.unglossed / Math.max(g.tokens, 1)) * 100).toFixed(1)}% glossed)`,
      );
      if (g.weakBooks.length > 0) {
        console.log(
          `  books under 90% aligned: ${g.weakBooks.map((b) => `${b.book} ${(b.coverage * 100).toFixed(0)}%`).join(", ")}`,
        );
      }
      const t = report.texts.byTranslation;
      console.log(`  English: BSB ${t.BSB}, WEB ${t.WEB}, KJV ${t.KJV} verses`);
      console.log(
        `  English verses with no original-language tokens: ${report.textOnly}; ` +
          `original verses with no English: ${report.originalOnly.length}` +
          (report.originalOnly.length > 0 ? ` (${report.originalOnly.slice(0, 6).join(", ")})` : ""),
      );
      if (report.unresolved.length > 0) {
        console.log(`  UNRESOLVED refs: ${report.unresolved.slice(0, 10).join(", ")}`);
      }
      const db = openStaging();
      const drift = assertSchemaAlignment(db);
      db.close();
      if (drift.length > 0) {
        console.log("\nSCHEMA DRIFT:");
        for (const problem of drift) console.log(`  ${problem}`);
        return 1;
      }
      console.log("  schema alignment: ok");
      return 0;
    }

    case "derive": {
      const book = rest[0];
      if (book === undefined) {
        console.error("usage: yada derive <BOOK>");
        return 2;
      }
      const report = coverage(book);
      console.log(`derive ${book}: ${report.verses} verses, ${report.tokens} tokens`);
      console.log(`  with Strong's:  ${report.withStrongs} (${pct(report.withStrongs, report.tokens)})`);
      console.log(`  with morphemes: ${report.withMorphemes} (${pct(report.withMorphemes, report.tokens)})`);
      console.log(`  variant-marked: ${report.variantMarked}`);
      return 0;
    }

    case "oracle": {
      console.log("oracle: derived output against the hand-authored fixtures\n");
      let failures = 0;
      for (const fixture of ORACLE_FIXTURES) {
        const result = checkAgainstFixture(fixture);
        const status = result.ok ? "PASS" : "FAIL";
        if (!result.ok) failures += 1;
        console.log(
          `  ${status}  ${result.fixture.padEnd(11)} words ${result.derivedWords}/${result.fixtureWords}` +
            `  translit ${(result.translitAgreement * 100).toFixed(0)}%`,
        );
        for (const line of [
          ...result.surfaceMismatches,
          ...result.strongsMismatches,
          ...result.morphemeMismatches,
        ].slice(0, 6)) {
          console.log(`         ${line}`);
        }
      }
      console.log(`\n${ORACLE_FIXTURES.length - failures}/${ORACLE_FIXTURES.length} fixtures reproduced`);
      return failures === 0 ? 0 : 1;
    }

    case "import-golden": {
      const report = importGolden();
      console.log(`import-golden: ${report.imported.length} entries into staging.db as flagged`);
      for (const id of report.imported) console.log(`  + ${id}`);
      for (const r of report.rejected) console.log(`  REJECTED ${r.file}: ${r.problem}`);
      return report.rejected.length > 0 ? 1 : 0;
    }

    case "package": {
      // `package`            core + every book with content, reviewed entries only
      // `package JHN`        one Understand bundle
      // `--allow-unreviewed` include flagged entries, marked unreviewed-dev
      const allowUnreviewed = rest.includes("--allow-unreviewed");
      const only = rest.find((arg) => !arg.startsWith("--"));
      const previous = readBundleManifest()?.bundles ?? [];
      const built: BundleInfo[] = [];

      if (only === undefined || only.toLowerCase() === "core") {
        const core = packageCore();
        built.push(core.info);
        console.log(
          `  core      ${core.info.file.padEnd(14)} ${(core.info.bytes / 1048576).toFixed(1)} MB  ` +
            `${core.verses} verses, ${core.texts} texts, ${core.tokens} tokens`,
        );
      }
      const books = only === undefined ? understandBooks() : only.toLowerCase() === "core" ? [] : [only.toUpperCase()];
      for (const book of books) {
        if (!isBookCode(book)) {
          console.error(`unknown book ${book}`);
          return 2;
        }
        const report = packageUnderstand(book, { allowUnreviewed });
        built.push(report.info);
        console.log(
          `  ${book.padEnd(9)} ${report.info.file.padEnd(14)} ${(report.info.bytes / 1024).toFixed(0)} KB  ` +
            `${report.included.length} entries${report.withheld.length > 0 ? `, ${report.withheld.length} withheld as unreviewed` : ""}` +
            `${report.info.review_gate === "unreviewed-dev" ? "  [UNREVIEWED-DEV — never publishable]" : ""}`,
        );
      }
      const merged = [...previous.filter((b) => !built.some((n) => n.name === b.name)), ...built];
      writeBundleManifest(merged);
      console.log(`\npackage: ${built.length} bundles built, manifest lists ${merged.length} -> content/bundles/manifest.json`);
      return 0;
    }

    case "inspect": {
      const report = inspectAll();
      if (report.responses === 0) {
        console.log("inspect: no responses in content/responses/ — nothing generated yet");
        return 0;
      }
      console.log(`inspect: ${report.responses} responses, ${report.entries.length} entries`);
      console.log(`  schema-valid:   ${report.parsed}`);
      console.log(`  parse failures: ${report.parseFailures}`);
      if (report.unreadable.length > 0) {
        console.log(`  UNREADABLE (no JSON recovered): ${report.unreadable.join(", ")}`);
      }

      // The quality signal. A rule with zero violations is as informative as one
      // with many — it says the prompt carried that rule successfully.
      console.log(`\n  violations by rule:`);
      const rules = [...report.byRule].sort((a, b) => b[1] - a[1]);
      if (rules.length === 0) console.log(`    none`);
      for (const [rule, count] of rules) {
        console.log(`    ${rule.padEnd(28)} ${count} of ${report.entries.length} entries`);
      }

      const provenance = report.entries.filter((e) => e.provenance.length > 0);
      if (provenance.length > 0) {
        console.log(`\n  PROVENANCE PROBLEMS (${provenance.length}):`);
        for (const entry of provenance.slice(0, 10)) {
          console.log(`    ${entry.id} [${entry.model}]: ${entry.provenance.join("; ")}`);
        }
      }

      const failures = report.entries.filter((e) => e.parseError !== undefined);
      if (failures.length > 0) {
        console.log(`\n  parse failures in detail:`);
        for (const entry of failures.slice(0, 10)) {
          console.log(`    ${entry.id} [${entry.model}]: ${entry.parseError}`);
        }
      }
      return report.parseFailures > 0 || provenance.length > 0 ? 1 : 0;
    }

    case "generate": {
      const book = rest.find((arg) => !arg.startsWith("--"));
      if (book === undefined) {
        console.error("usage: yada generate [--dry-run | --confirm] <BOOK>");
        return 2;
      }
      // Default to dry-run. Spending must be asked for explicitly and can never
      // be the thing that happens because a flag was forgotten.
      if (!rest.includes("--confirm")) {
        if (!rest.includes("--dry-run")) {
          console.error("refusing to run: pass --dry-run to price it, or --confirm to submit it");
          return 2;
        }
        dryRun(book);
        return 0;
      }
      return await confirmedRun(book);
    }

    case "ingest-responses": {
      const model = flagValue(rest, "--model");
      const db = openStaging();
      const report = ingestResponses(db, undefined, model === undefined ? {} : { model });
      db.close();
      if (report.responses === 0) {
        console.log("ingest-responses: no responses in content/responses/ — nothing to store");
        return 0;
      }
      console.log(`ingest-responses: ${report.responses} responses${report.skipped > 0 ? ` (${report.skipped} from other models skipped)` : ""}`);
      console.log(`  stored as flagged: ${report.stored.length}`);
      for (const s of report.stored) {
        console.log(`    + ${s.id.padEnd(16)} ${s.kind.padEnd(8)} ${s.model}${s.warnings > 0 ? `  (${s.warnings} warnings)` : ""}`);
      }
      console.log(`  rejected: ${report.rejected.length}`);
      for (const r of report.rejected) console.log(`    REJECTED ${r.source} ${r.id}: ${r.reason}`);
      return report.rejected.length > 0 ? 1 : 0;
    }

    case "validate": {
      const book = positional(rest)[0]?.toUpperCase();
      if (book === undefined || !isBookCode(book)) {
        console.error("usage: yada validate <BOOK>");
        return 2;
      }
      const db = openStaging();
      const report = validateBook(db, book);
      db.close();
      if (!report.stagingReady) {
        console.error(`validate ${book}: staging.db has no text for ${book}; run \`yada normalize\` first`);
        return 2;
      }
      console.log(`validate ${book}: ${report.verseEntries} verse entries, ${report.pericopeEntries} pericope entries\n`);
      console.log(`  ${"rule".padEnd(30)} ${"errors".padStart(7)} ${"warns".padStart(6)} ${"entries".padStart(8)}`);
      const rules = [...report.byRule].sort((a, b) => b[1].errors - a[1].errors || a[0].localeCompare(b[0]));
      if (rules.length === 0) console.log("  none — every rule held");
      for (const [rule, tally] of rules) {
        console.log(
          `  ${rule.padEnd(30)} ${String(tally.errors).padStart(7)} ${String(tally.warnings).padStart(6)} ${String(tally.entries.size).padStart(8)}`,
        );
      }
      const errors = report.findings.filter((f) => f.level === "error");
      if (errors.length > 0) {
        console.log(`\n  first findings:`);
        for (const f of errors.slice(0, 20)) {
          console.log(`    ${f.entry}${f.claimId === undefined ? "" : ` [${f.claimId}]`} ${f.rule}: ${f.message}`);
        }
      }
      return errors.length > 0 ? 1 : 0;
    }

    case "adversary": {
      const book = positional(rest)[0]?.toUpperCase();
      if (book === undefined || !isBookCode(book)) {
        console.error("usage: yada adversary [--dry-run | --confirm] [--model MODEL] <BOOK>");
        return 2;
      }
      const model = flagValue(rest, "--model") ?? ADVERSARY_MODEL;
      if (!rest.includes("--confirm")) {
        if (!rest.includes("--dry-run")) {
          console.error("refusing to run: pass --dry-run to build the requests, or --confirm to submit them");
          return 2;
        }
        const db = openStaging();
        const requests = adversaryDryRun(db, book);
        db.close();
        const claims = requests.reduce((sum, r) => sum + r.claimIds.length, 0);
        console.log(`adversary --dry-run ${book}: NOTHING WAS SUBMITTED`);
        console.log(`  requests built: ${requests.length} (one per verse entry), ${claims} claims`);
        console.log(`  characters:     ${requests.reduce((s, r) => s + r.characters, 0).toLocaleString()}`);
        console.log(`  model:          ${model}`);
        console.log(`  written to:     content/requests/adversary/`);
        console.log(`  Token counts are not measured without credentials; --confirm runs count_tokens before each request.`);
        return 0;
      }
      try {
        requireApiKey();
      } catch (error) {
        console.error((error as Error).message);
        return 1;
      }
      const db = openStaging();
      const spentBefore = spentSoFar();
      console.log(`adversary --confirm ${book}: THIS WILL SPEND MONEY`);
      console.log(`  model:   ${model}`);
      console.log(`  ceiling: $${CEILING_USD} (already spent: $${spentBefore.toFixed(2)})\n`);
      const run = await runAdversary(db, book, model, { confirm: true, log: (line) => console.log(line) });
      const bar = disagreement(db, book, model);
      db.close();

      console.log(`\n  sent ${run.sent}, skipped ${run.skipped} (already judged or no claims), unusable ${run.unusable.length}`);
      console.log(`  spent this run: $${(spentSoFar() - spentBefore).toFixed(2)}`);
      if (run.humanDecisionsKept.length > 0) {
        console.log(`  contested after human review (status kept, verdicts stored): ${run.humanDecisionsKept.join(", ")}`);
      }
      console.log(`\n  verdicts by type: ${[...bar.byVerdict].map(([v, n]) => `${v} ${n}`).join(", ") || "none"}`);
      console.log(
        `  disagreement: ${bar.contested}/${bar.verdicts} (${pct(bar.contested, bar.verdicts)}), critical ${bar.critical}` +
          `  — 0C bar ≤${ZERO_C_MAX_DISAGREEMENT * 100}% and 0 critical: ${bar.meetsBar ? "MET" : "NOT MET"}`,
      );
      if (run.stoppedOn !== undefined) {
        console.error(`\n  STOPPED at ${run.stoppedOn.verse_id}: ${run.stoppedOn.error}`);
        return 1;
      }
      return run.unusable.length > 0 || !bar.meetsBar ? 1 : 0;
    }

    case "regress": {
      console.log("regress: CI tier (no API calls)\n");
      const checks = runCiTier();
      for (const check of checks) {
        console.log(`  ${check.status.toUpperCase().padEnd(4)}  ${check.name}`);
        for (const line of check.detail.slice(0, 6)) console.log(`        ${line}`);
      }
      const failures = checks.filter((c) => c.status === "fail").length;
      console.log(`\n  ${checks.length - failures}/${checks.length} checks not failing${failures > 0 ? `, ${failures} FAILED` : ""}`);
      if (!rest.includes("--live")) return failures > 0 ? 1 : 0;

      if (failures > 0) {
        console.error("\n  live tier not run: the CI tier failed, and spending against a broken corpus measures nothing");
        return 1;
      }
      if (!rest.includes("--confirm")) {
        if (!rest.includes("--dry-run")) {
          console.error("\nrefusing to run the live tier: pass --dry-run to describe it, or --confirm to spend");
          return 2;
        }
        console.log(`\nregress --live --dry-run: NOTHING WAS SUBMITTED`);
        console.log(`  would regenerate the pericope containing ${LIVE_VERSE} with ${LIVE_MODEL}`);
        console.log(`  and judge it structurally against golden/1co.14.34.json (see compareStructure)`);
        return 0;
      }
      try {
        const live = await runLiveRegress({ confirm: true });
        console.log(`\nregress --live: ${live.pericopeId} regenerated, $${live.costUsd.toFixed(3)}, ${live.stopReason ?? "?"}`);
        console.log(`  structural equivalence: ${live.comparison.ok ? "PASS" : "FAIL"}`);
        for (const p of live.comparison.problems) console.log(`    problem: ${p}`);
        for (const n of live.comparison.notes) console.log(`    note:    ${n}`);
        return live.comparison.ok ? 0 : 1;
      } catch (error) {
        console.error(`\n  live tier failed: ${(error as Error).message}`);
        return 1;
      }
    }

    case "publish": {
      const confirm = rest.includes("--confirm");
      if (!confirm && !rest.includes("--dry-run")) {
        console.error("refusing to run: pass --dry-run to verify and list, or --confirm to upload");
        return 2;
      }
      try {
        const report = await publish({ confirm });
        const plan = report.plan;
        console.log(`publish${report.dryRun ? " --dry-run: NOTHING WAS UPLOADED" : ": uploaded to R2"}`);
        console.log(`  verified: ${plan.bundles.length} bundles, ${formatBytes(totalBytes(plan))}, sha256 and size match the manifest`);
        for (const b of plan.bundles) console.log(`    ${b.info.file.padEnd(16)} ${b.info.review_gate}`);
        if (plan.ignored.length > 0) console.log(`  not in the manifest, not uploaded: ${plan.ignored.join(", ")}`);
        if (report.dryRun) {
          console.log(`  order on --confirm: bundles, then manifest.json last`);
        } else {
          console.log(`  unchanged (already published): ${report.unchanged.length}`);
          console.log(`  uploaded in order: ${report.uploaded.join(", ")}`);
        }
        return 0;
      } catch (error) {
        if (error instanceof PublishRefused) {
          console.error(error.message);
          return 1;
        }
        throw error;
      }
    }

    default: {
      console.log(
        "usage: yada <ingest|normalize|derive BOOK|oracle|generate [--dry-run|--confirm] BOOK|inspect|import-golden|" +
          "ingest-responses [--model M]|validate BOOK|adversary [--dry-run|--confirm] [--model M] BOOK|" +
          "regress [--live --dry-run|--live --confirm]|publish [--dry-run|--confirm]|package [core|BOOK] [--allow-unreviewed]>",
      );
      return command === undefined ? 0 : 2;
    }
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
