import { describe, expect, it } from "vitest";

import { checkNoteParse, codeMatchesToken, headClause, quotedCodes, statedFeatures, type ParseToken } from "./parse-check.js";

/**
 * Parse consistency, against the incidents it exists for (docs/milestone-0.md
 * §"Strong's numbers and parses not in the supplied data"). Tokens carry the
 * codes staging.db holds for those words.
 */

const heb = (surface: string, strongs: string, morph: string): ParseToken => ({
  surface, strongs: new Set([strongs]), morph, greek: false,
});
const grk = (surface: string, strongs: string, morph: string): ParseToken => ({
  surface, strongs: new Set([strongs]), morph, greek: true,
});

// PSA.23.2 and GEN.1.2 as staging.db has them.
const meNuchot = heb("מְנֻחוֹת", "H4496", "HNcbpa");
const mei = heb("מֵי", "H4325", "HNcmpc");
const yarbitseni = heb("יַרְבִּיצֵנִי", "H7257", "HVhi3ms/Sp1cs");
const haarets = heb("וְהָאָרֶץ", "H0776", "HC/Td/Ncbsa");
const hayetah = heb("הָיְתָה", "H1961", "HVqp3fs");
const psa232 = [meNuchot, mei, yarbitseni];

// 1CO.14.34 as staging.db has it.
const sigatosan = grk("σιγάτωσαν", "G4601", "V- 3PAD-P--");
const gunaikes = grk("γυναῖκες", "G1135", "N- ----NPF-");
const cor1434 = [sigatosan, gunaikes];

const errors = (lemma: string, note: string, cited: ParseToken[], scope: ParseToken[]) =>
  checkNoteParse(lemma, note, cited, scope).filter((p) => p.level === "error").map((p) => p.message);

describe("codes quoted in a note", () => {
  it("refuses a Robinson-style code, which MorphGNT never writes (the 1co.14.34 fixture's V-PAM-3P)", () => {
    expect(errors("σιγάω", "V-PAM-3P", [sigatosan], cor1434).join(" ")).toMatch(/"V-PAM-3P", which is not a MorphGNT code; the source tags it V- 3PAD-P--/);
    expect(errors("γυνή", "N-NFP", [gunaikes], cor1434).join(" ")).toMatch(/N-NFP/);
  });

  it("accepts the supplied MorphGNT code", () => {
    expect(checkNoteParse("σιγάω", "V- 3PAD-P--", [sigatosan], cor1434)).toEqual([]);
  });

  it("refuses a code no word in scope carries: מְנֻחוֹת called construct in code form", () => {
    // Sonnet's psa.23.2-c3 error, had its note quoted a code instead of being empty.
    expect(errors("מְנוּחָה", "HNcbpc", [meNuchot], psa232).join(" ")).toMatch(/quotes HNcbpc, which no word in scope carries; the source tags "מְנוּחָה" HNcbpa/);
  });

  it("warns, not errors, when every quoted code belongs to a neighbouring word", () => {
    // Opus gen.1.5-c1 quoted the objects' codes on the verb: accurate, but about other words.
    const problems = checkNoteParse("מְנוּחָה", "HNcmpc", [meNuchot], psa232);
    expect(problems).toEqual([expect.objectContaining({ level: "warn", message: expect.stringMatching(/only other words' codes/) })]);
  });

  it("allows a contrast with a neighbour's code beside the word's own (golden gen.1.1 'HNcmpa against HVqp3ms')", () => {
    expect(checkNoteParse("מַיִם", "HNcmpc against HNcbpa", [mei], psa232)).toEqual([]);
  });

  it("matches a Hebrew morpheme or run of morphemes inside the whole-word code", () => {
    expect(codeMatchesToken("Vhi3ms", yarbitseni)).toBe(true);
    expect(codeMatchesToken("Vhi3ms/Sp1cs", yarbitseni)).toBe(true);
    expect(codeMatchesToken("HVhi3ms/Sp1cs", yarbitseni)).toBe(true);
    expect(codeMatchesToken("Ncbsa", haarets)).toBe(true);
    expect(codeMatchesToken("Vhi3mp", yarbitseni)).toBe(false);
    expect(codeMatchesToken("Sp1cs/Vhi3ms", yarbitseni)).toBe(false);
  });

  it("does not read English words as OSHB codes", () => {
    expect(quotedCodes("To the choirmaster. A psalm of David, C and D.", false).codes).toEqual([]);
    expect(quotedCodes("HNp followed by HTo and Ncbsa", false).codes).toEqual(["HNp", "HTo", "Ncbsa"]);
  });

  it("reads MorphGNT codes with their internal space", () => {
    expect(quotedCodes("N- ----ASM- preceded by RA ----ASM-", true).codes).toEqual(["N- ----ASM-", "RA ----ASM-"]);
  });
});

describe("Strong's numbers named in a note", () => {
  it("must be in scope", () => {
    expect(errors("רָבַץ", "compare H7462b in v. 1", [yarbitseni], psa232).join(" ")).toMatch(/names H7462b, which does not occur/);
  });

  it("accept a bare or unpadded number for a word the source gives a homograph letter", () => {
    const roi = heb("רֹעִי", "H7462b", "HVqrmsc/Sp1cs");
    expect(errors("רָעָה", "the participle H7462", [roi], [roi])).toEqual([]);
    expect(errors("רָעָה", "the participle H7462a", [roi], [roi]).join(" ")).toMatch(/H7462a/);
  });
});

describe("parses stated in prose", () => {
  it("refuses a state the code does not carry: Sonnet's 'plural construct' for מְנֻחוֹת", () => {
    expect(errors("מְנוּחָה", "plural construct noun", [meNuchot], psa232).join(" ")).toMatch(/states construct, but the source tags it HNcbpa \(state absolute\)/);
  });

  it("refuses a gender the code does not give: Opus's 'feminine' for אֶרֶץ, tagged gender both", () => {
    expect(errors("אֶרֶץ", "feminine singular noun with the article", [haarets], [haarets, hayetah]).join(" ")).toMatch(/states feminine.*gender both/);
  });

  it("accepts a parse that matches, including the suffix's person", () => {
    expect(errors("רָבַץ", "hiphil imperfect 3ms with 1cs suffix", [yarbitseni], psa232)).toEqual([]);
    expect(errors("רָעָה", "qal active participle, masculine singular construct, with 1cs suffix", [heb("רֹעִי", "H7462b", "HVqrmsc/Sp1cs")], [])).toEqual([]);
    expect(errors("שׁוּב", "parsed as a first-person singular perfect with waw", [heb("וְשַׁבְתִּי", "H3427", "HC/Vqq1cs")], [])).toEqual([]);
  });

  it("refuses a stem the code does not carry", () => {
    expect(errors("רָבַץ", "qal imperfect", [yarbitseni], psa232).join(" ")).toMatch(/states qal.*stem hiphil/);
  });

  it("reads only the head of a note, not the words it is contrasted with (9 of 9 Milestone 0 false findings)", () => {
    const ginestho = grk("γινέσθω", "G1096", "V- 3PMD-S--");
    expect(errors("γίνομαι", "third person singular present middle imperative with neuter plural subject", [ginestho], [ginestho])).toEqual([]);
    expect(errors("ὑποτάσσω", "present passive indicative, not imperative", [grk("ὑποτάσσεται", "G5293", "V- 3PPI-S--")], [])).toEqual([]);
    expect(headClause("HVpp2ms alongside תַּעֲרֹךְ, an imperfect")).toBe("hvpp2ms ");
  });

  it("refuses a Greek parse the code contradicts", () => {
    expect(errors("σιγάω", "aorist active imperative", [sigatosan], cor1434).join(" ")).toMatch(/states aorist.*tense present/);
  });

  it("does not read ordinary English as grammar", () => {
    // "present" and "middle" are tenses and voices only beside another grammatical term.
    expect(statedFeatures("present in the middle of the verse", true).size).toBe(0);
    expect(statedFeatures("a common noun", false).size).toBe(0);
    expect(statedFeatures("infinitive construct", false).get("state")).toBeUndefined();
  });

  it("reports nothing for a word the source does not have, which is another rule's finding", () => {
    expect(checkNoteParse("ἀγάπη", "aorist", [], cor1434)).toEqual([]);
  });
});
