import { describe, expect, it } from "vitest";

import { OFFICE_EVENINGS, OFFICE_MORNINGS } from "../data/office.generated";
import { adventSunday, easter, officeKey } from "./office";

const on = (y: number, m: number, d: number) => officeKey(new Date(y, m - 1, d));

describe("the Daily Office calendar", () => {
  it("finds Easter and Advent Sunday", () => {
    expect(easter(2026).toDateString()).toBe(new Date(2026, 3, 5).toDateString());
    expect(easter(2027).toDateString()).toBe(new Date(2027, 2, 28).toDateString());
    expect(adventSunday(2026).toDateString()).toBe(new Date(2026, 10, 29).toDateString());
  });

  it("names the morning for known days, in the source's own keys", () => {
    expect(on(2026, 10, 17)).toBe("2|Proper 23|Saturday");
    expect(on(2026, 4, 5)).toBe("2|Easter Week|Sunday");
    expect(on(2026, 11, 29)).toBe("1|Week of 1 Advent|Sunday");
    expect(on(2026, 12, 25)).toBe("1|Christmas Day and Following|Dec 25");
    expect(on(2027, 1, 7)).toBe("1|The Epiphany and Following|Jan 7");
    expect(on(2027, 1, 10)).toBe("1|Week of 1 Epiphany|Sunday");
    expect(on(2027, 2, 7)).toBe("1|Week of Last Epiphany|Sunday");
    expect(on(2027, 2, 10)).toBe("1|Ash Wednesday and Following|Wednesday");
    expect(on(2027, 3, 21)).toBe("1|Holy Week|Sunday");
    expect(on(2027, 5, 16)).toBe("1|Pentecost|Sunday");
  });

  it("finds an entry for nearly every day of two years; the rest are holy days kept by their fixed parts", () => {
    let missing = 0;
    for (let i = 0; i < 730; i += 1) if (OFFICE_MORNINGS[officeKey(new Date(2026, 0, 1 + i))] === undefined) missing += 1;
    expect(missing).toBeLessThanOrEqual(12);
  });

  it("finds an evening for the same days, with psalms and the day's lesson left after the morning", () => {
    let missing = 0;
    for (let i = 0; i < 730; i += 1) if (OFFICE_EVENINGS[officeKey(new Date(2026, 0, 1 + i))] === undefined) missing += 1;
    expect(missing).toBeLessThanOrEqual(12);
    expect(OFFICE_EVENINGS["2|Proper 23|Saturday"]?.lessons.map((l) => l.ref)).toEqual(["Luke 9:37–50"]);
    // Christmas Eve splits its lessons: the evening reads its own two, not the morning's.
    expect(OFFICE_EVENINGS["1|Week of 4 Advent|Dec 24"]?.lessons.map((l) => l.ref)).toEqual(["Isa 59:15b–21", "Phil 2:5–11"]);
    expect(OFFICE_MORNINGS["1|Week of 4 Advent|Dec 24"]?.lessons.map((l) => l.ref)).toEqual(["Isa 35:1–10", "Rev 22:12–17, 21"]);
    // The source's own Saturday note (29 December).
    expect(OFFICE_EVENINGS["1|Christmas Day and Following|Dec 29"]?.saturday).toEqual(["23", "27"]);
  });
});

describe("the evening office's songs and lessons", () => {
  it("keeps Mary's and Simeon's own words: the lead-in and the quotation marks go, nothing else changes", async () => {
    const { songOnly } = await import("../data/office");
    expect(songOnly("Then Mary said: “My soul magnifies the Lord,")).toBe("My soul magnifies the Lord,");
    expect(songOnly("“Sovereign Lord, as You have promised, You now dismiss Your servant in peace.")).toBe("Sovereign Lord, as You have promised, You now dismiss Your servant in peace.");
    expect(songOnly("as He promised to our fathers, to Abraham and his descendants forever.”")).toBe("as He promised to our fathers, to Abraham and his descendants forever.");
  });

  it("reads a lesson in pieces, and skips one whose piece names no chapter (rule 4)", async () => {
    const { lessonSpans } = await import("../data/office");
    expect(lessonSpans("4:13–17; 5:7–11")).toEqual([
      { chapter: 4, from: 13, to: 17 },
      { chapter: 5, from: 7, to: 11 },
    ]);
    expect(lessonSpans("4;43–54")).toEqual([]);
    expect(lessonSpans("1:10–20")).toEqual([{ chapter: 1, from: 10, to: 20 }]);
  });
});

describe("the Lord's Prayer in Daily prayer", () => {
  it("keeps the prayer's own words: the lead-in and its quotation marks go, nothing else changes", async () => {
    const { prayerOnly } = await import("../data/office");
    expect(prayerOnly("So then, this is how you should pray: ‘Our Father in heaven, hallowed be Your name.")).toBe("Our Father in heaven, hallowed be Your name.");
    expect(prayerOnly("And lead us not into temptation, but deliver us from the evil one.’")).toBe("And lead us not into temptation, but deliver us from the evil one.");
  });
});
