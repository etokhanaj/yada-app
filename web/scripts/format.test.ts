import { describe, expect, it } from "vitest";

import { bare, esc, ref, times } from "./format";

describe("ref", () => {
  it("writes a verse id as a reference that never splits across lines", () => {
    expect(ref("1CO.14.34")).toBe("1&nbsp;Corinthians&nbsp;14:34");
    expect(ref("JHN.1.1")).toBe("John&nbsp;1:1");
  });

  it("falls back to the book code for a book it does not name", () => {
    expect(ref("ROM.8.1")).toBe("ROM&nbsp;8:1");
  });
});

describe("times", () => {
  it("is singular for one and groups thousands", () => {
    expect(times(1)).toBe("1 time");
    expect(times(1307)).toBe("1,307 times");
  });
});

describe("esc", () => {
  it("escapes markup and quotes so source text cannot break the page", () => {
    expect(esc(`"<b>A & B</b>"`)).toBe("&quot;&lt;b&gt;A &amp; B&lt;/b&gt;&quot;");
  });
});

describe("bare", () => {
  // The word card shows "From θεός" only when the dictionary form differs from the word;
  // καὶ (grave) and καί (acute), or Ἐν and ἐν, are the same word and must not.
  it("ignores accents, breathings and case", () => {
    expect(bare("καὶ")).toBe(bare("καί"));
    expect(bare("Ἐν")).toBe(bare("ἐν"));
    expect(bare("λόγος")).toBe(bare("λόγος"));
  });

  it("still tells different forms apart", () => {
    expect(bare("θεόν")).not.toBe(bare("θεός"));
    expect(bare("ἦν")).not.toBe(bare("εἰμί"));
  });
});
