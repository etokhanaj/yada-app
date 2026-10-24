import { describe, expect, it } from "vitest";

import { COLLECTS } from "../data/collects.generated";
import { collectFor, collectKey } from "./collects";

const on = (y: number, m: number, d: number) => collectKey(new Date(y, m - 1, d));

describe("the collect of the day (1979 Prayer Book, traditional)", () => {
  it("holds all 76 collects of the seasons, each whole to its Amen", () => {
    expect(Object.keys(COLLECTS)).toHaveLength(76);
    for (const text of Object.values(COLLECTS)) expect(text.endsWith("Amen.")).toBe(true);
    expect(COLLECTS["Advent 1"]).toMatch(/^Almighty God, give us grace that we may cast away the works of darkness/);
  });

  it("takes the Sunday's collect through the week", () => {
    expect(on(2026, 11, 29)).toBe("Advent 1"); // Advent Sunday 2026
    expect(on(2026, 12, 2)).toBe("Advent 1");
    expect(on(2026, 10, 25)).toBe("Proper 25");
    expect(on(2026, 10, 28)).toBe("Proper 25");
  });

  it("gives Christmas, the Holy Name and the Epiphany their own", () => {
    expect(on(2026, 12, 25)).toBe("Christmas Day");
    expect(on(2026, 12, 27)).toBe("Christmas 1"); // a Sunday
    expect(on(2027, 1, 1)).toBe("Holy Name");
    expect(on(2027, 1, 3)).toBe("Christmas 2");
    expect(on(2027, 1, 6)).toBe("Epiphany");
  });

  it("follows Lent, Holy Week, Easter Week and Ascension Day (Easter 2027 is 28 March)", () => {
    expect(on(2027, 2, 10)).toBe("Ash Wednesday");
    expect(on(2027, 3, 21)).toBe("Palm Sunday");
    expect(on(2027, 3, 25)).toBe("Maundy Thursday");
    expect(on(2027, 3, 26)).toBe("Good Friday");
    expect(on(2027, 3, 28)).toBe("Easter Day");
    expect(on(2027, 3, 30)).toBe("Easter Tuesday");
    expect(on(2027, 5, 6)).toBe("Ascension Day");
    expect(on(2027, 5, 9)).toBe("Easter 7");
    expect(on(2027, 5, 16)).toBe("Pentecost");
    expect(on(2027, 5, 23)).toBe("Trinity Sunday");
  });

  it("names the day as the Prayer Book does", () => {
    expect(collectFor(new Date(2027, 1, 14))?.name).toBe("First Sunday in Lent");
    expect(collectFor(new Date(2026, 9, 25))?.name).toBe("Proper 25");
    expect(collectFor(new Date(2027, 2, 22))?.name).toBe("Monday in Holy Week");
  });

  it("has a collect for every day of a year", () => {
    for (let i = 0; i < 366; i++) {
      const d = new Date(2026, 9, 1 + i);
      expect(collectFor(d), d.toDateString()).not.toBeNull();
    }
  });
});
