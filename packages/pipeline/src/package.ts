/**
 * `yada package` — compile staging.db into immutable, versioned bundles.
 *
 * Build plan §4. Two kinds:
 *
 *   core.vN.db        all 66 books: BSB/WEB/KJV text, the complete interlinear
 *                     with sourced glosses, word occurrence counts, full-text
 *                     search, and in-app attribution.
 *   <book>.vN.db      Understand content for one book: verse entries and
 *                     pericope boundaries (with pericope entries once they exist).
 *
 * A bundle's version only changes when its bytes do, so filenames stay
 * immutable and a manifest swap is the whole of an update.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  BOOK_CODES,
  BOOK_ORDER,
  BUNDLE_FORMAT,
  BundleManifestSchema,
  CORE_DDL,
  SCHEMA_VERSION,
  UNDERSTAND_DDL,
  bundleFileName,
  encodeMorphemes,
  isBookCode,
  normalizeGreek,
  normalizeHebrew,
  parseVerseId,
  parseVerseRef,
  verseOrd,
  type BookCode,
  type BundleInfo,
  type BundleManifest,
  type BundleMorpheme,
  type ReviewGate,
  type SourceManifestEntry,
} from "@yada/schema";

import { openStaging } from "./db.js";
import { CONTENT, MANIFEST, PIPELINE_DATA, RAW } from "./paths.js";
import { SOURCES } from "./sources.js";
import { transliterate } from "./translit.js";

export const BUNDLES = path.join(CONTENT, "bundles");
export const BUNDLE_MANIFEST = path.join(BUNDLES, "manifest.json");

/** Statuses that may ship. `flagged` never does, except in an explicit dev build. */
export const SHIPPABLE_STATUSES: ReadonlySet<string> = new Set(["auto_passed", "human_reviewed", "expert_reviewed"]);

type Row = Record<string, unknown>;

const text = (row: Row, key: string): string => String(row[key]);
const nullableText = (row: Row, key: string): string | null => (row[key] == null ? null : String(row[key]));
const integer = (row: Row, key: string): number => Number(row[key]);

function scriptOf(book: BookCode): "greek" | "hebrew" {
  return BOOK_CODES[book].testament === "NT" ? "greek" : "hebrew";
}

function sha256File(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** A manifest from an older bundle format is treated as absent, not as an error. */
export function readBundleManifest(): BundleManifest | null {
  if (!existsSync(BUNDLE_MANIFEST)) return null;
  const parsed = BundleManifestSchema.safeParse(JSON.parse(readFileSync(BUNDLE_MANIFEST, "utf8")));
  return parsed.success ? parsed.data : null;
}

/** Highest version already on disk for a bundle name, whatever the manifest says. */
function highestVersionOnDisk(name: string): number {
  if (!existsSync(BUNDLES)) return 0;
  const pattern = new RegExp(`^${name.toLowerCase()}\\.v(\\d+)\\.db$`);
  return readdirSync(BUNDLES).reduce((max, file) => {
    const match = pattern.exec(file);
    return match?.[1] === undefined ? max : Math.max(max, Number(match[1]));
  }, 0);
}

/**
 * Built into a temporary file first. Unchanged bytes keep the previous version
 * and file. Changed bytes get a version above anything on disk, so a file name
 * is never reused for different content — including across format changes,
 * when the old manifest can no longer be read.
 */
function finalize(
  name: string,
  kind: "core" | "understand",
  tmp: string,
  extra: { book?: BookCode; review_gate: ReviewGate; entries: number },
): BundleInfo {
  const sha = sha256File(tmp);
  const previous = readBundleManifest()?.bundles.find((b) => b.name === name);
  if (
    previous !== undefined &&
    previous.sha256 === sha &&
    previous.review_gate === extra.review_gate &&
    existsSync(path.join(BUNDLES, previous.file))
  ) {
    rmSync(tmp);
    return previous;
  }
  const version = Math.max(previous?.version ?? 0, highestVersionOnDisk(name)) + 1;
  const file = bundleFileName(name, version);
  renameSync(tmp, path.join(BUNDLES, file));
  return {
    name,
    kind,
    ...(extra.book === undefined ? {} : { book: extra.book }),
    version,
    file,
    sha256: sha,
    bytes: statSync(path.join(BUNDLES, file)).size,
    format: BUNDLE_FORMAT,
    schema_version: SCHEMA_VERSION,
    review_gate: extra.review_gate,
    entries: extra.entries,
  };
}

function freshDb(file: string, ddl: string): DatabaseSync {
  if (existsSync(file)) rmSync(file);
  const db = new DatabaseSync(file);
  // Bundles are read-only on device; a rollback journal would only leave a
  // side file the app has to clean up.
  db.exec("PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;");
  db.exec(ddl);
  return db;
}

/**
 * Hebrew headwords by extended Strong's number, from TBESH column 3 only.
 *
 * TBESH's definitions (column 7) derive from the Abridged BDB and need Online
 * Bible's permission, which Yada does not have. A headword is the dictionary
 * form of the word — the same Hebrew the text itself contains — so it is read,
 * and nothing else in the file is.
 */
function loadHebrewHeadwords(): Map<string, string> {
  const map = new Map<string, string>();
  const file = path.join(RAW, "TBESH.txt");
  if (!existsSync(file)) return map;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const cols = line.split("\t");
    const strongs = (cols[0] ?? "").trim();
    const headword = (cols[3] ?? "").trim();
    if (/^H\d{4,5}[a-z]?$/.test(strongs) && headword.length > 0 && !map.has(strongs)) map.set(strongs, headword);
  }
  return map;
}

function ordOf(verseId: string): number | null {
  const ref = parseVerseId(verseId);
  return ref === null ? null : verseOrd(ref.book, ref.chapter, ref.verse);
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

export interface CoreReport {
  info: BundleInfo;
  verses: number;
  tokens: number;
  texts: number;
}

export function packageCore(): CoreReport {
  mkdirSync(BUNDLES, { recursive: true });
  const tmp = path.join(BUNDLES, "core.building.db");
  const out = freshDb(tmp, CORE_DDL);
  const staging = openStaging();

  out.exec("BEGIN");
  const insertMeta = out.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  insertMeta.run("format", String(BUNDLE_FORMAT));
  insertMeta.run("schema_version", SCHEMA_VERSION);

  const insertBook = out.prepare(
    "INSERT INTO books (code, ord, name, testament, chapters, script) VALUES (?, ?, ?, ?, ?, ?)",
  );
  BOOK_ORDER.forEach((code, index) => {
    const meta = BOOK_CODES[code];
    insertBook.run(code, index + 1, meta.name, meta.testament, meta.chapters, scriptOf(code));
  });

  // Every English verse, plus verses that exist only in the original (Psalm
  // superscriptions at verse 0).
  const verseIds = new Set<string>();
  for (const row of staging.prepare("SELECT DISTINCT verse_id FROM texts").all()) verseIds.add(text(row, "verse_id"));
  for (const row of staging.prepare("SELECT verse_id FROM verses").all()) verseIds.add(text(row, "verse_id"));
  const insertVerse = out.prepare("INSERT INTO verses (ord, verse_id, book, chapter, verse) VALUES (?, ?, ?, ?, ?)");
  const orderedVerses = [...verseIds]
    .map((id) => ({ id, ref: parseVerseId(id) }))
    .filter((v): v is { id: string; ref: NonNullable<ReturnType<typeof parseVerseId>> } => v.ref !== null)
    .map((v) => ({ ...v, ord: verseOrd(v.ref.book, v.ref.chapter, v.ref.verse) }))
    .sort((a, b) => a.ord - b.ord);
  for (const v of orderedVerses) insertVerse.run(v.ord, v.id, v.ref.book, v.ref.chapter, v.ref.verse);

  // Texts first, then the search index is rebuilt from them in one pass.
  const insertText = out.prepare("INSERT INTO texts (translation, ord, text) VALUES (?, ?, ?)");
  const textRows = staging
    .prepare("SELECT translation, verse_id, text FROM texts")
    .all()
    .map((row) => ({ translation: text(row, "translation"), ord: ordOf(text(row, "verse_id")), text: text(row, "text") }))
    .filter((row): row is { translation: string; ord: number; text: string } => row.ord !== null)
    .sort((a, b) => a.ord - b.ord || a.translation.localeCompare(b.translation));
  for (const row of textRows) insertText.run(row.translation, row.ord, row.text);

  // Tokens are inserted in clustered-key order so the table builds as one
  // sequential B-tree rather than being rebalanced 440,000 times.
  interface TokenRow {
    ord: number;
    position: number;
    surface: string;
    translit: string;
    gloss: string | null;
    glossSource: string | null;
    lemma: string;
    strongs: string | null;
    morph: string;
    morphemes: string | null;
    variantMarked: number;
    occurrenceKey: string;
    searchKey: string;
  }
  const tokenRows: TokenRow[] = [];
  for (const row of staging.prepare("SELECT * FROM tokens").iterate()) {
    const verseId = text(row, "verse_id");
    const book = verseId.split(".")[0] ?? "";
    const ord = ordOf(verseId);
    if (!isBookCode(book) || ord === null) continue;
    const script = scriptOf(book);
    const surface = text(row, "surface");
    const strongs = nullableText(row, "strongs");
    const lemma = text(row, "lemma");
    const rawMorphemes = nullableText(row, "morphemes");
    tokenRows.push({
      ord,
      position: integer(row, "position"),
      surface,
      translit: transliterate(surface, script),
      gloss: nullableText(row, "gloss"),
      glossSource: nullableText(row, "gloss_source"),
      lemma,
      strongs,
      morph: text(row, "morph"),
      morphemes: rawMorphemes === null ? null : encodeMorphemes(JSON.parse(rawMorphemes) as BundleMorpheme[]),
      variantMarked: integer(row, "variant_marked"),
      // "In this book" counts the lexeme, not the inflected form: λόγος, λόγου
      // and λόγῳ are one word to a reader asking where else it appears.
      occurrenceKey: script === "greek" ? normalizeGreek(lemma) : (strongs ?? `lemma:${lemma}`),
      searchKey: script === "greek" ? normalizeGreek(surface) : normalizeHebrew(surface),
    });
  }
  tokenRows.sort((a, b) => a.ord - b.ord || a.position - b.position);

  const insertToken = out.prepare(
    `INSERT INTO tokens (ord, position, surface, translit, gloss, gloss_source, lemma, strongs,
                         morph, morphemes, variant_marked, occurrence_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const counts = new Map<string, Map<string, number>>();
  const forms = new Map<string, Set<string>>();
  const hebrewHeadwords = loadHebrewHeadwords();
  const lexemes = new Map<
    string,
    { script: "greek" | "hebrew"; lemma: string; strongs: string | null; glosses: Map<string, number>; total: number }
  >();
  for (const t of tokenRows) {
    insertToken.run(
      t.ord, t.position, t.surface, t.translit, t.gloss, t.glossSource,
      t.lemma, t.strongs, t.morph, t.morphemes, t.variantMarked, t.occurrenceKey,
    );
    const book = BOOK_ORDER[Math.floor(t.ord / 1_000_000) - 1] ?? "";
    const bookCounts = counts.get(book) ?? new Map<string, number>();
    bookCounts.set(t.occurrenceKey, (bookCounts.get(t.occurrenceKey) ?? 0) + 1);
    counts.set(book, bookCounts);
    const script: "greek" | "hebrew" = t.ord >= verseOrd("MAT", 1, 1) ? "greek" : "hebrew";
    const lexeme = lexemes.get(t.occurrenceKey) ?? {
      script,
      // MorphGNT gives the Greek dictionary form directly. OSHB's lemma field is
      // a Strong's reference, not a Hebrew word, so the headword comes from TBESH.
      lemma: script === "greek" ? t.lemma : (hebrewHeadwords.get(t.strongs ?? "") ?? t.surface),
      strongs: t.strongs,
      glosses: new Map<string, number>(),
      total: 0,
    };
    lexeme.total += 1;
    if (t.gloss !== null && t.gloss !== "") lexeme.glosses.set(t.gloss, (lexeme.glosses.get(t.gloss) ?? 0) + 1);
    lexemes.set(t.occurrenceKey, lexeme);
    if (t.searchKey.length > 0) {
      const set = forms.get(t.searchKey) ?? new Set<string>();
      set.add(t.occurrenceKey);
      forms.set(t.searchKey, set);
    }
  }

  const insertCount = out.prepare("INSERT INTO occurrences (book, occurrence_key, count) VALUES (?, ?, ?)");
  for (const [book, bookCounts] of counts) {
    for (const [occurrenceKey, count] of bookCounts) insertCount.run(book, occurrenceKey, count);
  }
  const insertLexeme = out.prepare(
    "INSERT INTO lexemes (occurrence_key, script, lemma, translit, strongs, gloss, total) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const [key, lexeme] of [...lexemes].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    // The commonest contextual gloss stands in for a dictionary gloss; ties go
    // to the shorter one, which is usually the bare form ("word", not "of word").
    const gloss =
      [...lexeme.glosses].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0] ?? null;
    insertLexeme.run(key, lexeme.script, lexeme.lemma, transliterate(lexeme.lemma, lexeme.script), lexeme.strongs, gloss, lexeme.total);
  }

  const insertForm = out.prepare("INSERT INTO word_forms (search_key, occurrence_key) VALUES (?, ?)");
  for (const [searchKey, keys] of [...forms].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    for (const occurrenceKey of [...keys].sort()) insertForm.run(searchKey, occurrenceKey);
  }

  // In-app attribution comes from the generated source manifest, with the
  // encumbrance notes kept alongside.
  const manifest: SourceManifestEntry[] = existsSync(MANIFEST)
    ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as SourceManifestEntry[])
    : [];
  const encumbrance = new Map(SOURCES.map((s) => [s.dataset, s.encumbered ?? null]));
  const insertSource = out.prepare(
    "INSERT OR REPLACE INTO sources (dataset, source, license, attribution, url, encumbered) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const entry of manifest) {
    insertSource.run(
      entry.dataset,
      entry.source,
      entry.license,
      entry.attribution_text,
      entry.url,
      encumbrance.get(entry.dataset) ?? null,
    );
  }

  out.exec("COMMIT");
  out.exec("INSERT INTO texts_fts(texts_fts) VALUES ('rebuild')");
  out.exec("INSERT INTO texts_fts(texts_fts) VALUES ('optimize')");
  out.exec("VACUUM");
  out.close();
  staging.close();

  const info = finalize("core", "core", tmp, { review_gate: "reviewed", entries: 0 });
  return { info, verses: orderedVerses.length, tokens: tokenRows.length, texts: textRows.length };
}

// ---------------------------------------------------------------------------
// Understand
// ---------------------------------------------------------------------------

export interface UnderstandReport {
  info: BundleInfo;
  included: string[];
  /** Entries left out because no human has reviewed them. */
  withheld: string[];
}

export function packageUnderstand(book: BookCode, options: { allowUnreviewed: boolean }): UnderstandReport {
  mkdirSync(BUNDLES, { recursive: true });
  const tmp = path.join(BUNDLES, `${book.toLowerCase()}.building.db`);
  const out = freshDb(tmp, UNDERSTAND_DDL);
  const staging = openStaging();
  const gate: ReviewGate = options.allowUnreviewed ? "unreviewed-dev" : "reviewed";

  out.exec("BEGIN");
  const insertMeta = out.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  insertMeta.run("format", String(BUNDLE_FORMAT));
  insertMeta.run("schema_version", SCHEMA_VERSION);
  insertMeta.run("book", book);
  insertMeta.run("review_gate", gate);

  const rows = staging
    .prepare(
      `SELECT e.verse_id, e.pericope_id, e.payload, COALESCE(r.status, 'flagged') AS status
       FROM entries e LEFT JOIN review_state r ON r.verse_id = e.verse_id
       WHERE e.verse_id LIKE ? ORDER BY e.verse_id`,
    )
    .all(`${book}.%`);

  const insertEntry = out.prepare(
    "INSERT INTO entries (verse_id, ord, pericope_id, review_status, payload) VALUES (?, ?, ?, ?, ?)",
  );
  const included: string[] = [];
  const withheld: string[] = [];
  for (const row of rows) {
    const status = text(row, "status");
    const verseId = text(row, "verse_id");
    const ord = ordOf(verseId);
    if (ord === null) continue;
    if (!SHIPPABLE_STATUSES.has(status) && !options.allowUnreviewed) {
      withheld.push(verseId);
      continue;
    }
    insertEntry.run(verseId, ord, text(row, "pericope_id"), status, text(row, "payload"));
    included.push(verseId);
  }

  // Pericope boundaries are editorial data files; entries join them later.
  const pericopeFile = path.join(PIPELINE_DATA, `${book.toLowerCase()}-pericopes.json`);
  if (existsSync(pericopeFile)) {
    const data = JSON.parse(readFileSync(pericopeFile, "utf8")) as {
      pericopes: Array<{ id: string; label: string }>;
    };
    const insertPericope = out.prepare(
      "INSERT INTO pericopes (pericope_id, label, start_ord, end_ord, review_status, payload) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const findEntry = staging.prepare("SELECT payload FROM pericope_entries WHERE pericope_id = ?");
    for (const pericope of data.pericopes) {
      const range = parseVerseRef(pericope.id);
      if (range === null) continue;
      const found = findEntry.get(pericope.id) as Row | undefined;
      const payload = found === undefined ? null : nullableText(found, "payload");
      const shipPayload = payload !== null && options.allowUnreviewed ? payload : null;
      insertPericope.run(
        pericope.id,
        pericope.label,
        verseOrd(range.book, range.start.chapter, range.start.verse),
        verseOrd(range.book, range.end.chapter, range.end.verse),
        shipPayload === null ? null : "flagged",
        shipPayload,
      );
    }
  }

  out.exec("COMMIT");
  out.exec("VACUUM");
  out.close();
  staging.close();

  const info = finalize(book, "understand", tmp, { book, review_gate: gate, entries: included.length });
  return { info, included, withheld };
}

/** Books that have any Understand content or pericope boundaries. */
export function understandBooks(): BookCode[] {
  const books = new Set<string>();
  const staging = openStaging();
  for (const row of staging.prepare("SELECT verse_id FROM entries").all()) {
    books.add(text(row, "verse_id").split(".")[0] ?? "");
  }
  staging.close();
  for (const file of readdirSync(PIPELINE_DATA)) {
    const match = /^([a-z0-9]{3})-pericopes\.json$/.exec(file);
    if (match?.[1] !== undefined) books.add(match[1].toUpperCase());
  }
  return [...books].filter(isBookCode).sort((a, b) => BOOK_ORDER.indexOf(a) - BOOK_ORDER.indexOf(b));
}

export function writeBundleManifest(bundles: BundleInfo[], minAppVersion = "1.0.0"): BundleManifest {
  const manifest: BundleManifest = {
    format: BUNDLE_FORMAT,
    generated_at: new Date().toISOString(),
    min_app_version: minAppVersion,
    schema_versions: [SCHEMA_VERSION],
    bundles,
  };
  BundleManifestSchema.parse(manifest);
  writeFileSync(BUNDLE_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
