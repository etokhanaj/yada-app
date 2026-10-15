/**
 * `yada package translation <CODE>` — one downloadable file per public-domain version.
 *
 * docs/more-translations-plan.md: each version is a small SQLite file (`translation-ylt.v1.db`)
 * served from R2 and ATTACHed beside core on device. Core is unchanged. These texts are read
 * straight from content/raw and never pass through staging.db, so they cannot reach a prompt, the
 * adversary or regression (CLAUDE.md rule 9).
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { constants, gzipSync } from "node:zlib";

import {
  BUNDLE_FORMAT,
  isVerseId,
  TRANSLATION_DDL,
  parseVerseId,
  translationFileName,
  verseOrd,
  BOOK_CODES,
  type CoverTone,
  type Testament,
  type TranslationInfo,
} from "@yada/schema";

import { parseVpl } from "./english.js";
import { readHebrewNumberedVpl, type HebrewMappingReport } from "./hebrew-numbering.js";
import { BUNDLES, freshDb, highestVersionOnDisk, readBundleManifest, sha256File } from "./package.js";
import { RAW } from "./paths.js";
import { SOURCES } from "./sources.js";

export interface TranslationDef {
  code: string;
  name: string;
  year: number;
  /** Assigned in the plan's cover table; fixed per version. */
  cover: CoverTone;
  /** The SOURCES entry the text comes from. */
  source: string;
  /** One testament only; its verses alone are expected, and any outside it are refused. */
  testament?: Testament;
  publisher?: string;
  /** One line saying what kind of text it is. */
  description?: string;
  /**
   * "hebrew": printed in Hebrew verse order, with eBible's "(4-1)" markers, and placed on English
   * verse ids through TVTMS (hebrew-numbering.ts). Absent: already in English order.
   */
  numbering?: "hebrew";
}

export const DOWNLOADABLE: readonly TranslationDef[] = [
  { code: "ASV", name: "American Standard Version", year: 1901, cover: "sage", source: "asv" },
  { code: "YLT", name: "Young's Literal Translation", year: 1898, cover: "paper", source: "ylt" },
  { code: "MSB", name: "Majority Standard Bible", year: 2024, cover: "lime", source: "msb" },
  // A Jewish rendering for Compare and "Readers differ" (John, 12 Oct 2026): Isaiah 7:14 "the young
  // woman shall conceive". Public domain in the UK as well as the US: docs/research/jps-1917-licence.md.
  {
    code: "JPS",
    name: "JPS 1917",
    year: 1917,
    cover: "lime",
    source: "jps1917",
    testament: "OT",
    publisher: "Jewish Publication Society",
    description: "The 1917 Jewish translation in older English (thee and thou), for comparing, not for plain reading.",
    numbering: "hebrew",
  },
];

/** TVTMS, which places a Hebrew-ordered text's verses on English ids. */
export const TVTMS_FILE = "TVTMS.txt";

/**
 * The English versification every Yada verse id belongs to, taken from the KJV file core already
 * uses (31,102 verses).
 */
export const REFERENCE_VPL = "eng-kjv2006_vpl.txt";

export interface VerseGaps {
  /** In the versification, absent from the translation. */
  missing: string[];
  /** In the translation, absent from the versification: a different numbering, not extra text. */
  extra: string[];
}

function byOrd(a: string, b: string): number {
  const ra = parseVerseId(a);
  const rb = parseVerseId(b);
  if (ra === null || rb === null) return a.localeCompare(b);
  return verseOrd(ra.book, ra.chapter, ra.verse) - verseOrd(rb.book, rb.chapter, rb.verse);
}

export function verseGaps(reference: Iterable<string>, actual: Iterable<string>): VerseGaps {
  const want = new Set(reference);
  const have = new Set(actual);
  return {
    missing: [...want].filter((id) => !have.has(id)).sort(byOrd),
    extra: [...have].filter((id) => !want.has(id)).sort(byOrd),
  };
}

/**
 * The bytes publish uploads for a translation file, with Content-Encoding gzip. A file is about
 * 7.2 MB on disk and 3.3 MB like this; the search index stays inside the file, so the phone gets
 * it back exactly. Level 9, and node's gzip writes no name and a zero mtime, so the same file
 * gives the same bytes every time: `download_bytes` is computed here at packaging and checked
 * against this again at publish.
 */
export function gzipTranslation(bytes: Uint8Array): Buffer {
  return gzipSync(bytes, { level: constants.Z_BEST_COMPRESSION });
}

export class TranslationRefused extends Error {
  constructor(
    message: string,
    readonly gaps?: VerseGaps,
  ) {
    super(message);
  }
}

export interface TranslationReport {
  info: TranslationInfo;
  gaps: VerseGaps;
  reused: boolean;
  /** For a Hebrew-ordered text: how its verses were placed. */
  numbering?: HebrewMappingReport | undefined;
}

export interface PackageTranslationOptions {
  /** Defaults to content/raw; tests pass a fixture directory. */
  rawDir?: string;
  outDir?: string;
  previous?: TranslationInfo;
}

export function packageTranslation(code: string, options: PackageTranslationOptions = {}): TranslationReport {
  const def = DOWNLOADABLE.find((t) => t.code === code.toUpperCase());
  if (def === undefined) {
    throw new TranslationRefused(`unknown translation ${code}; one of ${DOWNLOADABLE.map((t) => t.code).join(", ")}`);
  }
  const source = SOURCES.find((s) => s.key === def.source);
  const file = source?.files[0];
  if (source === undefined || file?.sha256 === undefined) {
    throw new TranslationRefused(`${def.code} has no source entry pinned by digest`);
  }
  const rawDir = options.rawDir ?? RAW;
  const outDir = options.outDir ?? BUNDLES;
  const textFile = path.join(rawDir, file.file);
  if (!existsSync(textFile)) throw new TranslationRefused(`${file.file} is not in ${rawDir}; run \`yada ingest\``);

  // eBible keeps a verse's number with no words where the translation omits it (the ASV's
  // Matthew 23:14). Dropped here, it is listed in `missing`, which is what the app trusts.
  let numbering: HebrewMappingReport | undefined;
  let printed: Array<{ verse_id: string; text: string }>;
  if (def.numbering === "hebrew") {
    const tvtms = path.join(rawDir, TVTMS_FILE);
    if (!existsSync(tvtms)) throw new TranslationRefused(`${TVTMS_FILE} is not in ${rawDir}; run \`yada ingest\``);
    const mapped = readHebrewNumberedVpl(textFile, def.code, tvtms);
    numbering = mapped.report;
    // A new disagreement with TVTMS means the pinned text or TVTMS changed: look before shipping.
    if (mapped.report.unmapped.length > 0) {
      throw new TranslationRefused(
        `${def.code}: ${mapped.report.unmapped.length} passages carry a Hebrew number TVTMS places elsewhere ` +
          `(${mapped.report.dropped.join(", ")}). Check them against the KJV before accepting any.`,
      );
    }
    printed = mapped.verses;
  } else {
    printed = parseVpl(textFile, def.code);
  }
  const verses = printed.filter((v) => v.text.trim() !== "");
  const inScope = (id: string): boolean => {
    const book = parseVerseId(id)?.book;
    return def.testament === undefined || (book !== undefined && BOOK_CODES[book].testament === def.testament);
  };
  // An Old Testament text is measured against the Old Testament only; a verse it prints outside
  // it is `extra`, and refused below like any other.
  const reference = parseVpl(path.join(rawDir, REFERENCE_VPL), "KJV")
    .map((v) => v.verse_id)
    .filter(inScope);
  const gaps = verseGaps(reference, verses.map((v) => v.verse_id));
  // A verse number outside the English versification means the file follows another numbering,
  // and then the verses around it are shifted too (eBible's Geneva has Job 39:1 where English has
  // 38:39). Keyed as printed, Compare would set different verses side by side. Refused until the
  // text is mapped onto Yada's verse ids.
  if (gaps.extra.length > 0) {
    throw new TranslationRefused(
      `${def.code} numbers ${gaps.extra.length} verses outside the English versification and lacks ` +
        `${gaps.missing.length} of its verses, so its text is shifted against Yada's verse ids. ` +
        `It needs a versification mapping before it can be packaged.`,
      gaps,
    );
  }

  mkdirSync(outDir, { recursive: true });
  const name = `translation-${def.code.toLowerCase()}`;
  const tmp = path.join(outDir, `${name}.building.db`);
  const out = freshDb(tmp, TRANSLATION_DDL);
  out.exec("BEGIN");
  const meta = out.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  meta.run("format", String(BUNDLE_FORMAT));
  meta.run("code", def.code);
  meta.run("name", def.name);
  meta.run("year", String(def.year));
  meta.run("license", source.license);
  meta.run("attribution", source.attribution_text);
  meta.run("source", source.homepage);
  // The digest of the eBible archive the text came from; a file cannot hold its own hash.
  meta.run("source_sha256", file.sha256);
  meta.run("verses", String(verses.length));
  meta.run("missing", JSON.stringify(gaps.missing));
  if (def.testament !== undefined) meta.run("testament", def.testament);
  if (def.publisher !== undefined) meta.run("publisher", def.publisher);
  if (def.description !== undefined) meta.run("description", def.description);

  const insert = out.prepare("INSERT INTO texts (ord, text) VALUES (?, ?)");
  const rows = verses
    .map((v) => {
      const ref = parseVerseId(v.verse_id);
      if (ref === null) throw new TranslationRefused(`${def.code}: unreadable verse id ${v.verse_id}`);
      return { ord: verseOrd(ref.book, ref.chapter, ref.verse), text: v.text };
    })
    .sort((a, b) => a.ord - b.ord);
  for (const row of rows) insert.run(row.ord, row.text);
  out.exec("COMMIT");
  out.exec("INSERT INTO texts_fts(texts_fts) VALUES ('rebuild')");
  out.exec("INSERT INTO texts_fts(texts_fts) VALUES ('optimize')");
  out.exec("VACUUM");
  out.close();

  // Same immutability rule as core and book bundles: unchanged bytes keep the file, changed
  // bytes get a version above anything on disk.
  const sha = sha256File(tmp);
  const previous =
    options.previous ??
    (outDir === BUNDLES ? readBundleManifest()?.translations?.find((t) => t.code === def.code) : undefined);
  const downloadBytes = gzipTranslation(readFileSync(tmp)).length;
  if (previous !== undefined && previous.sha256 === sha && existsSync(path.join(outDir, previous.file))) {
    rmSync(tmp);
    // A manifest from before compression gains the size; the file itself is untouched.
    return { info: { ...previous, download_bytes: downloadBytes }, gaps, reused: true, numbering };
  }
  const version = Math.max(previous?.version ?? 0, highestVersionOnDisk(name, outDir)) + 1;
  const fileName = translationFileName(def.code, version);
  renameSync(tmp, path.join(outDir, fileName));
  return {
    info: {
      code: def.code,
      name: def.name,
      year: def.year,
      version,
      file: fileName,
      sha256: sha,
      bytes: statSync(path.join(outDir, fileName)).size,
      download_bytes: downloadBytes,
      format: BUNDLE_FORMAT,
      license: source.license,
      attribution: source.attribution_text,
      cover: def.cover,
      verses: verses.length,
      missing: gaps.missing.filter(isVerseId),
      ...(def.testament === undefined ? {} : { testament: def.testament }),
      ...(def.publisher === undefined ? {} : { publisher: def.publisher }),
      ...(def.description === undefined ? {} : { description: def.description }),
    },
    gaps,
    reused: false,
    numbering,
  };
}
