import { describe, expect, it } from "vitest";

import { MANUSCRIPT_OMISSIONS, missingOriginalNote } from "./omissions";

describe("verses with nothing underneath", () => {
  it("says nothing when the verse has original words", () => {
    expect(missingOriginalNote("JHN.1.1", "greek", true)).toBeNull();
  });

  it("names the manuscript omission for John 7:53–8:11", () => {
    for (const id of ["JHN.7.53", "JHN.8.1", "JHN.8.11"]) {
      expect(missingOriginalNote(id, "greek", false)).toMatch(/earliest manuscripts omit it/);
    }
    expect([...MANUSCRIPT_OMISSIONS].filter((id) => id.startsWith("JHN.8") || id === "JHN.7.53")).toHaveLength(12);
  });

  it("does not claim a manuscript omission for a numbering difference", () => {
    const note = missingOriginalNote("2CO.13.14", "greek", false) ?? "";
    expect(note).not.toMatch(/manuscripts/);
    expect(note).toMatch(/numbers this passage differently/);
  });

  it("speaks of Hebrew in the Old Testament", () => {
    expect(missingOriginalNote("NEH.7.68", "hebrew", false)).toMatch(/no Hebrew/);
  });
});
