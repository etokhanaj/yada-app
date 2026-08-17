/**
 * Mechanical transliteration. Best-effort and deliberately not asserted against
 * the golden fixtures: transliteration is a scholarly convention, not a fact,
 * and the hand-authored fixtures follow SBL-style choices a table cannot always
 * reproduce. The derive stage reports agreement as a percentage instead.
 */

const HEBREW_CONSONANTS: Readonly<Record<string, string>> = {
  "א": "ʾ", "ב": "b", "ג": "g", "ד": "d", "ה": "h",
  "ו": "w", "ז": "z", "ח": "ḥ", "ט": "ṭ", "י": "y",
  "ך": "k", "כ": "k", "ל": "l", "ם": "m", "מ": "m",
  "ן": "n", "נ": "n", "ס": "s", "ע": "ʿ", "ף": "p",
  "פ": "p", "ץ": "ṣ", "צ": "ṣ", "ק": "q", "ר": "r",
  "ש": "š", "ת": "t",
};

const HEBREW_VOWELS: Readonly<Record<string, string>> = {
  "ְ": "ə", "ֱ": "ĕ", "ֲ": "ă", "ֳ": "ŏ",
  "ִ": "i", "ֵ": "ē", "ֶ": "e", "ַ": "a",
  "ָ": "ā", "ֹ": "ō", "ֺ": "ō", "ֻ": "u",
};

/** Cantillation marks and other pointing that carries no vowel value. */
const HEBREW_SKIP = /[֑-ֽ֯-ׇֿ]/u;

export function transliterateHebrew(text: string): string {
  let out = "";
  for (const char of text.normalize("NFC")) {
    if (char === "/" || char === "־") continue;
    if (HEBREW_SKIP.test(char)) continue;
    if (char === "ּ") continue; // dagesh: gemination not represented
    const consonant = HEBREW_CONSONANTS[char];
    if (consonant !== undefined) {
      out += consonant;
      continue;
    }
    const vowel = HEBREW_VOWELS[char];
    if (vowel !== undefined) out += vowel;
  }
  return out;
}

const GREEK_LETTERS: Readonly<Record<string, string>> = {
  α: "a", β: "b", γ: "g", δ: "d", ε: "e", ζ: "z", η: "ē", θ: "th",
  ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
  ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "ph", χ: "ch", ψ: "ps", ω: "ō",
};

const ROUGH_BREATHING = "̔";

export function transliterateGreek(text: string): string {
  const decomposed = text.normalize("NFD");
  let out = "";
  let pendingRough = false;

  for (const char of decomposed) {
    if (char === ROUGH_BREATHING) {
      pendingRough = true;
      continue;
    }
    // Drop remaining combining marks: accents, smooth breathing, iota subscript.
    if (char >= "̀" && char <= "ͯ") continue;
    const letter = GREEK_LETTERS[char.toLowerCase()];
    if (letter === undefined) continue;
    out += pendingRough ? `h${letter}` : letter;
    pendingRough = false;
  }
  return out;
}

export function transliterate(text: string, script: "greek" | "hebrew"): string {
  return script === "hebrew" ? transliterateHebrew(text) : transliterateGreek(text);
}
