import { describe, expect, it } from "vitest";

import { eveningTable, morningTable, OfficeRefused, parseLesson } from "./office.js";

describe("Daily Office lessons", () => {
  it("reads the source's references, slips included, and marks books the BSB lacks", () => {
    expect(parseLesson("Isa 1:10–20")).toEqual({ ref: "Isa 1:10–20", book: "ISA", verses: "1:10–20" });
    expect(parseLesson("1 Cor5:1–8").book).toBe("1CO");
    expect(parseLesson("1 cor 5:1–8").book).toBe("1CO");
    expect(parseLesson("Sir 43:1–12(27–33)")).toEqual({ ref: "Sir 43:1–12(27–33)", book: null, verses: "43:1–12" });
  });

  it("skips a reference it cannot read rather than guess (rule 4)", () => {
    expect(parseLesson("Col (3:18–4:1)2–18")).toEqual({ ref: "Col (3:18–4:1)2–18", book: null, verses: "" });
  });

  it("gives the evening the lesson the morning leaves, or the evening's own where the day splits them", () => {
    const plain = { week: "Proper 23", day: "Saturday", psalms: { morning: ["107:33–43"], evening: ["110", "116"] }, lessons: { first: "Mic 3:1–8", second: "Eph 6:10–24", gospel: "Luke 9:37–50" } };
    const split = { week: "Week of 4 Advent", day: "Dec 24", psalms: { morning: ["45"], evening: ["89:1–29"] }, lessons: { morning: { first: "Isa 35:1–10", second: "Rev 22:12–17, 21", gospel: "Luke 1:67–80" }, evening: { first: "Isa 59:15b–21", second: "Phil 2:5–11" } } };
    expect(eveningTable([plain], 2)["2|Proper 23|Saturday"]?.lessons.map((l) => l.ref)).toEqual(["Luke 9:37–50"]);
    expect(eveningTable([split], 1)["1|Week of 4 Advent|Dec 24"]?.lessons.map((l) => l.ref)).toEqual(["Isa 59:15b–21", "Phil 2:5–11"]);
    expect(morningTable([split], 1)["1|Week of 4 Advent|Dec 24"]?.lessons.map((l) => l.ref)).toEqual(["Isa 35:1–10", "Rev 22:12–17, 21"]);
  });

  it("reads the source's Saturday note and refuses any other", () => {
    const day = { week: "Christmas Day and Following", day: "Dec 29", psalms: { evening: ["18:21–50"] }, lessons: { gospel: "John 7:37–52" } };
    expect(eveningTable([{ ...day, notes: ["If today is Saturday, use Psalms 23 and 27 at Evening Prayer."] }], 1)["1|Christmas Day and Following|Dec 29"]?.saturday).toEqual(["23", "27"]);
    expect(() => eveningTable([{ ...day, notes: ["Use the collect of the day."] }], 1)).toThrow(OfficeRefused);
  });
});
