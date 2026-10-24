#!/usr/bin/env node
/**
 * `yada` — the pipeline CLI. Every stage is idempotent and resumable.
 *
 * Network access is limited to `ingest` and to the gated stages — `generate`,
 * `adversary`, `regress --live` and `publish` — each of which does nothing
 * without an explicit `--confirm`, and whose model calls go through budget.ts.
 * `batch status` and `batch collect` only read a batch already paid for;
 * `batch recover` is offline.
 */

import { momentsCommand } from "./moments.js";
import { officeCommand } from "./office.js";
import { copyFileSync, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { assertSchemaAlignment, openStaging } from "./db.js";
import { ORACLE_FIXTURES, checkAgainstFixture, coverage } from "./derive.js";
import { CEILING_USD, spentSoFar } from "./budget.js";
import { buildRequests, dryRun, loadPericopes } from "./generate.js";
import { inspectAll } from "./inspect.js";
import { BUNDLES, highestVersionOnDisk, packageCore, readBundleManifest, sha256File, writeBundleManifest } from "./package.js";
import { importGolden } from "./store.js";
import { BOOK_CODES, StudyInfoSchema, XREFS_PER_VERSE, formatDisplayRef, isBookCode, ordToParts, parseVerseId, speakersFileName, syntaxFileName, verseOrd, type BundleManifest } from "@yada/schema";
import { REPO_ROOT, ensureDirs } from "./paths.js";
import { MILESTONE_0_MODELS, generatePericope, type GenerationResult } from "./submit.js";
import { normalize } from "./normalize.js";
import { ingest } from "./sources.js";
import { ingestResponses } from "./responses.js";
import { validateBook } from "./validate-book.js";
import { ADVERSARY_MODEL, ZERO_C_MAX_DISAGREEMENT, adversaryDryRun, disagreement, runAdversary } from "./adversary.js";
import { requireApiKey } from "./budget.js";
import { LIVE_MODEL, LIVE_VERSE, runCiTier, runLiveRegress } from "./regress.js";
import { PublishRefused, formatBytes, pruneAudio, publish, totalBytes } from "./publish.js";
import { BatchNotEnded, batchStatus, collectBatch, recoverBatch, submitBatch } from "./batch.js";
import { DOWNLOADABLE, TranslationRefused, packageTranslation, type TranslationReport } from "./translations.js";
import { STUDY_FRAGMENT, StudyRefused, packageStudy, type StudyReport } from "./study.js";
import { AUDIO_TEXTS, AudioRefused, COMPUTER_VOICES, type ComputerVoice, NARRATORS, audioEntriesOnDisk, buildAudio, buildTitles, creditOf, type Narrator, narratorKind } from "./audio.js";
import { SyntaxRefused, packageSyntax, verseSyntax, type JoinCounts, type SyntaxReport, type SyntaxWord } from "./macula.js";
import { SpeakersRefused, packageSpeakers, passageSpeakers, type PassageSpeaker, type SpeakersReport } from "./glyssen.js";
import { UnderstandRefused } from "./understand/sources.js";
import { UNDERSTAND_DATA, packageUnderstandBook, understandManifestEntries, understandPaths, type UnderstandReport } from "./understand/package.js";
import { grammarCommand } from "./grammar.js";
import { introsCommand } from "./understand/intro.js";
import { basemapCommand } from "./understand/basemap.js";
import { placesCommand } from "./understand/bundleExtras.js";
import { wordLinksCommand } from "./understand/wordLinksReport.js";

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
async function confirmedRun(book: string, only?: string): Promise<number> {
  const models = only === undefined ? [...MILESTONE_0_MODELS] : [only];
  ensureDirs();
  const pericopes = loadPericopes(book);
  const spentBefore = spentSoFar();

  console.log(`generate --confirm ${book}: THIS WILL SPEND MONEY`);
  console.log(`  pericopes:     ${pericopes.length}`);
  console.log(`  models:        ${models.join(", ")}`);
  console.log(`  ceiling:       $${CEILING_USD} (already spent: $${spentBefore.toFixed(2)})`);
  console.log(`  usage log:     content/usage.jsonl\n`);

  const results: GenerationResult[] = [];
  for (const model of models) {
    for (const pericope of pericopes) {
      // A pericope too long for one response is several requests (generate.ts
      // chunkVerses); each is priced against the ceiling on its own.
      const parts = Math.max(buildRequests(book, pericope).length, 1);
      for (let part = 1; part <= parts; part += 1) {
        try {
          const result = await generatePericope(book, pericope, model, { confirm: true, ...(parts > 1 ? { part } : {}) });
          results.push(result);
          const perVerse = Math.round(result.outputTokens / Math.max(result.verses.length, 1));
          const label = result.parts === 1 ? result.pericopeId : `${result.pericopeId} ${result.part}/${result.parts}`;
          console.log(
            `  ${model.padEnd(17)} ${label.padEnd(16)} ` +
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
          console.error(`  FAILED ${model} ${pericope.id}${parts > 1 ? ` part ${part}/${parts}` : ""}: ${(error as Error).message}`);
          console.error(`  stopping. $${(spentSoFar() - spentBefore).toFixed(2)} spent this run.`);
          return 1;
        }
      }
    }
  }

  console.log(`\n  spent this run: $${(spentSoFar() - spentBefore).toFixed(2)}`);
  console.log(`  responses:      content/responses/`);
  console.log(`\n  Nothing here is reviewed. Every entry is flagged and must stay that way`);
  console.log(`  until a human has actually read it.`);
  return 0;
}

/**
 * The batch spending path: one Message Batch for the whole book. Its worst
 * case is checked against the ceiling as a single sum before submission,
 * because a submitted batch cannot be stopped request by request.
 */
async function confirmedBatch(book: string, only?: string): Promise<number> {
  const models = only === undefined ? [...MILESTONE_0_MODELS] : [only];
  ensureDirs();
  const pericopes = loadPericopes(book);

  console.log(`generate --batch --confirm ${book}: THIS WILL SPEND MONEY`);
  console.log(`  pericopes:     ${pericopes.length}`);
  console.log(`  models:        ${models.join(", ")}`);
  console.log(`  ceiling:       $${CEILING_USD} (already spent or reserved: $${spentSoFar().toFixed(2)})`);
  console.log(`  counting tokens for every request before anything is sent...\n`);

  const db = openStaging();
  try {
    const { batchId, plan } = await submitBatch(db, book, pericopes, models, { confirm: true });
    for (const s of plan.skipped) console.log(`  SKIP ${s.pericopeId} (${s.reason})`);
    console.log(`  submitted batch ${batchId}`);
    console.log(`  requests:      ${plan.requests.length}`);
    console.log(`  worst case:    $${plan.worstCaseUsd.toFixed(2)} (batch rate, every request at max_tokens)`);
    console.log(`  reserved in content/usage.jsonl until collected; measured cost replaces it.`);
    console.log(`\n  next: yada batch status ${batchId}`);
    console.log(`        yada batch collect ${batchId}   (once it has ended)`);
    return 0;
  } catch (error) {
    console.error(`  ${(error as Error).message}`);
    return 1;
  } finally {
    db.close();
  }
}

function packageTranslationCommand(code: string | undefined): number {
  if (code === undefined) {
    console.error(`usage: yada package translation <${DOWNLOADABLE.map((t) => t.code).join("|")}>`);
    return 2;
  }
  let report: TranslationReport;
  try {
    report = packageTranslation(code);
  } catch (error) {
    if (error instanceof TranslationRefused) {
      console.error(`package translation ${code.toUpperCase()}: REFUSED. ${error.message}`);
      if (error.gaps !== undefined) {
        console.error(`  numbered outside the versification: ${error.gaps.extra.join(", ")}`);
        console.error(`  missing from the versification:     ${error.gaps.missing.join(", ")}`);
      }
      return 1;
    }
    throw error;
  }
  const { info, gaps } = report;
  console.log(
    `  ${info.code.padEnd(9)} ${info.file.padEnd(24)} ${formatBytes(info.bytes)}  ` +
      `${info.download_bytes === undefined ? "" : `(${formatBytes(info.download_bytes)} gzipped)  `}${info.verses} verses` +
      `${report.reused ? "  (unchanged)" : ""}`,
  );
  if (report.numbering !== undefined) {
    const n = report.numbering;
    console.log(
      `  Hebrew order: ${n.segments} passages, ${n.renumbered} renumbered through TVTMS, ` +
        `${n.accepted.length} hand-checked divergences, ${n.unmapped.length} unmapped, headings removed at ${n.headings.join(" ")}`,
    );
  }
  console.log(
    gaps.missing.length === 0
      ? `  every verse of the ${info.testament === "OT" ? "Old Testament in the " : ""}English versification is present`
      : `  missing ${gaps.missing.length} verses of the English versification: ${gaps.missing.join(", ")}`,
  );
  const previous = readBundleManifest();
  const translations = [...(previous?.translations ?? []).filter((t) => t.code !== info.code), info].sort(
    (a, b) => DOWNLOADABLE.findIndex((t) => t.code === a.code) - DOWNLOADABLE.findIndex((t) => t.code === b.code),
  );
  writeBundleManifest(previous?.bundles ?? [], translations, downloadsOf(previous));
  console.log(`\npackage: manifest lists ${translations.length} translations -> content/bundles/manifest.json`);
  return 0;
}

/**
 * Not written into content/bundles/manifest.json: the entries go to a fragment beside the files,
 * because a manifest entry is what publish uploads and every phone then offers (John merges it).
 */
function packageStudyCommand(): number {
  let report: StudyReport;
  try {
    report = packageStudy();
  } catch (error) {
    if (error instanceof StudyRefused) {
      console.error(`package study: REFUSED. ${error.message}`);
      return 1;
    }
    throw error;
  }
  const { notes } = report;
  for (const { info, reused } of report.books) {
    console.log(
      `  study     ${info.file.padEnd(22)} ${formatBytes(info.bytes).padStart(9)}  (${formatBytes(info.download_bytes)} gzipped)` +
        `  ${info.notes} notes, ${info.xrefs} xrefs${reused ? "  (unchanged)" : ""}`,
    );
  }
  console.log(
    `  total     ${report.books.length} books, ${formatBytes(report.bytes)}  (${formatBytes(report.gzipBytes)} gzipped)`,
  );
  console.log(
    `  notes     ${notes.note} verse notes in ${report.noteBooks.length} books, ${notes.intro} introductions, ` +
      `${notes.intro_summary} summaries, ${notes.profile} profiles, ${notes.theme} theme articles`,
  );
  console.log(
    `  xrefs     ${report.xrefsKept} kept of ${report.xrefsRead} (the ${XREFS_PER_VERSE} best-voted per verse; ` +
      `${report.downvoted} downvoted rows left out)`,
  );
  console.log(`  manifest entries written to ${report.fragment}; manifest.json is unchanged`);
  const { outsideVersification: outside } = report;
  console.log(
    `  outside the English versification: ${outside.notes.length} notes${outside.notes.length > 0 ? ` (${outside.notes.join(", ")})` : ""}, ${outside.xrefs} cross-references`,
  );
  return 0;
}

function joinLine(lang: string, j: JoinCounts): string {
  return (
    `  ${lang.padEnd(9)} ${j.joined}/${j.words} words joined (${pct(j.joined, j.words)}); ` +
    `${j.noCoreVerse} in verses core has no tokens for, ${j.unaligned} with no matching token; ` +
    `${j.coreUnmatched} core tokens with no MACULA word; ${j.lettersOnly} joined on letters with different points or accents`
  );
}

/**
 * Not written into content/bundles/manifest.json: the app does not read the syntax layer yet, and
 * a manifest entry is what publish uploads.
 */
function packageSyntaxCommand(): number {
  let report: SyntaxReport;
  try {
    report = packageSyntax();
  } catch (error) {
    if (error instanceof SyntaxRefused) {
      console.error(`package syntax: REFUSED. ${error.message}`);
      return 1;
    }
    throw error;
  }
  console.log(
    `  syntax    ${report.file.padEnd(24)} ${formatBytes(report.bytes)}  (${formatBytes(report.gzipBytes)} gzipped)` +
      `${report.reused ? "  (unchanged)" : ""}`,
  );
  console.log(
    `  trees     ${report.books} books, ${report.rows} word rows, ${report.nodes} word groups (${report.clauses} clauses), ` +
      `${report.links} links (${report.danglingLinks} naming no word, ${report.emptyFrameArgs} frame arguments with none), ${report.emptyGroups} empty groups left out`,
  );
  if (report.danglingExamples.length > 0) console.log(`    naming no word: ${report.danglingExamples.slice(0, 8).join(" | ")}`);
  console.log(joinLine("greek", report.join.greek));
  console.log(joinLine("hebrew", report.join.hebrew));
  for (const [lang, j] of Object.entries(report.join)) {
    for (const [kind, list] of Object.entries(j.examples)) {
      if (list.length > 0) console.log(`    ${lang} ${kind}: ${list.slice(0, 8).join(" | ")}`);
    }
  }
  console.log(
    report.core === null
      ? "  core      no core bundle to check the join against"
      : `  core      ${report.coreMismatches.length} joined words whose surface differs from ${path.basename(report.core)}`,
  );
  for (const line of report.coreMismatches.slice(0, 10)) console.log(`    ${line}`);
  return report.coreMismatches.length === 0 ? 0 : 1;
}

/** A Hebrew word is several morph rows; print it once, morphs joined, glosses joined. */
function phrase(words: readonly SyntaxWord[]): string {
  const merged: Array<{ key: string; surface: string; english: string[] }> = [];
  for (const w of words) {
    const key = `${w.ord}!${w.word}`;
    const last = merged.at(-1);
    if (last?.key === key) {
      last.surface += w.surface;
      if (w.english !== null) last.english.push(w.english);
    } else merged.push({ key, surface: w.surface, english: w.english === null ? [] : [w.english] });
  }
  return merged.map((m) => `${m.surface}${m.english.length > 0 ? ` (${m.english.join(" ")})` : ""}`).join(" ");
}

/** `yada syntax JHN.3.16` — a verse's clauses and frames, straight from the syntax bundle. */
function syntaxCommand(verseId: string | undefined): number {
  const ref = verseId === undefined ? null : parseVerseId(verseId);
  if (ref === null) {
    console.error("usage: yada syntax <VERSE_ID>, e.g. yada syntax JHN.3.16");
    return 2;
  }
  const version = highestVersionOnDisk("syntax", BUNDLES);
  if (version === 0) {
    console.error("no syntax bundle; run `yada package syntax`");
    return 1;
  }
  const db = new DatabaseSync(path.join(BUNDLES, syntaxFileName(version)), { readOnly: true });
  const view = verseSyntax(db, verseOrd(ref.book, ref.chapter, ref.verse));
  db.close();
  for (const clause of view.clauses) {
    const indent = "  ".repeat(clause.depth + 1);
    console.log(`${indent}clause ${clause.rule ?? ""}${clause.role === null ? "" : ` [as ${clause.role}]`}`);
    for (const part of clause.constituents) console.log(`${indent}  ${part.role.padEnd(4)} ${phrase(part.words)}`);
  }
  if (view.frames.length > 0) console.log("  frames");
  for (const frame of view.frames) {
    console.log(`    ${phrase([frame.verb])}: ${frame.args.map((a) => `${a.arg} = ${phrase(a.words)}`).join("; ")}`);
  }
  return 0;
}

/**
 * Not written into content/bundles/manifest.json, like the syntax layer: the app does not read
 * speakers yet, and a manifest entry is what publish uploads.
 */
function packageSpeakersCommand(): number {
  let report: SpeakersReport;
  try {
    report = packageSpeakers();
  } catch (error) {
    if (error instanceof SpeakersRefused) {
      console.error(`package speakers: REFUSED. ${error.message}`);
      return 1;
    }
    throw error;
  }
  console.log(
    `  speakers  ${report.file.padEnd(24)} ${formatBytes(report.bytes)}  (${formatBytes(report.gzipBytes)} gzipped)` +
      `${report.reused ? "  (unchanged)" : ""}`,
  );
  console.log(`  licence   MIT, LICENSE and GlyssenCharacters.csproj re-read: ${report.copyright.join(" | ")}`);
  console.log(
    `  control   version ${report.controlFileVersion}: ${report.lines} lines (${report.comments} '#' lines skipped) -> ${report.rows} verse rows in ${report.books} books`,
  );
  console.log(
    `  mapped    ${report.mapped}/${report.rows} rows to a core verse (${pct(report.mapped, report.rows)}); ${report.unmapped} rows name a verse ${path.basename(report.core)} does not have`,
  );
  for (const line of report.unmappedExamples.slice(0, 10)) console.log(`    ${line}`);
  console.log(
    `  standing  speaks ${report.byStanding.speaks}, uncertain ${report.byStanding.uncertain}, reported ${report.byStanding.reported}; ` +
      Object.entries(report.byQuoteType)
        .sort((a, b) => b[1] - a[1])
        .map(([type, n]) => `${type} ${n}`)
        .join(", "),
  );
  console.log(
    `  people    ${report.characters} character IDs; used but not in CharacterDetail.txt: ` +
      Object.entries(report.notInDetail)
        .filter(([, n]) => n > 0)
        .map(([kind, n]) => `${n} ${kind}`)
        .join(", ") +
      `; ${report.undescribedParts.length} parts of "/" IDs undescribed; ${report.deliveryTo} rows with an explicit "to X" delivery note`,
  );
  if (report.undescribedParts.length > 0) console.log(`    undescribed parts: ${report.undescribedParts.slice(0, 10).join(" | ")}`);
  return report.unmapped === 0 ? 0 : 1;
}

/** "1:19-34", or "1:19-2:3" across chapters. */
function verses(ords: readonly number[]): string {
  const runs: Array<[number, number]> = [];
  for (const ord of ords) {
    const last = runs.at(-1);
    if (last !== undefined && ord === last[1] + 1) last[1] = ord;
    else runs.push([ord, ord]);
  }
  return runs
    .map(([a, b]) => {
      const x = ordToParts(a);
      const y = ordToParts(b);
      if (a === b) return `${x.chapter}:${x.verse}`;
      return x.chapter === y.chapter ? `${x.chapter}:${x.verse}-${y.verse}` : `${x.chapter}:${x.verse}-${y.chapter}:${y.verse}`;
    })
    .join(", ");
}

function speakerLine(s: PassageSpeaker): string {
  const to = s.deliveryTo.length > 0 ? `; delivery note "to ${s.deliveryTo.join('", "to ')}"` : "";
  const alias = s.aliases.length > 0 ? `; alias "${s.aliases.join('", "')}"` : "";
  return `    ${s.name}  (${verses(s.ords)}; ${s.quoteTypes.join(", ")}${to}${alias})`;
}

/** `yada speakers JHN.1.19 JHN.1.34` — who Glyssen says speaks in a range, from the speakers bundle. */
function speakersCommand(fromId: string | undefined, toId: string | undefined): number {
  const from = fromId === undefined ? null : parseVerseId(fromId);
  const to = toId === undefined ? from : parseVerseId(toId);
  if (from === null || to === null) {
    console.error("usage: yada speakers <FROM_VERSE_ID> [TO_VERSE_ID], e.g. yada speakers JHN.1.19 JHN.1.34");
    return 2;
  }
  const version = highestVersionOnDisk("speakers", BUNDLES);
  if (version === 0) {
    console.error("no speakers bundle; run `yada package speakers`");
    return 1;
  }
  const db = new DatabaseSync(path.join(BUNDLES, speakersFileName(version)), { readOnly: true });
  const view = passageSpeakers(db, verseOrd(from.book, from.chapter, from.verse), verseOrd(to.book, to.chapter, to.verse));
  db.close();
  console.log(`${formatDisplayRef(from)} to ${formatDisplayRef(to)}`);
  const groups = [
    ["speaking", view.speaking],
    ["uncertain (Potential, Rare, Hypothetical, Alternate: not to be shown as fact)", view.uncertain],
    ["reported (Indirect, Quotation, Interruption)", view.reported],
    ["markers (narrator, interruption, Needs Review, scripture)", view.markers],
  ] as const;
  for (const [label, list] of groups) {
    if (list.length === 0) continue;
    console.log(`  ${label}`);
    for (const s of list) console.log(speakerLine(s));
  }
  return 0;
}

/** The manifest's download lists, passed through by a command that rewrites only bundles or translations. */
function downloadsOf(manifest: BundleManifest | null): Pick<BundleManifest, "study" | "understand" | "audio"> {
  return {
    ...(manifest?.study === undefined ? {} : { study: manifest.study }),
    ...(manifest?.understand === undefined ? {} : { understand: manifest.understand }),
    ...(manifest?.audio === undefined ? {} : { audio: manifest.audio }),
  };
}

/**
 * `yada audio JHN [--narrator=hays|heart|george]`: encode and time a book's chapters from content/raw/audio/<narrator>
 * (audio.ts), and list them in the manifest's `audio`. Exits 1 when a chapter's words don't match the text
 * well enough (another printing) or nothing was found. Nothing is published.
 */
async function audioCommand(args: readonly string[]): Promise<number> {
  const book = args.find((a) => !a.startsWith("--"))?.toUpperCase();
  const narratorArg = args.find((a) => a.startsWith("--narrator="))?.split("=")[1] ?? "hays";
  const translation = args.find((a) => a.startsWith("--translation="))?.split("=")[1] ?? "BSB";
  // One chapter, to hear a voice before a whole book is made.
  const chapterArg = args.find((a) => a.startsWith("--chapter="))?.split("=")[1];
  const only = chapterArg === undefined ? null : Number(chapterArg);
  const badChapter = only !== null && (book === undefined || !isBookCode(book) || !Number.isInteger(only) || only < 1 || only > BOOK_CODES[book].chapters);
  if (book === undefined || !isBookCode(book) || !Object.hasOwn(NARRATORS, narratorArg) || badChapter) {
    console.error(`usage: yada audio <BOOK> [--narrator=${Object.keys(NARRATORS).join("|")}] [--translation=BSB] [--chapter=N]`);
    return 2;
  }
  const narrator = narratorArg as Narrator;
  // The merge below matches book and voice only: another version's reading is listed by audio-manifest.
  if (translation !== "BSB" && !args.includes("--no-manifest")) {
    console.error("audio: a WEB, KJV or LSV reading takes --no-manifest; yada audio-manifest lists it");
    return 2;
  }
  let report: Awaited<ReturnType<typeof buildAudio>>;
  try {
    report = await buildAudio(book, narrator, translation, undefined, only);
  } catch (error) {
    if (error instanceof AudioRefused) {
      console.error(`audio ${book}: REFUSED. ${error.message}`);
      return 1;
    }
    throw error;
  }
  console.log(`audio ${book} (${NARRATORS[narrator].name}): ${report.chapters.length} chapters encoded; ${report.missing.length} not in content/raw/audio/${narrator}`);
  for (const l of report.lowMatch) console.log(`  chapter ${l.chapter}: only ${(l.matched * 100).toFixed(1)}% of the text heard; left out of the manifest`);
  if (report.chapters.length === 0) return 1;
  // Several books at once (both voices in parallel) each skip this and leave it to `yada audio-manifest`,
  // which lists what is on disk: two runs rewriting manifest.json together could drop each other's entry.
  if (args.includes("--no-manifest")) return report.lowMatch.length > 0 ? 1 : 0;
  const previous = readBundleManifest();
  if (previous === null) {
    console.error("audio: content/bundles/manifest.json is missing or unreadable");
    return 1;
  }
  // A chapter below the match floor is likely another printing: it never reaches the manifest, so
  // publish cannot ship words that differ from the text highlighted (the printing check).
  const low = new Set(report.lowMatch.map((l) => l.chapter));
  const chapters = report.chapters.filter((c) => !low.has(c.chapter));
  if (chapters.length === 0) return 1;
  // A one-chapter run adds to the book's entry; it never drops the chapters already made.
  const made = new Set(chapters.map((c) => c.chapter));
  const kept = only === null ? [] : (previous.audio ?? []).find((a) => a.book === book && a.narrator === narrator && a.translation === "BSB")?.chapters.filter((c) => !made.has(c.chapter)) ?? [];
  const entry = { book, translation: "BSB" as const, narrator, narrator_name: NARRATORS[narrator].name, kind: narratorKind(narrator), ...creditOf(narrator), chapters: [...kept, ...chapters].sort((a, b) => a.chapter - b.chapter) };
  const audio = [...(previous.audio ?? []).filter((a) => !(a.book === book && a.narrator === narrator && a.translation === "BSB")), entry];
  writeBundleManifest(previous.bundles, previous.translations ?? [], { ...downloadsOf(previous), audio });
  return report.lowMatch.length > 0 ? 1 : 0;
}

/** `yada audio-titles <BOOK> [--narrator=heart]`: the chapter names in a computer voice; `audio-manifest` lists them. */
async function audioTitlesCommand(args: readonly string[]): Promise<number> {
  const code = args.find((a) => !a.startsWith("--"))?.toUpperCase();
  const voice = args.find((a) => a.startsWith("--narrator="))?.split("=")[1] ?? "heart";
  if (code === undefined || !isBookCode(code) || !Object.hasOwn(COMPUTER_VOICES, voice)) {
    console.error(`usage: yada audio-titles <BOOK> [--narrator=${Object.keys(COMPUTER_VOICES).join("|")}]`);
    return 2;
  }
  try {
    const titles = await buildTitles(code, voice as ComputerVoice);
    console.log(`audio-titles ${code} (${NARRATORS[voice as ComputerVoice].name}): ${titles.spans.length} chapters, ${formatBytes(titles.bytes)}`);
    return 0;
  } catch (e) {
    if (e instanceof AudioRefused) {
      console.error(`audio-titles: ${e.message}`);
      return 1;
    }
    throw e;
  }
}

/**
 * `yada audio-manifest [--narrator=heart,george]`: the manifest's `audio` list for those voices, rebuilt
 * from the chapters on disk in bundles/audio/<voice>/ and its web/, kjv/, lsv/ (each m4a with its timings, admitted only if it
 * passes the check); the other voices' entries are kept. After a parallel `yada audio … --no-manifest` run.
 */
function audioManifestCommand(args: readonly string[]): number {
  const voices = (args.find((a) => a.startsWith("--narrator="))?.split("=")[1] ?? "heart,george").split(",");
  if (!voices.every((v) => Object.hasOwn(NARRATORS, v))) {
    console.error(`usage: yada audio-manifest [--narrator=${Object.keys(NARRATORS).join(",")}]`);
    return 2;
  }
  const previous = readBundleManifest();
  if (previous === null) {
    console.error("audio-manifest: content/bundles/manifest.json is missing or unreadable");
    return 1;
  }
  const entries = voices.flatMap((v) => AUDIO_TEXTS.flatMap((t) => audioEntriesOnDisk(v as Narrator, undefined, t)));
  const audio = [...(previous.audio ?? []).filter((a) => !voices.includes(a.narrator)), ...entries];
  writeBundleManifest(previous.bundles, previous.translations ?? [], { ...downloadsOf(previous), audio });
  const chapters = entries.reduce((n, e) => n + e.chapters.length, 0);
  const bytes = entries.reduce((n, e) => n + e.chapters.reduce((m, c) => m + c.bytes, 0), 0);
  console.log(`audio-manifest: ${entries.length} books, ${chapters} chapters, ${(bytes / 1e9).toFixed(2)} GB for ${voices.join(", ")}`);
  return 0;
}

/**
 * `yada manifest`: list every book's newest Understand bundle and every study bundle in
 * content/bundles/manifest.json, and drop the retired AI per-book bundles (docs/no-ai-understand.md:
 * "Bundles stop shipping entries"). Study follows docs/research/manifest-merge-plan.md: the fragment's
 * entries as they stand, minus John, whose notes ship inside the app. Each listed file is checked
 * against its entry first, and the manifest is copied aside before it is rewritten. Nothing is
 * published: R2 is John's step.
 */
function manifestCommand(): number {
  const previous = readBundleManifest();
  if (previous === null) {
    console.error("manifest: content/bundles/manifest.json is missing or unreadable");
    return 1;
  }
  const backup = path.join(BUNDLES, `manifest.json.bak-${new Date().toISOString().slice(0, 10)}`);
  if (!existsSync(backup)) copyFileSync(path.join(BUNDLES, "manifest.json"), backup);
  const fragment = path.join(BUNDLES, STUDY_FRAGMENT);
  if (!existsSync(fragment) && (previous.study?.length ?? 0) > 0) {
    // Without the fragment the merge would write an empty list and drop every book's notes.
    console.error(`manifest: refused, nothing written: ${STUDY_FRAGMENT} is missing; run \`yada package study\` first`);
    return 1;
  }
  const study = existsSync(fragment)
    ? StudyInfoSchema.array().parse((JSON.parse(readFileSync(fragment, "utf8")) as { study?: unknown }).study).filter((s) => s.book !== "JHN")
    : [];
  const skipped: string[] = [];
  const understand = understandManifestEntries(BUNDLES, skipped);
  const problems = study.flatMap((s) => {
    const file = path.join(BUNDLES, s.file);
    if (!existsSync(file)) return [`${s.file} is not on disk`];
    return statSync(file).size === s.bytes && sha256File(file) === s.sha256 ? [] : [`${s.file} does not match its fragment entry`];
  });
  if (problems.length > 0) {
    console.error(`manifest: refused, nothing written:\n  ${problems.join("\n  ")}`);
    return 1;
  }
  const bundles = previous.bundles.filter((b) => b.kind === "core");
  writeBundleManifest(bundles, previous.translations ?? [], { study, understand, ...(previous.audio === undefined ? {} : { audio: previous.audio }) });
  console.log(`manifest: ${bundles.length} core, ${previous.translations?.length ?? 0} translations, ${study.length} study, ${understand.length} understand -> content/bundles/manifest.json (previous kept as ${path.basename(backup)})`);
  for (const u of understand) console.log(`  ${u.book.padEnd(4)} ${u.file.padEnd(24)} ${formatBytes(u.download_bytes)} to download`);
  if (skipped.length > 0) console.log(`  left out, over the 15% flag stop: ${skipped.join(", ")}`);
  return 0;
}

/**
 * `yada understand JHN`: the book's Understand without AI (docs/no-ai-understand.md) into
 * content/bundles/understand-jhn.vN.db, read from YADA_ROOT (a worktree has no content/), plus the
 * per-book report. Not written into the manifest and never published: R2 is John's step. Exits 1
 * when more than 15% of the summaries are flagged, the rollout's stop rule.
 */
function understandCommand(book: string | undefined): number {
  const code = book?.toUpperCase();
  if (code === undefined || !isBookCode(code)) {
    console.error("usage: yada understand <BOOK>, e.g. yada understand JHN");
    return 2;
  }
  let report: UnderstandReport;
  try {
    report = packageUnderstandBook(code);
  } catch (error) {
    if (error instanceof UnderstandRefused) {
      console.error(`understand ${code}: REFUSED. ${error.message}`);
      return 1;
    }
    throw error;
  }
  const { verses: v, passages: p } = report;
  console.log(
    `  understand ${report.file.padEnd(26)} ${formatBytes(report.bytes)}${report.reused ? "  (unchanged)" : ""}  -> ${understandPaths().bundles}`,
  );
  console.log(
    `  verses    ${v.verses} (${v.missing} the BSB leaves out); plain ${pct(v.plain, v.verses - v.missing)}, readers differ ${v.readersDiffer}, ` +
      `facts ${pct(v.facts, v.verses - v.missing)}, key words ${pct(v.keyWords, v.verses - v.missing)}; over budget ${v.overBudget}; ` +
      `leaks ${v.leaks.length}${v.leaks.length > 0 ? ` (${v.leaks.slice(0, 3).join(", ")})` : ""}; NLT in beginner lines ${v.nltInBeginner.length}`,
  );
  console.log(
    `  sources   UST ${p.coverage.ust}% · tQ ${p.coverage.tq}% · tN chapter outline lines ${p.outlineLines} · book outline ${p.bookOutline} · ` +
      `OBS ${p.coverage.obs}% · Glyssen speakers ${p.coverage.speakers}%`,
  );
  const reasons = Object.entries(p.reasons)
    .sort()
    .map(([k, n]) => `${k}: ${n}`)
    .join(", ");
  console.log(
    `  passages  ${p.summaries} summaries · ${p.passing} pass and ship · ${p.flagged.length} flagged for John${reasons === "" ? "" : ` (${reasons})`}` +
      (p.stop ? "  ** STOP: over 15% flagged, a source gap; fix rules before release **" : ""),
  );
  for (const f of p.flagged) console.log(`    flagged ${f.id}: ${f.flags.join("; ")}`);
  if (p.awaitingDebates.length > 0) {
    console.log(`  debates   awaiting a note (nothing shown until John approves one): ${p.awaitingDebates.join("; ")}`);
  }
  console.log(`  sample    for John to read once: ${p.sample.join(", ")}`);
  const x = report.extras;
  console.log(
    `  build 6   word links ${x.links.linked}/${x.links.tokens} tokens (${x.links.skipped} skipped, rule 4; ${x.links.versesWithSkip} verses with a skip) · ` +
      `places ${x.places} in ${x.versesWithPlaces} verses, ${x.namesMarked} named in the BSB`,
  );
  return p.stop || v.nltInBeginner.length > 0 ? 1 : 0;
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
        `  glosses: TAGNT ${g.bySource.TAGNT}, TAHOT ${g.bySource.TAHOT}, TBESG fallback ${g.bySource.TBESG}, TBESH fallback ${g.bySource.TBESH}, ` +
          `unglossed ${g.unglossed} of ${g.tokens} (${((1 - g.unglossed / Math.max(g.tokens, 1)) * 100).toFixed(1)}% glossed)`,
      );
      if (g.weakBooks.length > 0) {
        console.log(
          `  books under 90% aligned: ${g.weakBooks.map((b) => `${b.book} ${(b.coverage * 100).toFixed(0)}%`).join(", ")}`,
        );
      }
      const t = report.texts.byTranslation;
      console.log(`  English: BSB ${t.BSB}, WEB ${t.WEB}, KJV ${t.KJV}, LSV ${t.LSV} verses`);
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
      // An unresolved ref is a verse whose words were not stored: a lost word
      // must fail the stage, not scroll past in a log that exits 0.
      return report.unresolved.length > 0 ? 1 : 0;
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
      // `package`            core (the AI entries' per-book bundles are retired: docs/no-ai-understand.md)
      // `package translation ASV`  one downloadable translation
      if (rest[0] === "translation") return packageTranslationCommand(rest[1]);
      // `package study`  one Tyndale notes and OpenBible cross-references file per book, plus a manifest fragment
      if (rest[0] === "study") return packageStudyCommand();
      // `package syntax`  MACULA Greek and Hebrew syntax trees, outside the manifest
      if (rest[0] === "syntax") return packageSyntaxCommand();
      // `package speakers`  Glyssen's speakers per verse, outside the manifest
      if (rest[0] === "speakers") return packageSpeakersCommand();
      if (rest[0] !== undefined && rest[0].toLowerCase() !== "core") {
        console.error(`package ${rest[0]}: Understand bundles are built by \`yada understand ${rest[0].toUpperCase()}\` and listed by \`yada manifest\``);
        return 2;
      }
      const previousManifest = readBundleManifest();
      const core = packageCore();
      console.log(
        `  core      ${core.info.file.padEnd(14)} ${(core.info.bytes / 1048576).toFixed(1)} MB  ` +
          `${core.verses} verses, ${core.texts} texts, ${core.tokens} tokens`,
      );
      writeBundleManifest([core.info], previousManifest?.translations ?? [], downloadsOf(previousManifest));
      console.log("\npackage: core built -> content/bundles/manifest.json");
      return 0;
    }

    case "manifest":
      return manifestCommand();

    case "audio":
      return await audioCommand(rest);

    case "audio-prune": {
      const report = await pruneAudio({ confirm: rest.includes("--confirm") });
      if (!rest.includes("--confirm")) {
        console.log(`audio-prune: dry run; ${report.kept.length} chapters on this Mac would be checked against R2. Add --confirm.`);
        return 0;
      }
      console.log(`audio-prune: removed ${report.removed.length} chapters (${formatBytes(report.bytes)}) the bucket holds; kept ${report.kept.length}`);
      return 0;
    }

    case "audio-titles":
      return await audioTitlesCommand(rest);

    case "audio-manifest":
      return audioManifestCommand(rest);

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
      // An unreadable response is a response nothing was measured from.
      return report.parseFailures > 0 || provenance.length > 0 || report.unreadable.length > 0 ? 1 : 0;
    }

    case "generate": {
      const book = rest.find((arg, i) => !arg.startsWith("--") && rest[i - 1] !== "--model");
      if (book === undefined) {
        console.error("usage: yada generate [--dry-run | --confirm] [--batch] [--model M] <BOOK>");
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
      const modelFlag = rest.indexOf("--model");
      const only = modelFlag === -1 ? undefined : rest[modelFlag + 1];
      return rest.includes("--batch") ? await confirmedBatch(book, only) : await confirmedRun(book, only);
    }

    case "batch": {
      const [action, batchId] = rest;
      if ((action !== "status" && action !== "collect" && action !== "recover") || batchId === undefined) {
        console.error("usage: yada batch <status|collect|recover> <BATCH_ID>");
        return 2;
      }
      const db = openStaging();
      try {
        if (action === "recover") {
          const report = recoverBatch(db, batchId);
          console.log(`batch recover ${batchId}:`);
          if (report.batchRow) console.log(`  batches row rebuilt`);
          for (const id of report.restaged) console.log(`  request map rebuilt from usage.jsonl: ${id}`);
          for (const id of report.reserved) console.log(`  worst case re-reserved from staging.db: ${id}`);
          if (!report.batchRow && report.restaged.length === 0 && report.reserved.length === 0) {
            console.log(`  nothing missing; already recorded`);
          }
          console.log(`\n  next: yada batch status ${batchId}`);
          return 0;
        }
        if (action === "status") {
          const status = await batchStatus(db, batchId);
          const c = status.counts;
          console.log(`batch ${batchId} (${status.book}): ${status.processingStatus}`);
          console.log(`  processing ${c.processing}, succeeded ${c.succeeded}, errored ${c.errored}, canceled ${c.canceled}, expired ${c.expired}`);
          console.log(`  created ${status.createdAt}${status.endedAt === null ? "" : `, ended ${status.endedAt}`}`);
          if (status.processingStatus === "ended") console.log(`  next: yada batch collect ${batchId}`);
          return 0;
        }
        ensureDirs();
        const report = await collectBatch(db, batchId);
        let failed = 0;
        for (const r of report.collected) {
          if (r.result !== "succeeded") {
            failed += 1;
            console.log(`  ${r.result.toUpperCase()} ${r.model} ${r.pericopeId}${r.error === undefined ? "" : `: ${r.error}`} (worst case stays reserved)`);
            continue;
          }
          console.log(
            `  ${r.model.padEnd(17)} ${r.pericopeId.padEnd(16)} in ${r.inputTokens} out ${r.outputTokens} ` +
              `(thinking ${r.thinkingTokens}) $${(r.costUsd ?? 0).toFixed(3)} ${r.stopReason ?? "?"}`,
          );
          if (r.stopReason === "max_tokens") console.log(`    TRUNCATED — max_tokens reached. This entry is incomplete.`);
        }
        const cost = report.collected.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
        console.log(`\nbatch collect ${batchId}: ${report.collected.length} new results, $${cost.toFixed(2)} measured`);
        if (report.alreadyCollected > 0) console.log(`  already collected earlier: ${report.alreadyCollected}`);
        for (const id of report.unknown) console.log(`  UNKNOWN custom_id ${id} — not submitted from here, ignored`);
        for (const id of report.missing) console.log(`  MISSING ${id} — no result yet`);
        console.log(`  responses:  content/responses/ — run yada ingest-responses to store them as flagged.`);
        console.log(`\n  Nothing here is reviewed. Every entry is flagged and must stay that way`);
        console.log(`  until a human has actually read it.`);
        return failed > 0 || report.unknown.length > 0 || report.missing.length > 0 ? 1 : 0;
      } catch (error) {
        if (error instanceof BatchNotEnded) {
          console.error(error.message);
          return 1;
        }
        throw error;
      } finally {
        db.close();
      }
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
        for (const b of plan.bundles) {
          console.log(`    ${b.info.file.padEnd(24)} ${"review_gate" in b.info ? b.info.review_gate : "code" in b.info ? "translation" : "passages" in b.info ? "understand" : b.info.file.startsWith("audio/") ? "audio" : "study"}`);
        }
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

    case "syntax":
      return syntaxCommand(rest[0]);

    case "speakers":
      return speakersCommand(rest[0], rest[1]);

    case "understand":
      return understandCommand(rest[0]);

    case "intros":
      return introsCommand(rest, understandPaths().raw, UNDERSTAND_DATA);

    // Build 8: the Daily Office lectionary, morning only, for Daily prayer.
    case "office":
      return officeCommand(rest, { raw: understandPaths().raw, appFile: path.join(REPO_ROOT, "apps/mobile/src/data/office.generated.ts") });

    // Build 11h: verses for a moment, drafts for John's review (OpenBible topic scores, CC BY 4.0).
    case "moments":
      return momentsCommand(rest, { raw: understandPaths().raw, reviewFile: path.join(UNDERSTAND_DATA, "moments.json") });

    case "grammar": {
      const { raw, bundles } = understandPaths();
      return grammarCommand(rest, { raw, bundles, dataDir: UNDERSTAND_DATA, appFile: path.join(REPO_ROOT, "apps/mobile/src/data/grammar.generated.ts") });
    }

    // Build 6 dry runs: nothing written (MM-03, MS-01).
    case "word-links":
      return wordLinksCommand(rest);

    case "places":
      return placesCommand(rest);

    // Not a dry run: writes apps/mobile/src/data/basemap.generated.ts.
    case "basemap":
      return basemapCommand();

    default: {
      console.log(
        "usage: yada <ingest|normalize|derive BOOK|oracle|generate [--dry-run|--confirm] [--batch] BOOK|" +
          "batch <status|collect|recover> ID|inspect|import-golden|" +
          "ingest-responses [--model M]|validate BOOK|adversary [--dry-run|--confirm] [--model M] BOOK|" +
          "regress [--live --dry-run|--live --confirm]|publish [--dry-run|--confirm]|package [core|BOOK] [--allow-unreviewed]|package translation CODE|package study|package syntax|syntax VERSE_ID|package speakers|speakers FROM [TO]|understand BOOK|intros [--write]|grammar [--write]|word-links [BOOK]|places [BOOK]|basemap>",
      );
      return command === undefined ? 0 : 2;
    }
  }
}

main()
  .then((code) => {
    // `audio` lets Node exit by itself: process.exit with Kokoro's onnxruntime loaded aborts (exit 134,
    // 12 Oct 2026), and a wrong exit code is never trusted (rule 7).
    if (process.argv[2] === "audio" || process.argv[2] === "audio-titles") process.exitCode = code;
    else process.exit(code);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
