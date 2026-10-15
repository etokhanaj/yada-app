import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { type Passage, type PassageRow, type VerseLayers, isMissingVerse, parsePassage, parseVerseLayers } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { halves, inShort, passagesTouched, prophetLeads, readerLeadLines, repeats, versesLabel } from "./passageGuide";
import { halfView, parseUnderstandCatalogue, plainSegments, readerLines, readersLead, spokenPlain, translatorNotes } from "./understand";

const bundles = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../content/bundles");

/** The newest understand-<book>.vN.db on disk, or null in a checkout without content/. */
function latest(book: string): string | null {
  if (!existsSync(bundles)) return null;
  const files = readdirSync(bundles)
    .filter((f) => f.startsWith(`understand-${book}.v`) && f.endsWith(".db"))
    .sort((a, b) => Number(/v(\d+)/.exec(b)?.[1]) - Number(/v(\d+)/.exec(a)?.[1]));
  return files[0] === undefined ? null : path.join(bundles, files[0]);
}

function verse(book: string, id: string): VerseLayers {
  const file = latest(book);
  if (file === null) throw new Error(`no understand-${book}`);
  const db = new DatabaseSync(file, { readOnly: true });
  const row = db.prepare("SELECT layers FROM verses WHERE verse_id = ?").get(id) as { layers: string };
  db.close();
  const parsed = parseVerseLayers(row.layers);
  if (parsed === null || isMissingVerse(parsed)) throw new Error(`${id} did not parse`);
  return parsed;
}

function passage(book: string, id: string): Passage {
  const file = latest(book);
  if (file === null) throw new Error(`no understand-${book}`);
  const db = new DatabaseSync(file, { readOnly: true });
  const row = db.prepare("SELECT * FROM passages WHERE passage_id = ?").get(id) as unknown as PassageRow;
  db.close();
  const parsed = parsePassage(row);
  if (parsed === null) throw new Error(`${id} did not parse`);
  return parsed;
}

describe("the plain line's added words (VS-02)", () => {
  it("splits {…} out, braces removed", () => {
    expect(plainSegments("{This is} because God loved")).toEqual([
      { text: "This is", added: true },
      { text: " because God loved", added: false },
    ]);
  });

  it("says once per line that words were added", () => {
    expect(spokenPlain("{This is} because God loved")).toBe("This is because God loved (Some words added for clarity.)");
    expect(spokenPlain("God loved")).toBe("God loved");
  });
});

describe("the manifest's understand list", () => {
  const entry = {
    book: "JHN",
    version: 2,
    file: "understand-jhn.v2.db",
    sha256: "a".repeat(64),
    bytes: 10,
    download_bytes: 5,
    format: 1,
    verses: 879,
    passages: 46,
  };

  it("keeps known formats, one per book, with the URL beside the manifest", () => {
    const out = parseUnderstandCatalogue({ understand: [entry, entry, { ...entry, book: "LUK", file: "understand-luk.v2.db", format: 9 }] }, "https://x.test/v1/manifest.json");
    expect(out.map((e) => e.book)).toEqual(["JHN"]);
    expect(out[0]?.url).toBe("https://x.test/v1/understand-jhn.v2.db");
  });

  it("refuses a file name that is not the book's own", () => {
    expect(parseUnderstandCatalogue({ understand: [{ ...entry, file: "../core.v5.db" }] }, "https://x.test/manifest.json")).toEqual([]);
  });
});

describe("repeated lines are hidden where the text they repeat is on screen (John, 12 Oct 2026)", () => {
  it("drops Isaiah 40's setting line under its section name", () => {
    expect(repeats("Words of comfort for the exiles in Babylon.", ["Comfort for the exiles in Babylon"])).toBe(true);
  });

  it("drops Psalm 51's Written when beside the superscription", () => {
    const title = "For the choirmaster. A Psalm of David. When Nathan the prophet came to him after his adultery with Bathsheba.";
    expect(repeats("Written when Nathan the prophet came to David after his adultery with Bathsheba.", [title])).toBe(true);
  });

  it("keeps a line that says something new", () => {
    expect(repeats("A prayer asking God to forgive", ["Create in Me a Clean Heart, O God"])).toBe(false);
  });
});

describe("verse labels", () => {
  it("names a range within a chapter and across chapters", () => {
    expect(versesLabel(43001003, 43001005)).toBe("1:3–5");
    expect(versesLabel(43001015, 43002003)).toBe("1:15–2:3");
    expect(versesLabel(46014034, 46014034)).toBe("14:34");
  });
});

describe.skipIf(latest("jhn") === null || latest("1co") === null || latest("isa") === null || latest("psa") === null)("against the built bundles", () => {
  it("John 3:16: a plain line past 30 words stands alone in the half view (VS-01)", () => {
    const half = halfView(verse("jhn", "JHN.3.16"));
    expect(half.readersFirst).toBe(false);
    expect(half.plainLarge).toBe(true);
    expect(half.readers).toEqual([]);
    expect(half.fact).toBeNull();
    expect(half.readersCount).toBe(2);
  });

  it("1 Corinthians 14:34: Readers differ first, with its count and first reading (VS-03)", () => {
    const v = verse("1co", "1CO.14.34");
    const half = halfView(v);
    expect(half.readersFirst).toBe(true);
    expect(half.readers).toHaveLength(1);
    expect(readersLead(v, half.readersCount)).toBe("Readers differ · 2");
    expect(v.beginner.plain?.label).toBe("One way to read it");
    expect(v.beginner.voice).toBe("Paul tells them:");
  });

  it("Isaiah 7:14: the JPS reading and the BSB's own footnote make two (VS-05, VS-06)", () => {
    const v = verse("isa", "ISA.7.14");
    expect(readerLines(v).map((l) => l.text)).toEqual([expect.stringMatching(/^A Jewish translation, the JPS 1917, reads:/u), "The BSB’s own footnote: Or young woman."]);
    expect(translatorNotes(v)).toEqual([]);
  });

  it("no line in any reading is from a licensed translation (rule 9)", () => {
    for (const [book, id] of [["jhn", "JHN.3.16"], ["1co", "1CO.14.34"], ["isa", "ISA.7.14"]] as const) {
      const text = JSON.stringify(verse(book, id));
      expect(text).not.toMatch(/\b(NKJV|NIV|The Message|MSG)\b/u);
    }
  });

  it("a passage's In short: headline, then its sentences (NA-04)", () => {
    const short = inShort(passage("jhn", "JHN.3.1-3.21"));
    expect(short.headline).toBe("Jesus teaches Nicodemus about being born again.");
    expect(short.lines.length).toBeGreaterThanOrEqual(2);
  });

  it("Psalm 51 in the reader: Written when is hidden under its superscription; What kind stays (JR-02)", () => {
    const p = passage("psa", "PSA.51.1-51.19");
    const title = "For the choirmaster. A Psalm of David. When Nathan the prophet came to him after his adultery with Bathsheba.";
    expect(readerLeadLines(p, [p.label, title])).toEqual(["A prayer asking God to forgive"]);
  });

  it("a range across two passages touches both, first one first (UX-07)", () => {
    const a = passage("jhn", "JHN.1.1-1.18");
    const b = passage("jhn", "JHN.1.19-1.34");
    expect(passagesTouched([b, a], 43001015, 43001020).map((p) => p.id)).toEqual(["JHN.1.1-1.18", "JHN.1.19-1.34"]);
  });
});

describe.skipIf(latest("isa") === null)("prophets in the reader (JR-04)", () => {
  it("names Isaiah 40's section once and hides its setting line, which repeats the name", () => {
    const leads = prophetLeads([passage("isa", "ISA.39.1-39.8"), passage("isa", "ISA.40.1-40.5"), passage("isa", "ISA.40.6-40.8")]);
    expect(leads.get("ISA.40.1-40.5")).toEqual({ section: "Comfort for the exiles in Babylon", setting: null });
    expect(leads.has("ISA.40.6-40.8")).toBe(false);
  });
});

describe("a flagged summary is held back; its facts stay (EG-01)", () => {
  const row: PassageRow = {
    passage_id: "MRK.16.9-16.11",
    label: "Jesus Appears to Mary Magdalene",
    start_ord: 41016009,
    end_ord: 41016011,
    headline: "",
    headline_kind: "What happens",
    mode: "gospel",
    summary: "",
    sentences: JSON.stringify([{ text: "A sentence that failed the gate.", where: [16, 9], source: "UST", credit: "c" }]),
    credit: "From unfoldingWord",
    speakers: "[]",
    facts: JSON.stringify([{ fact: "Some early manuscripts end the Gospel of Mark after verse 8.", rest: "" }]),
    psalm_lead: "[]",
    psalm_about: "[]",
    debates: "[]",
    purpose: JSON.stringify({ line: "A drafted line not yet approved.", source: "kinds.json", status: "draft" }),
    around: null,
    also_told_in: "[]",
    themes: "[]",
    settings: "[]",
    flagged: 1,
  };

  it("empties the sentences, drops an unapproved line, keeps the facts", () => {
    const p = parsePassage(row);
    expect(p?.sentences).toEqual([]);
    expect(p?.purpose).toBeNull();
    expect(p === null ? [] : inShort(p).facts).toEqual(["Some early manuscripts end the Gospel of Mark after verse 8."]);
  });
});

describe.skipIf(latest("1co") === null)("the readers-differ marker (review, 12 Oct 2026)", () => {
  it("is absent on a held debate that shows no reading: 1 Corinthians 6:9", () => {
    const v = verse("1co", "1CO.6.9");
    expect(v.beginner.debate?.kind).toBe("held");
    expect(readerLines(v)).toEqual([]);
  });
});

describe("the psalm tip (JR-01)", () => {
  it("splits Psalm 27:1 into its two halves, unaltered", () => {
    expect(halves("The LORD is my light and my salvation—whom shall I fear? The LORD is the stronghold of my life—whom shall I dread?")).toEqual([
      "The LORD is my light and my salvation—whom shall I fear?",
      "The LORD is the stronghold of my life—whom shall I dread?",
    ]);
  });
});
