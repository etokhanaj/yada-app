import { describe, expect, it } from "vitest";

import { contrast, over } from "./contrast";
import { AVATAR_HUES, AVATAR_INK, BRAND, PALETTES, type Palette } from "./palette";

/**
 * Brief §5: text ≥ 4.5:1 everywhere; state marks (selection bar, underline,
 * bookmark glyph, Increase Contrast separators) ≥ 3:1. Measured on every
 * ground a token is actually drawn on, in all four palettes.
 */

const TEXT = 4.5;
const MARK = 3;

type Pair = [label: string, fg: (p: Palette) => string, bg: (p: Palette) => string | ReturnType<typeof over>, min: number];

const opaque = (p: Palette, layer: string) => over(layer, p.paper);

const PAIRS: Pair[] = [
  ["ink / paper", (p) => p.ink, (p) => p.paper, TEXT],
  ["ink / selection", (p) => p.ink, (p) => p.selection, TEXT],
  ["ink / highlight", (p) => p.ink, (p) => p.highlight, TEXT],
  ["ink / sheet", (p) => p.ink, (p) => p.sheet, TEXT],
  ["mutedInk / paper", (p) => p.mutedInk, (p) => p.paper, TEXT],
  ["mutedInk / selection", (p) => p.mutedInk, (p) => p.selection, TEXT],
  // No mutedInk text on highlight: the wash sits only under ink words, with a mutedInk underline (a mark, below).
  ["mutedInk / sheet", (p) => p.mutedInk, (p) => p.sheet, TEXT],
  ["accent / paper", (p) => p.accent, (p) => p.paper, TEXT],
  ["accent / selection", (p) => p.accent, (p) => p.selection, TEXT],
  ["accent / sheet", (p) => p.accent, (p) => p.sheet, TEXT],
  // Primary action: paper text on an ink capsule (amendment 6).
  ["paper / ink", (p) => p.paper, (p) => p.ink, TEXT],
  ["ink / fill over paper", (p) => p.ink, (p) => opaque(p, p.fill), TEXT],
  ["mutedInk / fill over paper", (p) => p.mutedInk, (p) => opaque(p, p.fill), TEXT],
  ["ink / glass over paper", (p) => p.ink, (p) => opaque(p, p.glass), TEXT],
  // Reduce Transparency: the same controls drawn solid.
  ["ink / solid glass", (p) => p.ink, (p) => p.glassSolid, TEXT],
  ["mutedInk / solid glass", (p) => p.mutedInk, (p) => p.glassSolid, TEXT],
  ["selection bar: accent / selection", (p) => p.accent, (p) => p.selection, MARK],
  ["difference underline: mutedInk / highlight", (p) => p.mutedInk, (p) => p.highlight, MARK],
];

describe.each(Object.entries(PALETTES))("palette %s", (_name, palette) => {
  it.each(PAIRS)("%s", (_label, fg, bg, min) => {
    expect(contrast(fg(palette), bg(palette))).toBeGreaterThanOrEqual(min);
  });
});

describe("Increase Contrast", () => {
  it("divider becomes a visible separator (≥ 3:1) on paper and sheet", () => {
    for (const p of [PALETTES.lightIC, PALETTES.darkIC]) {
      expect(contrast(p.divider, p.paper)).toBeGreaterThanOrEqual(MARK);
      expect(contrast(p.divider, p.sheet)).toBeGreaterThanOrEqual(MARK);
    }
  });

  it("raises mutedInk contrast over the default palettes", () => {
    expect(contrast(PALETTES.lightIC.mutedInk, PALETTES.light.paper)).toBeGreaterThan(
      contrast(PALETTES.light.mutedInk, PALETTES.light.paper),
    );
    expect(contrast(PALETTES.darkIC.mutedInk, PALETTES.dark.paper)).toBeGreaterThan(
      contrast(PALETTES.dark.mutedInk, PALETTES.dark.paper),
    );
  });

  // Build 7's white palette (polish-2026-10-15.md), measured 15 Oct 2026; the chalk values it replaced were 7.2,
  // 10.2, 15.2 and 14.2.
  it("matches the white palette's measured values", () => {
    expect(contrast(PALETTES.lightIC.mutedInk, PALETTES.light.paper)).toBeCloseTo(8.56, 1);
    expect(contrast(PALETTES.darkIC.mutedInk, PALETTES.dark.paper)).toBeCloseTo(10.67, 1);
    expect(contrast(PALETTES.light.ink, PALETTES.light.paper)).toBeCloseTo(18.67, 1);
  });
});

describe("chartreuse is never text on chalk (brand/README.md)", () => {
  it("fails as text, so the light palette never uses it for text", () => {
    expect(contrast(PALETTES.light.highlight, PALETTES.light.paper)).toBeLessThan(TEXT);
    for (const tone of [PALETTES.light.ink, PALETTES.light.mutedInk, PALETTES.light.accent]) expect(tone).not.toBe(PALETTES.light.highlight);
  });
});

describe("highlights (PS-02)", () => {
  it.each(Object.entries(PALETTES))("%s: ink and the muted verse number read on every wash", (_name, p) => {
    for (const wash of Object.values(p.highlights)) {
      expect(contrast(p.ink, wash)).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(p.mutedInk, wash)).toBeGreaterThanOrEqual(MARK);
    }
  });

  it("dark: a verse still to come in read-along, in muted ink, reads as text on every wash", () => {
    for (const wash of Object.values(PALETTES.dark.highlights)) expect(contrast(PALETTES.dark.mutedInk, wash)).toBeGreaterThanOrEqual(TEXT);
  });
});

describe("selection is never carried by its wash alone", () => {
  it("the wash is too close to paper to read as a state (so the bar is required)", () => {
    for (const p of Object.values(PALETTES)) expect(contrast(p.selection, p.paper)).toBeLessThan(MARK);
  });
});

describe("avatar hues and circle tones (docs/colour-rules.md)", () => {
  it("deep hues take white initials and stand off white; pale hues take ink initials and stand off the forest", () => {
    for (const [hue, { deep, pale }] of Object.entries(AVATAR_HUES)) {
      expect(contrast(AVATAR_INK.onDeep, deep), `${hue} deep initials`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(PALETTES.light.paper, deep), `${hue} deep on white`).toBeGreaterThanOrEqual(3);
      expect(contrast(AVATAR_INK.onPale, pale), `${hue} pale initials`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(BRAND.forest, pale), `${hue} pale on forest`).toBeGreaterThanOrEqual(3);
      expect(contrast(PALETTES.dark.paper, pale), `${hue} pale on dark`).toBeGreaterThanOrEqual(3);
    }
  });
});
