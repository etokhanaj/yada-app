import { describe, expect, it } from "vitest";

import { OFFICE_MORNINGS } from "../data/office.generated";
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
});

describe("the Lord's Prayer in Daily prayer", () => {
  it("keeps the prayer's own words: the lead-in and its quotation marks go, nothing else changes", async () => {
    const { prayerOnly } = await import("../data/office");
    expect(prayerOnly("So then, this is how you should pray: ‘Our Father in heaven, hallowed be Your name.")).toBe("Our Father in heaven, hallowed be Your name.");
    expect(prayerOnly("And lead us not into temptation, but deliver us from the evil one.’")).toBe("And lead us not into temptation, but deliver us from the evil one.");
  });
});
