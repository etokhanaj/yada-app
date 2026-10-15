/**
 * Morphology codes into words a reader can use.
 *
 * The design brief's own example of the claim chain of custody is
 * "σιγάτωσαν → present active imperative, 3rd plural → MorphGNT/SBLGNT". A word
 * card that showed `V- 3PAD-P--` instead would be the interlinear-tool failure
 * the PRD positions against. This is a mechanical decoder of the two source
 * code systems, nothing more: it names what the dataset says and adds nothing.
 *
 *   Greek   MorphGNT: part of speech, then an 8-character parsing code —
 *           person, tense, voice, mood, case, number, gender, degree.
 *   Hebrew  OpenScriptures: a language letter (H Hebrew, A Aramaic), then one
 *           code per morpheme separated by "/".
 */

export interface MorphPart {
  /** "verb", "common noun", "definite article" … */
  partOfSpeech: string;
  /** "present active imperative, 3rd person plural"; empty when there is nothing more to say. */
  detail: string;
}

const join = (...words: Array<string | undefined>): string => words.filter((w) => w !== undefined && w !== "").join(" ");

// ---------------------------------------------------------------------------
// Greek
// ---------------------------------------------------------------------------

const GREEK_POS: Readonly<Record<string, string>> = {
  "A-": "adjective",
  "C-": "conjunction",
  "D-": "adverb",
  "I-": "interjection",
  "N-": "noun",
  "P-": "preposition",
  RA: "article",
  RD: "demonstrative pronoun",
  RI: "interrogative or indefinite pronoun",
  RP: "personal pronoun",
  RR: "relative pronoun",
  "V-": "verb",
  "X-": "particle",
};

const G_PERSON: Readonly<Record<string, string>> = { "1": "1st person", "2": "2nd person", "3": "3rd person" };
const G_TENSE: Readonly<Record<string, string>> = {
  P: "present", I: "imperfect", F: "future", A: "aorist", X: "perfect", Y: "pluperfect",
};
const G_VOICE: Readonly<Record<string, string>> = { A: "active", M: "middle", P: "passive" };
const G_MOOD: Readonly<Record<string, string>> = {
  I: "indicative", D: "imperative", S: "subjunctive", O: "optative", N: "infinitive", P: "participle",
};
const G_CASE: Readonly<Record<string, string>> = {
  N: "nominative", G: "genitive", D: "dative", A: "accusative", V: "vocative",
};
const G_NUMBER: Readonly<Record<string, string>> = { S: "singular", P: "plural" };
const G_GENDER: Readonly<Record<string, string>> = { M: "masculine", F: "feminine", N: "neuter" };
const G_DEGREE: Readonly<Record<string, string>> = { C: "comparative", S: "superlative" };

export function describeGreekMorph(morph: string): MorphPart {
  const [pos = "", parsing = ""] = morph.trim().split(/\s+/);
  const [person, tense, voice, mood, kase, number, gender, degree] = parsing.padEnd(8, "-").split("");
  const at = (table: Readonly<Record<string, string>>, key: string | undefined): string | undefined =>
    key === undefined ? undefined : table[key];

  const pieces: string[] = [];
  const moodName = at(G_MOOD, mood);
  if (moodName !== undefined) {
    pieces.push(join(at(G_TENSE, tense), at(G_VOICE, voice), moodName));
    if (mood === "P") pieces.push(join(at(G_CASE, kase), at(G_GENDER, gender), at(G_NUMBER, number)));
    else if (mood !== "N") pieces.push(join(at(G_PERSON, person), at(G_NUMBER, number)));
  } else {
    pieces.push(join(at(G_PERSON, person), at(G_CASE, kase), at(G_GENDER, gender), at(G_NUMBER, number)));
  }
  pieces.push(at(G_DEGREE, degree) ?? "");

  return {
    partOfSpeech: GREEK_POS[pos] ?? "word",
    detail: pieces.filter((p) => p !== "").join(", "),
  };
}

// ---------------------------------------------------------------------------
// Hebrew and Aramaic
// ---------------------------------------------------------------------------

const HEBREW_STEMS: Readonly<Record<string, string>> = {
  q: "qal", N: "niphal", p: "piel", P: "pual", h: "hiphil", H: "hophal", t: "hithpael",
  o: "polel", O: "polal", r: "hithpolel", m: "poel", M: "poal", k: "palel", K: "pulal",
  Q: "qal passive", l: "pilpel", L: "polpal", f: "hithpalpel", D: "nithpael", j: "pealal",
  i: "pilel", u: "hothpaal", c: "tiphil", v: "hishtaphel", w: "nithpalel", y: "nithpoel", z: "hithpoel",
};

const ARAMAIC_STEMS: Readonly<Record<string, string>> = {
  q: "peal", Q: "peil", u: "hithpeel", N: "niphal", p: "pael", P: "ithpaal", M: "hithpaal",
  a: "aphel", h: "haphel", s: "saphel", e: "shaphel", H: "hophal", i: "ithpeel", t: "hishtaphel",
  v: "ishtaphel", w: "hithaphel", o: "polel", z: "hithpoel", r: "hithpolel", f: "hithpalpel",
  b: "hephal", c: "tiphel", m: "poel", l: "palpel", L: "ithpalpel", O: "ithpolel", G: "ittaphal",
};

const H_CONJUGATION: Readonly<Record<string, string>> = {
  p: "perfect", q: "sequential perfect", i: "imperfect", w: "sequential imperfect",
  h: "cohortative", j: "jussive", v: "imperative", r: "participle", s: "passive participle",
  a: "infinitive absolute", c: "infinitive construct",
};
const H_PERSON: Readonly<Record<string, string>> = { "1": "1st person", "2": "2nd person", "3": "3rd person" };
const H_GENDER: Readonly<Record<string, string>> = { b: "both genders", c: "common", f: "feminine", m: "masculine" };
const H_NUMBER: Readonly<Record<string, string>> = { d: "dual", p: "plural", s: "singular" };
const H_STATE: Readonly<Record<string, string>> = { a: "absolute", c: "construct", d: "determined" };

const ADJECTIVE_TYPE: Readonly<Record<string, string>> = {
  a: "adjective", c: "cardinal number", g: "gentilic adjective", o: "ordinal number",
};
const NOUN_TYPE: Readonly<Record<string, string>> = { c: "common noun", g: "gentilic noun", p: "proper noun" };
const PRONOUN_TYPE: Readonly<Record<string, string>> = {
  d: "demonstrative pronoun", f: "indefinite pronoun", i: "interrogative pronoun",
  p: "personal pronoun", r: "relative pronoun",
};
const SUFFIX_TYPE: Readonly<Record<string, string>> = {
  d: "directional he", h: "paragogic he", n: "paragogic nun", p: "pronominal suffix",
};
const PARTICLE_TYPE: Readonly<Record<string, string>> = {
  a: "particle of affirmation", d: "definite article", e: "particle of exhortation",
  i: "interrogative particle", j: "interjection", m: "demonstrative particle",
  n: "negative particle", o: "direct object marker", r: "relative particle",
};

function gns(codes: string, from: number): string {
  return join(H_GENDER[codes[from] ?? ""], H_NUMBER[codes[from + 1] ?? ""], H_STATE[codes[from + 2] ?? ""]);
}

function describeHebrewPart(code: string, aramaic: boolean): MorphPart {
  const pos = code[0] ?? "";
  const type = code[1] ?? "";
  switch (pos) {
    case "A":
      return { partOfSpeech: ADJECTIVE_TYPE[type] ?? "adjective", detail: gns(code, 2) };
    case "C":
      return { partOfSpeech: "conjunction", detail: "" };
    case "D":
      return { partOfSpeech: "adverb", detail: "" };
    case "N":
      return { partOfSpeech: NOUN_TYPE[type] ?? "noun", detail: type === "p" ? "" : gns(code, 2) };
    case "P":
      return {
        partOfSpeech: PRONOUN_TYPE[type] ?? "pronoun",
        detail: join(H_PERSON[code[2] ?? ""], H_GENDER[code[3] ?? ""], H_NUMBER[code[4] ?? ""]),
      };
    case "R":
      return { partOfSpeech: type === "d" ? "preposition with article" : "preposition", detail: "" };
    case "S":
      return {
        partOfSpeech: SUFFIX_TYPE[type] ?? "suffix",
        detail: type === "p" ? join(H_PERSON[code[2] ?? ""], H_GENDER[code[3] ?? ""], H_NUMBER[code[4] ?? ""]) : "",
      };
    case "T":
      return { partOfSpeech: PARTICLE_TYPE[type] ?? "particle", detail: "" };
    case "V": {
      const stems = aramaic ? ARAMAIC_STEMS : HEBREW_STEMS;
      const conjugation = code[2] ?? "";
      const form = join(stems[type], H_CONJUGATION[conjugation]);
      let inflection = "";
      if (conjugation === "r" || conjugation === "s") inflection = gns(code, 3);
      else if (conjugation !== "a" && conjugation !== "c") {
        inflection = join(H_PERSON[code[3] ?? ""], H_GENDER[code[4] ?? ""], H_NUMBER[code[5] ?? ""]);
      }
      return { partOfSpeech: "verb", detail: [form, inflection].filter((p) => p !== "").join(", ") };
    }
    default:
      return { partOfSpeech: "word", detail: "" };
  }
}

/** One description per morpheme: `HR/Ncfsa` is a preposition and a noun. */
export function describeHebrewMorph(morph: string): MorphPart[] {
  const language = morph[0];
  const aramaic = language === "A";
  const body = language === "H" || language === "A" ? morph.slice(1) : morph;
  return body
    .split("/")
    .filter((part) => part.length > 0)
    .map((part) => describeHebrewPart(part, aramaic));
}

/**
 * Either script. Greek codes contain a space between part of speech and
 * parsing; Hebrew codes never do, which is how the two are told apart.
 */
export function describeMorph(morph: string): MorphPart[] {
  return /\s/.test(morph.trim()) ? [describeGreekMorph(morph)] : describeHebrewMorph(morph);
}

/** A single readable line: "preposition + common noun, feminine singular absolute". */
export function morphLine(morph: string): string {
  return describeMorph(morph)
    .map((part) => (part.detail === "" ? part.partOfSpeech : `${part.partOfSpeech}, ${part.detail}`))
    .join(" + ");
}

// ---------------------------------------------------------------------------
// Grammar terms (build 6, item H)
// ---------------------------------------------------------------------------

export type GrammarLanguage = "greek" | "hebrew" | "aramaic";

/** A grammar term in a word's Form line, keyed by language: Greek and Hebrew "imperfect" are different things. */
export interface GrammarTerm {
  label: string;
  language: GrammarLanguage;
}

export const grammarKey = (t: GrammarTerm): string => `${t.language}:${t.label}`;

/**
 * The terms a reader may not know, in the order the Form line says them: tense, voice, mood, case and
 * degree in Greek; stem, conjugation, state and the less common genders, numbers, suffixes and the
 * object marker in Hebrew and Aramaic. Person, gender, number and parts of speech are plain English.
 * Each label is the same word morphLine prints, so the screen and the grammar table never disagree.
 */
export function morphTerms(morph: string): GrammarTerm[] {
  const out: GrammarTerm[] = [];
  const add = (label: string | undefined, language: GrammarLanguage) => {
    if (label !== undefined && !out.some((t) => t.label === label && t.language === language)) out.push({ label, language });
  };
  if (/\s/.test(morph.trim())) {
    const [, parsing = ""] = morph.trim().split(/\s+/);
    const [, tense, voice, mood, kase, , , degree] = parsing.padEnd(8, "-").split("");
    add(G_TENSE[tense ?? ""], "greek");
    add(G_VOICE[voice ?? ""], "greek");
    add(G_MOOD[mood ?? ""], "greek");
    add(G_CASE[kase ?? ""], "greek");
    add(G_DEGREE[degree ?? ""], "greek");
    return out;
  }
  const language: GrammarLanguage = morph[0] === "A" ? "aramaic" : "hebrew";
  const body = morph[0] === "H" || morph[0] === "A" ? morph.slice(1) : morph;
  for (const code of body.split("/").filter((p) => p.length > 0)) {
    const pos = code[0] ?? "";
    const type = code[1] ?? "";
    let gns = "";
    if (pos === "V") {
      add((language === "aramaic" ? ARAMAIC_STEMS : HEBREW_STEMS)[type], language);
      const conjugation = code[2] ?? "";
      add(H_CONJUGATION[conjugation], language);
      if (conjugation === "r" || conjugation === "s") gns = code.slice(3, 6);
      else if (conjugation !== "a" && conjugation !== "c") gns = code.slice(4, 6);
    } else if (pos === "A" || (pos === "N" && type !== "p")) {
      gns = code.slice(2, 5);
    } else if (pos === "S" || pos === "P") {
      gns = code.slice(3, 5);
      if (pos === "S") add(SUFFIX_TYPE[type], language);
    } else if (pos === "T" && type === "o") {
      add(PARTICLE_TYPE[type], language);
    }
    const [g, n, s] = gns.split("");
    if (g === "b" || g === "c") add(H_GENDER[g], language);
    if (n === "d") add(H_NUMBER[n], language);
    add(H_STATE[s ?? ""], language);
  }
  return out;
}
