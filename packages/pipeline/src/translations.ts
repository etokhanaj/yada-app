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
  type CoverTone,
  type TranslationInfo,
} from "@yada/schema";

import { parseVpl } from "./english.js";
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
}

export const DOWNLOADABLE: readonly TranslationDef[] = [
  { code: "ASV", name: "American Standard Version", year: 1901, cover: "sage", source: "asv" },
  { code: "YLT", name: "Young's Literal Translation", year: 1898, cover: "paper", source: "ylt" },
  { code: "MSB", name: "Majority Standard Bible", year: 2024, cover: "lime", source: "msb" },
];

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
  const verses = parseVpl(textFile, def.code).filter((v) => v.text.trim() !== "");
  const reference = parseVpl(path.join(rawDir, REFERENCE_VPL), "KJV").map((v) => v.verse_id);
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
    return { info: { ...previous, download_bytes: downloadBytes }, gaps, reused: true };
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
    },
    gaps,
    reused: false,
  };
}
