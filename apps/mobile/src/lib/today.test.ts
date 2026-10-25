import { describe, expect, it } from "vitest";

import { cardPictureDays, dayOf, dayParam, doneLine, readingMinutes, earlierDays, greeting, laterRow, mmdd, officeName, opening, parseDayParam, partOf, partSpan, pictureDay, whenLabel } from "./today";

describe("Later and Earlier (DR-11, DR-12)", () => {
  it("names the other part's psalms and, when there is an entry, the devotional", () => {
    expect(laterRow("morning", "Psalms 6–8", true)).toEqual({ title: "This evening · Psalms 6–8", subtitle: "and the evening devotional", label: "This evening: Psalms 6–8 and the evening devotional" });
    expect(laterRow("evening", "Psalms 1–5", true)).toEqual({ title: "This morning", subtitle: "Psalms 1–5 and the devotional", label: "This morning: Psalms 1–5 and the morning devotional" });
  });

  it("never names Spurgeon without an entry", () => {
    expect(laterRow("morning", "Psalms 6–8", false).subtitle).toBeUndefined();
    expect(laterRow("evening", "Psalms 1–5", false).subtitle).toBe("Psalms 1–5");
  });
});

const at = (h: number, d = 1, m = 10) => new Date(2026, m, d, h, 0, 0);

describe("today's clock", () => {
  it("turns the day at 03:00, not midnight", () => {
    expect(mmdd(dayOf(at(1, 2)))).toBe("1101");
    expect(mmdd(dayOf(at(3, 2)))).toBe("1102");
    expect(mmdd(dayOf(new Date(2026, 0, 1, 2)))).toBe("1231");
  });

  it("is evening from 17:00 until the day turns", () => {
    expect(partOf(at(16))).toBe("morning");
    expect(partOf(at(17))).toBe("evening");
    expect(partOf(at(2))).toBe("evening");
    expect(partOf(at(3))).toBe("morning");
  });

  it("spans a morning from 03:00 to 17:00 and an evening on to 03:00 the next day", () => {
    const day = new Date(2026, 9, 31);
    const morning = partSpan(day, "morning");
    const evening = partSpan(day, "evening");
    expect([morning.from.getHours(), morning.until.getHours()]).toEqual([3, 17]);
    expect(evening.from).toEqual(morning.until);
    expect(evening.until).toEqual(new Date(2026, 10, 1, 3));
    expect(partOf(evening.from)).toBe("evening");
    expect(dayOf(new Date(evening.until.getTime() - 1))).toEqual(day);
  });

  it("greets by the hour, with no name", () => {
    expect(greeting(at(8))).toBe("Good morning");
    expect(greeting(at(13))).toBe("Good afternoon");
    expect(greeting(at(21))).toBe("Good evening");
    expect(greeting(at(1))).toBe("Good evening");
  });

  it("reuses the 30th's picture on the 31st", () => {
    expect(pictureDay(new Date(2026, 9, 31))).toBe(30);
    expect(pictureDay(new Date(2026, 9, 1))).toBe(1);
  });

  it("ends the opening at the verse's own punctuation", () => {
    expect(opening("Blessed is the man who does not walk in the counsel of the wicked, or set foot on the path of sinners, or sit in the seat of mockers.")).toBe(
      "Blessed is the man who does not walk in the counsel of the wicked",
    );
    expect(opening("O LORD, do not rebuke me in Your anger or discipline me in Your wrath.")).toBe(
      "O LORD, do not rebuke me in Your anger or discipline me in Your wrath",
    );
  });
});

describe("the day's verse, earlier (DR-16, DR-19)", () => {
  const sunday = new Date(2026, 10, 1);
  it("names today, this evening, yesterday and last night, then the date", () => {
    expect(whenLabel(sunday, "morning", sunday)).toBe("Today");
    expect(whenLabel(sunday, "evening", sunday)).toBe("This evening");
    expect(whenLabel(new Date(2026, 9, 31), "morning", sunday)).toBe("Yesterday");
    expect(whenLabel(new Date(2026, 9, 31), "evening", sunday)).toBe("Last night");
    expect(whenLabel(new Date(2026, 9, 29), "morning", sunday)).toBe("Thursday 29 October");
  });

  it("round-trips a day through its route parameter", () => {
    expect(dayParam(sunday)).toBe("2026-11-01");
    expect(parseDayParam("2026-11-01")?.getTime()).toBe(sunday.getTime());
    expect(parseDayParam("nonsense")).toBeNull();
  });

  it("refuses a day that does not exist rather than rolling it into the next month", () => {
    expect(parseDayParam("2026-02-31")).toBeNull();
    expect(parseDayParam("2026-13-01")).toBeNull();
    expect(parseDayParam("2026-00-10")).toBeNull();
    expect(parseDayParam("2025-02-29")).toBeNull();
    expect(parseDayParam("2028-02-29")?.getDate()).toBe(29);
  });

  it("lists this month newest first, this evening only once it has come", () => {
    const morning = earlierDays(new Date(2026, 9, 3, 9));
    expect(morning.map((d) => `${d.day.getDate()} ${d.part}`)).toEqual(["3 morning", "2 evening", "2 morning", "1 evening", "1 morning"]);
    const evening = earlierDays(new Date(2026, 9, 2, 20));
    expect(evening.map((d) => `${d.day.getDate()} ${d.part}`)).toEqual(["2 evening", "2 morning", "1 evening", "1 morning"]);
  });
});

describe("the office's name (decision 4)", () => {
  it("is the afternoon's between noon and five, the evening's from five", () => {
    expect(officeName(new Date(2026, 9, 24, 9))).toBe("Morning prayer");
    expect(officeName(new Date(2026, 9, 24, 12))).toBe("Afternoon prayer");
    expect(officeName(new Date(2026, 9, 24, 16, 59))).toBe("Afternoon prayer");
    expect(officeName(new Date(2026, 9, 24, 17))).toBe("Evening prayer");
  });
});

describe("For you today (TD-30, TD-31)", () => {
  it("says how long a reading takes at 200 words a minute, never under a minute", () => {
    expect(readingMinutes(351)).toBe(2);
    expect(readingMinutes(40)).toBe(1);
    expect(readingMinutes(1200)).toBe(6);
  });

  it("gives the cards the days after today's picture, wrapping after the 30th", () => {
    expect(cardPictureDays(24, 3)).toEqual([25, 26, 27]);
    expect(cardPictureDays(29, 3)).toEqual([30, 1, 2]);
  });

  it("counts what is done only once something is", () => {
    expect(doneLine(0, 6)).toBeNull();
    expect(doneLine(1, 6)).toBe("1 of 6 done");
  });
});
