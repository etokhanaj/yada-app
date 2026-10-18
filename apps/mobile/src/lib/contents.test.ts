import { BOOK_CODES, BOOK_ORDER } from "@yada/schema";
import { describe, expect, it } from "vitest";

import { booksAtoZ, contentsGroups, isBookOrder } from "./contents";

const names = (books: readonly (keyof typeof BOOK_CODES)[]) => books.map((b) => BOOK_CODES[b].name);

describe("Contents book order (CT-01, CT-02)", () => {
  it("A to Z sorts a numbered book by its name: 1 John under J", () => {
    const az = names(booksAtoZ());
    expect(az.slice(0, 14)).toEqual([
      "Acts", "Amos", "1 Chronicles", "2 Chronicles", "Colossians", "1 Corinthians", "2 Corinthians",
      "Daniel", "Deuteronomy", "Ecclesiastes", "Ephesians", "Esther", "Exodus", "Ezekiel",
    ]);
    const j = az.filter((n) => n.replace(/^\d\s/u, "").startsWith("J"));
    expect(j).toEqual(["James", "Jeremiah", "Job", "Joel", "John", "1 John", "2 John", "3 John", "Jonah", "Joshua", "Jude", "Judges"]);
    expect(az).toHaveLength(BOOK_ORDER.length);
  });

  it("A to Z is one list with no testament heading", () => {
    const groups = contentsGroups("az", "JHN");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBeNull();
  });

  it("Traditional keeps the testaments, the one being read first", () => {
    expect(contentsGroups("traditional", null).map((g) => g.title)).toEqual(["Old Testament", "New Testament"]);
    expect(contentsGroups("traditional", "1CO").map((g) => g.title)).toEqual(["New Testament", "Old Testament"]);
    expect(contentsGroups("traditional", "GEN")[0]?.books[0]).toBe("GEN");
  });

  it("reads back only the two orders it writes", () => {
    expect(isBookOrder("az")).toBe(true);
    expect(isBookOrder("traditional")).toBe(true);
    expect(isBookOrder("random")).toBe(false);
    expect(isBookOrder(undefined)).toBe(false);
  });
});
