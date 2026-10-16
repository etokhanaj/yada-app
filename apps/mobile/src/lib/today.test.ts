import { describe, expect, it } from "vitest";

import { dayOf, greeting, mmdd, opening, partOf, pictureDay } from "./today";

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
