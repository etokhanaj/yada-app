import { describe, expect, it } from "vitest";

import { MANUSCRIPT_OMISSIONS, missingOriginalNote, omittedVerseLine, SOURCE_GAPS } from "./omissions";

describe("verses with nothing underneath", () => {
  it("says nothing when the verse has original words", () => {
    expect(missingOriginalNote("JHN.1.1", "greek", true)).toBeNull();
  });

  it("names the manuscript omission for John 7:53–8:11, once for the passage (N-01)", () => {
    for (const id of ["JHN.7.53", "JHN.8.1", "JHN.8.11"]) {
      expect(missingOriginalNote(id, "greek", false)).toBe(
        "John 7:53–8:11 is not in the earliest manuscripts, so Yada’s Greek text has none of it.",
      );
    }
    expect(missingOriginalNote("ACT.8.37", "greek", false)).toMatch(/earliest manuscripts omit it/);
    expect([...MANUSCRIPT_OMISSIONS].filter((id) => id.startsWith("JHN.8") || id === "JHN.7.53")).toHaveLength(12);
  });

  it("does not claim a manuscript omission for a numbering difference", () => {
    const note = missingOriginalNote("2CO.13.14", "greek", false) ?? "";
    expect(note).not.toMatch(/manuscripts/);
    expect(note).toMatch(/numbers this passage differently/);
  });

  // Romans 16:25–27 had been given the numbering note: the pinned MorphGNT file
  // ends at 16:24, which is a gap in Yada's source, not in SBLGNT's numbering
  // and not a manuscript omission.
  it("calls Romans 16:25–27 a gap in Yada's data, not a manuscript omission", () => {
    for (const id of ["ROM.16.25", "ROM.16.26", "ROM.16.27"]) {
      const note = missingOriginalNote(id, "greek", false) ?? "";
      expect(note).toMatch(/gap in Yada's data/);
      expect(note).not.toMatch(/omit it|numbers this passage differently/);
    }
    expect(missingOriginalNote("ROM.16.24", "greek", true)).toBeNull();
  });

  it("keeps the manuscript and source-gap lists apart", () => {
    expect([...SOURCE_GAPS].filter((id) => MANUSCRIPT_OMISSIONS.has(id))).toEqual([]);
  });

  it("speaks of Hebrew in the Old Testament", () => {
    expect(missingOriginalNote("NEH.7.68", "hebrew", false)).toMatch(/no Hebrew/);
  });
});

describe("the note on a verse modern translations leave out (PD-06)", () => {
  it("says so in plain words for a listed omission", () => {
    expect(omittedVerseLine("JHN.5.4", "John")).toBe(
      "The oldest Greek manuscripts of John don’t have this verse, so modern translations leave it out. Later manuscripts add it, and the King James Version has it:",
    );
  });

  it("says nothing for a numbering difference or the passage in John 7:53–8:11", () => {
    expect(omittedVerseLine("2CO.13.14", "2 Corinthians")).toBeNull();
    expect(omittedVerseLine("JHN.8.3", "John")).toBeNull();
  });
});
