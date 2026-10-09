/**
 * The app's SQL, run against the real bundles under node:sqlite. Skipped when
 * content/bundles has not been built (it is gitignored working data).
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { buildFtsQuery, planSearch, splitSnippet } from "../lib/searchQuery";
import { resolvePassage } from "../lib/pericopes";
import {
  countInBook, getChapter, getEntriesInRange, getEntryRow, getLexeme, getOccurrences, getPericopes, getSources,
  getTexts, getTokens, searchPassages, searchWordsByForm, searchWordsByGloss, type Db,
} from "./queries";

const bundles = path.resolve(__dirname, "../../../../content/bundles");
const corePath = path.join(bundles, "core.v2.db");
const haveBundles = existsSync(corePath);

function open(file: string): Db {
  const db = new DatabaseSync(file, { readOnly: true });
  return {
    getAllAsync: async <T,>(sql: string, params: Array<string | number | null>) => db.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T,>(sql: string, params: Array<string | number | null>) =>
      (db.prepare(sql).get(...params) as T | undefined) ?? null,
  };
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

  it("reads all three translations of a verse", async () => {
    const t = await getTexts(core, 43001001);
    expect(Object.keys(t).sort()).toEqual(["BSB", "KJV", "WEB"]);
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

  it("finds λόγος by form and love by gloss", async () => {
    const logos = await searchWordsByForm(core, planSearch("λόγος").wordKey ?? "");
    expect(logos[0]?.lemma).toBe("λόγος");
    const love = await searchWordsByGloss(core, "love");
    expect(love.map((l) => l.lemma)).toContain("ἀγαπάω");
    expect(love.some((l) => l.script === "hebrew")).toBe(true);
  });

  it("lists sources with encumbrances", async () => {
    const sources = await getSources(core);
    expect(sources.some((s) => (s.encumbered ?? "") !== "" && /SBLGNT/.test(s.dataset))).toBe(true);
  });
});

describe.skipIf(!existsSync(path.join(bundles, "jhn.v1.db")))("queries against Understand bundles", () => {
  it("reads an entry and resolves John's pericopes", async () => {
    const jhn = open(path.join(bundles, "jhn.v1.db"));
    const row = await getEntryRow(jhn, "JHN.1.1");
    expect(row?.review_status).toBe("flagged");
    const pericopes = await getPericopes(jhn);
    const entries = await getEntriesInRange(jhn, 43001001, 43001020);
    const r = resolvePassage(pericopes, entries, 43001001, 43001020);
    expect(r.pericopes.map((p) => p.pericope.label)).toEqual(["The Word became flesh", "The testimony of John the Baptist"]);
    expect(r.pericopes[0]?.entries.map((e) => e.verse_id)).toEqual(["JHN.1.1"]);
  });
});
