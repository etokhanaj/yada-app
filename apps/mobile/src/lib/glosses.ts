/**
 * How a sourced gloss is shown. Decision 5 (9 Oct): TAHOT's `obj`, its marker
 * for the untranslatable direct-object particle אֵת, displays as `[object]` —
 * an abbreviation expanded, not a new gloss.
 */
export function displayGloss(gloss: string): string {
  return gloss.replace(/\bobj\b/gu, "[object]");
}
