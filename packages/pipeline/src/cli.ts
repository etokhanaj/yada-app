#!/usr/bin/env node
/**
 * `yada` — the pipeline CLI. Every stage is idempotent and resumable.
 *
 * No stage performs network access except `ingest`, and no stage calls a
 * generation API: `generate` builds and prices requests, then stops.
 */

import { assertSchemaAlignment, openStaging } from "./db.js";
import { ORACLE_FIXTURES, checkAgainstFixture, coverage } from "./derive.js";
import { CEILING_USD, spentSoFar } from "./budget.js";
import { dryRun, loadPericopes } from "./generate.js";
import { ensureDirs } from "./paths.js";
import { MILESTONE_0_MODELS, generatePericope, type GenerationResult } from "./submit.js";
import { normalize } from "./normalize.js";
import { ingest } from "./sources.js";

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

    default: {
      console.log("usage: yada <ingest|normalize|derive BOOK|oracle|generate --dry-run BOOK>");
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
