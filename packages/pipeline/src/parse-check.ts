/**
 * Parse consistency: does what a lexical evidence note says about a word match
 * the morphology the source gives that word?
 *
 * CLAUDE.md rule 4: never state a parse or Strong's number the source data does
 * not contain. docs/milestone-0.md §"Fix before scaling" item 2 asked for this
 * rule after two parse findings that nothing mechanical caught: Sonnet called
 * מְנֻחוֹת construct where OSHB tags it `HNcbpa` (absolute), and Opus gave אֶרֶץ
 * a feminine gender where OSHB tags it `Ncbsa` (gender "both"). The fixture
 * 1co.14.34 had the same class of fault in code form: it cited "V-PAM-3P", a
 * Robinson-style code, where the supplied MorphGNT code is `V- 3PAD-P--`.
 *
 * A note can state a parse three ways, and each is checked:
 *
 *   codes      `HVqp3fs`, `Ncbsa`, `V- 3PAD-P--`. Every quoted code must be on
 *              some token the claim can see (an invented code is an invented
 *              parse), and at least one must be on the cited word itself —
 *              notes legitimately contrast codes ("HNcmpa against HVqp3ms"),
 *              so a code of a neighbouring word is allowed alongside.
 *   Strong's   a number written into the note must be on a token in scope.
 *   prose      "plural construct", "qal imperfect 1cs". Each named feature
 *              must be one the cited word's code carries. Only terms that are
 *              unambiguous as grammar are read: "present" and "middle" count
 *              only next to another grammatical term, and "common" not at all,
 *              because "common noun" is not a gender.
 *
 * Pure: it sees tokens, never the database, so validate-book owns the scope.
 */

import { canonicalStrongs } from "@yada/schema";

/** One source token as the check needs it. */
export interface ParseToken {
  surface: string;
  strongs: ReadonlySet<string>;
  /** The whole-word code as staging.db stores it: `HC/Vqq2ms`, `V- 3PAD-P--`. */
  morph: string;
  greek: boolean;
}

// ---------------------------------------------------------------------------
// Features a code carries
// ---------------------------------------------------------------------------

type Category = "stem" | "conjugation" | "tense" | "voice" | "mood" | "case" | "person" | "gender" | "number" | "state";
type Features = Map<Category, Set<string>>;

function add(features: Features, category: Category, ...values: Array<string | undefined>): void {
  for (const value of values) {
    if (value === undefined) continue;
    const set = features.get(category) ?? new Set<string>();
    set.add(value);
    features.set(category, set);
  }
}

// Stem names and their common transliterations. A Q ("qal passive") token also
// answers to "qal": the note named the stem family correctly.
const HEBREW_STEMS: Readonly<Record<string, readonly string[]>> = {
  q: ["qal"], N: ["niphal"], p: ["piel"], P: ["pual"], h: ["hiphil"], H: ["hophal"], t: ["hithpael"],
  o: ["polel"], O: ["polal"], r: ["hithpolel"], m: ["poel"], M: ["poal"], k: ["palel"], K: ["pulal"],
  Q: ["qal passive", "qal"], l: ["pilpel"], L: ["polpal"], f: ["hithpalpel"], D: ["nithpael"], j: ["pealal"],
  i: ["pilel"], u: ["hothpaal"], c: ["tiphil"], v: ["hishtaphel"], w: ["nithpalel"], y: ["nithpoel"], z: ["hithpoel"],
};
const ARAMAIC_STEMS: Readonly<Record<string, readonly string[]>> = {
  q: ["peal"], Q: ["peil"], u: ["hithpeel"], N: ["niphal"], p: ["pael"], P: ["ithpaal"], M: ["hithpaal"],
  a: ["aphel"], h: ["haphel"], s: ["saphel"], e: ["shaphel"], H: ["hophal"], i: ["ithpeel"], t: ["hishtaphel"],
  v: ["ishtaphel"], w: ["hithaphel"], o: ["polel"], z: ["hithpoel"], r: ["hithpolel"], f: ["hithpalpel"],
  b: ["hephal"], c: ["tiphel"], m: ["poel"], l: ["palpel"], L: ["ithpalpel"], O: ["ithpolel"], G: ["ittaphal"],
};
const ALL_STEM_NAMES = [...new Set([...Object.values(HEBREW_STEMS), ...Object.values(ARAMAIC_STEMS)].flat())];

// A sequential form is still a perfect or an imperfect; a note that says
// "perfect" of a weqatal has named the conjugation the code carries.
const H_CONJUGATION: Readonly<Record<string, readonly string[]>> = {
  p: ["perfect"], q: ["perfect", "sequential"], i: ["imperfect"], w: ["imperfect", "sequential"],
  h: ["cohortative"], j: ["jussive"], v: ["imperative"], r: ["participle", "active"], s: ["participle", "passive"],
  a: ["infinitive", "infinitive absolute"], c: ["infinitive", "infinitive construct"],
};
const H_GENDER: Readonly<Record<string, string>> = { b: "both", c: "common", f: "feminine", m: "masculine" };
const H_NUMBER: Readonly<Record<string, string>> = { d: "dual", p: "plural", s: "singular" };
const H_STATE: Readonly<Record<string, string>> = { a: "absolute", c: "construct", d: "determined" };

function gns(features: Features, code: string, from: number): void {
  add(features, "gender", H_GENDER[code[from] ?? ""]);
  add(features, "number", H_NUMBER[code[from + 1] ?? ""]);
  add(features, "state", H_STATE[code[from + 2] ?? ""]);
}

function pgn(features: Features, code: string, from: number): void {
  const person = code[from];
  if (person === "1" || person === "2" || person === "3") add(features, "person", person);
  add(features, "gender", H_GENDER[code[from + 1] ?? ""]);
  add(features, "number", H_NUMBER[code[from + 2] ?? ""]);
}

function hebrewPartFeatures(part: string, aramaic: boolean, features: Features): void {
  const type = part[1] ?? "";
  switch (part[0]) {
    case "A":
    case "N":
      gns(features, part, 2);
      return;
    case "P":
    case "S":
      pgn(features, part, 2);
      return;
    case "V": {
      add(features, "stem", ...((aramaic ? ARAMAIC_STEMS : HEBREW_STEMS)[type] ?? []));
      const conjugation = part[2] ?? "";
      add(features, "conjugation", ...(H_CONJUGATION[conjugation] ?? []));
      if (conjugation === "r" || conjugation === "s") gns(features, part, 3);
      else if (conjugation !== "a" && conjugation !== "c") pgn(features, part, 3);
      return;
    }
    default:
      return;
  }
}

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

/** Every feature a whole-word code carries, across all its morphemes. */
function codeFeatures(morph: string, greek: boolean): Features {
  const features: Features = new Map();
  if (greek) {
    const parsing = (morph.trim().split(/\s+/)[1] ?? "").padEnd(8, "-");
    const person = parsing[0];
    if (person === "1" || person === "2" || person === "3") add(features, "person", person);
    add(features, "tense", G_TENSE[parsing[1] ?? ""]);
    add(features, "voice", G_VOICE[parsing[2] ?? ""]);
    add(features, "mood", G_MOOD[parsing[3] ?? ""]);
    add(features, "case", G_CASE[parsing[4] ?? ""]);
    add(features, "number", G_NUMBER[parsing[5] ?? ""]);
    add(features, "gender", G_GENDER[parsing[6] ?? ""]);
    return features;
  }
  const body = sourceBody(morph);
  const aramaic = morph.startsWith("A");
  for (const part of body.split("/")) hebrewPartFeatures(part, aramaic, features);
  return features;
}

// ---------------------------------------------------------------------------
// Codes quoted in a note
// ---------------------------------------------------------------------------

/** MorphGNT: a two-character part of speech, a space, eight parsing slots. */
const MORPHGNT_CODE = /(?:[ACDINPVX]-|R[ADIPR]) [-123][-PIFAXY][-AMP][-IDSONP][-NGDAV][-SP][-MFN][-CS]/g;

/**
 * Robinson-style codes ("V-PAM-3P", "N-NFP") are what a model recalls from
 * other tools. MorphGNT never writes them, so one in a note is a parse the
 * supplied data does not contain, whatever it says.
 */
const ROBINSON_CODE = /(?<![\w-])(?:V|N|A|T|P|R|C|D|X|ADV|CONJ|PREP|PRT)-(?=[A-Z0-9-]*[A-Z])[A-Z0-9]+(?:-[A-Z0-9]+)*(?![\w-])/g;

/** One OSHB morpheme code, anchored. Shapes from the OpenScriptures morphology spec. */
const OSHB_PART =
  "(?:V[a-zA-Z][pqiwhjvrsac](?:[123][bcfm][dps]|[bcfm][dps][acd])?" +
  "|N[cgp](?:[bcfm][dps][acd])?|A[acgo](?:[bcfm][dps][acd])?" +
  "|P[dfipr](?:[123]?[bcfm]?[dps]?)|S[dhnp](?:[123][bcfm][dps])?" +
  "|T[adeijmnor]?|Rd?|C|D)";
const OSHB_BODY = new RegExp(`^${OSHB_PART}(?:/${OSHB_PART})*$`);

/**
 * The code without its language letter, or null if `run` is not a code.
 * "H" is never a part of speech, so it is always the letter; "A" is both
 * Aramaic and adjective, so it is the letter only when the rest is a code
 * and the whole is not (`ANcmsa` is Aramaic, `Aamsa` an adjective).
 */
function oshbBody(run: string): string | null {
  if (!run.startsWith("H") && OSHB_BODY.test(run)) return run;
  if (/^[HA]/.test(run) && OSHB_BODY.test(run.slice(1))) return run.slice(1);
  return null;
}

/**
 * A staging.db code without its language letter. staging.db always writes the
 * letter, so it is stripped even from a code this grammar does not know: a
 * rarer shape must not turn every note about that word into a finding.
 */
function sourceBody(morph: string): string {
  return morph.replace(/^[HA]/, "");
}

/**
 * A run counts as an OSHB code only when it could not be English: it carries
 * the language letter (`HNp`, `HTo`), or a slash, or is four or more
 * characters of code grammar (`Ncbsa`, `Sp1cs`). "To" and "C" are words.
 */
function isOshbCode(run: string): boolean {
  const body = oshbBody(run);
  if (body === null) return false;
  if (run.includes("/")) return true;
  if (body !== run) return run.length >= 3;
  return run.length >= 4;
}

export interface QuotedCodes {
  /** Codes in the supplied dataset's own format. */
  codes: string[];
  /** Codes in a format the supplied dataset never uses. */
  foreign: string[];
}

export function quotedCodes(note: string, greek: boolean): QuotedCodes {
  if (greek) {
    const codes = [...note.matchAll(MORPHGNT_CODE)].map((m) => m[0]);
    const rest = note.replace(MORPHGNT_CODE, " ");
    return { codes, foreign: [...rest.matchAll(ROBINSON_CODE)].map((m) => m[0]) };
  }
  const runs = note.match(/[A-Za-z0-9/]+/g) ?? [];
  return { codes: runs.map((r) => r.replace(/^\/+|\/+$/g, "")).filter(isOshbCode), foreign: [] };
}

/**
 * Is `quoted` this token's code? A Hebrew note may quote the whole word
 * (`HR/Ncmsc/Sp2ms`) or the morphemes it is about (`Ncmsc`, `Ncmsc/Sp2ms`).
 */
export function codeMatchesToken(quoted: string, token: ParseToken): boolean {
  if (token.greek) return quoted.replace(/\s+/g, " ").trim() === token.morph.replace(/\s+/g, " ").trim();
  // OSHB writes the language letter once per word; compare codes without it.
  const parts = sourceBody(token.morph).split("/");
  const wanted = (oshbBody(quoted) ?? quoted).split("/");
  for (let start = 0; start + wanted.length <= parts.length; start += 1) {
    if (wanted.every((w, i) => parts[start + i] === w)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Strong's numbers and prose parses stated in a note
// ---------------------------------------------------------------------------

function statedStrongs(note: string): string[] {
  return [...note.matchAll(/(?<![\w])([GH])(\d{1,5})([a-z])?(?![\w])/g)]
    .map((m) => canonicalStrongs(`${m[2] as string}${m[3] ?? ""}`, m[1] as "G" | "H"))
    .filter((s): s is string => s !== undefined);
}

/** A note's Strong's number without a homograph letter names every homograph. */
function strongsMatches(stated: string, token: ParseToken): boolean {
  if (token.strongs.has(stated)) return true;
  return /\d$/.test(stated) && [...token.strongs].some((s) => s.replace(/[a-z]$/, "") === stated);
}

const GREEK_MOODS = "indicative|imperative|subjunctive|optative|infinitive|participle";
const VOICES = "active|middle|passive";
const GREEK_TENSES = "present|imperfect|future|aorist|perfect|pluperfect";

function words(text: string, pattern: string): string[] {
  return [...text.matchAll(new RegExp(`\\b(?:${pattern})\\b`, "g"))].map((m) => m[0]);
}

/**
 * Where a note stops describing its own word. Notes go on to name what the
 * word agrees with or is contrasted with — "imperative with neuter plural
 * subject", "HVpp2ms alongside תַּעֲרֹךְ, an imperfect", "indicative, not
 * imperative" — and read whole, every one of those was a false finding in the
 * Milestone 0 responses (9 of 9). Only the head is read as the word's parse.
 */
const RELATIONAL =
  /[;(]|\b(?:with|against|alongside|not|rather|unlike|versus|vs|preceded|followed|agreeing|agrees|agreement|subject|object|compared|contrast)\b/;

export function headClause(note: string): string {
  const lower = note.toLowerCase();
  const at = lower.search(RELATIONAL);
  return at === -1 ? lower : lower.slice(0, at);
}

/** The grammatical features the head of a note's prose names. */
export function statedFeatures(note: string, greek: boolean): Features {
  const features: Features = new Map();
  // Apostrophes and hyphens vary ("niph'al", "third-person"); neither carries grammar.
  let text = headClause(note).replace(/[’'ʼ]/g, "").replace(/-/g, " ");

  for (const m of text.matchAll(/\b([123])([mfc])([sp])\b/g)) {
    add(features, "person", m[1]);
    add(features, "gender", H_GENDER[m[2] as string]);
    add(features, "number", H_NUMBER[m[3] as string]);
  }
  for (const m of text.matchAll(/\b(first|second|third|1st|2nd|3rd) person\b/g)) {
    add(features, "person", { first: "1", "1st": "1", second: "2", "2nd": "2", third: "3", "3rd": "3" }[m[1] as string]);
  }
  add(features, "number", ...words(text, "singular|plural|dual"));
  add(features, "gender", ...words(text, "masculine|feminine|neuter"));

  if (greek) {
    // "present" and "future" are ordinary English; they name a tense only
    // when another grammatical term follows. "middle" likewise.
    for (const m of text.matchAll(new RegExp(`\\b(present|future)(?= (?:${VOICES}|${GREEK_MOODS}|tense)\\b)`, "g"))) {
      add(features, "tense", m[1]);
    }
    add(features, "tense", ...words(text, "aorist|pluperfect|imperfect|perfect"));
    for (const m of text.matchAll(new RegExp(`\\b(?:${GREEK_TENSES}) (${VOICES})\\b|\\b(${VOICES})(?= (?:voice|${GREEK_MOODS})\\b)`, "g"))) {
      add(features, "voice", m[1] ?? m[2]);
    }
    add(features, "mood", ...words(text, GREEK_MOODS));
    add(features, "case", ...words(text, "nominative|genitive|dative|accusative|vocative"));
    return features;
  }

  // Infinitive construct and absolute are conjugations, not noun states.
  for (const m of text.matchAll(/\binfinitive (construct|absolute)\b/g)) add(features, "conjugation", `infinitive ${m[1] as string}`);
  text = text.replace(/\binfinitive (construct|absolute)\b/g, "infinitive");
  for (const m of text.matchAll(/\b(active|passive) participle\b/g)) add(features, "conjugation", m[1]);
  add(features, "conjugation", ...words(text, "perfect|imperfect|imperative|participle|infinitive|cohortative|jussive"));
  add(features, "state", ...words(text, "absolute|construct"));
  // Longest names first, so "qal passive" is not read as "qal" alone.
  const stems = [...ALL_STEM_NAMES].sort((a, b) => b.length - a.length);
  add(features, "stem", ...words(text, stems.map((s) => s.replace(" ", "\\s")).join("|")).map((s) => s.replace(/\s+/g, " ")));
  return features;
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

const PERSON_WORD: Readonly<Record<string, string>> = { "1": "first person", "2": "second person", "3": "third person" };

function describeValue(category: Category, value: string): string {
  return category === "person" ? (PERSON_WORD[value] ?? value) : value;
}

export interface ParseProblem {
  level: "error" | "warn";
  message: string;
}

/**
 * Problems with what `note` says about the word whose tokens are `cited`,
 * given every token the claim can see. Empty means the note is consistent with
 * the source. `cited` empty means the word itself was not found, which is a
 * different rule's finding, so nothing is reported here.
 *
 * One finding is a warning rather than an error: a note that quotes only other
 * words' codes. Opus's GEN.1.5 note on קָרָא ("The objects are tagged Rd/Ncbsa
 * and C/Rd/Ncmsa") is accurate about the objects; every code in it is in the
 * source, so nothing is invented, but the evidence points at the wrong word,
 * which a reviewer should see.
 */
export function checkNoteParse(
  lemma: string,
  note: string | undefined,
  cited: readonly ParseToken[],
  scope: readonly ParseToken[],
): ParseProblem[] {
  if (note === undefined || note.trim() === "" || cited.length === 0) return [];
  const greek = cited[0]?.greek ?? false;
  const problems: ParseProblem[] = [];
  const error = (message: string) => problems.push({ level: "error", message });
  const tagged = [...new Set(cited.map((t) => t.morph))].join(", ");

  const { codes, foreign } = quotedCodes(note, greek);
  for (const code of foreign) {
    error(`note on "${lemma}" quotes "${code}", which is not a ${greek ? "MorphGNT" : "OSHB"} code; the source tags it ${tagged}`);
  }
  const invented = codes.filter((code) => !scope.some((t) => codeMatchesToken(code, t)));
  for (const code of invented) {
    error(`note on "${lemma}" quotes ${code}, which no word in scope carries; the source tags "${lemma}" ${tagged}`);
  }
  const located = codes.filter((code) => !invented.includes(code));
  if (located.length > 0 && !located.some((code) => cited.some((t) => codeMatchesToken(code, t)))) {
    problems.push({
      level: "warn",
      message: `note on "${lemma}" quotes only other words' codes (${located.join(", ")}); the source tags "${lemma}" ${tagged}`,
    });
  }

  for (const strongs of statedStrongs(note)) {
    if (!scope.some((t) => strongsMatches(strongs, t))) {
      error(`note on "${lemma}" names ${strongs}, which does not occur in the entry's verse or any verse the claim cites`);
    }
  }

  const stated = statedFeatures(note, greek);
  const carried: Features = new Map();
  for (const token of cited) {
    for (const [category, values] of codeFeatures(token.morph, greek)) add(carried, category, ...values);
  }
  for (const [category, values] of stated) {
    const available = carried.get(category) ?? new Set<string>();
    for (const value of values) {
      if (available.has(value)) continue;
      const has = available.size === 0 ? `no ${category}` : `${category} ${[...available].map((v) => describeValue(category, v)).join("/")}`;
      error(`note on "${lemma}" states ${describeValue(category, value)}, but the source tags it ${tagged} (${has})`);
    }
  }
  return problems;
}
