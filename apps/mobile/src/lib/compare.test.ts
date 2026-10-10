import { describe, expect, it } from "vitest";

import { comparingLabel, compareSelection, listAnd, parseCompareChoice, toggleCompare } from "./compare";

const installed = ["BSB", "WEB", "KJV", "LSV", "YLT", "ASV"];

describe("compareSelection", () => {
  it("defaults to the first three others in On your iPhone order", () => {
    expect(compareSelection("BSB", installed, null)).toEqual(["WEB", "KJV", "LSV"]);
    expect(compareSelection("KJV", installed, null)).toEqual(["BSB", "WEB", "LSV"]);
  });

  it("keeps a saved choice in On your iPhone order, capped at three", () => {
    expect(compareSelection("BSB", installed, ["YLT", "WEB"])).toEqual(["WEB", "YLT"]);
    expect(compareSelection("BSB", installed, ["ASV", "YLT", "LSV", "KJV"])).toEqual(["KJV", "LSV", "YLT"]);
  });

  it("drops the reader's own translation and anything no longer installed", () => {
    expect(compareSelection("YLT", installed, ["YLT", "ASV"])).toEqual(["ASV"]);
    expect(compareSelection("BSB", installed, ["MSB"])).toEqual(["WEB", "KJV", "LSV"]);
  });

  it("compares with what there is when fewer are installed", () => {
    expect(compareSelection("BSB", ["BSB", "WEB"], null)).toEqual(["WEB"]);
    expect(compareSelection("BSB", ["BSB"], null)).toEqual([]);
  });
});

describe("toggleCompare", () => {
  it("adds up to three and removes", () => {
    expect(toggleCompare(["WEB"], "KJV")).toEqual(["WEB", "KJV"]);
    expect(toggleCompare(["WEB", "KJV", "LSV"], "YLT")).toEqual(["WEB", "KJV", "LSV"]);
    expect(toggleCompare(["WEB", "KJV", "LSV"], "KJV")).toEqual(["WEB", "LSV"]);
  });
});

describe("parseCompareChoice", () => {
  it("reads the stored list and ignores junk", () => {
    expect(parseCompareChoice("WEB,KJV,LSV")).toEqual(["WEB", "KJV", "LSV"]);
    expect(parseCompareChoice("WEB, web,WEB,;drop")).toEqual(["WEB"]);
    expect(parseCompareChoice("")).toBeNull();
    expect(parseCompareChoice(undefined)).toBeNull();
  });
});

describe("comparingLabel", () => {
  it("is what VoiceOver says (plan, Compare cap)", () => {
    expect(comparingLabel(["WEB", "KJV", "LSV"])).toBe("Comparing with WEB, KJV and LSV");
    expect(comparingLabel(["WEB"])).toBe("Comparing with WEB");
    expect(listAnd(["WEB", "KJV"])).toBe("WEB and KJV");
  });
});
