/**
 * English verses with no original-language words under them.
 *
 * John decided (App v1 brief, decision 3): the English shows normally, and
 * Understand/Original carries a quiet note saying there is nothing underneath.
 * The wording is chosen per verse, because the core bundle has 36 such verses
 * and they are not all the same thing:
 *
 *   - Most are true omissions — verses the earliest Greek manuscripts do not
 *     contain, which SBLGNT therefore leaves out (John 7:53–8:11, Acts 8:37).
 *     Saying "the earliest manuscripts omit it" is accurate for these.
 *   - A few are numbering artefacts: the words exist in SBLGNT under a
 *     neighbouring verse number (2 Cor 13:14 is SBLGNT 13:13; Acts 19:41 is
 *     the end of SBLGNT 19:40), or the doxology of Romans moves between
 *     traditions (WEB prints it at 14:24–26). Telling a reader those verses
 *     are missing from the earliest manuscripts would state something the data
 *     does not show (handoff §3.4).
 *   - Romans 16:25–27 is a gap in Yada's own source: the pinned MorphGNT
 *     Romans file (66-Ro-morphgnt.txt) stops at 16:24. Neither the manuscript
 *     sentence nor the numbering one is true of it.
 *   - Nehemiah 7:68 is Hebrew: the Leningrad Codex has no such verse.
 *
 * Only the first group gets the manuscript sentence. Everything else gets the
 * plain, checkable statement that the base text has no words at this number.
 */

import type { BookCode } from "@yada/schema";

/** The verses SBLGNT omits because the earliest manuscripts lack them. */
export const MANUSCRIPT_OMISSIONS: ReadonlySet<string> = new Set([
  "MAT.17.21", "MAT.18.11", "MAT.23.14",
  "MRK.7.16", "MRK.9.44", "MRK.9.46", "MRK.11.26", "MRK.15.28",
  "LUK.17.36", "LUK.23.17",
  "JHN.5.4",
  "JHN.7.53", "JHN.8.1", "JHN.8.2", "JHN.8.3", "JHN.8.4", "JHN.8.5", "JHN.8.6",
  "JHN.8.7", "JHN.8.8", "JHN.8.9", "JHN.8.10", "JHN.8.11",
  "ACT.8.37", "ACT.15.34", "ACT.24.7", "ACT.28.29",
]);

/** Verses missing because the pinned source file stops short, not because any text omits them. */
export const SOURCE_GAPS: ReadonlySet<string> = new Set(["ROM.16.25", "ROM.16.26", "ROM.16.27"]);

export function isNewTestament(book: BookCode, testamentOf: (b: BookCode) => "OT" | "NT"): boolean {
  return testamentOf(book) === "NT";
}

/** John 7:53–8:11: one passage, so one sentence for all twelve verses (canvas N-01). */
const PERICOPE_ADULTERAE = new Set([
  "JHN.7.53", "JHN.8.1", "JHN.8.2", "JHN.8.3", "JHN.8.4", "JHN.8.5", "JHN.8.6",
  "JHN.8.7", "JHN.8.8", "JHN.8.9", "JHN.8.10", "JHN.8.11",
]);

/**
 * The note for a verse with no tokens, or null when the verse has tokens.
 * `script` is the book's original language.
 */
export function missingOriginalNote(verseId: string, script: "greek" | "hebrew", hasTokens: boolean): string | null {
  if (hasTokens) return null;
  if (PERICOPE_ADULTERAE.has(verseId)) {
    return "John 7:53–8:11 is not in the earliest manuscripts, so Yada’s Greek text has none of it.";
  }
  if (script === "hebrew") {
    return "There is no Hebrew for this verse. The Westminster Leningrad Codex, the Hebrew text Yada uses, has no words at this verse number.";
  }
  if (SOURCE_GAPS.has(verseId)) {
    return "There is no Greek for this verse in Yada yet. The MorphGNT data Yada's Greek comes from stops at Romans 16:24, so this is a gap in Yada's data, not a verse the manuscripts leave out.";
  }
  if (MANUSCRIPT_OMISSIONS.has(verseId)) {
    return "There is no Greek for this verse. The earliest manuscripts omit it, so SBLGNT, the Greek text Yada uses, does not include it. The English is shown as the translation prints it.";
  }
  return "There is no Greek at this verse number. SBLGNT, the Greek text Yada uses, numbers this passage differently, so its words are not attached to this verse.";
}
