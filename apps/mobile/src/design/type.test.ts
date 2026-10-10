import { describe, expect, it } from "vitest";

import { axLevel, effectiveTextScale, scaledType, TYPE, type TypeStep } from "./type";

// iOS body size / 17 per content-size category.
const LARGE = 1;
const XXXL = 23 / 17;
const AX1 = 28 / 17;
const AX3 = 40 / 17;
const AX5 = 53 / 17;

describe("axLevel", () => {
  it("is 0 below the accessibility sizes", () => {
    expect(axLevel(LARGE)).toBe(0);
    expect(axLevel(XXXL)).toBe(0);
  });

  it("names AX1 to AX5", () => {
    expect(axLevel(AX1)).toBe(1);
    expect(axLevel(33 / 17)).toBe(2);
    expect(axLevel(AX3)).toBe(3);
    expect(axLevel(47 / 17)).toBe(4);
    expect(axLevel(AX5)).toBe(5);
  });

  it("tolerates the rounding RN reports", () => {
    expect(axLevel(1.647)).toBe(1);
    expect(axLevel(1.64)).toBe(1);
  });
});

describe("AX step lock (brief §3)", () => {
  it("applies the Aa step below AX1", () => {
    expect(effectiveTextScale(1.36, XXXL)).toBe(1.36);
    expect(scaledType("scripture", 1.36, LARGE).size).toBe(29);
  });

  it("fixes the step at default from AX1, so the two never compound", () => {
    expect(effectiveTextScale(1.36, AX1)).toBe(1);
    expect(effectiveTextScale(0.85, AX5)).toBe(1);
    expect(scaledType("scripture", 1.36, AX5).size).toBe(TYPE.scripture.size);
  });

  it("leaves chrome alone at any step", () => {
    expect(scaledType("chrome", 1.36, LARGE).size).toBe(17);
    expect(scaledType("label", 0.85, LARGE).size).toBe(13);
  });
});

describe("maxFontSizeMultiplier", () => {
  it("lands every token on its AX5 size", () => {
    for (const step of Object.keys(TYPE) as TypeStep[]) {
      const t = scaledType(step, 1, AX5);
      expect(Math.abs(t.size * t.maxFontSizeMultiplier - TYPE[step].ax5)).toBeLessThan(0.5);
    }
  });

  it("still lands on the AX5 size from a non-default Aa step", () => {
    const t = scaledType("scripture", 1.22, LARGE);
    expect(Math.abs(t.size * t.maxFontSizeMultiplier - TYPE.scripture.ax5)).toBeLessThan(0.5);
  });

  it("caps chrome and titles at 2× (brief §3)", () => {
    expect(scaledType("chrome", 1, AX5).maxFontSizeMultiplier).toBe(2);
    expect(scaledType("sheetTitle", 1, AX5).maxFontSizeMultiplier).toBe(2);
  });
});

describe("leading", () => {
  it("is a ratio of the unscaled size only", () => {
    expect(scaledType("scripture", 1, AX5).lineHeight).toBe(Math.round(21 * TYPE.scripture.ratio));
  });
});
