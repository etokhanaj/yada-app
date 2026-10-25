import { describe, expect, it } from "vitest";

import { editDistance, moodFor, nearestWord } from "./search";

const VOCAB = [
  { term: "anxious", count: 12 },
  { term: "anxiety", count: 4 },
  { term: "peace", count: 400 },
  { term: "place", count: 900 },
  { term: "pence", count: 2 },
];

describe("did you mean (SE-32)", () => {
  it("counts a swap of neighbouring letters as one edit", () => {
    expect(editDistance("anxous", "anxious")).toBe(1);
    expect(editDistance("anxoius", "anxious")).toBe(1);
    expect(editDistance("peace", "grace")).toBe(2);
    expect(editDistance("", "abc")).toBe(3);
  });

  it("stops past the limit", () => {
    expect(editDistance("abcdefgh", "zyxwvuts", 2)).toBe(3);
    expect(editDistance("a", "abcdef", 2)).toBe(3);
  });

  it("offers the nearest word the Bible uses", () => {
    expect(nearestWord("anxous", VOCAB)).toBe("anxious");
    expect(nearestWord("Anxous ", VOCAB)).toBe("Anxious");
  });

  it("breaks a tie by how often the Bible uses the word", () => {
    // "peice" is one edit from both "peace" and "pence"; peace is the commoner.
    expect(nearestWord("peice", VOCAB)).toBe("peace");
  });

  it("offers nothing for a word the index holds, a short fragment, or one too far from any", () => {
    expect(nearestWord("peace", VOCAB)).toBeNull();
    expect(nearestWord("an", VOCAB)).toBeNull();
    expect(nearestWord("zzzzzz", VOCAB)).toBeNull();
  });

  it("names the mood a word is", () => {
    expect(moodFor("anxious")?.name).toBe("Anxious");
    expect(moodFor("Grieving")?.name).toBe("Grieving");
    expect(moodFor("peace")).toBeUndefined();
    expect(moodFor(null)).toBeUndefined();
  });
});
