import { describe, expect, it } from "vitest";

import { estimatedPillWidth, pillShape, placePill } from "./pill";

describe("selection pill", () => {
  it("is a row at the default size on an iPhone 17 Pro", () => {
    expect(pillShape(1, 402 - 32)).toBe("row");
  });

  it("becomes a column at AX3 instead of overflowing", () => {
    expect(pillShape(2.35, 402 - 32)).toBe("column");
    expect(estimatedPillWidth(2.35)).toBeGreaterThan(370);
  });

  it("sits above the selection when there is room", () => {
    expect(placePill(400, 460, 46, 100, 800)).toEqual({ top: 344, overlaps: false });
  });

  it("drops below the selection near the top of the screen", () => {
    expect(placePill(110, 170, 46, 100, 800)).toEqual({ top: 180, overlaps: false });
  });

  it("overlaps only when the selection fills the screen", () => {
    expect(placePill(105, 790, 46, 100, 800)).toEqual({ top: 754, overlaps: true });
  });
});
