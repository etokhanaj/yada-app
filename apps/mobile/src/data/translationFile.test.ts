/**
 * A downloaded translation end to end, in the pipeline's own format: built
 * with TRANSLATION_DDL and the meta keys `yada package translation` writes,
 * then parsed from a manifest entry, verified by digest, attached beside a
 * core file, checked, routed and read. The app once wrote its own DDL and
 * entry shape and could read none of the files the pipeline built; this test
 * fails if the two drift again. It needs no built bundles, so it always runs.
 *
 * The verse texts are placeholders, not any translation's words.
 */

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { BUNDLE_FORMAT, CORE_DDL, TRANSLATION_DDL, translationFileName, verseOrd } from "@yada/schema";
import { afterAll, describe, expect, it } from "vitest";

import { buildFtsQuery } from "../lib/searchQuery";
import { sourceItems } from "../lib/sources";
import { parseCatalogue, schemaName, verifyDownload, verseTextIn } from "../lib/translations";
import {
  checkTranslationFile, countPassages, getChapter, getTexts, getTranslationSources, isDownloaded, routeTranslation, searchPassages,
  unrouteTranslation, type Db,
} from "./queries";

const CODE = "TST";
const MANIFEST_URL = "http://localhost:8787/manifest.json";
const dir = mkdtempSync(path.join(tmpdir(), "yada-trfile-"));
const file = path.join(dir, translationFileName(CODE, 1));

const ords = {
  m13: verseOrd("MAT", 23, 13),
  m14: verseOrd("MAT", 23, 14),
  m15: verseOrd("MAT", 23, 15),
  j1: verseOrd("JHN", 1, 1),
};

/** Shaped like translation-dby.v1.db: Matthew 23:14 is not printed, so it has no row. */
function buildFile(): void {
  const db = new DatabaseSync(file);
  db.exec(TRANSLATION_DDL);
  const meta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  for (const [key, value] of [
    ["format", String(BUNDLE_FORMAT)],
    ["code", CODE],
    ["name", "Test Translation"],
    ["year", "1890"],
    ["license", "PUBLIC_DOMAIN"],
    ["attribution", "Test Translation (fixture). Public domain."],
    ["source", "https://example.org/tst/"],
    ["source_sha256", "b".repeat(64)],
    ["verses", "3"],
    ["missing", JSON.stringify(["MAT.23.14"])],
  ] as const) {
    meta.run(key, value);
  }
  const insert = db.prepare("INSERT INTO texts (ord, text) VALUES (?, ?)");
  insert.run(ords.m13, "Placeholder thirteen about lanterns.");
  insert.run(ords.m15, "Placeholder fifteen about harbours.");
  insert.run(ords.j1, "Placeholder for the first verse of John.");
  db.exec("INSERT INTO texts_fts(texts_fts) VALUES ('rebuild')");
  db.close();
}

function buildCore(): DatabaseSync {
  const db = new DatabaseSync(path.join(dir, "core.db"));
  db.exec(CORE_DDL);
  const insert = db.prepare("INSERT INTO texts (translation, ord, text) VALUES ('BSB', ?, ?)");
  for (const ord of Object.values(ords)) insert.run(ord, `BSB placeholder ${ord}.`);
  db.exec("INSERT INTO texts_fts(texts_fts) VALUES ('rebuild')");
  return db;
}

function wrap(db: DatabaseSync): Db {
  return {
    getAllAsync: async <T,>(sql: string, params: Array<string | number | null>) => db.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T,>(sql: string, params: Array<string | number | null>) => (db.prepare(sql).get(...params) as T | undefined) ?? null,
  };
}

buildFile();
const bytes = new Uint8Array(readFileSync(file));
const manifest = {
  format: BUNDLE_FORMAT,
  translations: [
    {
      code: CODE,
      name: "Test Translation",
      year: 1890,
      version: 1,
      file: translationFileName(CODE, 1),
      // The oracle is node's own SHA-256, not the app's (rule 5: check the fixture, trust the oracle).
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
      format: BUNDLE_FORMAT,
      license: "PUBLIC_DOMAIN",
      attribution: "Test Translation (fixture). Public domain.",
      cover: "sage",
      verses: 3,
      missing: ["MAT.23.14"],
    },
  ],
};

describe("a downloaded translation in the pipeline's format", () => {
  const raw = buildCore();
  const core = wrap(raw);
  const [entry] = parseCatalogue(manifest, MANIFEST_URL).entries;
  const schema = schemaName(CODE, 1);
  raw.exec(`ATTACH DATABASE '${file.replace(/'/g, "''")}' AS ${schema}`);
  afterAll(() => {
    unrouteTranslation(CODE);
    raw.close();
  });

  it("parses the manifest entry, resolving its file beside the manifest", () => {
    expect(entry).toMatchObject({ code: CODE, file: "translation-tst.v1.db", missing: ["MAT.23.14"], license: "PUBLIC_DOMAIN" });
    expect(entry?.url).toBe("http://localhost:8787/translation-tst.v1.db");
  });

  it("verifies the downloaded bytes against the entry", async () => {
    if (entry === undefined) throw new Error("no entry");
    expect(await verifyDownload(bytes, entry)).toBe(true);
    const tampered = bytes.slice();
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1;
    expect(await verifyDownload(tampered, entry)).toBe(false);
  });

  it("checks the attached file against its meta and the manifest before routing", async () => {
    if (entry === undefined) throw new Error("no entry");
    expect(await checkTranslationFile(core, schema, CODE, entry)).toMatchObject({ ok: true, verses: 3, meta: { name: "Test Translation" } });
    expect((await checkTranslationFile(core, schema, "YLT", entry)).ok).toBe(false);
    expect((await checkTranslationFile(core, schema, CODE, { verses: 4, missing: [] })).ok).toBe(false);
    // A verse the manifest says is not printed, but the file prints: "Not in TST" would be false.
    expect((await checkTranslationFile(core, schema, CODE, { verses: 3, missing: ["MAT.23.13"] })).ok).toBe(false);
    expect(isDownloaded(CODE)).toBe(false);
  });

  it("reads by ord, searches its own index, and shows no BSB where it prints nothing", async () => {
    routeTranslation(CODE, schema);
    expect(isDownloaded(CODE)).toBe(true);
    const chapter = await getChapter(core, "MAT", 23, CODE);
    expect(chapter.map((v) => v.verse)).toEqual([13, 15]);
    expect(chapter[0]?.text).toBe("Placeholder thirteen about lanterns.");
    expect((await getChapter(core, "MAT", 23, "BSB")).map((v) => v.verse)).toEqual([13, 14, 15]);

    const present = await getTexts(core, ords.m13);
    expect(present).toEqual({ BSB: `BSB placeholder ${ords.m13}.`, [CODE]: "Placeholder thirteen about lanterns." });
    const absent = await getTexts(core, ords.m14);
    expect(Object.keys(absent)).toEqual(["BSB"]);
    expect(verseTextIn(absent, CODE, isDownloaded(CODE))).toBeNull();

    const hits = await searchPassages(core, buildFtsQuery("harbours") ?? "", CODE);
    expect(hits.map((h) => h.ord)).toEqual([ords.m15]);
    expect(await countPassages(core, buildFtsQuery("placeholder") ?? "", CODE)).toBe(3);
    // Core's index is not consulted for a downloaded code, nor the download's for BSB.
    expect(await countPassages(core, buildFtsQuery("harbours") ?? "", "BSB")).toBe(0);
  });

  it("takes its licence and attribution from meta, shown in the words readers know", async () => {
    routeTranslation(CODE, schema);
    const rows = await getTranslationSources(core);
    expect(rows).toEqual([
      {
        dataset: "translation:TST",
        source: "Test Translation",
        license: "PUBLIC_DOMAIN",
        attribution: "Test Translation (fixture). Public domain.",
        url: "https://example.org/tst/",
        encumbered: null,
        translation: { code: CODE, name: "Test Translation" },
      },
    ]);
    expect(sourceItems(rows)[0]).toMatchObject({ title: "Test Translation", subtitle: "English · TST · Public domain", url: "https://example.org/tst/" });
  });
});
