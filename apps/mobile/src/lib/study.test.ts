import { verseOrd } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { compareLine, originalLine, passageLine, studyNotesLine } from "./goFurther";
import {
  covers,
  namedInVerse,
  failedLine,
  fetchingLine,
  guideNote,
  isBookQuery,
  leadingLemma,
  matchNames,
  mergeSeeAlso,
  needsMore,
  noteReferences,
  notesForVerse,
  onRangeLine,
  parseFurtherStudy,
  parseNoteMarkup,
  parseStudyCatalogue,
  peopleInVerse,
  plainNote,
  profileBody,
  profileCites,
  profileMatches,
  profilePronoun,
  rangeTitle,
  rankXrefs,
  readAboutLabel,
  spokenRange,
  stripLeadReference,
  stripOwnReference,
  sweepStudy,
  TYNDALE_LINE,
  TYNDALE_SHORT,
  whoLine,
} from "./study";

// Note text below is copied from Tyndale Open Study Notes (CC BY-SA 4.0, Tyndale House
// Publishers), as packaged in study-jhn.v1.db, so the parser is tested on the real markup.
const JOHN_1_1 =
  "<b>1:1</b> Echoing Gen 1:1, John’s Gospel introduces Jesus Christ, through whom God created everything (John 1:3). The Gospel opens with its central affirmation, that Jesus Christ, <x>the Word</x> (Greek <i>logos</i>), not only revealed God but <x>was God</x><i>.</i>";
const JOHN_1_5 =
  "<b>1:5</b> <x>the darkness can never extinguish it:</x> Or <i>the darkness has not understood it;</i> literally <i>the darkness cannot grasp it.</i>";
const JOHN_1_4 =
  "<b>1:4</b> <x>The Word gave life:</x> Life was God’s original gift to his creatures (Gen 1:20-28; 2:7). • As one of his first creative acts, God <x>brought light</x> (Gen 1:3).";
const NICODEMUS =
  "<h>Nicodemus</h>\nNicodemus was a highly respected Jewish Pharisee (John 3:1). He is mentioned only in the Gospel of John. He went to see him secretly, at night. After Jesus was crucified, he bought seventy-five pounds of ointment for his burial.\n<h>Passages for Further Study</h>\nJohn 3:1-9; 7:50; 19:39-42";

const john = (c: number, v: number) => verseOrd("JHN", c, v);

describe("note markup", () => {
  it("keeps quoted words, italics, bold and small caps as styled runs, and drops the verse's own lead", () => {
    const [p] = parseNoteMarkup(stripOwnReference(JOHN_1_1, 1, 1));
    expect(p?.segments[0]?.text.startsWith("Echoing Gen 1:1")).toBe(true);
    expect(p?.segments.filter((s) => s.quoted).map((s) => s.text)).toEqual(["the Word", "was God"]);
    expect(p?.segments.find((s) => s.text === "logos")).toMatchObject({ italic: true, quoted: false });
    const [sc] = parseNoteMarkup("the <sc>Lord</sc> in 90 <sc>AD</sc> &amp; after");
    expect(sc?.segments.filter((s) => s.smallCaps).map((s) => s.text)).toEqual(["Lord", "AD"]);
    expect(plainNote(parseNoteMarkup("a &lt;b&gt; &amp; c"))).toBe("a <b> & c");
  });

  it("keeps a lead that is not exactly the verse: a passage, or half a verse", () => {
    expect(stripOwnReference("<b>1:1-18</b> The beginning", 1, 1)).toBe("<b>1:1-18</b> The beginning");
    expect(stripOwnReference("<b>4:1b</b> Then", 4, 1)).toBe("<b>4:1b</b> Then");
    expect(stripOwnReference("<b>1:2</b> x", 1, 1)).toBe("<b>1:2</b> x");
    expect(stripLeadReference("<b>1:1-18</b> The beginning")).toBe("The beginning");
    expect(stripLeadReference("<b>Pss 1–2</b> The first")).toBe("The first");
  });

  it("splits Tyndale's • points into paragraphs and marks headings", () => {
    const paragraphs = parseNoteMarkup(stripOwnReference(JOHN_1_4, 1, 4));
    expect(paragraphs.map((p) => plainNote([p]))).toEqual([
      "The Word gave life: Life was God’s original gift to his creatures (Gen 1:20-28; 2:7).",
      "As one of his first creative acts, God brought light (Gen 1:3).",
    ]);
    expect(parseNoteMarkup("<h>Setting</h>\nText")[0]?.heading).toBe(true);
  });

  it("names a note's opening quotation as the NLT's", () => {
    const [p] = parseNoteMarkup(stripOwnReference(JOHN_1_5, 1, 5));
    const lemma = p === undefined ? null : leadingLemma(p);
    expect(lemma?.lemma).toBe("the darkness can never extinguish it");
    expect(lemma?.rest[0]?.text).toBe("Or ");
    const [plain] = parseNoteMarkup("Echoing Gen 1:1");
    expect(plain === undefined ? undefined : leadingLemma(plain)).toBeNull();
    // `<x>2:5</x>`'s form with a leading space and the colon outside the quoted words.
    const [outside] = parseNoteMarkup("<x> cultivate</x>: Work does not result from sin");
    expect(outside === undefined ? null : leadingLemma(outside)?.lemma).toBe("cultivate");
  });

  it("asks for Read the whole note on a second paragraph or a long first one", () => {
    expect(needsMore(parseNoteMarkup("one\ntwo"), 330, 16)).toBe(true);
    expect(needsMore(parseNoteMarkup("short"), 330, 16)).toBe(false);
    expect(needsMore(parseNoteMarkup("word ".repeat(80)), 330, 16)).toBe(true);
  });
});

describe("which notes a verse shows", () => {
  const rows = [
    { id: 1, ord_start: john(1, 1), ord_end: john(21, 25), kind: "intro", text: "" },
    { id: 2, ord_start: john(1, 1), ord_end: john(1, 18), kind: "note", text: "" },
    { id: 3, ord_start: john(1, 1), ord_end: john(1, 1), kind: "note", text: "" },
    { id: 4, ord_start: john(1, 4), ord_end: john(1, 5), kind: "note", text: "" },
    { id: 5, ord_start: john(1, 6), ord_end: john(1, 37), kind: "profile", text: "" },
  ];

  it("includes both ends of a range, the verse's own note first, then the passages around it", () => {
    expect(covers(rows[1] ?? rows[0]!, john(1, 18))).toBe(true);
    expect(covers(rows[1] ?? rows[0]!, john(1, 19))).toBe(false);
    expect(notesForVerse(rows, john(1, 1)).map((r) => r.id)).toEqual([3, 2]);
    expect(notesForVerse(rows, john(1, 5)).map((r) => r.id)).toEqual([4, 2]);
    expect(notesForVerse(rows, john(1, 19))).toEqual([]);
    expect(onRangeLine({ ord_start: john(1, 1), ord_end: john(1, 18) })).toBe("On 1:1–18");
    expect(onRangeLine({ ord_start: john(12, 44), ord_end: john(13, 3) })).toBe("On 12:44–13:3");
  });

  it("turns a note's pointers to other notes into references, in its own book unless it names one", () => {
    const text =
      "<b>1:3</b> God spoke (see study note on 1:2) and then <x>blessed</x>: See study note on 1:22; see also 17:16. See 2:15 and study note there; (see Gen 7:11-12 and study note); study notes on Exod 3:14.";
    expect(noteReferences(text, "GEN")).toEqual([
      { book: "GEN", start: verseOrd("GEN", 1, 2), end: verseOrd("GEN", 1, 2) },
      { book: "GEN", start: verseOrd("GEN", 1, 22), end: verseOrd("GEN", 1, 22) },
      { book: "GEN", start: verseOrd("GEN", 2, 15), end: verseOrd("GEN", 2, 15) },
      { book: "GEN", start: verseOrd("GEN", 7, 11), end: verseOrd("GEN", 7, 12) },
      { book: "EXO", start: verseOrd("EXO", 3, 14), end: verseOrd("EXO", 3, 14) },
    ]);
    expect(noteReferences("No pointers here, 3:16.", "JHN")).toEqual([]);
  });
});

describe("people", () => {
  const anchor = (c: number, v: number, c2: number, v2: number) => ({ ord_start: john(c, v), ord_end: john(c2, v2) });
  const profiles = [
    { id: 1, kind: "profile", title: "Nicodemus", text: NICODEMUS, ...anchor(3, 1, 3, 9) },
    { id: 2, kind: "profile", title: "Adam and Eve", text: "", ord_start: verseOrd("GEN", 2, 7), ord_end: verseOrd("GEN", 4, 2) },
    { id: 3, kind: "theme", title: "The Word", text: "", ...anchor(1, 1, 1, 18) },
    { id: 4, kind: "profile", title: "John the Baptist", text: "<h>John the Baptist</h>\nA preacher.\n<h>Passages for Further Study</h>\nJohn 1:6-37; 3:23-36", ...anchor(1, 6, 1, 37) },
    { id: 5, kind: "profile", title: "The Samaritans", text: "<h>The Samaritans</h>\nA people.", ...anchor(4, 1, 4, 42) },
  ];

  it("names a person only where the name is in the verse and the profile itself cites the verse", () => {
    expect(peopleInVerse(profiles, "Now there was a man of the Pharisees named Nicodemus, a leader", "JHN", john(3, 1)).map((p) => p.id)).toEqual([1]);
    // Named in 7:50 and 19:39, which the profile's passage list cites; never on a verse it does not.
    expect(peopleInVerse(profiles, "Nicodemus, who had gone to Jesus earlier", "JHN", john(7, 50)).map((p) => p.id)).toEqual([1]);
    expect(peopleInVerse(profiles, "Nicodemus said", "JHN", john(8, 1))).toEqual([]);
    expect(peopleInVerse(profiles, "Nicodemuses", "JHN", john(3, 1))).toEqual([]);
    expect(peopleInVerse(profiles, "And Adam named his wife Eve", "GEN", verseOrd("GEN", 3, 20)).map((p) => p.id)).toEqual([2]);
    expect(peopleInVerse(profiles, "In the beginning was the Word", "JHN", john(1, 1))).toEqual([]);
    // "John the Baptist" is never matched by "John" alone.
    expect(peopleInVerse(profiles, "His name was John.", "JHN", john(1, 6))).toEqual([]);
    // A people matches its singular: "a Samaritan woman".
    expect(peopleInVerse(profiles, "a Samaritan woman came to draw water", "JHN", john(4, 7)).map((p) => p.id)).toEqual([5]);
    expect(matchNames("The Samaritans")).toEqual(["Samaritans", "Samaritan"]);
    expect(matchNames("Nicodemus")).toEqual(["Nicodemus"]);
    expect(profileCites(profiles[3]!, "JHN", john(3, 30))).toBe(true);
    expect(isBookQuery("John")).toBe(true);
    expect(isBookQuery("Nicodemus")).toBe(false);
    expect(profileMatches("Nicodemus", "nico")).toBe(true);
    expect(profileMatches("John the Baptist", "apt")).toBe(false);
    expect(profileMatches("John the Baptist", "Baptist")).toBe(true);
  });

  it("says him or her only where the profile's own pronouns make it plain", () => {
    expect(profilePronoun("Nicodemus", NICODEMUS)).toBe("him");
    expect(whoLine("Nicodemus", NICODEMUS)).toBe("Who he was");
    expect(readAboutLabel("Nicodemus", NICODEMUS)).toBe("Read about him");
    expect(profilePronoun("Adam and Eve", "")).toBe("them");
    expect(profilePronoun("The Samaritans", "")).toBe("them");
    expect(profilePronoun("Lydia", "She sold purple cloth; her household and she were baptized. She urged them.")).toBe("her");
    expect(whoLine("Someone", "A name in a list.")).toBeNull();
    expect(readAboutLabel("Someone", "A name in a list.")).toBe("Passages");
  });

  it("keeps the profile's paragraphs and reads its study passages, carrying book and chapter", () => {
    const body = profileBody(NICODEMUS, "Nicodemus");
    expect(body.paragraphs[0]?.heading).toBe(false);
    expect(body.further).toBe("John 3:1-9; 7:50; 19:39-42");
    expect(parseFurtherStudy(body.further ?? "", "JHN")).toEqual([
      { start: john(3, 1), end: john(3, 9) },
      { start: john(7, 50), end: john(7, 50) },
      { start: john(19, 39), end: john(19, 42) },
    ]);
    const mixed = parseFurtherStudy("Gen 1:3-28; Ps 33:6, 9; Prov 8:22-31; 1 Jn 1:1; Rev 19:13", "JHN");
    expect(mixed).toEqual([
      { start: verseOrd("GEN", 1, 3), end: verseOrd("GEN", 1, 28) },
      { start: verseOrd("PSA", 33, 6), end: verseOrd("PSA", 33, 6) },
      { start: verseOrd("PSA", 33, 9), end: verseOrd("PSA", 33, 9) },
      { start: verseOrd("PRO", 8, 22), end: verseOrd("PRO", 8, 31) },
      { start: verseOrd("1JN", 1, 1), end: verseOrd("1JN", 1, 1) },
      { start: verseOrd("REV", 19, 13), end: verseOrd("REV", 19, 13) },
    ]);
    // Unreadable pieces are skipped, never guessed.
    expect(parseFurtherStudy("Nowhere 3:1; John 3:1", "JHN")).toEqual([{ start: john(3, 1), end: john(3, 1) }]);
  });
});

describe("See also", () => {
  const xrefs = [
    { to_ord_start: verseOrd("REV", 19, 13), to_ord_end: verseOrd("REV", 19, 13), votes: 120 },
    { to_ord_start: verseOrd("GEN", 1, 1), to_ord_end: verseOrd("GEN", 1, 1), votes: 400 },
    { to_ord_start: john(17, 5), to_ord_end: john(17, 5), votes: 120 },
  ];

  it("ranks by votes, never shows them, and lists Yada's own related passages first without repeats", () => {
    expect(rankXrefs(xrefs).map((x) => x.votes)).toEqual([400, 120, 120]);
    const merged = mergeSeeAlso(
      [{ ref: "GEN.1.1", note: "The same opening words.", start: verseOrd("GEN", 1, 1), end: verseOrd("GEN", 1, 1) }],
      xrefs,
    );
    expect(merged.map((m) => `${m.source}:${rangeTitle(m.start, m.end)}`)).toEqual([
      "yada:Genesis 1:1",
      "openbible:John 17:5",
      "openbible:Revelation 19:13",
    ]);
    expect(JSON.stringify(merged)).not.toContain("votes");
  });

  it("titles ranges in and across books and speaks them", () => {
    expect(rangeTitle(john(3, 19), john(3, 20))).toBe("John 3:19–20");
    expect(rangeTitle(verseOrd("GEN", 1, 1), verseOrd("GEN", 2, 3))).toBe("Genesis 1:1–2:3");
    expect(rangeTitle(verseOrd("HAG", 2, 20), verseOrd("ZEC", 1, 1))).toBe("Haggai 2:20 – Zechariah 1:1");
    expect(spokenRange("John 3:19–20")).toBe("John 3:19 to 20");
  });
});

describe("downloads", () => {
  const entry = {
    book: "JHN",
    version: 1,
    file: "study-jhn.v1.db",
    sha256: "a".repeat(64),
    bytes: 372_736,
    download_bytes: 124_600,
    format: 1,
    licenses: ["CC-BY-SA-4.0", "CC-BY-4.0"],
    notes: 514,
    xrefs: 3998,
  };

  it("reads the manifest's study list with the shared schema, and skips what it cannot read", () => {
    const catalogue = parseStudyCatalogue(
      { study: [entry, { ...entry, book: "GEN", file: "../x.db" }, { ...entry, book: "MAT", file: "study-mat.v1.db", format: 9 }, entry] },
      "https://cdn.example/manifest.json",
    );
    expect(catalogue.map((e) => e.url)).toEqual(["https://cdn.example/study-jhn.v1.db"]);
    expect(parseStudyCatalogue({ translations: [] }, "x")).toEqual([]);
  });

  it("says one plain line for each state, and sweeps what no live row names", () => {
    expect(fetchingLine("JHN")).toBe("Getting the study notes for John.");
    expect(failedLine("JHN")).toBe("The study notes for John didn’t download.");
    const plan = sweepStudy(
      [
        { book: "JHN", file: "study-jhn.v2.db", removed: 0 },
        { book: "GEN", file: "study-gen.v1.db", removed: 1 },
      ],
      ["study-jhn.v1.db", "study-jhn.v2.db", "study-jhn.v2.db.partial", "study-gen.v1.db"],
    );
    expect(plan.keep.map((r) => r.book)).toEqual(["JHN"]);
    expect(plan.dropRows).toEqual(["GEN"]);
    expect(plan.deleteFiles).toEqual(["study-jhn.v1.db", "study-jhn.v2.db.partial", "study-gen.v1.db"]);
  });
});

describe("Go further lines", () => {
  it("counts from the data", () => {
    expect(originalLine(17, 6)).toBe("17 words · 6 grammar notes");
    expect(originalLine(13, 0)).toBe("13 words, each with its English");
    expect(originalLine(1, 1)).toBe("1 word · 1 grammar note");
    expect(compareLine(["BSB", "WEB", "KJV", "LSV"])).toBe("BSB, WEB, KJV, LSV");
    expect(passageLine("1:1–18")).toBe("Passage guide · 1:1–18");
    expect(studyNotesLine(2)).toBe("Tyndale · 2 notes");
  });
});

describe("guideNote", () => {
  it("drops the lead range and keeps the note's paragraphs as published", () => {
    expect(guideNote("<b>1:1-18</b> The prologue.\nIt names the Word.")).toEqual({
      text: "The prologue.\n\nIt names the Word.",
      credit: TYNDALE_SHORT,
    });
  });

  it("says the quoted words are the NLT's when the note quotes them", () => {
    expect(guideNote("<b>1:19-34</b> <x>the Jewish leaders:</x> In John these are the authorities.")?.credit).toBe(TYNDALE_LINE);
  });

  it("is null when only a heading or nothing is left", () => {
    expect(guideNote("<b>1:1-18</b>")).toBeNull();
    expect(guideNote("<h>Heading</h>")).toBeNull();
  });
});

describe("people and places in one line (PD-01)", () => {
  const bsb = "Now a man named Lazarus was sick. He was from Bethany, the village of Mary and her sister Martha.";
  const at = (word: string): [number, number] => [bsb.indexOf(word), bsb.indexOf(word) + word.length];

  it("orders profiles and places as the verse names them, one each", () => {
    const named = namedInVerse(bsb, [{ id: 7, title: "Martha, Mary, and Lazarus" }], [{ place: "bethany_1", spans: [at("Bethany"), at("Bethany")] }]);
    expect(named).toEqual([
      { kind: "person", id: "7", name: "Martha, Mary, and Lazarus" },
      { kind: "place", id: "bethany_1", name: "Bethany" },
    ]);
  });

  it("drops a place whose span runs past the text", () => {
    expect(namedInVerse("Bethany", [], [{ place: "x", spans: [[0, 40]] }])).toEqual([]);
  });
});
