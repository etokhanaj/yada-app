import { describe, expect, it } from "vitest";

import { mergeSaved, withKeptWord } from "./sitChoices";

describe("Choose a verse's Saved (SW-02)", () => {
  it("lists each kept verse once, newest first, with the newest way it was kept and its highlight colour", () => {
    const saved = mergeSaved(
      [{ verse_id: "PSA.46.10", created_at: "2026-10-20T10:00:00Z" }, { verse_id: "MAT.11.28", created_at: "2026-10-22T10:00:00Z" }],
      [{ verse_id: "PSA.46.10", color: "yellow", updated_at: "2026-10-23T10:00:00Z" }],
      [{ target: "JHN.2.4", updated_at: "2026-10-21T10:00:00Z" }],
    );
    expect(saved).toEqual([
      { verseId: "PSA.46.10", kept: "Highlighted", color: "yellow", at: "2026-10-23T10:00:00Z" },
      { verseId: "MAT.11.28", kept: "Bookmarked", color: null, at: "2026-10-22T10:00:00Z" },
      { verseId: "JHN.2.4", kept: "Note", color: null, at: "2026-10-21T10:00:00Z" },
    ]);
  });

  it("keeps the highlight's colour when a later bookmark names the row", () => {
    const [row] = mergeSaved([{ verse_id: "ISA.41.10", created_at: "2026-10-24T09:00:00Z" }], [{ verse_id: "ISA.41.10", color: "blue", updated_at: "2026-10-01T09:00:00Z" }], []);
    expect(row).toMatchObject({ kept: "Bookmarked", color: "blue" });
  });

  it("leaves out a note on a whole chapter", () => {
    expect(mergeSaved([], [], [{ target: "JHN.3", updated_at: "2026-10-24T09:00:00Z" }])).toEqual([]);
  });
});

describe("keeping a word (SW-06)", () => {
  it("adds the word on its own line under the note, never over it", () => {
    expect(withKeptWord("", "still,")).toBe("Kept: still");
    expect(withKeptWord("What did stillness mean here?", "still")).toBe("What did stillness mean here?\nKept: still");
  });

  it("does not keep the same word twice", () => {
    expect(withKeptWord("Kept: still", "still")).toBe("Kept: still");
  });

  it("keeps the word without its quotation marks", () => {
    expect(withKeptWord("", "“Come")).toBe("Kept: Come");
  });
});
