/**
 * The search field's direction, from the first strong character of what was
 * typed (brief §5: "The search field takes its direction from the first strong
 * character, not a fixed LTR"). So בְּרֵאשִׁית types right to left, and "jn 3 16",
 * λόγος or "בְּרֵאשִׁית in Genesis" keep the direction their first word sets.
 *
 * Digits, spaces, punctuation and combining marks (niqqud, Greek accents) are
 * not strong, as in the Unicode bidi algorithm's first-strong rule: "3:16" or a
 * bare vowel point decides nothing, and the field stays LTR like the page.
 */

export type FieldDirection = "ltr" | "rtl";

// JavaScript regexes have no Bidi_Class property, so RTL is named by script.
const RTL_LETTER = /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;
const LETTER = /\p{L}/u;

export function fieldDirection(text: string): FieldDirection {
  for (const ch of text) {
    if (!LETTER.test(ch)) continue;
    return RTL_LETTER.test(ch) ? "rtl" : "ltr";
  }
  return "ltr";
}
