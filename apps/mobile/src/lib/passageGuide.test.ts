import { type Passage, type PassageRow, parsePassage, verseOrd } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { guideRows, passageAfter, passageRef, passageSubtitle } from "./passageGuide";

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
    const rows = guideRows(passage("PRO.1.8-1.19", "The Enticement of Sin", verseOrd("PRO", 1, 8), verseOrd("PRO", 1, 19)), 12, { studyNotes: true, keyWords: false, check: false });
    expect(rows.map((r) => [r.title, r.note])).toEqual([
      ["Verse by verse", "12 verses"],
      ["Study notes", "Tyndale on 1:8–19"],
    ]);
  });

  it("keeps the fixed order when everything is there", () => {
    const rows = guideRows(prologue, 18, { studyNotes: true, keyWords: true, check: true });
    expect(rows.map((r) => r.page)).toEqual(["verses", "notes", "key-words", "check"]);
  });

  it("offers nothing for a passage with no verses on the phone and no notes", () => {
    expect(guideRows(prologue, 0, { studyNotes: false, keyWords: false, check: false })).toEqual([]);
  });
});
