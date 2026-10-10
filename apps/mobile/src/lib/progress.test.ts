import { describe, expect, it } from "vitest";

import { formatMB, percent, progressAnnouncement, progressLine, quarter, spokenMB } from "./progress";

describe("sizes", () => {
  it("reads as the canvas writes them", () => {
    expect(formatMB(1_300_000)).toBe("1.3 MB");
    expect(spokenMB(1_250_000)).toBe("1.3 megabytes");
    expect(progressLine(600_000, 1_300_000)).toBe("0.6 of 1.3 MB");
    expect(progressLine(2_000_000, 1_300_000)).toBe("1.3 of 1.3 MB");
  });
});

describe("percent and quarter", () => {
  it("clamps and floors", () => {
    expect(percent(598_000, 1_300_000)).toBe(46);
    expect(percent(5, 0)).toBe(0);
    expect(percent(2, 1)).toBe(100);
    expect([0, 24, 25, 49, 50, 99, 100].map(quarter)).toEqual([0, 0, 25, 25, 50, 75, 100]);
  });
});

describe("progressAnnouncement", () => {
  it("speaks each 25% step once", () => {
    const name = "Young’s Literal Translation";
    const said: string[] = [];
    let before = 0;
    for (const p of [3, 10, 24, 26, 30, 51, 52, 74, 76, 99, 100]) {
      const line = progressAnnouncement(before, p, name);
      if (line !== null) said.push(line);
      before = p;
    }
    expect(said).toEqual([`${name}, 25 percent`, `${name}, 50 percent`, `${name}, 75 percent`]);
  });

  it("says one step when progress jumps past several", () => {
    expect(progressAnnouncement(10, 80, "ASV")).toBe("ASV, 75 percent");
  });
});
