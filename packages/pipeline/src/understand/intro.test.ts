import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { BOOK_ORDER } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { INTROS_FILE, INTRO_WORDS, bookIntro, extractIntros, introMeta, introsCommand, mergeIntros, readIntros, readTyndale, tyndaleIntro, writeIntros, type IntroEntry } from "./intro.js";
import { lastDecisions } from "../reviewLog.testkit.js";
import { UNDERSTAND_DATA, understandPaths } from "./package.js";

const HEADER = "Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote";
/** A tN file whose front:intro note is these markdown lines, joined with tN's literal `\n`. */
const tn = (...lines: string[]): string => `${HEADER}\nfront:intro\tab12\t\t\t\t0\t${lines.join("\\n")}\n1:1\tcd34\t\t\t\t1\tA verse note.\n`;
const about = (paragraph: string, heading = "### What is the book of Hebrews about?"): string =>
  tn("# Introduction to Hebrews", "", "## Part 1: General Introduction", "", heading, "", paragraph, "", "### How should the title of this book be translated?", "", "Translators may…");
const words = (n: number, w = "word"): string => Array.from({ length: n }, () => w).join(" ");

describe("Tyndale's opening, cut by the rules John's rejections asked for (decision 24)", () => {
  it("passes over a leading quotation and question, and stops at a later one", () => {
    const r = tyndaleIntro("“That terrible day of the Lord is near” (Zeph 1:14). Will the day spell the end? Zephaniah warned Judah and the nations around it of a coming judgment on their idolatry and on their leaders. He also said “come back” to them.", "ZEP");
    expect(r.intro?.text).toBe("Zephaniah warned Judah and the nations around it of a coming judgment on their idolatry and on their leaders.");
    expect(r.intro?.source).toBe("tyndale");
  });

  it("gives nothing under 15 words, so tN is tried", () => {
    expect(tyndaleIntro("Zephaniah’s words send a chill through the soul.", "ZEP").intro).toBeNull();
  });

  it("tries after the last aside when the hook leaves only a fragment (Zephaniah)", () => {
    const r = tyndaleIntro("“That terrible day of the Lord is near. . . .” “It will be . . . a day of ruin” (Zeph 1:14-15). Zephaniah’s words send a chill through the soul. Will the day of the Lord spell the end to everything? Zephaniah’s prophecy portrays the coming judgment, but it also presents God’s promise that his faithful people will one day enjoy a world of everlasting righteousness and joy.", "ZEP");
    expect(r.intro?.text).toBe("Zephaniah’s prophecy portrays the coming judgment, but it also presents God’s promise that his faithful people will one day enjoy a world of everlasting righteousness and joy.");
  });

  it("starts at its own book, not a numbered sibling", () => {
    const r = bookIntro(about("The Book of 1 Chronicles retells the line from Adam to Saul in great and careful detail. The Book of 2 Chronicles gives the history of Israel beginning with Solomon and ending in exile."), "2CH");
    expect(r.intro?.text).toBe("The Book of 2 Chronicles gives the history of Israel beginning with Solomon and ending in exile.");
  });

  it("never ends on a sentence the next one turns on", () => {
    const r = bookIntro(about(`Zephaniah ${words(30)}. Hezekiah had been a godly ruler for many years. But ${words(30)}.`), "ZEP");
    expect(r.intro?.text).toBe(`Zephaniah ${words(30)}.`);
  });

  it("stops at a sentence with no full stop (ECC's “(1:3) Ecclesiastes…”)", () => {
    const r = bookIntro(about("Ecclesiastes asks what profit belongs to humanity (1:3) Ecclesiastes is a series of thoughts. It ends with fear of God."), "ECC");
    expect(r.intro).toBeNull();
  });
});

describe("rejections stay rejected (decision 24)", () => {
  const intro = (text: string, source: "tyndale" | "tn" = "tyndale") => ({ intro: { text, words: 3, paragraph: text, source }, reason: null }) as const;
  it("a rejected text keeps its rejection when another source replaces it and when it comes back", () => {
    const first = mergeIntros([{ book: "ZEP", text: "Old.", ref: "", paragraph: "", status: "rejected" }], [{ book: "ZEP", result: intro("New.") }]);
    expect(first[0]).toMatchObject({ text: "New.", status: "draft", rejected: ["Old."] });
    const back = mergeIntros(first, [{ book: "ZEP", result: intro("Old.", "tn") }]);
    expect(back[0]).toMatchObject({ text: "Old.", status: "rejected" });
    expect(introMeta(intro("Old.", "tn"), "ZEP", first)).toBeNull();
  });

  it("John's later approval of a text he once rejected wins: undo, approve, re-run, and it ships", () => {
    const approved: IntroEntry[] = [{ book: "ZEP", text: "Old.", ref: "", paragraph: "", status: "approved", rejected: ["Old."] }];
    expect(mergeIntros(approved, [{ book: "ZEP", result: intro("Old.", "tn") }])[0]?.status).toBe("approved");
    expect(introMeta(intro("Old.", "tn"), "ZEP", approved)?.status).toBe("approved");
  });

  it("refuses rather than fall back to tN when the Tyndale zip is missing", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "yada-tosn-"));
    try {
      expect(() => readTyndale(empty)).toThrow(/tosn-BookIntros\.xml\.zip is missing/);
      expect(readTyndale(empty, false).size).toBe(0);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("credits Tyndale as its README asks for an adapted copy", () => {
    expect(introMeta(intro("New."), "ZEP", [])?.credit).toMatch(/^Adapted from Tyndale Open Study Notes.*tyndaleopenresources\.com.*CC BY-SA 4\.0$/);
  });
});

describe("book introductions from tN's front:intro (build 6, item G)", () => {
  it("Genesis: no “What is … about?” section, so nothing", () => {
    const r = bookIntro(tn("# Introduction to Genesis", "", "### What is the book of Genesis?", "", "Genesis is the first book."));
    expect(r.intro).toBeNull();
    expect(r.reason).toMatch(/no “What is … about\?” section/);
  });

  it("no front:intro row at all, so nothing", () => {
    expect(bookIntro(`${HEADER}\n1:1\tcd34\t\t\t\t1\tA verse note.\n`).intro).toBeNull();
  });

  it("drops a last sentence that only announces a list (HEB)", () => {
    const r = bookIntro(about("Hebrews is a “word of exhortation” (13:22) that encourages the audience. There are three primary explanations for why the author sent this letter."));
    expect(r.intro?.text).toBe("Hebrews is a “word of exhortation” (13:22) that encourages the audience.");
  });

  it("keeps whole sentences up to 60 words and stops before the one that would pass it", () => {
    const first = `Paul wrote ${words(40)}.`;
    const second = `He also ${words(16)}.`;
    const third = `Then ${words(5)}.`;
    const r = bookIntro(about(`${first} ${second} ${third}`));
    expect(r.intro?.text).toBe(`${first} ${second}`);
    expect(r.intro?.words).toBe(60);
    expect(r.intro?.words).toBeLessThanOrEqual(INTRO_WORDS);
  });

  it("gives nothing when the first sentence alone is over 60 words", () => {
    const r = bookIntro(about(`Paul wrote ${words(62)}. Short one.`));
    expect(r.intro).toBeNull();
    expect(r.reason).toBe("first sentence is 64 words");
  });

  it("stops before a sentence addressed to the reader-translator (“you”)", () => {
    const r = bookIntro(about("Paul wrote this letter to Titus. If you want, you can say more. Paul also wrote other things."));
    expect(r.intro?.text).toBe("Paul wrote this letter to Titus.");
  });

  it("stops before a sentence about translating or the ULT/UST", () => {
    expect(bookIntro(about("Ruth is a story. Translators should keep it short. More here.")).intro?.text).toBe("Ruth is a story.");
    expect(bookIntro(about("Ruth is a story. The ULT says it plainly.")).intro?.text).toBe("Ruth is a story.");
    expect(bookIntro(about("Ruth is a story. The UST says it plainly.")).intro?.text).toBe("Ruth is a story.");
  });

  it("cleans with md(): links to their words, bold and (See: …) gone, no empty ( ) left", () => {
    const r = bookIntro(about("**Paul** wrote to [Rome](../01/01.md) (See: [[rc://en/ta/man/translate/figs-metaphor]]). He wanted ( ) to visit."));
    expect(r.intro?.text).toBe("Paul wrote to Rome. He wanted to visit.");
  });

  it("reads Psalms' own heading, “What is the book of Psalms?”", () => {
    const r = bookIntro(about("The book of Psalms is a collection of songs.", "### What is the book of Psalms?"));
    expect(r.intro?.text).toBe("The book of Psalms is a collection of songs.");
  });

  it("does not take the “What is the meaning of the name …” section", () => {
    expect(bookIntro(about("It means praise.", "### What is the meaning of the name Judah about?")).intro).toBeNull();
  });
});

describe("review state (rule 2)", () => {
  const result = bookIntro(about("Ruth is a story."));
  const entry = (status: IntroEntry["status"], text = "Ruth is a story."): IntroEntry => ({ book: "RUT", text, ref: "", paragraph: "", status });

  it("is flagged until John approves this exact text", () => {
    expect(introMeta(result, "RUT", [])?.status).toBe("flagged");
    expect(introMeta(result, "RUT", [entry("draft")])?.status).toBe("flagged");
    expect(introMeta(result, "RUT", [entry("approved")])?.status).toBe("approved");
    expect(introMeta(result, "RUT", [entry("approved", "Ruth is an older story.")])?.status).toBe("flagged");
  });

  it("a text John rejected is not in the bundle at all, not even flagged", () => {
    expect(introMeta(result, "RUT", [entry("rejected")])).toBeNull();
    // A rejection is of that text: a changed text is new, and flagged until he decides.
    expect(introMeta(result, "RUT", [entry("rejected", "Ruth is an older story.")])?.status).toBe("flagged");
  });

  it("carries the source and a credit that says it was shortened, with no ® mark", () => {
    const meta = introMeta(result, "RUT", []);
    expect(meta?.source).toBe("tn");
    expect(meta?.credit).toMatch(/shortened/);
    expect(meta?.credit).not.toMatch(/®/);
  });

  it("a refresh keeps a decision only while the text is unchanged", () => {
    const merged = mergeIntros([entry("approved"), { ...entry("approved"), book: "EST" }], [
      { book: "RUT", result },
      { book: "EST", result: bookIntro(about("Esther became queen.")) },
      { book: "GEN", result: { intro: null, reason: "none" } },
    ]);
    expect(merged.map((e) => [e.book, e.status])).toEqual([["RUT", "approved"], ["EST", "draft"]]);
  });

  it("approves only what John approved in the review tool, on the text he read", () => {
    // Was "starts with nothing approved"; John's review (bb61acf) approved 49. Every approval must be his
    // last logged decision on exactly this text, so no status is promoted outside the review tool.
    const log = lastDecisions("book_intro");
    for (const e of readIntros(UNDERSTAND_DATA).entries.filter((e) => e.status === "approved")) {
      expect(log.get(e.book), e.book).toEqual({ decision: "approved", reviewer: "john", text_sha256: createHash("sha256").update(e.text, "utf8").digest("hex") });
    }
  });
});

describe("`yada intros` refuses rather than wipe the review file (code review, 15 Oct 2026)", () => {
  /** content/raw in small: a pinned en_tn.zip and a tN file for each book given. */
  function rawWith(books: readonly string[], pinned = true): string {
    const raw = mkdtempSync(path.join(tmpdir(), "yada-intros-"));
    mkdirSync(path.join(raw, "uw-tn/en_tn"), { recursive: true });
    writeFileSync(path.join(raw, "uw-tn/en_tn.zip"), "zip bytes");
    const sha = createHash("sha256").update(pinned ? "zip bytes" : "other bytes").digest("hex");
    writeFileSync(path.join(raw, "sources-12oct.sha256"), `${sha}  uw-tn/en_tn.zip\n`);
    for (const book of books) writeFileSync(path.join(raw, `uw-tn/en_tn/tn_${book}.tsv`), book === "RUT" ? about("Ruth is a story.") : tn("# Introduction"));
    return raw;
  }
  const committed = (dir: string, books: string[]) => writeIntros(dir, books.map((book) => ({ book, text: `${book} text.`, ref: "", paragraph: "", status: "approved" as const })));
  const run = (raw: string, fn: (data: string) => void) => {
    const data = mkdtempSync(path.join(tmpdir(), "yada-intros-data-"));
    try {
      fn(data);
    } finally {
      rmSync(raw, { recursive: true, force: true });
      rmSync(data, { recursive: true, force: true });
    }
  };

  it("exits 1 with nothing written when content/raw is not there (a wrong YADA_ROOT)", () => {
    const data = mkdtempSync(path.join(tmpdir(), "yada-intros-data-"));
    try {
      committed(data, ["RUT", "EST"]);
      const before = readFileSync(path.join(data, INTROS_FILE), "utf8");
      expect(introsCommand(["--write"], path.join(data, "no-such-root/content/raw"), data)).toBe(1);
      expect(readFileSync(path.join(data, INTROS_FILE), "utf8")).toBe(before);
    } finally {
      rmSync(data, { recursive: true, force: true });
    }
  });

  it("exits 1 with nothing written when en_tn.zip differs from its pin", () => {
    const raw = rawWith(BOOK_ORDER, false);
    run(raw, (data) => {
      expect(introsCommand(["--write"], raw, data)).toBe(1);
      expect(existsSync(path.join(data, INTROS_FILE))).toBe(false);
    });
  });

  it("exits 1 with nothing written when any book's tN file is missing", () => {
    const raw = rawWith(BOOK_ORDER.filter((b) => b !== "REV"));
    run(raw, (data) => {
      committed(data, ["RUT"]);
      const before = readFileSync(path.join(data, INTROS_FILE), "utf8");
      expect(introsCommand(["--write"], raw, data)).toBe(1);
      expect(readFileSync(path.join(data, INTROS_FILE), "utf8")).toBe(before);
    });
  });

  it("exits 1 with nothing written when the refresh has fewer entries than the committed file", () => {
    const raw = rawWith(BOOK_ORDER);
    run(raw, (data) => {
      committed(data, ["RUT", "EST"]);
      const before = readFileSync(path.join(data, INTROS_FILE), "utf8");
      expect(introsCommand(["--write"], raw, data)).toBe(1);
      expect(readFileSync(path.join(data, INTROS_FILE), "utf8")).toBe(before);
    });
  });

  it("writes when every file is there and nothing is lost", () => {
    const raw = rawWith(BOOK_ORDER);
    run(raw, (data) => {
      committed(data, ["RUT"]);
      // The Tyndale zip is pinned to the real download, so the fixture stands in for its reading.
      expect(introsCommand(["--write"], raw, data, () => new Map())).toBe(0);
      expect(readIntros(data).entries.map((e) => [e.book, e.status])).toEqual([["RUT", "draft"]]);
    });
  });
});

const RAW = understandPaths().raw;
describe.skipIf(!existsSync(path.join(RAW, "uw-tn/en_tn/tn_GEN.tsv")) || !existsSync(path.join(RAW, "tosn-BookIntros.xml")))("against the pinned tN and Tyndale", { timeout: 60_000 }, () => {
  it("every book, Tyndale's where it gives one; the fixes John's rejections asked for (decision 24)", () => {
    const all = new Map(extractIntros(RAW, readIntros(UNDERSTAND_DATA).entries).map((r) => [r.book, r.result.intro]));
    expect([...all.values()].filter((i) => i !== null)).toHaveLength(66);
    for (const i of all.values()) if (i !== null) expect(i.words).toBeLessThanOrEqual(INTRO_WORDS);
    // Genesis had no tN section; Tyndale's opening matches John's brief (creation, sin, Abraham).
    expect(all.get("GEN")?.source).toBe("tyndale");
    expect(all.get("GEN")?.text).toMatch(/^Genesis is the book of beginnings/);
    // 2CH opens on its own book, not 1 Chronicles; 2JN stops before "The first letter of John".
    expect(all.get("2CH")?.text).toMatch(/^Second Chronicles/);
    expect(all.get("2JN")?.text).not.toMatch(/first letter of John/);
    // HAG reaches Haggai; ZEP's Tyndale opening is a quotation, a question and a fragment, so it falls back.
    expect(all.get("HAG")?.text).toMatch(/Haggai pointed out/);
    expect(all.get("ZEP")?.text).toMatch(/^Zephaniah’s prophecy portrays the coming judgment/);
    // No Tyndale text carries a quotation (rule 9: Tyndale quotes the NLT) or a question.
    for (const i of all.values()) if (i?.source === "tyndale") expect(i.text).not.toMatch(/[“”?]/);
  });

  it("matches the committed review file, so John reviews what ships", () => {
    const file = readIntros(UNDERSTAND_DATA).entries;
    for (const { book, result } of extractIntros(RAW, file)) {
      if (result.intro !== null) expect(file.find((e) => e.book === book)?.text).toBe(result.intro.text);
    }
  });
});
