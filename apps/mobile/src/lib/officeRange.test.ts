import { describe, expect, it } from "vitest";

import { psalmSpans, spans } from "./officeRange";

describe("Daily Office ranges", () => {
  it("reads the forms the lectionary uses", () => {
    expect(spans("1:10–20")).toEqual([{ chapter: 1, from: 10, to: 20 }]);
    expect(spans("5:8–12, 18–23")).toEqual([{ chapter: 5, from: 8, to: 12 }, { chapter: 5, from: 18, to: 23 }]);
    expect(spans("2:13–3:5")).toEqual([{ chapter: 2, from: 13, to: Infinity }, { chapter: 3, from: 1, to: 5 }]);
    expect(spans("2:1–10a")).toEqual([{ chapter: 2, from: 1, to: 10 }]);
    expect(spans("43:1–12(27–33)")).toEqual([{ chapter: 43, from: 1, to: 12 }]);
    expect(spans("17–25")).toEqual([{ chapter: 1, from: 17, to: 25 }]);
  });

  it("reads psalms whole, in part, without their optional verses, and skips alternatives", () => {
    expect(psalmSpans("146")).toEqual([{ chapter: 146, from: 1, to: Infinity }]);
    expect(psalmSpans("119:1–24")).toEqual([{ chapter: 119, from: 1, to: 24 }]);
    expect(psalmSpans("69:1–23(24–30)31–38")).toEqual([{ chapter: 69, from: 1, to: 23 }, { chapter: 69, from: 31, to: 38 }]);
    expect(psalmSpans("[100]")).toEqual([]);
  });
});
