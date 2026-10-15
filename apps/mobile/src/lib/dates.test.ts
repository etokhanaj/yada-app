import { describe, expect, it } from "vitest";

import { formatDay } from "./dates";

describe("dates from the reader's own data", () => {
  const now = new Date(2026, 9, 12);
  it("leaves the year off in the current year", () => {
    expect(formatDay(new Date(2026, 8, 3), now)).toBe("3 Sep");
  });
  it("names the year otherwise, never a relative date", () => {
    expect(formatDay(new Date(2025, 9, 12), now)).toBe("12 Oct 2025");
  });
});
