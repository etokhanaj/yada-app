/**
 * The app's SQL, run against the real bundles under node:sqlite. Skipped when
 * content/bundles has not been built (it is gitignored working data).
 */

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { TRANSLATION_DDL, verseOrd } from "@yada/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SOURCE_GAPS } from "../lib/omissions";
import { originalLanguage } from "../lib/originalLanguage";
import { buildFtsQuery, planSearch, splitSnippet } from "../lib/searchQuery";
import { parseCatalogue, verifyDownload, verseTextIn } from "../lib/translations";
import {
  bookBounds, checkTranslationFile, countInBook, countPassages, countPassagesByBook, countsByBook, countVerses, getChapter, getLanguageLetters, getLexeme,
  getOccurrences, getSources, nearestTerm, getTexts, getTextsForOrds, getTextsInRange, getTokens, getTranslationSources,
  readableTranslations, routeTranslation, searchPassages, searchWordsByForm, searchWordsByGloss, unrouteTranslation, type Db,
} from "./queries";

const bundles = path.resolve(__dirname, "../../../../content/bundles");
// core.v4 is the first core with the LSV, and SBLGNT under CC BY 4.0.
const corePath = path.join(bundles, "core.v4.db");
const haveBundles = existsSync(corePath);

function wrap(db: DatabaseSync): Db {
  return {
    getAllAsync: async <T,>(sql: string, params: Array<string | number | null>) => db.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T,>(sql: string, params: Array<string | number | null>) =>
      (db.prepare(sql).get(...params) as T | undefined) ?? null,
  };
}

const open = (file: string): Db => wrap(new DatabaseSync(file, { readOnly: true }));

/**
 * A downloaded translation in the pipeline's format (TRANSLATION_DDL in
 * @yada/schema). Its text is the KJV's John 1:1–5, copied verbatim from core
 * under a test code.
 */
function buildTranslationFile(core: DatabaseSync, file: string): void {
  const db = new DatabaseSync(file);
  db.exec(`${TRANSLATION_DDL}
    INSERT INTO meta VALUES ('code', 'TST'), ('name', 'Test Translation'), ('year', '1611'), ('verses', '5'),
      ('license', 'PUBLIC_DOMAIN'), ('attribution', 'Test text, public domain.'), ('source', 'https://example.org/tst');`);
  const insert = db.prepare("INSERT INTO texts (ord, text) VALUES (?, ?)");
  for (const r of core.prepare("SELECT ord, text FROM texts WHERE translation = 'KJV' AND ord BETWEEN 43001001 AND 43001005").all() as Array<{ ord: number; text: string }>) {
    insert.run(r.ord, r.text);
  }
  db.exec("INSERT INTO texts_fts(texts_fts) VALUES ('rebuild')");
  db.close();
}

// Full-text search over the 88 MB core bundle takes ~1.7s alone and passed the
// default 5s limit only when the four packages' suites ran in parallel.
describe.skipIf(!haveBundles)("queries against the core bundle", { timeout: 30_000 }, () => {
  const core = haveBundles ? open(corePath) : (null as unknown as Db);

  it("reads a chapter without verse 0 or empty rows", async () => {
    const psalm = await getChapter(core, "PSA", 23, "BSB");
    expect(psalm.map((v) => v.verse)).toEqual([1, 2, 3, 4, 5, 6]);
    const romans = await getChapter(core, "ROM", 16, "BSB");
    expect(romans.some((v) => v.verse === 24)).toBe(false);
    const cor = await getChapter(core, "1CO", 14, "BSB");
    expect(cor.find((v) => v.verse === 34)?.text).toMatch(/^Women are to be silent/);
  });

  it("reads all four built-in translations of a verse", async () => {
    const t = await getTexts(core, 43001001);
    expect(Object.keys(t).sort()).toEqual(["BSB", "KJV", "LSV", "WEB"]);
  });

  it("carries the whole LSV, brackets and all, as eBible prints it", async () => {
    const raw = new DatabaseSync(corePath, { readOnly: true });
    const row = raw.prepare("SELECT count(*) AS n FROM texts WHERE translation = 'LSV'").get() as { n: number };
    expect(row.n).toBe(31_102);
    const john = await getChapter(core, "JHN", 1, "LSV");
    expect(john[0]?.text).toBe("In the beginning was the Word, and the Word was with God, and the Word was God;");
    expect((await getChapter(core, "GEN", 1, "LSV"))[0]?.text).toBe("In [the] beginning God created the heavens and the earth,");
  });

  it("lists the LSV and SBLGNT licences from the sources table", async () => {
    const sources = await getSources(core);
    const lsv = sources.find((s) => s.dataset === "Literal Standard Version (englsv)");
    expect(lsv).toMatchObject({ license: "CC-BY-SA-4.0", url: "https://ebible.org/englsv/" });
    expect(sources.find((s) => s.dataset === "SBLGNT (Greek text)")?.license).toBe("CC-BY-4.0");
  });

  it("returns a psalm's Hebrew title with verse 1", async () => {
    const t = await getTokens(core, 19023001);
    expect(t.title.map((x) => x.surface).join(" ")).toMatch(/^מִזְמ/);
    expect(t.words.length).toBeGreaterThan(0);
    const john = await getTokens(core, 43001001);
    expect(john.title).toEqual([]);
  });

  it("has no Greek under John 8:7", async () => {
    expect((await getTokens(core, 43008007)).words).toEqual([]);
  });

  it("has Greek through Romans 16:24 and none for the source gap after it", async () => {
    expect((await getTokens(core, verseOrd("ROM", 16, 24))).words.length).toBeGreaterThan(0);
    for (const id of SOURCE_GAPS) {
      const [, chapter = 0, verse = 0] = id.split(".").map(Number);
      expect((await getTokens(core, verseOrd("ROM", chapter, verse))).words).toEqual([]);
    }
  });

  it("finds σιγάτωσαν with its parse and counts", async () => {
    const t = await getTokens(core, 46014034);
    const word = t.words.find((x) => x.surface === "σιγάτωσαν");
    expect(word?.morph).toBe("V- 3PAD-P--");
    expect(word?.glossSource).toBe("TAGNT");
    const lexeme = await getLexeme(core, word?.occurrenceKey ?? "");
    expect(lexeme?.lemma).toBe("σιγάω");
    expect(await countInBook(core, "1CO", "σιγαω")).toBe(3);
    const occ = await getOccurrences(core, "σιγαω", "1CO");
    expect(occ.map((o) => o.ord)).toEqual([46014028, 46014030, 46014034]);
  });

  it("decodes Hebrew morphemes", async () => {
    const t = await getTokens(core, 1001001);
    expect(t.words[0]?.morphemes?.map((m) => m.role)).toEqual(["prefix", "stem"]);
  });

  it("searches passages with quoted terms and marked snippets", async () => {
    const hits = await searchPassages(core, buildFtsQuery("love") ?? "", "BSB", 5);
    expect(hits.length).toBe(5);
    expect(splitSnippet(hits[0]?.snippet ?? "").some((p) => p.hit && /love/i.test(p.text))).toBe(true);
    // Syntax characters are inert once quoted.
    await expect(searchPassages(core, buildFtsQuery('love" OR (') ?? "", "BSB", 5)).resolves.toBeDefined();
  });

  it("counts a search's verses by book, adding up to the total, and lists one book's alone (SE-31)", async () => {
    const match = buildFtsQuery("peace") ?? "";
    const books = await countPassagesByBook(core, match, "WEB");
    expect(books.reduce((n, b) => n + b.count, 0)).toBe(await countPassages(core, match, "WEB"));
    expect(books.map((b) => b.book).slice(0, 2)).toEqual(["GEN", "EXO"]);
    const john = books.find((b) => b.book === "JHN");
    const [lo, hi] = bookBounds("JHN");
    const hits = await searchPassages(core, match, "WEB", 500, [lo, hi]);
    expect(hits.length).toBe(john?.count);
    expect(hits.every((h) => h.ord >= lo && h.ord <= hi)).toBe(true);
  });

  it("offers the nearest word the Bible's text holds, and none for a word it holds (SE-32)", async () => {
    expect(await nearestTerm(core, "anxous")).toBe("anxious");
    expect(await nearestTerm(core, "peace")).toBeNull();
  });

  it("finds λόγος by form and love by gloss", async () => {
    const logos = await searchWordsByForm(core, planSearch("λόγος").wordKey ?? "");
    expect(logos[0]?.lemma).toBe("λόγος");
    const love = await searchWordsByGloss(core, "love");
    expect(love.map((l) => l.lemma)).toContain("ἀγαπάω");
    expect(love.some((l) => l.script === "hebrew")).toBe(true);
  });

  it("names Aramaic as Aramaic: Daniel 3:1 Aramaic, 1:1 Hebrew, 2:4 both (John, 15 Oct 2026)", async () => {
    const name = async (verse: [number, number]) => originalLanguage("hebrew", await getLanguageLetters(core, verseOrd("DAN", ...verse), verseOrd("DAN", ...verse)));
    expect(await name([3, 1])).toBe("Aramaic");
    expect(await name([1, 1])).toBe("Hebrew");
    expect(await name([2, 4])).toBe("Hebrew and Aramaic");
    const king = await searchWordsByGloss(core, "king");
    // H4428 is Hebrew's king (2,526 times); H4430 is Daniel and Ezra's Aramaic king.
    expect(king.find((l) => l.occurrenceKey === "H4428")?.language).toBe("Hebrew");
    expect(king.find((l) => l.occurrenceKey === "H4430")?.language).toBe("Aramaic");
    expect((await searchWordsByForm(core, planSearch("λόγος").wordKey ?? ""))[0]?.language).toBe("Greek");
  });

  it("counts λόγος by book and by verse (canvas S-04)", async () => {
    const [lexeme] = await searchWordsByForm(core, "λογοσ");
    expect(lexeme?.total).toBe(330);
    expect(await countVerses(core, lexeme?.occurrenceKey ?? "")).toBe(318);
    const books = await countsByBook(core, lexeme?.occurrenceKey ?? "");
    expect(books.slice(0, 4)).toEqual([
      { book: "MAT", count: 33 },
      { book: "MRK", count: 24 },
      { book: "LUK", count: 33 },
      { book: "JHN", count: 40 },
    ]);
    expect(books.at(-1)).toEqual({ book: "REV", count: 18 });
    expect(books.reduce((n, b) => n + b.count, 0)).toBe(330);
  });

  it("lists sources with encumbrances", async () => {
    const sources = await getSources(core);
    // SBLGNT's EULA question closed with core.v4 (CC BY 4.0, read 10 Oct 2026); the KJV's UK one is open.
    expect(sources.some((s) => (s.encumbered ?? "") !== "" && /SBLGNT/.test(s.dataset))).toBe(false);
    expect(sources.some((s) => (s.encumbered ?? "") !== "" && /King James/.test(s.dataset))).toBe(true);
  });
});

describe.skipIf(!haveBundles)("a downloaded translation attached to core", { timeout: 30_000 }, () => {
  const raw = haveBundles ? new DatabaseSync(corePath, { readOnly: true }) : (null as unknown as DatabaseSync);
  const core = haveBundles ? wrap(raw) : (null as unknown as Db);
  const file = path.join(mkdtempSync(path.join(tmpdir(), "yada-tr-")), "translation-tst.v1.db");
  if (haveBundles) {
    buildTranslationFile(raw, file);
    raw.exec(`ATTACH DATABASE '${file.replace(/'/g, "''")}' AS tr_tst_v1`);
  }
  afterAll(() => unrouteTranslation("TST"));

  it("is checked before it is routed", async () => {
    expect(await checkTranslationFile(core, "tr_tst_v1", "TST")).toMatchObject({ ok: true, verses: 5, meta: { name: "Test Translation" } });
    expect((await checkTranslationFile(core, "tr_tst_v1", "YLT")).ok).toBe(false);
    expect(readableTranslations()).not.toContain("TST");
  });

  it("reads, compares and searches like a built-in version once routed", async () => {
    routeTranslation("TST", "tr_tst_v1");
    expect(readableTranslations()).toEqual(["BSB", "WEB", "KJV", "LSV", "TST"]);
    const chapter = await getChapter(core, "JHN", 1, "TST");
    expect(chapter.map((v) => v.verse)).toEqual([1, 2, 3, 4, 5]);
    expect(chapter[0]?.text).toBe((await getChapter(core, "JHN", 1, "KJV"))[0]?.text);
    const texts = await getTexts(core, 43001001);
    expect(Object.keys(texts).sort()).toEqual(["BSB", "KJV", "LSV", "TST", "WEB"]);
    const range = await getTextsInRange(core, 43001001, 43001002);
    expect(range.map((r) => Object.keys(r.texts).length)).toEqual([5, 5]);
    expect((await getTextsForOrds(core, [43001003], "TST")).get(43001003)).toMatch(/^All things were made by him/);
    const hits = await searchPassages(core, buildFtsQuery("darkness") ?? "", "TST");
    expect(hits.map((h) => h.ord)).toEqual([43001005]);
    expect(await countPassages(core, buildFtsQuery("darkness") ?? "", "TST")).toBe(1);
    const [source] = await getTranslationSources(core);
    expect(source).toMatchObject({
      license: "PUBLIC_DOMAIN",
      attribution: "Test text, public domain.",
      url: "https://example.org/tst",
      translation: { code: "TST", name: "Test Translation" },
    });
  });

  it("stops being read the moment it is removed", async () => {
    routeTranslation("TST", "tr_tst_v1");
    unrouteTranslation("TST");
    expect(Object.keys(await getTexts(core, 43001001))).not.toContain("TST");
    expect(await getChapter(core, "JHN", 1, "TST")).toEqual([]);
  });

  it("refuses a schema name that is not a translation's", () => {
    expect(() => routeTranslation("TST", "main; DROP TABLE texts")).toThrow();
  });
});

// Whichever ASV the manifest lists: repackaging bumps its version.
const asvFile = haveBundles && existsSync(path.join(bundles, "manifest.json"))
  ? (JSON.parse(readFileSync(path.join(bundles, "manifest.json"), "utf8")) as { translations?: Array<{ code: string; file: string }> })
      .translations?.find((t) => t.code === "ASV")?.file
  : undefined;
const asvPath = path.join(bundles, asvFile ?? "translation-asv.v1.db");
describe.skipIf(!haveBundles || !existsSync(asvPath))("the pipeline's ASV file, as the app downloads it", { timeout: 30_000 }, () => {
  const raw = haveBundles ? new DatabaseSync(corePath, { readOnly: true }) : (null as unknown as DatabaseSync);
  const core = haveBundles ? wrap(raw) : (null as unknown as Db);
  afterAll(() => unrouteTranslation("ASV"));

  it("parses its manifest entry, verifies, checks, and leaves its blank Matthew 23:14 out rather than showing BSB", async () => {
    const manifest = JSON.parse(readFileSync(path.join(bundles, "manifest.json"), "utf8")) as unknown;
    const entry = parseCatalogue(manifest, "http://localhost:8787/manifest.json").entries.find((e) => e.code === "ASV");
    if (entry === undefined) throw new Error("manifest has no ASV entry");
    expect(await verifyDownload(new Uint8Array(readFileSync(asvPath)), entry)).toBe(true);
    raw.exec(`ATTACH DATABASE '${asvPath.replace(/'/g, "''")}' AS tr_asv_v1`);
    expect((await checkTranslationFile(core, "tr_asv_v1", "ASV", entry)).ok).toBe(true);
    routeTranslation("ASV", "tr_asv_v1");
    const texts = await getTexts(core, verseOrd("MAT", 23, 14));
    // The KJV prints it; the ASV keeps the verse number with no text, as the critical texts omit it.
    expect(texts.KJV).toBeDefined();
    expect(texts.ASV).toBeUndefined();
    expect(verseTextIn(texts, "ASV", true)).toBeNull();
    expect((await getChapter(core, "MAT", 23, "ASV")).some((v) => v.verse === 14)).toBe(false);
    expect((await searchPassages(core, buildFtsQuery("beginning") ?? "", "ASV", 3)).length).toBe(3);
  });
});

// Runs without the bundles: a translation file in the pipeline's own format,
// so the hits come from the same unicode61 remove_diacritics 2 the app uses.
describe("passage excerpts from a real FTS5 index", () => {
  // Acts 6:5, ASV, as eBible prints it (precomposed ü), and the same text in
  // NFD under the next ord, so a decomposed diaeresis is folded too.
  const verse =
    "And the saying pleased the whole multitude: and they chose Stephen, a man full of faith and of the Holy Spirit, and Philip, and Prochorus, and Nicanor, and Timon, and Parmenas, and Nicolaüs a proselyte of Antioch;";
  const file = path.join(mkdtempSync(path.join(tmpdir(), "yada-fts-")), "translation-tsd.v1.db");
  const build = new DatabaseSync(file);
  build.exec(TRANSLATION_DDL);
  const insert = build.prepare("INSERT INTO texts (ord, text) VALUES (?, ?)");
  insert.run(44006005, verse);
  insert.run(44006006, verse.normalize("NFD"));
  build.exec("INSERT INTO texts_fts(texts_fts) VALUES ('rebuild')");
  build.close();
  const raw = new DatabaseSync(":memory:");
  raw.exec(`ATTACH DATABASE '${file.replace(/'/g, "''")}' AS tr_tsd_v1`);
  const db = wrap(raw);
  // Routing is module-wide: set at collection, it would leak into the other suites' readableTranslations().
  beforeAll(() => routeTranslation("TSD", "tr_tsd_v1"));
  afterAll(() => unrouteTranslation("TSD"));

  it("shows a hit at the end of a long verse", async () => {
    const [hit] = await searchPassages(db, buildFtsQuery("proselyte") ?? "", "TSD");
    expect(splitSnippet(hit?.snippet ?? "").filter((p) => p.hit).map((p) => p.text)).toEqual(["proselyte"]);
    expect(hit?.snippet.startsWith("…Parmenas, and Nicolaüs a ")).toBe(true);
  });

  it("matches across diacritics, precomposed or not, and keeps the verse's spelling", async () => {
    const hits = await searchPassages(db, buildFtsQuery("nicolaus") ?? "", "TSD");
    expect(hits.map((h) => h.ord)).toEqual([44006005, 44006006]);
    expect(hits.map((h) => splitSnippet(h.snippet).find((p) => p.hit)?.text)).toEqual(["Nicolaüs", "Nicolaüs".normalize("NFD")]);
    expect(hits.every((h) => h.snippet.startsWith("…Timon, and Parmenas, and "))).toBe(true);
  });
});
