/**
 * Matthew Henry's Concise Commentary on the Whole Bible, from the CrossWire SWORD module MHCC 2.0
 * (content/raw/matthew-henry, pinned by content/raw/matthew-henry.sha256). Henry comments section by
 * section, each opened by a "Verses 1-5" marker; a chapter's outline lists the same sections with a
 * one-line summary each. Data only: nothing here decides which summary a passage shows.
 *
 * Rule 9: the commentary quotes the KJV (public domain; the UK Crown-patent caveat recorded for the
 * KJV applies) and no licensed translation.
 */

import path from "node:path";

import { understandPaths, type UnderstandPaths } from "./package.js";
import { summarySentences } from "./passage.js";
import { decodeEntities, pinnedFile, zComEntries } from "./sword.js";

export const MHC_PINS = "matthew-henry.sha256";
export const MHC_DIR = "matthew-henry/unzipped/modules/comments/zcom/mhcc";

export interface MhcSection {
  /** USFM book code, as core names books ("DAN"). */
  book: string;
  c1: number;
  v1: number;
  c2: number;
  v2: number;
  /** Henry's comment on the section, verbatim apart from markup and whitespace. */
  text: string;
  sentences: string[];
  /** The chapter outline's line for this range ("He is cast into the lion's den."), where it has one. */
  outline: string | null;
}

const OSIS_TO_USFM: Readonly<Record<string, string>> = {
  Gen: "GEN", Exod: "EXO", Lev: "LEV", Num: "NUM", Deut: "DEU", Josh: "JOS", Judg: "JDG", Ruth: "RUT",
  "1Sam": "1SA", "2Sam": "2SA", "1Kgs": "1KI", "2Kgs": "2KI", "1Chr": "1CH", "2Chr": "2CH", Ezra: "EZR",
  Neh: "NEH", Esth: "EST", Job: "JOB", Ps: "PSA", Prov: "PRO", Eccl: "ECC", Song: "SNG", Isa: "ISA",
  Jer: "JER", Lam: "LAM", Ezek: "EZK", Dan: "DAN", Hos: "HOS", Joel: "JOL", Amos: "AMO", Obad: "OBA",
  Jonah: "JON", Mic: "MIC", Nah: "NAM", Hab: "HAB", Zeph: "ZEP", Hag: "HAG", Zech: "ZEC", Mal: "MAL",
  Matt: "MAT", Mark: "MRK", Luke: "LUK", John: "JHN", Acts: "ACT", Rom: "ROM", "1Cor": "1CO", "2Cor": "2CO",
  Gal: "GAL", Eph: "EPH", Phil: "PHP", Col: "COL", "1Thess": "1TH", "2Thess": "2TH", "1Tim": "1TI",
  "2Tim": "2TI", Titus: "TIT", Phlm: "PHM", Heb: "HEB", Jas: "JAS", "1Pet": "1PE", "2Pet": "2PE",
  "1John": "1JN", "2John": "2JN", "3John": "3JN", Jude: "JUD", Rev: "REV",
};

/** Titles ("Chapter 6", "Chapter Outline") are headings, not Henry's words; every other tag goes, its text kept. */
function plainText(osis: string): string {
  return decodeEntities(osis.replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .trim();
}

/**
 * Outline lines by verse range. Two forms occur: table rows ("<cell>The creation of light.</cell>
 * <cell>(3-5)</cell>") and running text with references ("The malice of Daniel's enemies.
 * (<reference osisRef="Dan.6.1-Dan.6.5">Dn 6:1-5</reference>)"). Both are brought to "line (a-b)". The
 * outline follows the chapter's last heading ("Chapter 6" or "Chapter Outline"); text before it is the
 * book's introduction.
 */
export function mhcOutline(osis: string): Map<string, string> {
  const heading = osis.lastIndexOf("</title>");
  const flat = plainText(
    osis.slice(heading < 0 ? 0 : heading).replace(/<reference osisRef="[^".]+\.\d+\.(\d+)(?:-[^".]+\.\d+\.(\d+))?"[^>]*>[\s\S]*?<\/reference>/g, (_m, a: string, b?: string) => (b === undefined ? a : `${a}-${b}`)),
  );
  const out = new Map<string, string>();
  for (const m of flat.matchAll(/([^()]+?)\s*\((\d+)(?:-(\d+))?\)/g)) {
    const line = (m[1] ?? "").trim();
    if (line !== "") out.set(`${m[2]}-${m[3] ?? m[2]}`, line);
  }
  return out;
}

const TOKEN =
  /<div\b[^>]*\bosisID="([^"]+)"[^>]*\btype="book"[^>]*\/>|<chapter n="(\d+)"[^>]*\bsID="[^"]*"[^>]*\/>|<chapter eID="[^"]*"\/>|<hi type="bold">Verses? (\d+)(?:-(\d+))?<\/hi>/g;

/**
 * Sections of every book in the module's OSIS stream (the entries joined in order). A section runs from
 * its marker to the next marker, the chapter's end or the next book; a chapter's text before its first
 * marker is the book introduction and the outline, which are not sections.
 *
 * 121 chapters (33 psalms, much of Chronicles) carry no marker: Henry comments on the whole chapter,
 * its outline line in the paragraph before the comment, which often opens with a dash ("Confidence in
 * God's grace and care." then "--"The Lord is my shepherd." …", Psalm 23). Such a chapter is one
 * section, verses 1 to 999 as the tN outlines write a whole chapter; the dash is dropped. A chapter of one
 * paragraph (Psalm 108, Ezekiel 41-48) is all comment, no outline; one whose only paragraph is a pointer
 * ("See II Kin. 18:17-37, and the commentary thereon.", Isaiah 36; "This chapter is the same as II Kin. 19.",
 * Isaiah 37 and 39) has no section. 1 Chronicles 17 opens the same way but goes on to comment, so it stays.
 */
export function mhcParse(osis: string): Map<string, MhcSection[]> {
  const books = new Map<string, MhcSection[]>();
  let book: string | null = null;
  let chapter = 0;
  let outline = new Map<string, string>();
  let open: { v1: number; v2: number; from: number } | null = null;
  /** Where the current chapter's text starts, while it has had no marker. */
  let unmarked: number | null = null;
  const push = (v1: number, v2: number, text: string, line: string | null): void => {
    if (book === null) return;
    const list = books.get(book) ?? [];
    list.push({ book, c1: chapter, v1, c2: chapter, v2, text, sentences: summarySentences(text), outline: line });
    books.set(book, list);
  };
  const close = (to: number): void => {
    if (open !== null) push(open.v1, open.v2, plainText(osis.slice(open.from, to)), outline.get(`${open.v1}-${open.v2}`) ?? null);
    open = null;
    if (unmarked !== null) {
      const region = osis.slice(unmarked, to);
      const head = region.slice(Math.max(0, region.lastIndexOf("</title>")));
      const split = /<div eID="[^"]*" type="x-p"\/>/.exec(head);
      const text = plainText(head.slice(split?.index ?? 0)).replace(/^--\s*/, "");
      const pointer = /^(?:See\b|This chapter is the same as\b)/.test(text) && summarySentences(text).length <= 1;
      if (text !== "" && !pointer) push(1, 999, text, split === null ? null : plainText(head.slice(0, split.index)) || null);
    }
    unmarked = null;
  };
  for (const m of osis.matchAll(TOKEN)) {
    const at = m.index;
    if (m[1] !== undefined) {
      close(at);
      book = OSIS_TO_USFM[m[1]] ?? null;
      chapter = 0;
    } else if (m[2] !== undefined) {
      close(at);
      chapter = Number(m[2]);
      unmarked = at + m[0].length;
      outline = new Map();
    } else if (m[3] !== undefined) {
      if (unmarked !== null) outline = mhcOutline(osis.slice(unmarked, at));
      unmarked = null;
      close(at);
      open = { v1: Number(m[3]), v2: Number(m[4] ?? m[3]), from: at + m[0].length };
    } else {
      close(at);
    }
  }
  close(osis.length);
  return books;
}

let cache: Map<string, MhcSection[]> | null = null;

/** The whole module, its six files each checked against matthew-henry.sha256 before they are read. */
export function loadMhc(options: { paths?: UnderstandPaths; verifyPins?: boolean } = {}): Map<string, MhcSection[]> {
  const raw = (options.paths ?? understandPaths()).raw;
  const file = (name: string): Buffer => pinnedFile(raw, MHC_PINS, path.posix.join(MHC_DIR, name), options.verifyPins ?? true);
  const osis = ["ot", "nt"].flatMap((t) => zComEntries(file(`${t}.bzs`), file(`${t}.bzv`), file(`${t}.bzz`))).join("\n");
  return mhcParse(osis);
}

/** Henry's sections for one book (USFM code), in order; empty for a book the module lacks. */
export function mhcSections(book: string): MhcSection[] {
  cache ??= loadMhc();
  return cache.get(book) ?? [];
}
