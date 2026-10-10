import { describe, expect, it } from "vitest";

import { scriptureSegments, splitSupplied, spokenText, suppliedSlicer } from "./supplied";

const join = (pieces: ReadonlyArray<{ text: string }>) => pieces.map((p) => p.text).join("");

describe("splitSupplied", () => {
  it("marks each bracketed span, brackets kept", () => {
    const text = "In [the] beginning God created the heavens and the earth,";
    const pieces = splitSupplied(text);
    expect(pieces).toEqual([
      { text: "In ", supplied: false },
      { text: "[the]", supplied: true },
      { text: " beginning God created the heavens and the earth,", supplied: false },
    ]);
    expect(join(pieces)).toBe(text);
  });

  it("handles several spans and multi-word spans", () => {
    const text = "and God sees that [it is] good; whose seed [is] in itself";
    expect(splitSupplied(text).filter((p) => p.supplied).map((p) => p.text)).toEqual(["[it is]", "[is]"]);
  });

  it("leaves the double brackets around disputed passages alone", () => {
    const open = "They answered and said to him, “Are you also out of Galilee?”; [[";
    expect(splitSupplied(open)).toEqual([{ text: open, supplied: false }]);
    const inside = "preached everywhere, the LORD working with [them], and confirming the word. Amen.]]";
    expect(splitSupplied(inside).filter((p) => p.supplied).map((p) => p.text)).toEqual(["[them]"]);
    expect(splitSupplied("[[hard for you to kick at the goads”;").every((p) => !p.supplied)).toBe(true);
  });

  it("never changes a character of the text", () => {
    const text = "and [there] are three who are testifying [[in Heaven: the Father";
    expect(join(splitSupplied(text))).toBe(text);
  });
});

describe("scriptureSegments", () => {
  it("mutes supplied words in the LSV only, keeping LORD in small capitals", () => {
    const text = "the LORD [said] to him";
    const lsv = scriptureSegments(text, "LSV");
    expect(join(lsv)).toBe(text);
    expect(lsv.find((s) => s.text === "LORD")?.smallCaps).toBe(true);
    expect(lsv.find((s) => s.text === "[said]")?.supplied).toBe(true);
    expect(scriptureSegments("a [bracket] in another text", "YLT").some((s) => s.supplied === true)).toBe(false);
  });
});

describe("suppliedSlicer", () => {
  it("cuts a bracketed span that crosses words", () => {
    const text = "God sees that [it is] good";
    const slice = suppliedSlicer(text, "LSV");
    const it_ = text.indexOf("[it");
    expect(slice(it_, it_ + 3)).toEqual([{ text: "[it", supplied: true }]);
    expect(slice(it_ + 4, it_ + 7)).toEqual([{ text: "is]", supplied: true }]);
    expect(slice(0, 3)).toEqual([{ text: "God", supplied: false }]);
    expect(join(slice(0, text.length))).toBe(text);
    expect(suppliedSlicer(text, "WEB")(0, text.length)).toEqual([{ text, supplied: false }]);
  });
});

describe("spokenText", () => {
  it("reads the LSV without its single brackets", () => {
    expect(spokenText("In [the] beginning, [[and [it is] good]]", "LSV")).toBe("In the beginning, [[and it is good]]");
    expect(spokenText("In [the] beginning", "BSB")).toBe("In [the] beginning");
  });
});
