/**
 * Golden checks against the real sources, ported from assemble.py `checks()` and `rule9()` and the
 * passage-summary results John read (docs/no-ai-understand.md, rollout progress, 12 Oct 2026).
 * Skipped where YADA_ROOT/content/raw is absent (CI has none). Nothing loads at collection time.
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { highestVersionOnDisk } from "../package.js";
import { assembleBook, loadBook, packageUnderstandBook, understandPaths, verseReport, type LoadedBook } from "./package.js";
import { STOP_SHARE, genealogyLine, type PassageResult } from "./passage.js";
import { passageReport, summariseBook } from "./summaries.js";
import { outlineNamed, sayingsLines } from "./modes.js";
import { vk } from "./sources.js";
import { compareFact, derive, assemble, isMissing, readersDiffer, type Assembled, type VerseLayers } from "./verse.js";

const PATHS = understandPaths();
// The maps download too: packageUnderstandBook writes MS-01 places from it, and a machine without it
// would fail here rather than skip (code review, 15 Oct 2026).
const HAVE =
  existsSync(path.join(PATHS.raw, "uw-ust/en_ust")) &&
  existsSync(path.join(PATHS.raw, "bsb-tables/bsb_tables.tsv")) &&
  existsSync(path.join(PATHS.raw, "openbible/data/ancient.jsonl")) &&
  existsSync(path.join(PATHS.raw, "maps-15oct.sha256")) &&
  highestVersionOnDisk("core", PATHS.bundles) > 0;
const SLOW = 120_000;
const HAVE_JPS = highestVersionOnDisk("translation-jps", PATHS.bundles) > 0;

function live(r: Assembled | undefined): VerseLayers {
  if (r === undefined || isMissing(r)) throw new Error("expected a verse the BSB has");
  return r;
}

describe.skipIf(!HAVE)("verse layers against the real sources (assemble.py checks)", () => {
  const books = new Map<string, LoadedBook>();
  const at = (book: string, c: number, v: number): Assembled => {
    const loaded = books.get(book);
    if (loaded === undefined) throw new Error(`${book} not loaded`);
    return assemble(loaded.verses, derive(loaded.verses), c, v);
  };

  beforeAll(() => {
    for (const b of ["JHN", "1CO", "PSA"]) books.set(b, loadBook(b, { paths: PATHS, verifyPins: false }));
  }, SLOW);
  afterAll(() => {
    for (const b of books.values()) b.close();
  });

  it("1 Corinthians 14:34", () => {
    const r = live(at("1CO", 14, 34));
    expect(r.facts.some((f) => f.includes("Are to be silent") && f.includes("3 times") && f.includes("14:28, 14:30"))).toBe(true);
    // The note's readings, in any of the three wordings, still name “women” and the married-women reading.
    const loaded = books.get("1CO") as LoadedBook;
    expect(
      readersDiffer(loaded.verses, 14, 34).some((d) => d.about.toLowerCase() === "women" && d.sentence.toLowerCase().includes("married women") && d.sentence.toLowerCase().includes("“women”")),
    ).toBe(true);
    // 14:34–35 is a major debate with no approved note yet: tN's readings lead and the plain line follows
    // as one way to read it (John's verse-sheet spec, 12 Oct 2026).
    expect(r.beginner.debate).not.toBeNull();
    expect(r.beginner.order[0]).toBe("readers_differ");
    expect(r.beginner.plain?.label).toBe("One way to read it");
    for (const f of r.facts.filter((x) => x.startsWith("Translations differ"))) expect(f.split("“")[1]?.split("”")[0]?.split(" ").length).toBeLessThanOrEqual(2);
    expect(r.beginner.manuscripts.some((m) => m.includes("after verse 40"))).toBe(true);
    expect(r.where.section).toBe("Orderly Worship");
    expect(r.deeper.key_words.some((k) => k.term === "church")).toBe(true);
    expect(r.alongside.some((x) => x.startsWith("14:3"))).toBe(false);
  });

  it("the comparison fact: John uses the word for “world” most, and a name is never the word", () => {
    const loaded = books.get("JHN") as LoadedBook;
    expect(compareFact(loaded.verses, 3, 16)).toBe("John uses the word for “world” more than any other book: 78 of its 185 uses in the Bible.");
    expect(live(at("JHN", 3, 16)).facts[0]).toBe("John uses the word for “world” more than any other book: 78 of its 185 uses in the Bible.");
    expect(compareFact(loaded.verses, 11, 35)).toBeNull();
  });

  it("an ordinary verse with readings still leads with its plain line (John 1:5): readings lead only on a debate verse", () => {
    const r = live(at("JHN", 1, 5));
    expect(r.beginner.readers_differ.length).toBeGreaterThan(0);
    expect(r.beginner.order).toEqual(["plain", "readers_differ"]);
    expect(r.beginner.plain?.label).toBe("In plain words");
    expect(r.beginner.plain?.one_reading).toBe(true);
    // A verse's section is the passage that contains it, as the guide cuts it (option A, 7a3844a).
    expect(r.where.section).toBe((books.get("JHN") as LoadedBook).verses.pericopes[0]?.label);
    const plainFirst = live(at("JHN", 11, 35));
    expect([plainFirst.beginner.order, plainFirst.beginner.plain?.label]).toEqual([["plain", "readers_differ"], "In plain words"]);
  });

  it("says whose words a verse is: the speaker, John's vision, the Teacher, the letter's writer; narration has none", async () => {
    // Loaded one at a time with a yield between, so vitest's worker can report while ten books load.
    const more = new Map<string, LoadedBook>();
    for (const b of ["JOB", "REV", "ECC", "LEV", "ROM", "ISA", "GEN", "PRO", "MRK", "ACT", "MIC", "PSA", "JAS", "EZK"]) {
      more.set(b, loadBook(b, { paths: PATHS, verifyPins: false }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    try {
      const said = (book: string, c: number, v: number): Assembled => {
        const loaded = more.get(book) ?? (books.get(book) as LoadedBook);
        return assemble(loaded.verses, derive(loaded.verses), c, v);
      };
      // The live file's approvals predate sides (John, 15 Oct 2026), so they show nothing until he tags them.
      // The presentation checks below tag each approved position as its own side, as if he had.
      const tagged = (book: string, c: number, v: number): Assembled => {
        const loaded = more.get(book) ?? (books.get(book) as LoadedBook);
        const debates = loaded.verses.debates.map((d) => ({
          ...d,
          positions: (d.positions ?? []).map((p, i) => (p.status === "approved" && !p.side ? { ...p, side: `side ${i}` } : p)),
        }));
        const data = { ...loaded.verses, debates };
        return assemble(data, derive(data), c, v);
      };
      // Untagged, the live approvals count toward no side: Psalm 2:7 shows none of them.
      expect(live(said("PSA", 2, 7)).beginner.readers_differ.some((d) => d.source === "position")).toBe(
        (more.get("PSA") as LoadedBook).verses.debates.some((d) => d.from[0] === 2 && d.from[1] === 7 && new Set(d.positions?.filter((p) => p.status === "approved" && p.side).map((p) => p.side)).size >= 2),
      );
      expect(live(said("JOB", 8, 6)).beginner.voice).toBe("Bildad the Shuhite says:");
      expect(live(said("REV", 20, 2)).beginner.voice).toBe("In John’s vision:");
      expect(live(said("ECC", 1, 2)).beginner.voice).toBe("The Teacher says:");
      expect(live(said("LEV", 11, 3)).beginner.voice).toBe("God says:");
      expect(live(said("ROM", 1, 7)).beginner.voice).toBe("Paul tells them:");
      expect(live(said("JHN", 11, 35)).beginner.voice).toBeNull();
      // A tN reading ending in "or" never doubles the template's own "or" (Genesis 1:2).
      const gen = more.get("GEN") as LoadedBook;
      expect(readersDiffer(gen.verses, 1, 2).filter((d) => / or; or | or, or /.test(d.sentence))).toEqual([]);
      // Debate kinds (49310cc): "positions" and "held" show nothing until approved; "tn-readings" falls back
      // to a chapter introduction's two readings; a "data" entry with a manuscripts fact keeps its plain line.
      // After John's review (cf98f4c): Micah 5:2 has no two approved positions and Leviticus 18:22 is held, so
      // neither shows anything; Genesis 1 shows only his approved quotes, never an off-topic tN reading.
      for (const [book, c, v] of [["MIC", 5, 2], ["LEV", 18, 22]] as const) {
        const r = live(said(book, c, v));
        expect([r.beginner.plain, r.beginner.readers_differ, r.beginner.readers_lead], `${book} ${c}:${v}`).toEqual([null, [], null]);
      }
      expect(live(said("GEN", 1, 2)).beginner.readers_differ.every((d) => d.source === "position")).toBe(true);
      // The lead-in: readings that sit together (Psalm 2:7), readings that differ (1 Corinthians 14:34).
      expect(live(tagged("PSA", 2, 7)).beginner.readers_lead).toBe("Readers explain this in more than one way");
      expect(live(at("1CO", 14, 34)).beginner.readers_lead).toBe("Readers differ");
      // James 2:14–26: John put all three approved sentences on one side, "no real conflict" (15 Oct 2026), so
      // none of them shows.
      expect(live(tagged("JAS", 2, 24)).beginner.readers_differ.some((d) => d.source === "position")).toBe(false);
      // Ezekiel 40–48: every approved reading in the full view, three in the half view, the rest counted.
      const ezk = live(tagged("EZK", 40, 5)).beginner;
      const n40 = (more.get("EZK") as LoadedBook).verses.debates
        .filter((d) => d.book === "EZK" && d.from[0] === 40 && d.from[1] === 1)
        .flatMap((d) => d.positions ?? [])
        .filter((p) => p.status === "approved").length;
      expect(n40).toBeGreaterThan(3);
      expect(ezk.readers_differ).toHaveLength(n40);
      expect(Math.min(ezk.readers_half, ezk.readers_differ.length)).toBe(3);
      expect(ezk.readers_more).toBe(n40 - 3);
      // Revelation 20: John's three approved millennium positions lead (15 Oct 2026); tN's reading follows them.
      const rev20 = live(said("REV", 20, 4)).beginner.readers_differ;
      expect(rev20[0]?.source).toBe("position");
      expect(rev20.some((d) => d.sentence.includes("Jesus reigning now from heaven"))).toBe(true);
      const mark = live(said("MRK", 16, 9));
      expect(mark.beginner.plain).not.toBeNull();
      expect(mark.beginner.manuscripts.length).toBeGreaterThan(0);
      // With a voice line, "Speaking:" would repeat it.
      expect(live(said("JOB", 8, 6)).facts.some((f) => f.startsWith("Speaking:"))).toBe(false);
      // The LSV's "||" line marks are layout, never a word in a difference.
      expect(live(said("JOB", 8, 6)).facts.join(" ")).not.toContain("||");
      // Isaiah 7:14 is a "data" debate with no approved note. With the JPS 1917 bundle its "young woman" verse
      // leads the readings, and the plain line is never beside it (8f43cc9); without it, nothing shows.
      const immanuel = live(said("ISA", 7, 14));
      expect(immanuel.beginner.plain).toBeNull();
      expect(immanuel.beginner.debate).toEqual({ kind: "data" });
      if (HAVE_JPS) {
        expect(immanuel.beginner.readers_differ[0]?.sentence).toContain("young woman");
        expect(immanuel.beginner.readers_differ[0]?.credit).toBe("JPS 1917, public domain");
        expect(immanuel.beginner.order[0]).toBe("readers_differ");
      } else {
        expect(immanuel.beginner.readers_differ).toEqual([]);
      }
      // Audit fixes (8f43cc9, 41ebd8a): narration in a speech verse is not the speaker's (Acts 16:15); a
      // priests/Levites dialogue gets no frame (John 1:21); the UST's own quotation names the speaker (John 3:3).
      expect(live(said("ACT", 16, 15)).beginner.voice).toBeNull();
      expect(live(said("JHN", 1, 21)).beginner.voice).toBeNull();
      expect(live(said("JHN", 3, 3)).beginner.voice).toBeNull();
      // Hebrew names (Np) are never the comparison word (Isaiah 1:1).
      const isa11 = compareFact((more.get("ISA") as LoadedBook).verses, 1, 1) ?? "";
      expect(isa11).not.toContain("the word for “Isaiah”");
      expect(isa11).not.toContain("Judah");
      // TR is printed editions, not manuscripts (John 5:4).
      const j54 = said("JHN", 5, 4);
      expect((isMissing(j54) ? j54.manuscripts : []).some((m) => m.includes("TR") || m.includes("Later manuscripts include 4"))).toBe(false);
      // One phrase is explained once: no BSB "only begotten" note beside the reading on it (John 3:16).
      const j316 = live(said("JHN", 3, 16)).beginner;
      expect(j316.readers_differ.length === 0 || !j316.translators.some((n) => n.text.includes("begotten"))).toBe(true);
      // Approved positions (40bceef): sources' sentences unchanged, credited to the source alone, never John;
      // a rejected position never shows.
      const isa = more.get("ISA") as LoadedBook;
      const approved = {
        ...isa.verses,
        debates: [
          {
            book: "ISA",
            from: [7, 14] as [number, number],
            to: [7, 14] as [number, number],
            question: "q",
            kind: "data" as const,
            positions: [
              { text: "Source sentence one, unchanged.", source: "Keil and Delitzsch", status: "approved", side: "first view" },
              { text: "Source sentence two, unchanged.", source: "Tyndale Open Study Notes", status: "approved", side: "second view" },
              { text: "A rejected sentence.", source: "Ellicott", status: "rejected" },
            ],
          },
        ],
      };
      const rp = live(assemble(approved, derive(approved), 7, 14)).beginner.readers_differ;
      expect(rp.slice(0, 2).map((x) => x.sentence)).toEqual(["Source sentence one, unchanged.", "Source sentence two, unchanged."]);
      expect(rp[0]?.credit).toBe("Keil and Delitzsch");
      expect(rp.some((x) => x.credit.includes("John"))).toBe(false);
      expect(rp.some((x) => x.sentence === "A rejected sentence.")).toBe(false);
    } finally {
      for (const b of more.values()) b.close();
    }
  }, SLOW);

  it.skipIf(!HAVE_JPS)("Psalm 22:16 shows the JPS 1917 verse whole: “like a lion”", () => {
    const r = live(at("PSA", 22, 16));
    expect(r.beginner.readers_differ[0]?.sentence).toContain("like a lion");
    expect(r.beginner.readers_differ[0]?.sentence.startsWith("A Jewish translation, the JPS 1917, reads: “")).toBe(true);
  });

  it("John 5:4 is missing from the BSB, carries its note, and the UST brackets it", () => {
    const r = at("JHN", 5, 4);
    if (!isMissing(r)) throw new Error("John 5:4 should be missing");
    expect(r.manuscripts.length).toBeGreaterThan(0);
    expect(r.plain?.bracketed).toBe(true);
  });

  it("John 7:53 has the manuscripts note; John 11:35 and Psalm 23:1 have their plain lines", () => {
    expect(live(at("JHN", 7, 53)).beginner.manuscripts.length).toBeGreaterThan(0);
    expect(live(at("JHN", 11, 35)).beginner.plain?.text.startsWith("Jesus started crying")).toBe(true);
    expect(live(at("PSA", 23, 1)).beginner.plain).not.toBeNull();
  });

  it(
    "rule 9: no NLT wording in any beginner line or Explained note across John, 1 Corinthians and Psalms",
    () => {
      for (const loaded of books.values()) {
        const report = verseReport(assembleBook(loaded));
        expect(report.nltInBeginner, loaded.verses.book).toEqual([]);
        expect(report.leaks, loaded.verses.book).toEqual([]);
      }
    },
    SLOW,
  );
});

/**
 * Passages and passing summaries per book, as the port produces them from the prototype at 40bceef. Every
 * book matches the prototype line for line except where a Tyndale sentence carries an NLT lemma the BSB
 * does not use: the port passes it over (rule 9) where the prototype showed the NLT words unmarked. That
 * leaves one fewer passing in Ecclesiastes (2:18–26) and a different Tyndale sentence in Leviticus 8,
 * Exodus 2 and 38, Luke 19–22, Ruth 3 and the Song 5. The two-thirds outline fallback (13 Oct 2026) adds one
 * passing each in Acts (9:31–35), Genesis (14:17–24) and Isaiah (1:1–9), each headline read by hand. Showing a
 * summary with no headline (John, 15 Oct 2026) passes six more in Genesis and Revelation and one in Ecclesiastes,
 * and Mark 16:9–11. A quotation's first sentence where nothing else stands passes Exodus 35:4–9, and a brace
 * restored at a sentence's edge passes Acts 15:5–21 (15 Oct 2026).
 */
const SUMMARIES: ReadonlyArray<[string, number, number]> = [
  ["JHN", 46, 46],
  ["1CO", 45, 45],
  ["MRK", 90, 90],
  ["MAT", 141, 139],
  ["LUK", 146, 144],
  ["ACT", 110, 109],
  ["GEN", 142, 139],
  ["RUT", 8, 8],
  ["PSA", 171, 171],
  ["ISA", 117, 115],
  ["ROM", 47, 47],
  ["LEV", 70, 69],
  ["JOB", 50, 50],
  // The prototype passes 25: Ecclesiastes 2:18–26's Tyndale note carries an NLT lemma, so it is flagged here.
  ["ECC", 26, 25],
  ["PRO", 53, 52],
  ["SNG", 8, 8],
  ["REV", 59, 59],
  ["EXO", 116, 109],
];
const OLD_TESTAMENT = new Set(["GEN", "RUT", "PSA", "ISA", "LEV", "JOB", "ECC", "PRO", "SNG", "EXO"]);

describe.skipIf(!HAVE)("passage summaries against the real sources", () => {
  for (const [book, passages, passing] of SUMMARIES) {
    it(
      `${book}: ${passages} summaries, ${passing} pass, no more than 15% flagged`,
      () => {
        const loaded = loadBook(book, { paths: PATHS, verifyPins: false });
        // The rules alone: John's holds and approvals (passage_reviews.json) change as he reviews.
        const results = summariseBook({ ...loaded.passages, reviews: new Map() });
        loaded.close();
        const report = passageReport(loaded.passages, results);
        expect(report.summaries).toBe(passages);
        expect(report.passing).toBe(passing);
        expect(report.flagged.length / report.summaries).toBeLessThanOrEqual(STOP_SHARE);
        expect(report.stop).toBe(false);
        expect(report.sample).toHaveLength(5);
        if (book === "JHN") {
          // The sample John read once (docs/no-ai-understand.md).
          expect(report.sample).toEqual(["JHN.1.1-1.18", "JHN.9.1-9.41", "JHN.11.1-11.44", "JHN.11.45-11.57", "JHN.19.31-19.42"]);
        }
        // In the Old Testament, Glyssen's "Jesus", "Christ" or "Messiah" speakers are one tradition's reading.
        if (OLD_TESTAMENT.has(book)) expect(results.filter((r) => r.speakers.some((n) => /Jesus/.test(n))).map((r) => r.id)).toEqual([]);
        if (book === "ISA") {
          // A major debate is never settled: no sentence from 7:14, and no note until John approves one; the
          // passage waits on his list instead, without a flag.
          const immanuel = results.find((r) => r.id === "ISA.7.10-7.16");
          expect(immanuel?.sentences.some((d) => d.where[0] === 7 && d.where[1] === 14)).toBe(false);
          expect(immanuel?.debates).toEqual([]);
          expect(immanuel?.awaiting).toEqual(["ISA.7.10-7.16 (Whether the word means “virgin” or “young woman”, and who the child is)"]);
          expect(immanuel?.flags).toEqual([]);
          // John approved the prophets' tables (e77677d): the plain name and setting are stored as approved.
          expect(immanuel?.headline).toBe("Messages to Judah.");
          expect(immanuel?.headlineStatus).toBe("approved");
          expect(immanuel?.settings).toEqual([{ line: "Spoken in Judah under the threat of Assyria.", source: "tN book intro", status: "approved" }]);
          expect(results.find((r) => r.id.startsWith("ISA.40.1-"))?.settings[0]).toEqual({ line: "Words of comfort for the exiles in Babylon.", source: "tN book intro", status: "approved" });
        }
        if (book === "PSA") {
          const shepherd = results.find((r) => r.id === "PSA.23.1-23.6");
          expect(shepherd?.lead).toEqual([
            { label: "The picture", text: "David speaks of Yahweh as if he were a shepherd, and of himself as a sheep.", source: "tN" },
            { label: "What kind", text: "A song of trust in God", source: "tN intro" },
          ]);
          expect(results.every((r) => r.lead.length >= 1 && r.lead.length <= 2)).toBe(true);
        }
      },
      SLOW,
    );
  }
});


/** passage_summary.py `checks()`: the cases that read the sources or run a whole book (John, 12 Oct 2026). */
describe.skipIf(!HAVE)("the modes by kind of writing against the real sources", () => {
  const summaries = new Map<string, PassageResult[]>();
  const loaded = new Map<string, LoadedBook>();
  const book = (code: string): LoadedBook => {
    let l = loaded.get(code);
    if (l === undefined) {
      l = loadBook(code, { paths: PATHS, verifyPins: false });
      loaded.set(code, l);
    }
    return l;
  };
  const passage = (code: string, id: string): PassageResult => {
    let rs = summaries.get(code);
    if (rs === undefined) {
      rs = summariseBook(book(code).passages);
      summaries.set(code, rs);
    }
    const r = rs.find((x) => x.id === id);
    if (r === undefined) throw new Error(`${id} not found`);
    return r;
  };
  const bsb = (code: string, c: number, v1: number, v2: number): string =>
    Array.from({ length: v2 - v1 + 1 }, (_, i) => book(code).passages.bsb.get(vk(c, v1 + i)) ?? "").join(" ");
  const shown = (r: PassageResult): string => [r.headline, r.purpose?.line ?? "", r.text, ...r.facts.map((f) => `${f.fact} ${f.rest}`)].join(" ");
  afterAll(() => {
    for (const l of loaded.values()) l.close();
  });

  it(
    "genealogy lines come from the heading's own names (Genesis 11:10–26 said “to Haran”)",
    () => {
      expect(genealogyLine("Genealogy from Shem to Abram", bsb("GEN", 11, 10, 26))).toBe("The list runs from Shem to Abram.");
      expect(genealogyLine("The Descendants of Cain", bsb("GEN", 4, 17, 24))).toBeNull();
      expect(genealogyLine("Terah’s Descendants", bsb("GEN", 11, 27, 32))).toBeNull();
      expect(genealogyLine("Genealogy from Shem to Zerubbabel", bsb("GEN", 11, 10, 26))).toBeNull();
    },
    SLOW,
  );

  it(
    "Proverbs 5 is part of its collection with tN's themes; the Song's speakers come from the UST's headings",
    () => {
      const pro = book("PRO").passages;
      const [coll, themes] = sayingsLines([[5, 1], [5, 23]], pro.outline, pro.tnNotes, pro.events, pro.plainWords);
      expect(coll).toBe("A father teaches his son about wisdom");
      expect(themes).toContain("Adulterous women");
      const sng = book("SNG").passages;
      expect([sng.ustSpeakers.get(vk(1, 2)), sng.ustSpeakers.get(vk(4, 1))]).toEqual(["The woman", "The man"]);
      expect(sng.ust.get(vk(1, 2))).not.toContain("thinks about");
    },
    SLOW,
  );

  it(
    "Revelation 13 is not inside “The seven trumpets”; chapter 11 is",
    () => {
      expect(outlineNamed("The seven trumpets", bsb("REV", 13, 1, 18))).toBe(false);
      expect(outlineNamed("The seven trumpets", bsb("REV", 11, 1, 19))).toBe(true);
      expect(passage("REV", "REV.13.1-13.10").headline).not.toContain("The seven trumpets");
    },
    SLOW,
  );

  it(
    "Mark 4:35–41 is also told in Matthew and Luke; Mark 16's fact is one sentence, then the note",
    () => {
      expect(passage("MRK", "MRK.4.35-4.41").alsoToldIn).toEqual(["Matthew 8:23–27", "Luke 8:22–25"]);
      const m16 = passage("MRK", "MRK.16.1-16.8");
      expect(m16.facts[0]?.fact).toBe("Some early manuscripts end the Gospel of Mark after verse 8.");
      expect(m16.facts[0]?.rest).not.toBe("");
      expect(JSON.stringify(m16)).not.toContain("9But");
    },
    SLOW,
  );

  it(
    "Romans 3:21 uses the UST line; Exodus 26:1–6 is its topic with no prose or measures; Isaiah 40 opens with God's comfort",
    () => {
      expect(shown(passage("ROM", "ROM.3.21-3.31"))).not.toContain("By the witnesses of the Law");
      const exo = passage("EXO", "EXO.26.1-26.6");
      expect([exo.headlineKind, exo.headline]).toEqual(["Topic", "Inner covering."]);
      expect(shown(exo)).not.toMatch(/Hebrew words|cubit/);
      expect(passage("ISA", "ISA.40.1-40.5").text.startsWith("God says: “Comfort my people!")).toBe(true);
    },
    SLOW,
  );
});

describe.skipIf(!HAVE)("the understand bundle", () => {
  let dir = "";
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "yada-understand-"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it(
    "writes Ruth's verse layers, passages and sources with their licences, and keeps the file when nothing changed",
    () => {
      const first = packageUnderstandBook("RUT", { paths: PATHS, outDir: dir });
      expect(first.file).toBe("understand-rut.v1.db");
      const db = new DatabaseSync(path.join(dir, first.file), { readOnly: true });
      const count = (sql: string): number => Number(db.prepare(sql).get()?.["n"]);
      expect(count("SELECT count(*) AS n FROM verses")).toBe(85);
      expect(count("SELECT count(*) AS n FROM passages")).toBe(8);
      expect(count("SELECT count(*) AS n FROM passages WHERE sample = 1")).toBe(5);
      const sources = db.prepare("SELECT key, license, credit FROM sources ORDER BY key").all();
      expect(sources.map((s) => s["key"])).toEqual(["bsb", "obs", "openbible", "tn", "tq", "tw", "twl", "tyndale", "ust"]);
      // Build 6 (bundleExtras.ts): Ruth's word links (MM-03) and Bethlehem and Moab's places (MS-01).
      expect(count("SELECT count(*) AS n FROM word_links")).toBeGreaterThan(80);
      expect(count("SELECT count(*) AS n FROM places WHERE name = 'Bethlehem'")).toBe(1);
      expect(sources.find((s) => s["key"] === "ust")?.["credit"]).toBe("Simplified Text, adapted from unfoldingWord (alignment markup removed) · CC BY-SA 4.0");
      db.close();
      const again = packageUnderstandBook("RUT", { paths: PATHS, outDir: dir });
      expect(again.reused).toBe(true);
      expect(again.file).toBe(first.file);
    },
    SLOW,
  );
});
