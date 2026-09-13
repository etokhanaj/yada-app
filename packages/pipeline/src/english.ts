/**
 * English translation texts — BSB, WEB and KJV — parsed into verse ids.
 *
 * All three use English (KJV-tradition) numbering, which is the canonical
 * scheme, so no renumbering happens here. One consequence worth knowing: a
 * Psalm superscription is printed *inside* English verse 1 ("A Psalm of David.
 * The LORD is my shepherd"), while the Hebrew places it at verse 0. The reader
 * therefore has no English row at verse 0, and the Original layer for verse 1
 * shows the superscription's Hebrew alongside it.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { BOOK_CODES, BOOK_ORDER, type BookCode } from "@yada/schema";

import { RAW } from "./paths.js";

export type TranslationCode = "BSB" | "WEB" | "KJV";
export const TRANSLATIONS: readonly TranslationCode[] = ["BSB", "WEB", "KJV"];

export interface VerseText {
  translation: TranslationCode;
  verse_id: string;
  text: string;
}

/** BSB prints full book names. Two differ from Yada's canonical names. */
const BSB_NAME_TO_CODE: ReadonlyMap<string, BookCode> = new Map<string, BookCode>([
  ...BOOK_ORDER.map((code) => [BOOK_CODES[code].name, code] as [string, BookCode]),
  ["Psalm", "PSA"],
  ["Song of Solomon", "SNG"],
]);

/**
 * eBible's VPL files use BibleWorks-style codes, which mostly but not always
 * match USFM. Every divergence is listed; an unknown code is an error rather
 * than a skipped book.
 */
const VPL_TO_CODE: Readonly<Record<string, BookCode>> = {
  SOL: "SNG", EZE: "EZK", JOE: "JOL", NAH: "NAM",
  MAR: "MRK", JOH: "JHN", PHI: "PHP", JAM: "JAS",
  "1JO": "1JN", "2JO": "2JN", "3JO": "3JN",
};

function vplCode(raw: string): BookCode {
  const mapped = VPL_TO_CODE[raw];
  if (mapped !== undefined) return mapped;
  if ((BOOK_ORDER as readonly string[]).includes(raw)) return raw as BookCode;
  throw new Error(`unknown VPL book code ${raw}`);
}

export function parseBsb(file = "bsb.txt"): VerseText[] {
  const out: VerseText[] = [];
  const line = /^(.+?) (\d+):(\d+)\t(.*)$/;
  for (const raw of readFileSync(path.join(RAW, file), "utf8").split("\n")) {
    const match = line.exec(raw.replace(/\r$/, ""));
    if (match === null) continue;
    const code = BSB_NAME_TO_CODE.get(match[1] ?? "");
    if (code === undefined) {
      if (match[1] === "Verse") continue; // the column header row
      throw new Error(`unknown BSB book name ${match[1]}`);
    }
    out.push({
      translation: "BSB",
      verse_id: `${code}.${Number(match[2])}.${Number(match[3])}`,
      text: tidy(match[4] ?? ""),
    });
  }
  return out;
}

export function parseVpl(file: string, translation: "WEB" | "KJV"): VerseText[] {
  const out: VerseText[] = [];
  const line = /^([1-3]?[A-Z]{2,3}) (\d+):(\d+) (.*)$/;
  for (const raw of readFileSync(path.join(RAW, file), "utf8").split("\n")) {
    const match = line.exec(raw.replace(/\r$/, ""));
    if (match === null) continue;
    const text = translation === "KJV" ? cleanKjv(match[4] ?? "") : tidy(match[4] ?? "");
    out.push({
      translation,
      verse_id: `${vplCode(match[1] ?? "")}.${Number(match[2])}.${Number(match[3])}`,
      text,
    });
  }
  return out;
}

/**
 * The 2006 KJV marks paragraph starts with a pilcrow and translator-supplied
 * words (the italics of a printed KJV) with square brackets. Both are removed
 * from display text; losing the italics distinction is recorded in the manifest.
 */
export function cleanKjv(text: string): string {
  return tidy(text.replace(/¶/g, "").replace(/[[\]]/g, ""));
}

function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export interface TextReport {
  byTranslation: Record<TranslationCode, number>;
}

export function loadTexts(): { texts: VerseText[]; report: TextReport } {
  const texts = [
    ...parseBsb(),
    ...parseVpl("engwebp_vpl.txt", "WEB"),
    ...parseVpl("eng-kjv2006_vpl.txt", "KJV"),
  ];
  const byTranslation = { BSB: 0, WEB: 0, KJV: 0 };
  for (const t of texts) byTranslation[t.translation] += 1;
  return { texts, report: { byTranslation } };
}
