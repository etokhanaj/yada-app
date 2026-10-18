import { describe, expect, it } from "vitest";

import { HIGHLIGHT_COLORS, IMAGE_GROUNDS, isHighlightColor, isImageGround, isNoteTarget } from "./highlights";

describe("isHighlightColor", () => {
  it("takes PS-01's four colours only", () => {
    for (const color of HIGHLIGHT_COLORS) expect(isHighlightColor(color)).toBe(true);
    // "" is a cleared highlight's tombstone in user.db, never a colour to draw.
    for (const value of ["", "red", "Yellow", "#FFD60A", null, undefined, 1]) expect(isHighlightColor(value)).toBe(false);
  });
});

describe("isNoteTarget", () => {
  it("places a note on a verse or a whole chapter", () => {
    expect(isNoteTarget("JHN.3.16")).toBe(true);
    expect(isNoteTarget("JHN.3")).toBe(true);
  });

  it("refuses what another copy of the app might send that this one cannot place", () => {
    for (const key of ["", "JHN", "XYZ.3.16", "JHN.three", "JHN.3.16.2", "position"]) expect(isNoteTarget(key)).toBe(false);
  });
});

describe("isImageGround", () => {
  it("takes PS-05's four grounds only", () => {
    for (const ground of IMAGE_GROUNDS) expect(isImageGround(ground)).toBe(true);
    for (const value of ["", "black", "Picture", null, 0]) expect(isImageGround(value)).toBe(false);
  });
});
