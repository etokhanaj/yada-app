import { describe, expect, it } from "vitest";

import { splitScriptRuns } from "./lang";

describe("splitScriptRuns", () => {
  it("leaves plain English as one run", () => {
    expect(splitScriptRuns("Women are to be silent.")).toEqual([{ text: "Women are to be silent.", lang: null }]);
  });

  it("splits a Greek word out of an English claim (1 Cor 14:34)", () => {
    expect(splitScriptRuns("σιγάτωσαν is a present active imperative.")).toEqual([
      { text: "σιγάτωσαν", lang: "el" },
      { text: " is a present active imperative.", lang: null },
    ]);
  });

  it("keeps a Greek phrase together across its space", () => {
    expect(splitScriptRuns("The subject is αἱ γυναῖκες, a plural.")).toEqual([
      { text: "The subject is ", lang: null },
      { text: "αἱ γυναῖκες", lang: "el" },
      { text: ", a plural.", lang: null },
    ]);
  });

  it("keeps Hebrew with its niqqud and maqaf as one run (Gen 1:1)", () => {
    const runs = splitScriptRuns("בְּרֵאשִׁית בָּרָא opens the verse.");
    expect(runs).toEqual([
      { text: "בְּרֵאשִׁית בָּרָא", lang: "he" },
      { text: " opens the verse.", lang: null },
    ]);
    expect(splitScriptRuns("אֶת־הַשָּׁמַיִם")).toEqual([{ text: "אֶת־הַשָּׁמַיִם", lang: "he" }]);
  });

  it("keeps decomposed Greek accents on their letter", () => {
    const nfd = "λόγος".normalize("NFD");
    expect(splitScriptRuns(`the ${nfd} was`)).toEqual([
      { text: "the ", lang: null },
      { text: nfd, lang: "el" },
      { text: " was", lang: null },
    ]);
  });

  it("separates adjacent Greek and Hebrew", () => {
    expect(splitScriptRuns("ἀρχή and רֵאשִׁית").map((r) => r.lang)).toEqual(["el", null, "he"]);
  });

  it("never loses or reorders characters", () => {
    const text = "In ἀρχῇ (Gen 1:1, בְּרֵאשִׁית) — “in the beginning”.";
    expect(splitScriptRuns(text).map((r) => r.text).join("")).toBe(text);
  });
});
