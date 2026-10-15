import { describe, expect, it } from "vitest";

import { tnRows, type BookTables, type TableWord, type VerseKey } from "./sources.js";
import { TEMPLATES, assemble, capped, compareFact, jpsContrast, passagesForWhere, derive, differs, displayName, explained, isMissing, readersDiffer, voice, approvedPositions, type BookData } from "./verse.js";

const word = (bsb: string, opts: Partial<TableWord> = {}): TableWord => ({ orig: "", strong: "", bsb, foot: "", footRaw: "", ...opts });

/** A small 1 Corinthians: two chapters' worth of verses, texts by translation, notes as TSV text. */
function book(opts: { tn?: string[]; verses?: Array<[VerseKey, TableWord[]]>; texts?: Record<string, Record<string, string>>; ust?: Array<[VerseKey, string]> }): BookData {
  const tables: BookTables = { verses: new Map(opts.verses ?? []), headings: [{ chapter: 14, verse: 26, heading: "Orderly Worship", summaryHeading: "Orderly Worship", parallels: "" }], parallels: [], name: "1 Corinthians" };
  const texts = opts.texts ?? {};
  return {
    book: "1CO",
    name: "1 Corinthians",
    ust: new Map(opts.ust ?? []),
    tn: tnRows(["Reference\tID\tTags\tSupportReference\tQuote\tOccurrence\tNote", ...(opts.tn ?? [])].join("\n")),
    tq: [],
    twl: [],
    tw: () => null,
    tables,
    ord: (c, v) => (c === 14 && v === 99 ? null : 46000000 + c * 1000 + v),
    text: (ord, tr = "BSB") => texts[tr]?.[String(ord % 1000)] ?? "",
    speakers: () => [],
    studyNotes: () => [],
    lastChapter: 16,
    chapters: [14, 15, 16],
    debates: [],
    tokens: () => [],
    occurrences: () => [],
    speechRows: () => [],
    keyRefs: () => [],
    pericopes: [],
    verseList: [[14, 26], [14, 33], [14, 34], [14, 35], [14, 40]],
  };
}

const tn = (ref: string, note: string, support = "rc://*/ta/man/translate/figs-explicit", quote = ""): string => [ref, "x1y2", "", support, quote, "1", note].join("\t");

describe("readers differ", () => {
  it("sets the readings in a fixed sentence, named by the note's own word when the verse uses it", () => {
    const data = book({
      texts: { BSB: { "34": "women are to be silent in the churches." } },
      tn: [
        tn(
          "14:34",
          "Here, **women** could refer to: (1) married women, in which case Paul is speaking about wives. Alternate translation: “wives” (2) women in general. Alternate translation: “women” (See: [Generic](rc://en/ta/man/translate/figs-genericnoun))",
        ),
      ],
    });
    const [rd] = readersDiffer(data, 14, 34);
    expect(rd?.about).toBe("women");
    // Verse 34, first reading: wording (34 + 0) % 3 = 1.
    // Capitalised after the opening quote mark.
    expect(rd?.sentence).toBe("“Women” can mean married women, in which case Paul is speaking about wives, or women in general.");
    expect(rd?.full_note).toBe(false);
  });

  it("caps each reading at its first sentence and 18 words, and says when the full note has more", () => {
    const long = "a reading that goes on and on, with many words in it, far past the cap that the first screen allows for";
    expect(capped(long)).toEqual(["a reading that goes on and on, with many words in it…", true]);
    expect(capped("short. Then more.")).toEqual(["short", true]);
    expect(capped("short")).toEqual(["short", false]);
    const data = book({
      texts: { BSB: { "34": "They are to be silent." } },
      tn: [tn("14:34", "This could mean: (1) one (2) two (3) three (4) four")],
    });
    const [rd] = readersDiffer(data, 14, 34);
    expect(rd?.about).toBe("this");
    // "this" unquoted, and the sentence capitalised.
    expect(rd?.sentence).toBe("This can mean one, two, or three.");
    expect(rd?.full_note).toBe(true);
  });

  it("turns the wording with the verse and with each reading in it, so neighbours differ and a rerun repeats", () => {
    const note = "Here, **women** could mean: (1) wives (2) women";
    const data = book({ texts: { BSB: { "33": "women", "34": "women" } }, tn: [tn("14:33", note), tn("14:33", note), tn("14:34", note)] });
    expect(readersDiffer(data, 14, 33).map((r) => r.sentence)).toEqual([TEMPLATES.read2[0], TEMPLATES.read2[1]].map((t) => t.replace("{about}", "women").replace("{a}", "wives").replace("{b}", "women")).map((t) => (t.startsWith("“") ? `“${t[1]?.toUpperCase()}${t.slice(2)}` : t)));
    expect(readersDiffer(data, 14, 34)[0]?.sentence).toBe("“Women” can mean wives, or women.");
  });

  it("drops a reading addressed to a translator", () => {
    const data = book({
      texts: { BSB: { "34": "women are silent." } },
      tn: [tn("14:34", "Here, **women** could mean: (1) wives (2) women (3) If it would be helpful in your language, translate this plainly")],
    });
    expect(readersDiffer(data, 14, 34)[0]?.options).toEqual(["wives", "women"]);
  });
});

describe("explained", () => {
  it("removes every sentence addressed to a translator and skips grammar-only notes", () => {
    const data = book({
      tn: [
        tn("14:33", "Paul is speaking of the way God brings peace to every gathering of believers. If it would be helpful in your language, you could say this plainly."),
        tn("14:33", "Paul uses the passive form here to keep the focus on what happens to them.", "rc://*/ta/man/translate/figs-activepassive"),
      ],
    });
    expect(explained(data, 14, 33)).toEqual([{ text: "Paul is speaking of the way God brings peace to every gathering of believers.", id: "x1y2" }]);
  });
});

describe("translation differences", () => {
  it("are one or two words a side; anything that spills into neighbouring words is dropped", () => {
    const data = book({
      texts: {
        BSB: { "34": "women are to be silent in the churches." },
        WEB: { "34": "let the wives be quiet in the assemblies for it has not been allowed." },
        KJV: { "34": "Let your women keep silence in the churches." },
        LSV: { "34": "let your women be silent in the assemblies." },
      },
    });
    const facts = differs(data, 46014034);
    expect(facts.length).toBeGreaterThan(0);
    for (const f of facts) expect(f.split("“")[1]?.split("”")[0]?.split(" ").length).toBeLessThanOrEqual(2);
    // The WEB's "assemblies for it has not been allowed" runs past two words, so only the LSV's counts.
    expect(facts).toEqual(["Translations differ: “churches” (BSB) · “assemblies” (LSV).", "Translations differ: “silent” (BSB) · “quiet” (WEB)."]);
  });
});

describe("manuscript footnotes", () => {
  const verses: Array<[VerseKey, TableWord[]]> = [
    ["14:33", [word("peace")]],
    ["14:34", [word("women")]],
    ["14:35", [word("church", { foot: "Some manuscripts place verses 34–35 after verse 40." })]],
    ["14:40", [word("order")]],
    ["15:1", [word("gospel")]],
    ["15:2", [word("saved", { foot: "BYZ and TR include 3But this is a later reading." })]],
    ["16:1", [word("collection", { foot: "The earliest manuscripts do not include 16:2 through 1 Corinthians 16:3." })]],
    ["16:2", [word("week")]],
    ["16:3", [word("letters")]],
    ["16:4", [word("me")]],
  ];
  const data = book({ verses, texts: { BSB: { "33": "peace", "34": "women", "35": "church", "40": "order", "1": "gospel", "2": "saved", "4": "me" } } });
  const derived = derive(data);

  it("attach to every verse they name: 'verses 34–35', never 'after verse 40'", () => {
    expect(derived.msNotes.get("14:34")).toEqual(["Some manuscripts place verses 34–35 after verse 40."]);
    expect(derived.msNotes.get("14:35")).toEqual(["Some manuscripts place verses 34–35 after verse 40."]);
    expect(derived.msNotes.has("14:40")).toBe(false);
    expect(derived.msNotes.has("14:33")).toBe(false);
  });

  it("attach to a range named with 'through', across the book's own verses", () => {
    for (const v of ["16:1", "16:2", "16:3"] as const) expect(derived.msNotes.get(v)).toHaveLength(1);
    expect(derived.msNotes.has("16:4")).toBe(false);
  });

  it("attach to a verse the BSB omits when the note glues its number to its first word ('include 3But')", () => {
    expect(derived.msNotes.get("15:3")).toEqual(["BYZ and TR include 3But this is a later reading."]);
    const missing = assemble(data, derived, 15, 3);
    if (!isMissing(missing)) throw new Error("15:3 should be missing");
    // Shown with the number set apart and the abbreviations in plain words.
    // TR is Greek editions printed in the 1500s and 1600s, not manuscripts (audit, 12 Oct 2026).
    expect(missing.manuscripts).toEqual(["Later manuscripts and Greek editions printed in the 1500s and 1600s include (3) But this is a later reading."]);
  });

  it("name the BSB section a verse sits in", () => {
    const r = assemble(data, derived, 14, 34);
    expect(!isMissing(r) && r.where.section).toBe("Orderly Worship");
  });
});

describe("whose words", () => {
  const speaking = (book: string, names: string[], kind = "character", quotePosition: string | null = "EntireVerse", ust = ""): BookData => ({
    ...bookFor(),
    book,
    speakers: () => names,
    speechRows: () => names.map((name) => ({ name, kind, quotePosition })),
    ust: new Map([["11:3", ust], ["4:1", ust]]),
  });
  const bookFor = (): BookData => book({});

  it("names one Glyssen speaker, reads Yahweh as God, and puts a group in the plural", () => {
    expect(voice(speaking("LEV", ["Yahweh"]), 11, 3, 1)).toBe("God says:");
    expect(voice(speaking("ACT", ["priests"]), 4, 1, 1)).toBe("Priests say:");
    expect(voice(speaking("ACT", ["Cornelius"]), 10, 30, 1)).toBe("Cornelius says:");
    expect(displayName("angels in white, two")).toBe("two angels in white");
    expect(displayName("voice of one calling (preparing way for Christ)")).toBe("voice of one calling");
  });

  it("frames only one named speaker whose speech is the whole verse and unquoted in the UST (Acts 16:15, John 1:21, 3:3)", () => {
    expect(voice(speaking("JHN", ["John the Baptist", "priests"]), 11, 3, 1)).toBeNull();
    expect(voice(speaking("JHN", ["priests/Levites"], "multiple"), 11, 3, 1)).toBeNull();
    expect(voice(speaking("ACT", ["Lydia"], "character", "Start"), 11, 3, 1)).toBeNull();
    expect(voice(speaking("JHN", ["Jesus"], "character", "EntireVerse", "Jesus said, “I tell you the truth.”"), 11, 3, 1)).toBeNull();
  });

  it("drops an Old Testament Jesus, Christ or Messiah speaker, and gives letters their writer", () => {
    expect(voice(speaking("ISA", ["Jesus"]), 61, 1, 1)).toBeNull();
    expect(voice(speaking("ROM", []), 1, 7, 1)).toBe("Paul tells them:");
    expect(voice(speaking("HEB", []), 1, 1, 1)).toBe("The writer tells them:");
    expect(voice(speaking("ROM", ["Paul", "Tertius"]), 16, 22, 1)).toBe("Paul tells them:");
    expect(voice(speaking("REV", []), 1, 9, 1)).toBe("In John’s vision:");
    expect(voice(speaking("REV", []), 1, 8, 1)).toBeNull();
    expect(voice(speaking("ECC", []), 1, 2, 1)).toBe("The Teacher says:");
  });
});

describe("major debates on a verse", () => {
  const note = "Here, **women** could mean: (1) wives (2) women";
  const base = { texts: { BSB: { "34": "women are silent." } }, tn: [tn("14:34", note)], ust: [["14:34", "Wives should be quiet."]] as Array<[VerseKey, string]> };
  const debate = { book: "1CO", from: [14, 34] as [number, number], to: [14, 35] as [number, number], question: "Q", note: null, status: "candidate", kind: "tn-readings" as const };

  it("tn-readings: keep tN's readings first and the plain line as one way to read it until a note is approved", () => {
    const data = { ...book(base), debates: [debate] };
    const r = assemble(data, derive(data), 14, 34);
    if (isMissing(r)) throw new Error("not missing");
    // The debate's question is for John's list only: the verse layer carries its kind alone.
    expect([r.beginner.order, r.beginner.plain?.label, r.beginner.debate]).toEqual([["readers_differ", "plain"], "One way to read it", { kind: "tn-readings" }]);
  });

  it("tn-readings without verse readings fall back to the chapter introduction's two readings (Revelation 20)", () => {
    const intro = "# Chapter 14\\n\\nSome scholars believe that this refers to a future period of time, while others believe that it refers to Jesus reigning now from heaven. More.";
    const data = { ...book({ ...base, tn: [tn("14:intro", intro)] }), debates: [debate] };
    const r = assemble(data, derive(data), 14, 34);
    if (isMissing(r)) throw new Error("not missing");
    expect(r.beginner.readers_differ[0]?.sentence).toBe("Some readers believe this refers to a future period of time; others believe it refers to Jesus reigning now from heaven.");
    expect(r.beginner.plain?.label).toBe("One way to read it");
  });

  it("positions and held kinds show nothing until approved: no readings, no plain line (Genesis 1:2, Leviticus 18:22)", () => {
    for (const kind of ["positions", "held"] as const) {
      const data = { ...book(base), debates: [{ ...debate, kind }] };
      const r = assemble(data, derive(data), 14, 34);
      if (isMissing(r)) throw new Error("not missing");
      expect([r.beginner.plain, r.beginner.readers_differ], kind).toEqual([null, []]);
    }
  });

  it("a data entry with a manuscripts fact keeps its plain line (Mark 16:9)", () => {
    const verses: Array<[VerseKey, TableWord[]]> = [["14:34", [word("women", { foot: "Some manuscripts place verses 34–35 after verse 40." })]]];
    const data = { ...book({ ...base, verses }), debates: [{ ...debate, kind: "data" as const }] };
    const r = assemble(data, derive(data), 14, 34);
    if (isMissing(r)) throw new Error("not missing");
    expect(r.beginner.plain).not.toBeNull();
    expect(r.beginner.manuscripts.length).toBe(1);
    expect(r.beginner.readers_differ).toEqual([]);
  });

  it("hide the plain line only when there are no readings (Isaiah 7:14)", () => {
    const data = { ...book({ ...base, tn: [] }), debates: [debate] };
    const r = assemble(data, derive(data), 14, 34);
    if (isMissing(r)) throw new Error("not missing");
    expect([r.beginner.plain, r.beginner.readers_differ]).toEqual([null, []]);
  });

  it("show approved positions as their sources' sentences, unchanged and credited to the source alone (40bceef)", () => {
    const positions = [
      { text: "Source sentence one, unchanged.", source: "Keil and Delitzsch", status: "approved", held_by: "many readers", side: "first view" },
      { text: "Source sentence two, unchanged.", source: "Tyndale Open Study Notes", status: "approved", side: "second view" },
      { text: "A rejected sentence.", source: "Ellicott", status: "rejected" },
    ];
    const data = { ...book(base), debates: [{ ...debate, kind: "positions" as const, positions }] };
    const r = assemble(data, derive(data), 14, 34);
    if (isMissing(r)) throw new Error("not missing");
    expect(r.beginner.readers_differ).toEqual([
      { about: null, sentence: "Source sentence one, unchanged.", options: [], full_note: false, source: "position", credit: "Keil and Delitzsch", held_by: "many readers" },
      { about: null, sentence: "Source sentence two, unchanged.", options: [], full_note: false, source: "position", credit: "Tyndale Open Study Notes" },
    ]);
    expect(JSON.stringify(r.beginner.readers_differ)).not.toContain("John");
    expect([r.beginner.order, r.beginner.plain?.label]).toEqual([["readers_differ", "plain"], "One way to read it"]);
    // One approved position is not enough; nothing shows from the positions then.
    expect(approvedPositions({ ...debate, positions: positions.slice(1) })).toEqual([]);
  });

  it("keep every reading once positions are approved: no cap of two", () => {
    const positions = ["One.", "Two.", "Three."].map((text) => ({ text, source: "S", status: "approved", side: text }));
    const data = { ...book({ ...base, tn: [] }), debates: [{ ...debate, kind: "positions" as const, positions }] };
    const r = assemble(data, derive(data), 14, 34);
    if (isMissing(r)) throw new Error("not missing");
    expect(r.beginner.readers_differ.map((x) => x.sentence)).toEqual(["One.", "Two.", "Three."]);
  });

  describe("two approved sentences are not two positions (John, 15 Oct 2026)", () => {
    const pos = (text: string, side?: string | null, extra: Record<string, string> = {}) => ({
      text,
      source: "Tyndale Open Study Notes",
      status: "approved" as const,
      ...(side === undefined ? {} : { side }),
      ...extra,
    });
    const shown = (positions: ReturnType<typeof pos>[]) => {
      const data = { ...book({ ...base, tn: [] }), debates: [{ ...debate, kind: "tn-readings" as const, positions }] };
      const r = assemble(data, derive(data), 14, 34);
      if (isMissing(r)) throw new Error("not missing");
      return r.beginner.readers_differ.filter((x) => x.source === "position").map((x) => x.sentence);
    };

    it("two sentences on one side do not show (1 Corinthians 11:2–16)", () => {
      const sameSide = [pos("Head means authority here.", "authority"), pos("Women should wear a veil.", " Authority ")];
      expect(approvedPositions({ ...debate, positions: sameSide })).toEqual([]);
      expect(shown(sameSide)).toEqual([]);
    });

    it("two distinct sides show, and a third on either side shows with them", () => {
      const two = [pos("Fallen angels.", "heavenly beings"), pos("Tyrannical kings.", "royal"), pos("Also angels.", "heavenly beings")];
      expect(shown(two)).toEqual(["Fallen angels.", "Tyrannical kings.", "Also angels."]);
    });

    it("an untagged approved position counts toward no side and does not show", () => {
      expect(shown([pos("Tagged.", "royal"), pos("Untagged.")])).toEqual([]);
      expect(shown([pos("Untagged one."), pos("Untagged two.")])).toEqual([]);
      expect(shown([pos("Blank side.", "  "), pos("Tagged.", "royal")])).toEqual([]);
      expect(shown([pos("A.", "royal"), pos("B.", "Sethite"), pos("Untagged.")])).toEqual(["A.", "B."]);
    });

    it("a suggested side counts for nothing until John accepts it (rule 2)", () => {
      const suggested = [pos("Fallen angels.", null, { side_suggested: "heavenly beings" }), pos("Kings.", "royal")];
      expect(shown(suggested)).toEqual([]);
      const accepted = [pos("Fallen angels.", "heavenly beings"), pos("Kings.", "royal")];
      expect(shown(accepted)).toEqual(["Fallen angels.", "Kings."]);
    });

    it("a framing side never makes a passage show, but shows inside one that does (Jeremiah 31:31–34)", () => {
      expect(shown([pos("One view.", "all Israel"), pos("Background.", "context")])).toEqual([]);
      expect(shown([pos("Lists both.", "lists both readings"), pos("Background.", " Context ")])).toEqual([]);
      expect(shown([pos("One view.", "authority"), pos("Lists the views.", "  LISTS   the views ")])).toEqual([]);
      const two = [pos("Lists both.", "lists both readings"), pos("Authority.", "authority"), pos("Source.", "source"), pos("Background.", "context")];
      expect(shown(two)).toEqual(["Lists both.", "Authority.", "Source.", "Background."]);
    });

    it("two sides must answer one question: one axis holds both (Hosea 1:2)", () => {
      const ax = (text: string, side: string, axis?: string, extra: Record<string, string> = {}) => pos(text, side, { ...(axis === undefined ? {} : { axis }), ...extra });
      // One side on each of two questions is not two positions.
      expect(shown([ax("Allegory.", "allegory", "real or allegory"), ax("Prostitute.", "prostitute", "what Gomer was")])).toEqual([]);
      // Two sides on one question show, with the other question's answer alongside; axes match like sides.
      const hosea = [ax("Allegory.", "allegory", "Real or allegory"), ax("Real.", "real marriage", " real  or allegory"), ax("Prostitute.", "prostitute", "what Gomer was")];
      expect(shown(hosea)).toEqual(["Allegory.", "Real.", "Prostitute."]);
      // No axis is one shared default axis, today's rule; a blank axis is the default too.
      expect(shown([ax("Allegory.", "allegory"), ax("Prostitute.", "prostitute", " ")])).toEqual(["Allegory.", "Prostitute."]);
      // A suggested axis counts for nothing until John accepts it (rule 2).
      expect(shown([ax("Allegory.", "allegory", undefined, { axis_suggested: "real or allegory" }), ax("Prostitute.", "prostitute", undefined, { axis_suggested: "what Gomer was" })])).toEqual([
        "Allegory.",
        "Prostitute.",
      ]);
    });

    it("a tilde between numbers shows as an en dash; the stored sentence stays verbatim (Ezekiel 38)", () => {
      const stored = "Gyges, king of Lydia (about 680~644 BC), and a ~ alone.";
      const positions = [pos(stored, "Gyges"), pos("Another.", "Cambyses")];
      expect(shown(positions)).toEqual(["Gyges, king of Lydia (about 680–644 BC), and a ~ alone.", "Another."]);
      expect(positions[0]?.text).toBe(stored);
    });
  });
});

describe("the comparison fact", () => {
  const base = (): BookData => ({
    ...book({ verses: [["3:16", [word("the world", { orig: "κόσμον" })]]], texts: { BSB: { "16": "For God so loved the world" } } }),
    book: "JHN",
    name: "John",
    ord: () => 43003016,
  });
  const token = (lemma: string, morph: string, surface: string) => ({ key: lemma, lemma, morph, surface });

  it("names the word this book uses most, without its article, from the BSB rendering", () => {
    const data = { ...base(), tokens: () => [token("κόσμος", "N- ----ASM-", "κόσμον")], occurrences: () => [{ book: "JHN", count: 78 }, { book: "1JN", count: 23 }, { book: "1CO", count: 21 }] };
    expect(compareFact(data, 3, 16)).toBe("John uses the word for “world” more than any other book: 78 of its 122 uses in the Bible.");
  });

  it("says nothing for a name, a tie at the top, under 10 uses, fewer than 3 books, or another book on top", () => {
    const rows = [{ book: "JHN", count: 78 }, { book: "1JN", count: 23 }, { book: "1CO", count: 21 }];
    const with_ = (t: ReturnType<typeof token>, occ: Array<{ book: string; count: number }>): BookData => ({ ...base(), tokens: () => [t], occurrences: () => occ });
    expect(compareFact(with_(token("Ἰησοῦς", "N- ----NSM-", "Ἰησοῦς"), rows), 3, 16)).toBeNull();
    expect(compareFact(with_(token("κόσμος", "N- ----ASM-", "κόσμον"), [{ book: "JHN", count: 23 }, { book: "1JN", count: 23 }, { book: "1CO", count: 1 }]), 3, 16)).toBeNull();
    expect(compareFact(with_(token("κόσμος", "N- ----ASM-", "κόσμον"), [{ book: "JHN", count: 9 }, { book: "1JN", count: 2 }, { book: "1CO", count: 1 }]), 3, 16)).toBeNull();
    expect(compareFact(with_(token("κόσμος", "N- ----ASM-", "κόσμον"), rows.slice(0, 2)), 3, 16)).toBeNull();
    expect(compareFact(with_(token("κόσμος", "N- ----ASM-", "κόσμον"), [rows[1], rows[0], rows[2]] as typeof rows), 3, 16)).toBeNull();
    expect(compareFact(with_(token("γάρ", "C- --------", "γὰρ"), rows), 3, 16)).toBeNull();
  });
});

describe("readings", () => {
  it("drop the trailing 'or' tN leaves on a reading, so the template's 'or' is not doubled (Genesis 1:2)", () => {
    const data = book({ texts: { BSB: { "34": "women are silent." } }, tn: [tn("14:34", "Here, **women** could mean: (1) “wives” or (2) “women”")] });
    const [rd] = readersDiffer(data, 14, 34);
    expect(rd?.options).toEqual(["“wives”", "“women”"]);
    expect(rd?.sentence).not.toMatch(/ or; or | or, or /);
  });

  it("cut a translator's figure-of-speech label and any 'many languages' advice", () => {
    const data = book({
      texts: { BSB: { "34": "women are silent." } },
      tn: [tn("14:34", "Here, **women** could mean: (1) wives, in which case “women” is a euphemism for married women (2) women in general; many languages would say this differently")],
    });
    expect(readersDiffer(data, 14, 34)[0]?.options).toEqual(["wives", "women in general"]);
  });
});

describe("JPS 1917 on a disputed verse", () => {
  const debate = { book: "ISA", from: [7, 14] as [number, number], to: [7, 14] as [number, number], question: "Q", note: null, status: "candidate", kind: "data" as const };
  const isa = (texts: Record<string, Record<string, string>>, debates = [debate]): BookData => ({
    ...book({ texts, ust: [["7:14", "A young woman will have a son."]] }),
    book: "ISA",
    name: "Isaiah",
    debates,
  });
  const bsb = "Therefore the Lord Himself will give you a sign: Behold, the virgin will be with child and will give birth to a son, and will call Him Immanuel.";
  const jps = "Therefore the Lord Himself shall give you a sign: behold, the young woman shall conceive, and bear a son, and shall call his name Immanuel.";

  it("leads Readers differ with the whole JPS verse, with no plain line beside it (a data entry disputes meaning)", () => {
    const data = isa({ BSB: { "14": bsb }, JPS: { "14": jps } });
    const r = assemble(data, derive(data), 7, 14);
    if (isMissing(r)) throw new Error("not missing");
    expect(r.beginner.readers_differ[0]).toEqual({ about: null, sentence: `A Jewish translation, the JPS 1917, reads: “${jps}”`, options: [], full_note: false, source: "jps", credit: "JPS 1917, public domain" });
    expect([r.beginner.order, r.beginner.plain]).toEqual([["readers_differ", "plain"], null]);
    expect(jpsContrast(data, 7014)[0]).toEqual(["the virgin will be with child", "the young woman shall conceive"]);
  });

  it("is absent without the JPS bundle or off a debate verse", () => {
    const without = isa({ BSB: { "14": bsb } });
    const r = assemble(without, derive(without), 7, 14);
    if (isMissing(r)) throw new Error("not missing");
    expect([r.beginner.plain, r.beginner.readers_differ]).toEqual([null, []]);
    const ordinary = isa({ BSB: { "14": bsb }, JPS: { "14": jps } }, []);
    const o = assemble(ordinary, derive(ordinary), 7, 14);
    if (isMissing(o)) throw new Error("not missing");
    expect(o.beginner.readers_differ).toEqual([]);
  });
});

describe("where a verse sits (option A)", () => {
  const sec = (title: string, start: [number, number], end: [number, number]) => ({ title, start, end, parallels: "" });

  it("uses the book's own passages when it has one per chapter", () => {
    const data = { ...book({}), lastChapter: 1, pericopes: [{ label: "The Word became flesh", start: [1, 1] as [number, number], end: [1, 18] as [number, number] }] };
    expect(passagesForWhere(data, [sec("Other", [1, 1], [1, 999])]).map((p) => p.title)).toEqual(["The Word became flesh"]);
  });

  it("else the BSB sections, one under 3 verses joining the next and the last joining the one before", () => {
    const verseList: Array<[number, number]> = [1, 2, 3, 4, 5, 6, 7, 8].map((v) => [1, v]);
    const data = { ...book({}), lastChapter: 1, verseList };
    const secs = [sec("A", [1, 1], [1, 2]), sec("B", [1, 3], [1, 6]), sec("C", [1, 7], [1, 999])];
    expect(passagesForWhere(data, secs).map((p) => [p.title, p.start, p.end])).toEqual([["A", [1, 1], [1, 999]]]);
    expect(passagesForWhere({ ...data, book: "PSA" }, secs)).toHaveLength(3);
  });
});
