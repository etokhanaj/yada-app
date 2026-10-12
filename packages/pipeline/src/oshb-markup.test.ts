import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseOshbXml, wordText } from "./parsers.js";

// Verbatim OSHB verses carrying the scribal large, small and suspended letters. Until
// 11 Oct 2026 (found by the MACULA join) their `<seg>` markup was stored as part of the
// word, so the reader showed `<seg type="x-large">` as text in eleven Hebrew words.
const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/oshb/large-small-suspended.xml");
const { tokens } = parseOshbXml(readFileSync(FIXTURE, "utf8"));
const surfaces = (verseId: string): string[] =>
  tokens.filter((t) => t.verse_id === verseId).map((t) => t.surface);

describe("OSHB words with child markup", () => {
  it("reads Deut 6:4 with its two large letters as plain letters", () => {
    expect(surfaces("DEU.6.4")).toEqual([
      "שְׁמַ֖ע",
      "יִשְׂרָאֵ֑ל",
      "יְהוָ֥ה",
      "אֱלֹהֵ֖ינוּ",
      "יְהוָ֥ה",
      "אֶחָֽד",
    ]);
  });

  it("reads Judg 18:30 with its raised nun as a plain letter", () => {
    expect(surfaces("JDG.18.30")).toEqual([
      "וַיָּקִ֧ימוּ",
      "לָהֶ֛ם",
      "בְּנֵי",
      "דָ֖ן",
      "אֶת",
      "הַפָּ֑סֶל",
      "וִ֠יהוֹנָתָן",
      "בֶּן",
      "גֵּרְשֹׁ֨ם",
      "בֶּן",
      "מְנַשֶּׁ֜ה",
      "ה֣וּא",
      "וּבָנָ֗יו",
      "הָי֤וּ",
      "כֹהֲנִים֙",
      "לְשֵׁ֣בֶט",
      "הַדָּנִ֔י",
      "עַד",
      "י֖וֹם",
      "גְּל֥וֹת",
      "הָאָֽרֶץ",
    ]);
  });

  it("splits morphemes after the markup is gone, not on the slash of </seg>", () => {
    // Num 27:5 `מִשְׁפָּטָ֖/<seg type="x-large">ן</seg>`: three parts against two morphs
    // while the closing tag was counted, so the word lost its stem and suffix.
    const word = tokens.find((t) => t.verse_id === "NUM.27.5" && t.position === 4);
    expect(word?.surface).toBe("מִשְׁפָּטָ֖ן");
    expect(word?.strongs).toBe("H4941");
    expect(word?.morphemes?.map((m) => m.role)).toEqual(["stem", "suffix"]);
  });

  it("leaves no markup in any surface, and keeps the source verbatim in raw_surface", () => {
    for (const token of tokens) expect(token.surface).not.toMatch(/[<>&]/);
    const shema = tokens.find((t) => t.verse_id === "DEU.6.4" && t.position === 1);
    expect(shema?.raw_surface).toContain('<seg type="x-large">');
  });

  it("keeps morpheme slashes while removing tags", () => {
    expect(wordText('a/b<seg type="x-small">c</seg>')).toBe("a/bc");
  });
});
