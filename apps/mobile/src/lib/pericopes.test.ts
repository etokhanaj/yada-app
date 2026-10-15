import { describe, expect, it } from "vitest";

import { pericopeForVerse, type PericopeRow } from "./pericopes";

const p = (id: string, label: string, start: number, end: number): PericopeRow => ({
  pericope_id: id, label, start_ord: start, end_ord: end, review_status: null, payload: null,
});

describe("a verse's passage", () => {
  it("picks the narrowest pericope containing a verse", () => {
    const nested = [p("A", "outer", 10, 20), p("B", "inner", 12, 14)];
    expect(pericopeForVerse(nested, 13)?.pericope_id).toBe("B");
    expect(pericopeForVerse(nested, 19)?.pericope_id).toBe("A");
    expect(pericopeForVerse(nested, 30)).toBeNull();
  });
});
