/**
 * Search and alignment normalisation, shared by the pipeline and the app.
 *
 * The pipeline writes normalised keys into the bundle; the app normalises what
 * the reader types with the same functions. If the two ever used different
 * rules, a search for λόγος would silently find nothing — so there is exactly
 * one definition, here.
 */

/** Accents, breathings and case removed; final sigma folded; non-letters gone. */
export function normalizeGreek(surface: string): string {
  return surface
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/[^α-ω]/g, "");
}

const FINAL_FORMS: Readonly<Record<string, string>> = {
  "ך": "כ",
  "ם": "מ",
  "ן": "נ",
  "ף": "פ",
  "ץ": "צ",
};

/** Consonants only: pointing, cantillation, separators and punctuation removed. */
export function normalizeHebrew(surface: string): string {
  return surface.replace(/[^א-ת]/g, "").replace(/[ךםןףץ]/g, (c) => FINAL_FORMS[c] ?? c);
}

export type QueryScript = "greek" | "hebrew" | "latin";

/** Which kind of search a query is, from its first letter. */
export function detectScript(query: string): QueryScript {
  if (/[Ͱ-Ͽἀ-῿]/.test(query)) return "greek";
  if (/[֐-׿]/.test(query)) return "hebrew";
  return "latin";
}
