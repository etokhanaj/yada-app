import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

import { parseOshb } from "./parsers.js";
import { RAW } from "./paths.js";

/**
 * Hebrew and English numbering diverge in three distinct ways, and each one was
 * wrong at some point in this pipeline's history. These lock all three.
 *
 * Skipped when the raw sources are absent — `yada ingest` fetches them, and a
 * clean checkout should not fail its tests for want of a network.
 */
const HAVE_SOURCES = existsSync(path.join(RAW, "Ps.xml"));
const describeIfIngested = HAVE_SOURCES ? describe : describe.skip;

describeIfIngested("Hebrew -> English versification", () => {
  // vitest still runs a skipped suite's body to collect its tests, so parsing
  // here unguarded crashed every clean checkout — including CI — with ENOENT
  // instead of skipping.
  const psalms = HAVE_SOURCES ? parseOshb("Ps.xml") : { tokens: [] };
  const verseIds = new Set(psalms.tokens.map((t) => t.verse_id));

  it("splits a title that shares Hebrew verse 1 with English verse 1 (Ps 23)", () => {
    const title = psalms.tokens.filter((t) => t.verse_id === "PSA.23.0");
    expect(title.map((t) => t.surface.normalize("NFC"))).toEqual(
      ["מִזְמ֥וֹר", "לְדָוִ֑ד"].map((s) => s.normalize("NFC")),
    );
    // English Ps 23 has six verses; the title takes none of their numbers.
    expect(verseIds.has("PSA.23.6")).toBe(true);
    expect(verseIds.has("PSA.23.7")).toBe(false);
  });

  it("renumbers a chapter whose title is the whole of Hebrew verse 1 (Ps 3)", () => {
    // English Ps 3:1 is "LORD, how many are my foes" — Hebrew 3:2. If the shift
    // is missed, PSA.3.1 wrongly holds the superscription instead.
    const first = psalms.tokens.filter((t) => t.verse_id === "PSA.3.1");
    expect(first[0]?.surface.normalize("NFC")).toBe("יְ֭הוָה".normalize("NFC"));
    expect(verseIds.has("PSA.3.0")).toBe(true);
    expect(verseIds.has("PSA.3.9")).toBe(false);
  });

  it("keeps a two-verse title in one verse 0 (Ps 51)", () => {
    expect(verseIds.has("PSA.51.0")).toBe(true);
    expect(verseIds.has("PSA.51.19")).toBe(true);
    expect(verseIds.has("PSA.51.20")).toBe(false);
  });

  it("reports every title it created", () => {
    // 116 chapters of Psalms carry a KJV note naming verse 1.
    const titles = [...verseIds].filter((id) => id.endsWith(".0"));
    expect(titles).toHaveLength(116);
  });
});

describeIfIngested("cross-chapter shifts", () => {
  it("moves Hebrew Gen 32:1 to English Gen 31:55", () => {
    const genesis = parseOshb("Gen.xml");
    const ids = new Set(genesis.tokens.map((t) => t.verse_id));
    expect(ids.has("GEN.31.55")).toBe(true);
    // Narrative books have no superscriptions. Genesis 32 does contain a note
    // naming verse 1, which briefly convinced the parser there was a title.
    expect(ids.has("GEN.32.0")).toBe(false);
    expect(genesis.report.titles).toBe(0);
    expect(genesis.report.crossChapter.some((c) => c.includes("31.55"))).toBe(true);
  });

  it("moves Hebrew Lev 5:20-26 to English Lev 6:1-7", () => {
    const leviticus = parseOshb("Lev.xml");
    const ids = new Set(leviticus.tokens.map((t) => t.verse_id));
    expect(ids.has("LEV.5.20")).toBe(false);
    expect(ids.has("LEV.6.1")).toBe(true);
    expect(leviticus.report.titles).toBe(0);
  });
});
