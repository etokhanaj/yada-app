import { describe, expect, it } from "vitest";

import { parseLesson } from "./office.js";

describe("Daily Office lessons", () => {
  it("reads the source's references, slips included, and marks books the BSB lacks", () => {
    expect(parseLesson("Isa 1:10–20")).toEqual({ ref: "Isa 1:10–20", book: "ISA", verses: "1:10–20" });
    expect(parseLesson("1 Cor5:1–8").book).toBe("1CO");
    expect(parseLesson("1 cor 5:1–8").book).toBe("1CO");
    expect(parseLesson("Sir 43:1–12(27–33)")).toEqual({ ref: "Sir 43:1–12(27–33)", book: null, verses: "43:1–12" });
  });

  it("skips a reference it cannot read rather than guess (rule 4)", () => {
    expect(parseLesson("Col (3:18–4:1)2–18")).toEqual({ ref: "Col (3:18–4:1)2–18", book: null, verses: "" });
  });
});
