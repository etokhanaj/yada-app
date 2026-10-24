import { describe, expect, it } from "vitest";

import { minutes, overviewsFor } from "./overviews";

describe("BibleProject overviews (OR-03)", () => {
  it("gives John its two parts and the three letters one shared video", () => {
    expect(overviewsFor("JHN").map((o) => o.url)).toEqual(["https://bibleproject.com/videos/john-1-12/", "https://bibleproject.com/videos/john-13-21/"]);
    expect(overviewsFor("2JN")).toEqual(overviewsFor("1JN"));
  });

  it("has no card for a book whose page was not checked", () => {
    expect(overviewsFor("GEN")).toEqual([]);
  });

  it("rounds the length to the minute", () => {
    expect(minutes(526)).toBe("9 min");
    expect(minutes(20)).toBe("1 min");
  });
});
