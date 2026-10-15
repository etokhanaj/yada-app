/**
 * Easton's Bible Dictionary (M. G. Easton, Illustrated Bible Dictionary, 3rd edition, Thomas Nelson,
 * 1897), from the CrossWire SWORD module Easton 2.0.1 (content/raw/easton, pinned by
 * content/raw/easton.sha256). One entry per person, place or term. Data only.
 *
 * Rule 9: Easton quotes the Authorised and Revised Versions (both public domain outside the KJV's UK
 * Crown patent) and no licensed translation.
 */

import path from "node:path";

import { understandPaths, type UnderstandPaths } from "./package.js";
import { decodeEntities, pinnedFile, zLdEntries, type LdEntry } from "./sword.js";

export const EASTON_PINS = "easton.sha256";
export const EASTON_DIR = "easton/unzipped/modules/lexdict/zld/easton";

export interface EastonEntry {
  /** As the entry's own title prints it ("Abimelech"). */
  headword: string;
  /** The entry's first sentence, verbatim. */
  first: string;
  /** The whole entry, markup removed, paragraphs joined by a blank line. */
  text: string;
}

/**
 * The first sentence: up to the first full stop, question or exclamation mark followed by a space and a
 * capital or an opening quote. A stop inside brackets ("(Gen. 20:1-18)") or after an abbreviation
 * ("Comp.", "i.e.") does not end it, since what follows is not a capital or sits inside the brackets.
 */
export function firstSentence(text: string): string {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "(" || ch === "[") depth += 1;
    else if ((ch === ")" || ch === "]") && depth > 0) depth -= 1;
    else if (depth === 0 && (ch === "." || ch === "?" || ch === "!")) {
      let j = i + 1;
      while (j < text.length && /[’”"')]/.test(text[j] ?? "")) j += 1;
      if (j >= text.length) return text;
      if (/\s/.test(text[j] ?? "") && /[A-Z“‘"(]/.test(text.slice(j).trimStart()[0] ?? "") && !/\b(?:[A-Z]|Comp|Gr|Heb|ver|vers|cf|viz|i\.e|e\.g|St|Mt|R\.V|A\.V)\.$/.test(text.slice(0, i + 1))) {
        return text.slice(0, j);
      }
    }
  }
  return text;
}

/** One entry's TEI as text: the title is the headword, each <p> a paragraph, references keep their printed words. */
export function eastonParse(entry: LdEntry): EastonEntry {
  const tei = entry.text;
  const title = /<title>([\s\S]*?)<\/title>/.exec(tei)?.[1];
  const headword = decodeEntities((title ?? entry.key).replace(/<[^>]+>/g, "")).trim();
  const paras = [...tei.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => decodeEntities((m[1] ?? "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim())
    .filter((p) => p !== "");
  const text = paras.join("\n\n");
  return { headword, first: firstSentence(paras[0] ?? ""), text };
}

let cache: Map<string, EastonEntry[]> | null = null;

/**
 * Every entry by upper-case key, the module files each checked against easton.sha256 before they are
 * read. Two headwords have two entries each, in Easton's order (Kadesh: the Hittite city, then
 * Kadesh-Barnea; Salmon: the hill, then the son of Nashon).
 */
export function loadEaston(options: { paths?: UnderstandPaths; verifyPins?: boolean } = {}): Map<string, EastonEntry[]> {
  const raw = (options.paths ?? understandPaths()).raw;
  const file = (name: string): Buffer => pinnedFile(raw, EASTON_PINS, path.posix.join(EASTON_DIR, name), options.verifyPins ?? true);
  const out = new Map<string, EastonEntry[]>();
  for (const e of zLdEntries(file("easton.idx"), file("easton.dat"), file("easton.zdx"), file("easton.zdt"))) {
    const key = e.key.toUpperCase();
    out.set(key, [...(out.get(key) ?? []), eastonParse(e)]);
  }
  return out;
}

/** Every entry under a name, matched without regard to case; empty when Easton has none. */
export function eastonEntries(name: string): EastonEntry[] {
  cache ??= loadEaston();
  return cache.get(name.trim().toUpperCase()) ?? [];
}

/** The (first) entry for a name ("Theophilus", "THEOPHILUS"); null when Easton has none. */
export function eastonEntry(name: string): EastonEntry | null {
  return eastonEntries(name)[0] ?? null;
}
