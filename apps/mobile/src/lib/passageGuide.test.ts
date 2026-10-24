import { type Passage, type PassageRow, parsePassage, verseOrd } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { guideRows, lastSentence, passageAfter, passageRef, passageSubtitle, studyNoteCaption } from "./passageGuide";

const j = (c: number, v: number) => verseOrd("JHN", c, v);

function passage(id: string, label: string, start: number, end: number, over: Partial<PassageRow> = {}): Passage {
  const row: PassageRow = {
    passage_id: id,
    label,
    start_ord: start,
    end_ord: end,
    headline: "",
    headline_kind: "What happens",
    mode: "gospel",
    summary: "",
    sentences: "[]",
    credit: "",
    speakers: "[]",
    facts: "[]",
    psalm_lead: "[]",
    psalm_about: "[]",
    debates: "[]",
    purpose: null,
    around: null,
    also_told_in: "[]",
    themes: "[]",
    settings: "[]",
    flagged: 0,
    ...over,
  };
  const p = parsePassage(row);
  if (p === null) throw new Error(`${id} did not parse`);
  return p;
}

const prologue = passage("JHN.1.1-1.18", "The Word became flesh", j(1, 1), j(1, 18));
const testimony = passage("JHN.1.19-1.34", "The testimony of John the Baptist", j(1, 19), j(1, 34));
const lamb = passage("JHN.1.35-1.42", "The first disciples", j(1, 35), j(1, 42));

describe("the guide's Next row (ON-04)", () => {
  it("is the passage after this one, in book order whatever the list's order", () => {
    expect(passageAfter([lamb, testimony, prologue], prologue)?.label).toBe("The testimony of John the Baptist");
    expect(passageAfter([prologue, testimony, lamb], lamb)).toBeNull();
  });

  it("opens with the passage's ref, and names it as Understand does", () => {
    expect(passageRef(testimony)).toBe("JHN.1.19-1.34");
    expect(passageSubtitle(testimony)).toBe("The testimony of John the Baptist · 1:19–34");
  });
});

describe("Go deeper offers only what has something behind it (UL-04)", () => {
  it("shows Proverbs' two rows when that is all there is", () => {
    const rows = guideRows(passage("PRO.1.8-1.19", "The Enticement of Sin", verseOrd("PRO", 1, 8), verseOrd("PRO", 1, 19)), 12, { studyNotes: true, keyWords: [], check: false });
    expect(rows.map((r) => [r.title, r.note])).toEqual([
      ["Verse by verse", "12 verses"],
      ["Study notes", "Tyndale on 1:8–19"],
    ]);
  });

  it("keeps the fixed order when everything is there", () => {
    const rows = guideRows(prologue, 18, { studyNotes: true, keyWords: ["word of God", "God"], check: true });
    expect(rows.map((r) => r.page)).toEqual(["verses", "notes", "key-words", "check"]);
  });

  it("puts In short after Key words, only where the summary says more than the headline (RU-3)", () => {
    const summarised = passage("JHN.1.1-1.18", "The Word became flesh", j(1, 1), j(1, 18), {
      headline: "Jesus is God in the flesh.",
      sentences: JSON.stringify([{ text: "The Word was with God.", source: "tq", credit: "c" }]),
    });
    expect(guideRows(summarised, 18, { studyNotes: true, keyWords: ["word of God", "God"], check: true }).map((r) => r.page)).toEqual(["verses", "notes", "key-words", "in-short", "check"]);
    const headlineOnly = passage("JHN.1.1-1.18", "The Word became flesh", j(1, 1), j(1, 18), { headline: "Jesus is God in the flesh." });
    expect(guideRows(headlineOnly, 18, { studyNotes: false, keyWords: [], check: false }).map((r) => r.page)).toEqual(["verses"]);
  });

  it("names the passage's first three key words in the Key words row (RU-03)", () => {
    const rows = guideRows(prologue, 18, { studyNotes: false, keyWords: ["word of God", "God", "John (the Baptist)", "light"], check: false });
    expect(rows.find((r) => r.page === "key-words")?.note).toBe("word of God, God, John (the Baptist)");
  });

  it("offers nothing for a passage with no verses on the phone and no notes", () => {
    expect(guideRows(prologue, 0, { studyNotes: false, keyWords: [], check: false })).toEqual([]);
  });
});

describe("the study note's sentence on the guide (RU-3)", () => {
  // The note on John 1:1 as the Understand bundle has it (understand-jhn.v4.db).
  const john11 =
    "Echoing Gen 1:1, John’s Gospel introduces Jesus Christ, through whom God created everything; Jesus also creates new life in those who believe. The Gospel opens with its central affirmation, that Jesus Christ, the Word (Greek logos), not only revealed God but was God.";

  it("is the note's last sentence, word for word", () => {
    expect(lastSentence(john11)).toBe("The Gospel opens with its central affirmation, that Jesus Christ, the Word (Greek logos), not only revealed God but was God.");
  });

  it("does not break at a colon, an abbreviation before a lower-case word, or a reference", () => {
    expect(lastSentence("Jesus reveals himself to the world. Audiences were divided: Some wanted to believe in him; others opposed him.")).toBe(
      "Audiences were divided: Some wanted to believe in him; others opposed him.",
    );
    expect(lastSentence("Weddings, e.g. in Cana, could last a week.")).toBe("Weddings, e.g. in Cana, could last a week.");
  });

  it("keeps a closing quote with its sentence and breaks before an opening one", () => {
    expect(lastSentence("He said “Come and see.” “Follow me,” he said later.")).toBe("“Follow me,” he said later.");
    expect(lastSentence("They asked, “Who are you?” He answered plainly.")).toBe("He answered plainly.");
    expect(lastSentence("They asked, “Who are you?”")).toBe("They asked, “Who are you?”");
  });

  it("never shows a note cut mid-sentence: the whole sentence before it, or nothing", () => {
    expect(lastSentence("This section introduces the template for discipleship in John’s Gospel. Disciples desired to “come and see”")).toBe(
      "This section introduces the template for discipleship in John’s Gospel.",
    );
    expect(lastSentence("Disciples desired to “come and see”")).toBeNull();
    expect(lastSentence("")).toBeNull();
  });

  it("names the verse the note starts on", () => {
    expect(studyNoteCaption(j(1, 1))).toBe("Tyndale Open Study Notes, on 1:1");
  });
});
