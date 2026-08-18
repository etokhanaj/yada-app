#!/usr/bin/env node
/**
 * `yada` — the pipeline CLI. Every stage is idempotent and resumable.
 *
 * No stage performs network access except `ingest`, and no stage calls a
 * generation API: `generate` builds and prices requests, then stops.
 */

import { assertSchemaAlignment, openStaging } from "./db.js";
import { ORACLE_FIXTURES, checkAgainstFixture, coverage } from "./derive.js";
import { dryRun } from "./generate.js";
import { normalize } from "./normalize.js";
import { ingest } from "./sources.js";

function pct(part: number, whole: number): string {
  return whole === 0 ? "n/a" : `${((part / whole) * 100).toFixed(1)}%`;
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
        console.error("usage: yada generate --dry-run <BOOK>");
        return 2;
      }
      if (!rest.includes("--dry-run")) {
        console.error("refusing to run: only --dry-run is implemented, by design");
        return 2;
      }
      dryRun(book);
      return 0;
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
