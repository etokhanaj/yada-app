/**
 * `yada package speakers` — Glyssen's character-per-verse data in one file (`speakers.vN.db`, DDL
 * in @yada/schema speakers.ts).
 *
 * Glyssen is SIL and Faith Comes By Hearing's tool for scripting dramatised audio Bibles. Its
 * control file CharacterVerse.txt lists, verse by verse, the characters its authors expect to
 * speak and how (the quote type), and CharacterDetail.txt describes each character. A free,
 * non-AI evidence layer: every value is copied from those two files, never inferred (CLAUDE.md
 * rule 4). Nothing is read into staging.db or a prompt.
 *
 * What the files do not say is not said here either: Glyssen records no addressee, so there is no
 * addressee column, only the delivery note as written; a "/" character ID is not split into
 * speakers; a field the file leaves empty is NULL, not the default Glyssen's own loader assumes.
 *
 * Versification. The control file is in Glyssen's English versification, and Yada's verse ords are
 * English canonical. Every expanded row's reference is looked up in core's `verses` table; rows
 * whose verse core does not have are counted and listed, never silently dropped (on 11 Oct 2026,
 * against core.v4.db, there were none).
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  BOOK_ORDER,
  GLYSSEN_QUOTE_POSITIONS,
  GLYSSEN_QUOTE_TYPES,
  QUOTE_TYPE_STANDING,
  SPEAKERS_DDL,
  SPEAKERS_FORMAT,
  type BookCode,
  type CharacterKind,
  type GlyssenQuotePosition,
  type GlyssenQuoteType,
  type SpeakerStanding,
  speakersFileName,
  verseOrd,
} from "@yada/schema";

import { BUNDLES, freshDb, highestVersionOnDisk, sha256File } from "./package.js";
import { RAW } from "./paths.js";
import { SOURCES, type SourceDef } from "./sources.js";
import { gzipTranslation } from "./translations.js";

export class SpeakersRefused extends Error {}

// ---------------------------------------------------------------------------
// The licence
// ---------------------------------------------------------------------------

/** The repository's LICENSE at the pinned commit, word for word. Any change is a refusal. */
export const GLYSSEN_LICENSE = `The MIT License (MIT)

Copyright (c) 2014-2020 SIL LSDev and Faith Comes By Hearing

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const LICENSE_COPYRIGHT = "Copyright (c) 2014-2020 SIL LSDev and Faith Comes By Hearing";
const CSPROJ_COPYRIGHT = "Copyright © 2014-2023 Faith Comes By Hearing and SIL International";

/**
 * What GlyssenCharacters.csproj must still say: the package is MIT, its copyright line, and that
 * the two data files Yada reads are shipped as the package's Content (so the MIT grant covers them).
 */
const CSPROJ_MUST_CONTAIN = [
  "<PackageLicenseExpression>MIT</PackageLicenseExpression>",
  `<Copyright>${CSPROJ_COPYRIGHT}</Copyright>`,
  '<Content Include="Resources\\CharacterVerse.txt" />',
  '<Content Include="Resources\\CharacterDetail.txt" />',
];

const normalise = (text: string): string => text.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

/** Returns the two copyright lines, LICENSE's first. Throws unless both files still say MIT as read. */
export function checkGlyssenLicence(license: string, csproj: string): string[] {
  if (normalise(license) !== GLYSSEN_LICENSE) {
    throw new SpeakersRefused("glyssen/LICENSE is no longer the MIT text it was on 11 Oct 2026; read the new terms first");
  }
  const project = normalise(csproj);
  for (const phrase of CSPROJ_MUST_CONTAIN) {
    if (!project.includes(phrase)) throw new SpeakersRefused(`GlyssenCharacters.csproj no longer says: ${phrase}`);
  }
  const licenceExpressions = [...project.matchAll(/<PackageLicense(?:Expression|File)>([^<]*)</g)].map((m) => m[1]);
  if (licenceExpressions.length !== 1) {
    throw new SpeakersRefused(`GlyssenCharacters.csproj states ${licenceExpressions.length} package licences: ${licenceExpressions.join(", ")}`);
  }
  return [LICENSE_COPYRIGHT, CSPROJ_COPYRIGHT];
}

// ---------------------------------------------------------------------------
// CharacterVerse.txt
// ---------------------------------------------------------------------------

export interface CharacterVerseRow {
  /** 1-based line in the file. */
  line: number;
  book: BookCode;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  character: string;
  delivery: string | null;
  alias: string | null;
  quoteType: GlyssenQuoteType;
  defaultCharacter: string | null;
  parallelPassage: string | null;
  quotePosition: GlyssenQuotePosition | null;
}

export interface CharacterVerseFile {
  controlFileVersion: number;
  rows: CharacterVerseRow[];
  /** '#' lines: the column header and Glyssen's editorial notes, which are not data. */
  comments: number;
}

const HEADER = /^Control File Version\t(\d+)\s*$/;
const VERSES = /^(\d+)(?:-(\d+))?$/;
const field = (value: string | undefined): string | null => (value === undefined || value.trim() === "" ? null : value);

const isQuoteType = (value: string): value is GlyssenQuoteType => (GLYSSEN_QUOTE_TYPES as readonly string[]).includes(value);
const isQuotePosition = (value: string): value is GlyssenQuotePosition => (GLYSSEN_QUOTE_POSITIONS as readonly string[]).includes(value);

/**
 * The file as ControlCharacterVerseData reads it: a version line, then tab-separated rows, '#'
 * lines and blank lines skipped. Stricter than Glyssen where Glyssen would default: an empty quote
 * type is "Normal" to Glyssen, but here it is a refusal, since the published file has none and a
 * default would be a claim the file does not make.
 */
export function parseCharacterVerse(text: string): CharacterVerseFile {
  const lines = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  const header = HEADER.exec(lines[0] ?? "");
  if (header === null) throw new SpeakersRefused(`CharacterVerse.txt does not start with its control file version: ${JSON.stringify(lines[0]?.slice(0, 40))}`);
  const rows: CharacterVerseRow[] = [];
  let comments = 0;
  lines.forEach((contents, index) => {
    const line = index + 1;
    if (index === 0 || contents.length === 0) return;
    if (contents.startsWith("#")) {
      comments += 1;
      return;
    }
    const items = contents.split("\t");
    if (items.length !== 10) throw new SpeakersRefused(`CharacterVerse.txt line ${line} has ${items.length} fields, not 10`);
    const [book = "", chapter = "", verses = "", character = "", delivery, alias, quoteType = "", defaultCharacter, parallel, position = ""] = items;
    if (!BOOK_ORDER.includes(book as BookCode)) throw new SpeakersRefused(`CharacterVerse.txt line ${line}: unknown book ${book}`);
    const range = VERSES.exec(verses);
    if (!/^\d+$/.test(chapter) || range === null) throw new SpeakersRefused(`CharacterVerse.txt line ${line}: unreadable reference ${book} ${chapter}:${verses}`);
    const verseStart = Number(range[1]);
    const verseEnd = range[2] === undefined ? verseStart : Number(range[2]);
    if (verseEnd < verseStart) throw new SpeakersRefused(`CharacterVerse.txt line ${line}: backwards range ${verses}`);
    if (character.trim() === "") throw new SpeakersRefused(`CharacterVerse.txt line ${line} names no character`);
    if (!isQuoteType(quoteType)) throw new SpeakersRefused(`CharacterVerse.txt line ${line}: quote type ${JSON.stringify(quoteType)} is not one of Glyssen's`);
    if (position !== "" && !isQuotePosition(position)) throw new SpeakersRefused(`CharacterVerse.txt line ${line}: quote position ${JSON.stringify(position)} is not one of Glyssen's`);
    rows.push({
      line,
      book: book as BookCode,
      chapter: Number(chapter),
      verseStart,
      verseEnd,
      character,
      delivery: field(delivery),
      alias: field(alias),
      quoteType,
      defaultCharacter: field(defaultCharacter),
      parallelPassage: field(parallel),
      quotePosition: position === "" ? null : position,
    });
  });
  return { controlFileVersion: Number(header[1]), rows, comments };
}

/**
 * The X of a delivery note that is explicitly "to X" ("to crowd", "speaking to Peter (Simon)",
 * "said to himself"), else null. Deliberately narrow: "response to Isaiah" or "ready to fight" are
 * not read, because "to" there does not name who is spoken to. Still Glyssen's delivery note, and
 * labelled as such in the schema; Glyssen has no addressee field.
 */
export function deliveryTo(delivery: string | null): string | null {
  if (delivery === null) return null;
  const match = /^(?:(?:speaking|saying|said|talking) )?to (.+)$/.exec(delivery.trim());
  return match?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// CharacterDetail.txt
// ---------------------------------------------------------------------------

export interface CharacterDetailRow {
  line: number;
  id: string;
  maxSpeakers: number;
  gender: string | null;
  age: string | null;
  comment: string | null;
  referenceComment: string | null;
  fcbhCharacter: string | null;
}

const DETAIL_HEADER = "#Character ID\tMax Speakers\tGender\tAge\tStatus\tComment\tReference\tFCBH Character";

/**
 * Seven or eight tab-separated fields (FCBH Character is often absent). Status is not read:
 * Glyssen's own loader comments it out (CharacterDetailData.ProcessLine), so its meaning is not
 * something the file states. Unlike CharacterVerse.txt, this file has no comment syntax: Glyssen
 * skips line 1 only, so a later '#' line would be a character to Glyssen and is refused here.
 */
export function parseCharacterDetail(text: string): CharacterDetailRow[] {
  const lines = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  if (lines[0]?.trimEnd() !== DETAIL_HEADER) throw new SpeakersRefused(`CharacterDetail.txt's header changed: ${JSON.stringify(lines[0]?.slice(0, 80))}`);
  const rows: CharacterDetailRow[] = [];
  const seen = new Set<string>();
  lines.forEach((contents, index) => {
    const line = index + 1;
    if (index === 0 || contents.length === 0) return;
    if (contents.startsWith("#")) throw new SpeakersRefused(`CharacterDetail.txt line ${line} starts with '#', which the file has no use for`);
    const items = contents.split("\t");
    if (items.length < 7 || items.length > 8) throw new SpeakersRefused(`CharacterDetail.txt line ${line} has ${items.length} fields, not 7 or 8`);
    const [id = "", max = "", gender, age, , comment, reference, fcbh] = items;
    if (id.trim() === "") throw new SpeakersRefused(`CharacterDetail.txt line ${line} has no character ID`);
    if (seen.has(id)) throw new SpeakersRefused(`CharacterDetail.txt lists ${id} twice`);
    seen.add(id);
    if (!/^-?\d+$/.test(max)) throw new SpeakersRefused(`CharacterDetail.txt line ${line}: max speakers ${JSON.stringify(max)} is not a number`);
    rows.push({
      line,
      id,
      maxSpeakers: Number(max),
      gender: field(gender),
      age: field(age),
      comment: field(comment),
      referenceComment: field(reference),
      fcbhCharacter: field(fcbh),
    });
  });
  return rows;
}

/** Glyssen's reserved IDs (CharacterVerseData.cs: kNeedsReview; CharacterVerse.cs: kScriptureCharacter). */
export function characterKind(id: string): CharacterKind {
  if (id === "Needs Review") return "needs_review";
  if (id === "scripture") return "scripture";
  if (/^narrator-[1-3A-Z]{3}$/.test(id)) return "narrator";
  if (/^interruption-[1-3A-Z]{3}$/.test(id)) return "interruption";
  // CharacterVerse.kMultiCharacterIdSeparator.
  if (id.includes("/")) return "multiple";
  return "character";
}

// ---------------------------------------------------------------------------
// Packaging
// ---------------------------------------------------------------------------

export interface SpeakersReport {
  file: string;
  version: number;
  sha256: string;
  bytes: number;
  gzipBytes: number;
  reused: boolean;
  controlFileVersion: number;
  copyright: string[];
  /** CharacterVerse.txt data lines, and the rows they expand to (one per verse). */
  lines: number;
  rows: number;
  comments: number;
  /** Rows written, and rows whose verse core has no entry for: count and up to 20 examples. */
  mapped: number;
  unmapped: number;
  unmappedExamples: string[];
  byStanding: Record<SpeakerStanding, number>;
  byQuoteType: Record<string, number>;
  characters: number;
  /** Character IDs CharacterVerse.txt uses that CharacterDetail.txt does not describe, by kind. */
  notInDetail: Record<CharacterKind, number>;
  /** Parts of "/" IDs that CharacterDetail.txt does not describe either. */
  undescribedParts: string[];
  /** Delivery notes with an explicit "to X". */
  deliveryTo: number;
  books: number;
  core: string;
}

export interface PackageSpeakersOptions {
  rawDir?: string;
  outDir?: string;
  /** The core bundle whose `verses` table the references are checked against. Default: the highest core.vN.db in outDir. */
  corePath?: string;
  /** Check every file against its pinned digest first. Off only for tests, whose fixtures are excerpts. */
  verifyPins?: boolean;
}

function glyssenSource(): SourceDef {
  const def = SOURCES.find((s) => s.key === "glyssen");
  if (def === undefined) throw new SpeakersRefused("glyssen has no source entry");
  return def;
}

function readRaw(rawDir: string, name: string): string {
  const full = path.join(rawDir, "glyssen", name);
  if (!existsSync(full)) throw new SpeakersRefused(`glyssen/${name} is not in ${rawDir}; run \`yada ingest\``);
  return readFileSync(full, "utf8");
}

export function packageSpeakers(options: PackageSpeakersOptions = {}): SpeakersReport {
  const rawDir = options.rawDir ?? RAW;
  const outDir = options.outDir ?? BUNDLES;
  const def = glyssenSource();

  if (options.verifyPins ?? true) {
    for (const file of def.files) {
      const full = path.join(rawDir, file.file);
      if (!existsSync(full)) throw new SpeakersRefused(`${file.file} is not in ${rawDir}; run \`yada ingest\``);
      const actual = sha256File(full);
      if (actual !== file.sha256) throw new SpeakersRefused(`${file.file} is sha256 ${actual}, pinned ${file.sha256 ?? "nothing"}`);
    }
  }

  // The licence comes from the repository's own files, every build (CLAUDE.md rule 3).
  const licenseText = normalise(readRaw(rawDir, "LICENSE"));
  const copyright = checkGlyssenLicence(licenseText, readRaw(rawDir, "GlyssenCharacters.csproj"));

  const verseFile = parseCharacterVerse(readRaw(rawDir, "CharacterVerse.txt"));
  const details = parseCharacterDetail(readRaw(rawDir, "CharacterDetail.txt"));

  const version = highestVersionOnDisk("core", outDir);
  const corePath = options.corePath ?? (version === 0 ? null : path.join(outDir, `core.v${version}.db`));
  if (corePath === null || !existsSync(corePath)) throw new SpeakersRefused("no core bundle to map verses against; run `yada package core`");
  const core = new DatabaseSync(corePath, { readOnly: true });
  const coreOrds = new Set(core.prepare("SELECT ord FROM verses").all().map((r) => Number(r["ord"])));
  core.close();

  // Characters: every ID either file names, and every part of a "/" ID.
  const detailById = new Map(details.map((d) => [d.id, d]));
  const names = new Set<string>(details.map((d) => d.id));
  for (const row of verseFile.rows) {
    names.add(row.character);
    if (characterKind(row.character) === "multiple") for (const part of row.character.split("/")) names.add(part);
  }
  const sorted = [...names].sort();
  const idOf = new Map(sorted.map((name, i) => [name, i + 1]));

  mkdirSync(outDir, { recursive: true });
  const tmp = path.join(outDir, "speakers.building.db");
  const out = freshDb(tmp, SPEAKERS_DDL);
  out.exec("BEGIN");
  const meta = out.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  meta.run("format", String(SPEAKERS_FORMAT));
  meta.run("review", "none: Glyssen's character data copied as published, never Yada's explanations");
  meta.run("control_file_version", String(verseFile.controlFileVersion));
  meta.run("versification", "Glyssen's English versification, mapped to core verse ords");
  out
    .prepare(
      "INSERT INTO sources (id, key, name, license, license_notice, copyright, attribution, homepage, commit_hash, modifications) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(def.key, def.dataset, def.license, licenseText, copyright.join("\n"), def.attribution_text, def.homepage, def.commit, def.modifications);

  const notInDetail = { character: 0, multiple: 0, narrator: 0, interruption: 0, needs_review: 0, scripture: 0 } satisfies Record<CharacterKind, number>;
  const usedInVerses = new Set(verseFile.rows.map((r) => r.character));
  const insertCharacter = out.prepare(
    "INSERT INTO characters (id, name, kind, in_detail, max_speakers, gender, age, comment, reference_comment, fcbh_character) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertPart = out.prepare("INSERT INTO character_parts (character, position, part) VALUES (?, ?, ?)");
  const undescribedParts = new Set<string>();
  for (const name of sorted) {
    const id = idOf.get(name) as number;
    const kind = characterKind(name);
    const detail = detailById.get(name);
    if (detail === undefined && usedInVerses.has(name)) notInDetail[kind] += 1;
    insertCharacter.run(
      id,
      name,
      kind,
      detail === undefined ? 0 : 1,
      detail?.maxSpeakers ?? null,
      detail?.gender ?? null,
      detail?.age ?? null,
      detail?.comment ?? null,
      detail?.referenceComment ?? null,
      detail?.fcbhCharacter ?? null,
    );
  }
  for (const name of sorted) {
    if (characterKind(name) !== "multiple") continue;
    name.split("/").forEach((part, position) => {
      if (!detailById.has(part)) undescribedParts.add(part);
      insertPart.run(idOf.get(name) as number, position, idOf.get(part) as number);
    });
  }

  const insertRow = out.prepare(
    `INSERT INTO verse_speakers (ord, line, character, quote_type, standing, delivery, delivery_to, alias, default_character, parallel_passage, quote_position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const byStanding = { speaks: 0, uncertain: 0, reported: 0 } satisfies Record<SpeakerStanding, number>;
  const byQuoteType: Record<string, number> = {};
  const unmappedExamples: string[] = [];
  const books = new Set<BookCode>();
  let rows = 0;
  let mapped = 0;
  let unmapped = 0;
  let withTo = 0;
  for (const row of verseFile.rows) {
    const standing = QUOTE_TYPE_STANDING[row.quoteType];
    const to = deliveryTo(row.delivery);
    for (let verse = row.verseStart; verse <= row.verseEnd; verse += 1) {
      rows += 1;
      const ord = verseOrd(row.book, row.chapter, verse);
      if (!coreOrds.has(ord)) {
        unmapped += 1;
        if (unmappedExamples.length < 20) unmappedExamples.push(`line ${row.line}: ${row.book} ${row.chapter}:${verse} ${row.character} (${row.quoteType})`);
        continue;
      }
      insertRow.run(
        ord,
        row.line,
        idOf.get(row.character) as number,
        row.quoteType,
        standing,
        row.delivery,
        to,
        row.alias,
        row.defaultCharacter,
        row.parallelPassage,
        row.quotePosition,
      );
      mapped += 1;
      byStanding[standing] += 1;
      byQuoteType[row.quoteType] = (byQuoteType[row.quoteType] ?? 0) + 1;
      if (to !== null) withTo += 1;
      books.add(row.book);
    }
  }
  meta.run("unmapped_rows", String(unmapped));
  out.exec("COMMIT");
  out.exec("VACUUM");
  out.close();

  // Same immutability rule as every bundle: unchanged bytes keep the file, changed bytes get a
  // version above anything on disk.
  const sha = sha256File(tmp);
  const highest = highestVersionOnDisk("speakers", outDir);
  const reused = highest > 0 && sha256File(path.join(outDir, speakersFileName(highest))) === sha;
  const fileVersion = reused ? highest : highest + 1;
  const file = speakersFileName(fileVersion);
  if (reused) rmSync(tmp);
  else renameSync(tmp, path.join(outDir, file));
  const full = path.join(outDir, file);
  return {
    file,
    version: fileVersion,
    sha256: sha,
    bytes: statSync(full).size,
    gzipBytes: gzipTranslation(readFileSync(full)).length,
    reused,
    controlFileVersion: verseFile.controlFileVersion,
    copyright,
    lines: verseFile.rows.length,
    rows,
    comments: verseFile.comments,
    mapped,
    unmapped,
    unmappedExamples,
    byStanding,
    byQuoteType,
    characters: sorted.length,
    notInDetail,
    undescribedParts: [...undescribedParts].sort(),
    deliveryTo: withTo,
    books: books.size,
    core: corePath,
  };
}

// ---------------------------------------------------------------------------
// Reading a passage back: "who speaks here"
// ---------------------------------------------------------------------------

export interface PassageSpeaker {
  /** Glyssen's character ID, as written. */
  name: string;
  kind: CharacterKind;
  /** The verses (ords) where it has a row of this standing, ascending. */
  ords: number[];
  quoteTypes: GlyssenQuoteType[];
  /** Explicit "to X" notes on those rows, as written. */
  deliveryTo: string[];
  /** Glyssen's Alias column on those rows ("messengers sent from Pharisees (the Jews)"), as written. */
  aliases: string[];
}

export interface PassageSpeakers {
  /** Characters Glyssen expects to speak in the range, in order of first appearance. */
  speaking: PassageSpeaker[];
  /** Characters with Potential, Rare, Hypothetical or Alternate rows: never to be shown as fact. */
  uncertain: PassageSpeaker[];
  /** Characters whose words are reported, quoted or parenthetical. */
  reported: PassageSpeaker[];
  /** Narrator, interruption, "Needs Review" and "scripture" rows, which name no character. */
  markers: PassageSpeaker[];
}

const SPEAKING_KINDS: ReadonlySet<string> = new Set(["character", "multiple"]);

/**
 * Distinct speakers across an ord range, in order of first appearance (first verse, then the
 * file's line order within it). A character can appear in more than one list: Jesus speaks in John
 * 3:3–13 and is only Potential in 3:14–21, so he is in `speaking` with 3–13 and `uncertain` with
 * 14–21.
 */
export function passageSpeakers(db: DatabaseSync, ordStart: number, ordEnd: number): PassageSpeakers {
  const rows = db
    .prepare(
      `SELECT c.name, c.kind, s.standing, s.ord, s.quote_type, s.delivery_to, s.alias
       FROM verse_speakers s JOIN characters c ON c.id = s.character
       WHERE s.ord BETWEEN ? AND ?
       ORDER BY s.ord, s.line`,
    )
    .all(ordStart, ordEnd);
  const result: PassageSpeakers = { speaking: [], uncertain: [], reported: [], markers: [] };
  const index = new Map<string, PassageSpeaker>();
  for (const row of rows) {
    const name = String(row["name"]);
    const kind = String(row["kind"]) as CharacterKind;
    const standing = String(row["standing"]) as SpeakerStanding;
    const list = SPEAKING_KINDS.has(kind) ? result[standing === "speaks" ? "speaking" : standing] : result.markers;
    const key = `${list === result.markers ? "markers" : standing}|${name}`;
    let entry = index.get(key);
    if (entry === undefined) {
      entry = { name, kind, ords: [], quoteTypes: [], deliveryTo: [], aliases: [] };
      index.set(key, entry);
      list.push(entry);
    }
    const ord = Number(row["ord"]);
    if (!entry.ords.includes(ord)) entry.ords.push(ord);
    const quoteType = String(row["quote_type"]) as GlyssenQuoteType;
    if (!entry.quoteTypes.includes(quoteType)) entry.quoteTypes.push(quoteType);
    const to = row["delivery_to"];
    if (typeof to === "string" && !entry.deliveryTo.includes(to)) entry.deliveryTo.push(to);
    const alias = row["alias"];
    if (typeof alias === "string" && !entry.aliases.includes(alias)) entry.aliases.push(alias);
  }
  return result;
}
