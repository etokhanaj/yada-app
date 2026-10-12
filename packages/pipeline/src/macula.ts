/**
 * `yada package syntax` — MACULA Greek and Hebrew syntax trees, joined to core's tokens, in one
 * file (`syntax.vN.db`, DDL in @yada/schema syntax.ts).
 *
 * A free, non-AI evidence layer: every role, clause boundary, frame and referent here is MACULA's
 * own annotation, copied, never inferred (CLAUDE.md rule 4). Nothing is read into staging.db or a
 * prompt.
 *
 * Why the lowfat XML and not the TSV: the TSV is one row per word and has no clause or phrase
 * boundaries, which are the point of this layer; the Hebrew TSV is also a Git LFS pointer at the
 * pinned commit, not data. Lowfat is the tree with `class` and `role` written on each group, so
 * "subject of this clause" is read off the file rather than reconstructed.
 *
 * The join. MACULA numbers words by the edition's own verses ("JHN 1:1!3", Hebrew numbering for the
 * Old Testament); core keys tokens by English verse and position. The MorphGNT and OSHB parsers
 * report each token's source verse, so MACULA's words for a source verse are aligned to that verse's
 * tokens by surface (accent-stripped Greek, consonantal Hebrew), longest common subsequence. Words
 * that do not align keep their place in the tree with a NULL position and are counted, never dropped
 * or guessed: SBLGNT's John 7:53–8:11, which MorphGNT leaves out, and OSHB's ketiv/qere pairs (core
 * keeps both forms as tokens; MACULA has one) are the expected cases.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  BOOK_ORDER,
  SYNTAX_DDL,
  SYNTAX_FORMAT,
  type BookCode,
  type SyntaxLinkKind,
  parseVerseId,
  syntaxFileName,
  verseOrd,
} from "@yada/schema";

import { BUNDLES, freshDb, highestVersionOnDisk, sha256File } from "./package.js";
import { parseMorphGntWithCoverage, parseOshb, SBLGNT_TO_ENGLISH } from "./parsers.js";
import { RAW } from "./paths.js";
import { SOURCES, type SourceDef, type SourceFile } from "./sources.js";
import { gzipTranslation } from "./translations.js";

export class SyntaxRefused extends Error {}

// ---------------------------------------------------------------------------
// Lowfat XML
// ---------------------------------------------------------------------------

export interface LowfatNode {
  tag: string;
  cls: string | null;
  role: string | null;
  rule: string | null;
  cltype: string | null;
  nominalized: boolean;
  /** Index into `nodes`, or -1 at the top of a sentence. */
  parent: number;
  /** First and last word index (`t`, file-local) the group covers. */
  start: number;
  end: number;
}

export interface LowfatLink {
  kind: SyntaxLinkKind;
  arg: string;
  /** A MACULA xml:id, with Hebrew's missing `o` prefix restored. */
  target: string;
}

export interface LowfatWord {
  /** Position in the depth-first walk of the file, from 0. */
  t: number;
  id: string;
  book: BookCode;
  chapter: number;
  verse: number;
  /** MACULA's word number within the verse: the n of "JHN 1:1!n". */
  word: number;
  cls: string;
  role: string | null;
  surface: string;
  english: string | null;
  /** Innermost enclosing group, or -1. */
  node: number;
  links: LowfatLink[];
}

export interface Lowfat {
  words: LowfatWord[];
  nodes: LowfatNode[];
  /** Groups that enclosed no word, so have no span. */
  emptyGroups: number;
  /** Frame arguments MACULA names with no word ("A2:"). */
  emptyFrameArgs: number;
}

/** Elements that frame the text rather than parse it. Everything else that is not a word is a group. */
const FRAMING = new Set(["book", "chapter", "sentence", "milestone"]);

const TAG = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
const ATTR = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
const REF = /^([1-3A-Z]{3}) (\d+):(\d+)!(\d+)$/;

const decode = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

function attributes(text: string): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const match of text.matchAll(ATTR)) attrs.set(match[1] ?? "", decode(match[2] ?? ""));
  return attrs;
}

const nonEmpty = (value: string | undefined): string | null => (value === undefined || value.trim() === "" ? null : value);

/** Hebrew writes link targets without the `o` its xml:ids carry. */
const targetId = (id: string): string => (/^\d/.test(id) ? `o${id}` : id);

/**
 * `frame="A0:n43001005010 A1:n43001005011"` (Greek) or `frame="A0:010010010031; A1:010010010052;010010010072;"`
 * (Hebrew): each space-separated argument names one or more words.
 */
export function parseFrame(value: string): { links: LowfatLink[]; emptyArgs: number } {
  const links: LowfatLink[] = [];
  let emptyArgs = 0;
  for (const part of value.trim().split(/\s+/)) {
    const match = /^([A-Z]+\d*):(.*)$/.exec(part);
    if (match === null) throw new SyntaxRefused(`unreadable frame ${JSON.stringify(value)}`);
    const ids = (match[2] ?? "").split(";").filter((id) => id !== "");
    // Matt 18:24 writes "A2:" with no word after it: an argument MACULA names but does not fill.
    if (ids.length === 0) emptyArgs += 1;
    for (const id of ids) links.push({ kind: "frame", arg: match[1] ?? "", target: targetId(id) });
  }
  return { links, emptyArgs };
}

function referents(kind: SyntaxLinkKind, value: string): LowfatLink[] {
  return value
    .split(/[\s;]+/)
    .filter((id) => id !== "")
    .map((id) => ({ kind, arg: "", target: targetId(id) }));
}

export function parseLowfat(xml: string): Lowfat {
  const words: LowfatWord[] = [];
  const nodes: LowfatNode[] = [];
  let emptyGroups = 0;
  let emptyFrameArgs = 0;
  // Open groups, as indexes into `nodes`. Whether a group is empty is only known when it closes, so
  // every group is pushed and empty ones are removed at the end.
  const stack: Array<{ tag: string; node: number }> = [];
  let inParagraph = 0;
  let openWord: { attrs: Map<string, string>; textStart: number } | null = null;
  let cursor = 0;

  const addWord = (attrs: Map<string, string>, surface: string): void => {
    const id = attrs.get("xml:id");
    const ref = attrs.get("ref");
    const match = ref === undefined ? null : REF.exec(ref);
    if (id === undefined || match === null) throw new SyntaxRefused(`word without an id or a readable ref: ${id ?? ref ?? "?"}`);
    const book = match[1] as BookCode;
    if (!BOOK_ORDER.includes(book)) throw new SyntaxRefused(`unknown book in ${ref ?? ""}`);
    const links: LowfatLink[] = [];
    const frame = nonEmpty(attrs.get("frame"));
    if (frame !== null) {
      const parsed = parseFrame(frame);
      links.push(...parsed.links);
      emptyFrameArgs += parsed.emptyArgs;
    }
    for (const kind of ["referent", "subjref", "participantref"] as const) {
      const value = nonEmpty(attrs.get(kind));
      if (value !== null) links.push(...referents(kind, value));
    }
    const node = stack.at(-1)?.node ?? -1;
    words.push({
      t: words.length,
      id,
      book,
      chapter: Number(match[2]),
      verse: Number(match[3]),
      word: Number(match[4]),
      cls: attrs.get("class") ?? "",
      role: nonEmpty(attrs.get("role")),
      surface: surface.trim(),
      english: nonEmpty(attrs.get("english")),
      node,
      links,
    });
  };

  for (const match of xml.matchAll(TAG)) {
    const between = xml.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    const [whole, closing = "", name = "", attrText = "", selfClosing = ""] = match;
    if (whole.startsWith("<!--") || whole.startsWith("<?")) continue;
    if (openWord === null && inParagraph === 0 && between.trim() !== "") {
      throw new SyntaxRefused(`text outside a word: ${JSON.stringify(between.trim().slice(0, 40))}`);
    }

    if (name === "p") {
      inParagraph += closing === "/" ? -1 : selfClosing === "/" ? 0 : 1;
      continue;
    }
    // The paragraph is the verse text printed once more for reading; the words are in the tree.
    if (inParagraph > 0) continue;

    if (name === "w") {
      if (closing === "/") {
        if (openWord === null) throw new SyntaxRefused("</w> without <w>");
        addWord(openWord.attrs, decode(xml.slice(openWord.textStart, match.index)));
        openWord = null;
      } else if (selfClosing === "/") {
        addWord(attributes(attrText), "");
      } else {
        if (openWord !== null) throw new SyntaxRefused("a word inside a word");
        openWord = { attrs: attributes(attrText), textStart: cursor };
      }
      continue;
    }
    if (openWord !== null) throw new SyntaxRefused(`<${closing}${name}> inside a word`);
    if (FRAMING.has(name)) continue;

    if (closing === "/") {
      const open = stack.pop();
      if (open === undefined || open.tag !== name) throw new SyntaxRefused(`</${name}> does not close <${open?.tag ?? "nothing"}>`);
      const node = nodes[open.node];
      if (node !== undefined) node.end = words.length - 1;
      continue;
    }
    if (selfClosing === "/") {
      emptyGroups += 1;
      continue;
    }
    const attrs = attributes(attrText);
    const parent = stack.at(-1)?.node ?? -1;
    nodes.push({
      tag: name,
      cls: nonEmpty(attrs.get("class")),
      role: nonEmpty(attrs.get("role")),
      rule: nonEmpty(attrs.get("rule") ?? attrs.get("Rule")),
      cltype: nonEmpty(attrs.get("cltype")),
      nominalized: attrs.get("clauseType") === "nominalized" || attrs.get("clausetype") === "nominalized-clause",
      parent,
      start: words.length,
      end: words.length - 1,
    });
    stack.push({ tag: name, node: nodes.length - 1 });
  }
  if (stack.length > 0 || openWord !== null || inParagraph !== 0) throw new SyntaxRefused("the file ends inside an element");

  // Drop groups that enclosed no word, renumbering parents and words' nodes to match.
  const keep = nodes.map((n) => n.end >= n.start);
  emptyGroups += keep.filter((k) => !k).length;
  const renumber = new Map<number, number>();
  const kept: LowfatNode[] = [];
  nodes.forEach((node, index) => {
    if (!keep[index]) return;
    renumber.set(index, kept.length);
    kept.push(node);
  });
  for (const node of kept) node.parent = node.parent === -1 ? -1 : (renumber.get(node.parent) ?? -1);
  for (const word of words) word.node = word.node === -1 ? -1 : (renumber.get(word.node) ?? -1);
  return { words, nodes: kept, emptyGroups, emptyFrameArgs };
}

// ---------------------------------------------------------------------------
// The join
// ---------------------------------------------------------------------------

/**
 * The letters of a word only: Greek without accents or breathings (σ for ς), Hebrew without points.
 * Markup goes first: core bundles packaged before the 11 Oct 2026 OSHB fix (parsers.ts wordText)
 * still carry `<seg type="x-large">` on OSHB's eleven large, small and suspended letters (Deut 6:4's
 * ע and ד among them), whose Latin letters would otherwise stop those words joining.
 */
export function surfaceKey(surface: string): string {
  return surface
    .replace(/<[^>]*>/g, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}]/gu, "")
    .toLowerCase()
    .replace(/ς/g, "σ");
}

/** The word as written, points and accents included, without markup or punctuation. */
export function pointedForm(surface: string): string {
  return surface
    .replace(/<[^>]*>/g, "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}]/gu, "")
    .toLowerCase();
}

export interface CoreSlot {
  verseId: string;
  position: number;
  surface: string;
}

export interface AlignUnit {
  word: number;
  surface: string;
}

/**
 * The pairs `[unit index, slot index]` of a best alignment: a longest common subsequence where two
 * words pair only when their letters (`surfaceKey`) agree, and a pair whose points and accents also
 * agree outweighs one where they do not. The weight is for OSHB's ketiv/qere pairs, which core keeps
 * as two tokens: where the ketiv's consonants equal the qere's (2 Sam 18:20 על, Job 38:12 ידעתה),
 * letters alone would pair MACULA's pointed qere with the unpointed ketiv.
 */
export function align(units: readonly AlignUnit[], slots: readonly CoreSlot[]): Array<[number, number]> {
  const unitKeys = units.map((u) => surfaceKey(u.surface));
  const unitForms = units.map((u) => pointedForm(u.surface));
  const slotKeys = slots.map((s) => surfaceKey(s.surface));
  const slotForms = slots.map((s) => pointedForm(s.surface));
  const score = (i: number, j: number): number =>
    unitKeys[i] === "" || unitKeys[i] !== slotKeys[j] ? 0 : unitForms[i] === slotForms[j] ? 2 : 1;
  const n = units.length;
  const m = slots.length;
  const best = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    const row = best[i] as Uint16Array;
    const below = best[i + 1] as Uint16Array;
    for (let j = m - 1; j >= 0; j -= 1) {
      const s = score(i, j);
      row[j] = Math.max(below[j] ?? 0, row[j + 1] ?? 0, s === 0 ? 0 : s + (below[j + 1] ?? 0));
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const s = score(i, j);
    if (s > 0 && best[i]?.[j] === s + (best[i + 1]?.[j + 1] ?? 0)) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if ((best[i + 1]?.[j] ?? 0) >= (best[i]?.[j + 1] ?? 0)) i += 1;
    else j += 1;
  }
  return pairs;
}

export interface JoinedWord extends LowfatWord {
  ord: number;
  position: number | null;
}

export interface JoinCounts {
  /** MACULA words (orthographic words: a Hebrew word's morphs count once). */
  words: number;
  joined: number;
  /** Joined words whose letters agree with their token's but whose points or accents do not. */
  lettersOnly: number;
  /** MACULA words in a verse where core has no token at all. */
  noCoreVerse: number;
  /** MACULA words whose verse has core tokens, none of which they align to. */
  unaligned: number;
  /** Core tokens in the joined verses that no MACULA word aligned to. */
  coreUnmatched: number;
  /** Up to 20 examples of each kind, as "VERSE!n surface". */
  examples: { noCoreVerse: string[]; unaligned: string[]; coreUnmatched: string[]; lettersOnly: string[] };
}

export const emptyCounts = (): JoinCounts => ({
  words: 0,
  joined: 0,
  lettersOnly: 0,
  noCoreVerse: 0,
  unaligned: 0,
  coreUnmatched: 0,
  examples: { noCoreVerse: [], unaligned: [], coreUnmatched: [], lettersOnly: [] },
});

const example = (list: string[], text: string): void => {
  if (list.length < 20) list.push(text);
};

/**
 * Join one book's MACULA words to core tokens. `slots` maps a source verse id ("JHN.1.1", in the
 * edition's numbering) to that verse's tokens in reading order; `fallbackVerse` gives the English
 * verse id for a source verse with no tokens (Greek: SBLGNT's two renumbered verses; Hebrew: none).
 */
export function joinWords(
  words: readonly LowfatWord[],
  slots: ReadonlyMap<string, readonly CoreSlot[]>,
  counts: JoinCounts,
  fallbackVerse: (sourceVerse: string) => string | null,
): JoinedWord[] {
  const byVerse = new Map<string, LowfatWord[]>();
  for (const w of words) {
    const id = `${w.book}.${w.chapter}.${w.verse}`;
    const list = byVerse.get(id);
    if (list === undefined) byVerse.set(id, [w]);
    else list.push(w);
  }
  const placed = new Map<LowfatWord, { verseId: string; position: number | null }>();
  for (const [sourceVerse, verseWords] of byVerse) {
    // A Hebrew word is several morphs sharing a word number; they align as one unit, in id order.
    const groups = new Map<number, LowfatWord[]>();
    for (const w of [...verseWords].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
      const group = groups.get(w.word);
      if (group === undefined) groups.set(w.word, [w]);
      else group.push(w);
    }
    const ordered = [...groups.entries()].sort((a, b) => a[0] - b[0]);
    const units = ordered.map(([word, group]) => ({ word, surface: group.map((g) => g.surface).join("") }));
    const verseSlots = slots.get(sourceVerse) ?? [];
    counts.words += units.length;

    if (verseSlots.length === 0) {
      const english = fallbackVerse(sourceVerse);
      if (english === null) throw new SyntaxRefused(`no English verse for MACULA's ${sourceVerse}`);
      for (const [word, group] of ordered) {
        counts.noCoreVerse += 1;
        example(counts.examples.noCoreVerse, `${sourceVerse}!${word} ${group.map((g) => g.surface).join("")}`);
        for (const g of group) placed.set(g, { verseId: english, position: null });
      }
      continue;
    }

    const pairs = align(units, verseSlots);
    const unitSlot = new Map(pairs);
    const matchedSlots = new Set(pairs.map(([, j]) => j));
    verseSlots.forEach((slot, j) => {
      if (matchedSlots.has(j)) return;
      counts.coreUnmatched += 1;
      example(counts.examples.coreUnmatched, `${slot.verseId}#${slot.position} ${slot.surface}`);
    });
    ordered.forEach(([word, group], i) => {
      const j = unitSlot.get(i);
      if (j !== undefined) {
        const slot = verseSlots[j] as CoreSlot;
        counts.joined += 1;
        if (pointedForm(units[i]?.surface ?? "") !== pointedForm(slot.surface)) {
          counts.lettersOnly += 1;
          example(counts.examples.lettersOnly, `${sourceVerse}!${word} ${units[i]?.surface ?? ""} ~ ${slot.surface}`);
        }
        for (const g of group) placed.set(g, { verseId: slot.verseId, position: slot.position });
        return;
      }
      counts.unaligned += 1;
      example(counts.examples.unaligned, `${sourceVerse}!${word} ${group.map((g) => g.surface).join("")}`);
      // Its English verse is that of the nearest aligned word before it, else after it, else the
      // verse's first token: a word cannot move verse in the join, only fail to find its token.
      const before = [...pairs].reverse().find(([k]) => k < i);
      const after = pairs.find(([k]) => k > i);
      const neighbour = before ?? after;
      const verseId = verseSlots[neighbour === undefined ? 0 : neighbour[1]]?.verseId ?? sourceVerse;
      for (const g of group) placed.set(g, { verseId, position: null });
    });
  }
  return words.map((w) => {
    const place = placed.get(w);
    const ref = place === undefined ? null : parseVerseId(place.verseId);
    if (place === undefined || ref === null) throw new SyntaxRefused(`MACULA word ${w.id} was not placed`);
    return { ...w, ord: verseOrd(ref.book, ref.chapter, ref.verse), position: place.position };
  });
}

// ---------------------------------------------------------------------------
// Packaging
// ---------------------------------------------------------------------------

/** MACULA Greek's book files are numbered 01–27 from Matthew; our order puts Matthew 40th. */
function greekFileBook(file: string): BookCode | undefined {
  const match = /^macula-greek-(\d\d)-/.exec(file);
  return match === null ? undefined : BOOK_ORDER[38 + Number(match[1])];
}

function hebrewFileBook(file: string): BookCode | undefined {
  const match = /^macula-hebrew-(\d\d)-/.exec(file);
  return match === null ? undefined : BOOK_ORDER[Number(match[1]) - 1];
}

/** MorphGNT's own book numbers start at 61 for Matthew; OSHB files are named by OSIS book. */
function morphgntFileBook(file: string): BookCode | undefined {
  const match = /^(\d\d)-/.exec(file);
  return match === null ? undefined : BOOK_ORDER[Number(match[1]) - 22];
}

const OSHB_FILE_BOOK = new Map<string, BookCode>(
  ["Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam", "2Sam", "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh", "Esth", "Job", "Ps", "Prov", "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos", "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal"].map(
    (name, i) => [`${name}.xml`, BOOK_ORDER[i] as BookCode],
  ),
);

/** The licence statement each LICENSE.md must still make, and the attribution it asks for. */
export const MACULA_LICENCE: Readonly<Record<"greek" | "hebrew", readonly string[]>> = {
  greek: [
    "is licensed under [CC BY 4.0 ](http://creativecommons.org/licenses/by/4.0/)",
    'You must attribute the work as follows: "MACULA Greek Linguistic Datasets, available at https://github.com/Clear-Bible/macula-greek/"',
  ],
  hebrew: [
    "is licensed under [CC BY 4.0 ](http://creativecommons.org/licenses/by/4.0/)",
    'You must attribute the work as follows: "MACULA Hebrew Linguistic Datasets, available at https://github.com/Clear-Bible/macula-hebrew/"',
  ],
};

/** Any of these in a licence file means the terms changed to something this layer cannot ship. */
const RESTRICTIVE = /NonCommercial|NoDerivatives|ShareAlike|BY-NC|BY-ND|BY-SA/i;

export function checkMaculaLicence(lang: "greek" | "hebrew", text: string): void {
  for (const phrase of MACULA_LICENCE[lang]) {
    if (!text.includes(phrase)) throw new SyntaxRefused(`macula-${lang}-LICENSE.md no longer says: ${phrase}`);
  }
  const restrictive = RESTRICTIVE.exec(text);
  if (restrictive !== null) throw new SyntaxRefused(`macula-${lang}-LICENSE.md now mentions ${restrictive[0]}`);
}

export interface SyntaxReport {
  file: string;
  version: number;
  sha256: string;
  bytes: number;
  gzipBytes: number;
  reused: boolean;
  books: number;
  nodes: number;
  clauses: number;
  rows: number;
  links: number;
  /** Link targets naming an id that is not a word in the files. */
  danglingLinks: number;
  danglingExamples: string[];
  emptyGroups: number;
  emptyFrameArgs: number;
  join: { greek: JoinCounts; hebrew: JoinCounts };
  /** Joined words whose core token, looked up in the core bundle, has a different surface. */
  coreMismatches: string[];
  /** The core bundle the join was checked against, or null when there was none. */
  core: string | null;
}

export interface PackageSyntaxOptions {
  rawDir?: string;
  outDir?: string;
  /** The core bundle to check the join against. Default: the highest core.vN.db in outDir. */
  corePath?: string;
  /** Build only these books (tests). Default: all 66. */
  books?: readonly BookCode[];
  /**
   * Check every listed file against its pinned digest first. Off only for tests, whose fixtures
   * are excerpts; then files a book lists but the raw directory lacks are skipped.
   */
  verifyPins?: boolean;
}

function sourceDef(key: string): SourceDef {
  const def = SOURCES.find((s) => s.key === key);
  if (def === undefined) throw new SyntaxRefused(`${key} has no source entry`);
  return def;
}

function verifyPin(rawDir: string, file: SourceFile): void {
  const full = path.join(rawDir, file.file);
  if (!existsSync(full)) throw new SyntaxRefused(`${file.file} is not in ${rawDir}; run \`yada ingest\``);
  const actual = sha256File(full);
  if (actual !== file.sha256) throw new SyntaxRefused(`${file.file} is sha256 ${actual}, pinned ${file.sha256 ?? "nothing"}`);
}

function latestCore(dir: string): string | null {
  const version = highestVersionOnDisk("core", dir);
  return version === 0 ? null : path.join(dir, `core.v${version}.db`);
}

export function packageSyntax(options: PackageSyntaxOptions = {}): SyntaxReport {
  const rawDir = options.rawDir ?? RAW;
  const outDir = options.outDir ?? BUNDLES;
  const verifyPins = options.verifyPins ?? true;
  const wanted = new Set<BookCode>(options.books ?? BOOK_ORDER);
  const greek = sourceDef("macula-greek");
  const hebrew = sourceDef("macula-hebrew");
  const morphgnt = sourceDef("morphgnt");
  const oshb = sourceDef("oshb");

  if (verifyPins) for (const file of [...greek.files, ...hebrew.files]) verifyPin(rawDir, file);
  const present = (file: SourceFile): boolean => verifyPins || existsSync(path.join(rawDir, file.file));

  // The licence comes from the repository's own LICENSE.md, every build (CLAUDE.md rule 3).
  const notices = { greek: "", hebrew: "" };
  for (const lang of ["greek", "hebrew"] as const) {
    const file = path.join(rawDir, `macula-${lang}-LICENSE.md`);
    if (!existsSync(file)) throw new SyntaxRefused(`macula-${lang}-LICENSE.md is not in ${rawDir}; run \`yada ingest\``);
    notices[lang] = readFileSync(file, "utf8").replace(/\r\n/g, "\n").trim();
    checkMaculaLicence(lang, notices[lang]);
  }

  const corePath = options.corePath ?? latestCore(outDir);
  const core = corePath !== null && existsSync(corePath) ? new DatabaseSync(corePath, { readOnly: true }) : null;
  const coreToken = core?.prepare("SELECT surface FROM tokens WHERE ord = ? AND position = ?");

  mkdirSync(outDir, { recursive: true });
  const tmp = path.join(outDir, "syntax.building.db");
  const out = freshDb(tmp, SYNTAX_DDL);
  out.exec("BEGIN");
  const meta = out.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  meta.run("format", String(SYNTAX_FORMAT));
  meta.run("review", "none: MACULA's annotations copied as published, never Yada's explanations");
  const insertSource = out.prepare(
    "INSERT INTO sources (id, key, name, license, license_notice, attribution, homepage, commit_hash, modifications) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const SOURCE_ID = { hebrew: 1, greek: 2 } as const;
  insertSource.run(SOURCE_ID.hebrew, hebrew.key, hebrew.dataset, hebrew.license, notices.hebrew, hebrew.attribution_text, hebrew.homepage, hebrew.commit, hebrew.modifications);
  insertSource.run(SOURCE_ID.greek, greek.key, greek.dataset, greek.license, notices.greek, greek.attribution_text, greek.homepage, greek.commit, greek.modifications);

  const insertNode = out.prepare(
    "INSERT INTO nodes (id, parent, start_t, end_t, tag, class, role, rule, cltype, nominalized, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertWord = out.prepare(
    "INSERT INTO words (t, ord, position, word, macula_id, node, class, role, surface, english) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertLink = out.prepare("INSERT OR IGNORE INTO links (t, kind, arg, target_t) VALUES (?, ?, ?, ?)");

  const join = { greek: emptyCounts(), hebrew: emptyCounts() };
  const coreMismatches: string[] = [];
  let tBase = 0;
  let nodeBase = 0;
  let rows = 0;
  let links = 0;
  let danglingLinks = 0;
  const danglingExamples: string[] = [];
  const tOf = new Map<string, number>();
  const pending: Array<{ t: number; link: LowfatLink }> = [];
  let emptyGroups = 0;
  let emptyFrameArgs = 0;
  let clauses = 0;
  const books = new Set<BookCode>();

  for (const book of BOOK_ORDER) {
    if (!wanted.has(book)) continue;
    const lang = BOOK_ORDER.indexOf(book) < 39 ? "hebrew" : "greek";
    const def = lang === "greek" ? greek : hebrew;
    const maculaFiles = def.files.filter(
      (f) => (lang === "greek" ? greekFileBook(f.file) : hebrewFileBook(f.file)) === book && present(f),
    );
    const sourceFile = (lang === "greek" ? morphgnt : oshb).files.find(
      (f) => (lang === "greek" ? morphgntFileBook(f.file) : OSHB_FILE_BOOK.get(f.file)) === book,
    );
    if (maculaFiles.length === 0) {
      if (verifyPins) throw new SyntaxRefused(`MACULA has no file for ${book}`);
      continue;
    }
    if (sourceFile === undefined || !existsSync(path.join(rawDir, sourceFile.file))) {
      throw new SyntaxRefused(`${sourceFile?.file ?? book} is not in ${rawDir}; run \`yada ingest\``);
    }

    // Core's tokens for this book, grouped by the verse they have in the edition's own numbering.
    const parsed = lang === "greek" ? parseMorphGntWithCoverage(sourceFile.file, rawDir) : parseOshb(sourceFile.file, rawDir);
    const slots = new Map<string, CoreSlot[]>();
    parsed.tokens.forEach((token, i) => {
      const source = parsed.sources[i] ?? "";
      const slot = { verseId: token.verse_id, position: token.position, surface: token.surface };
      const list = slots.get(source);
      if (list === undefined) slots.set(source, [slot]);
      else list.push(slot);
    });
    // Greek only: a source verse with no tokens (John 7:53–8:11) keeps its own number unless
    // SBLGNT numbers it differently from English. Hebrew: every verse has tokens, so a missing one
    // is a fault.
    const fallback = (sourceVerse: string): string | null =>
      lang === "greek" ? (SBLGNT_TO_ENGLISH[sourceVerse] ?? sourceVerse) : null;

    books.add(book);
    for (const file of maculaFiles) {
      const lowfat = parseLowfat(readFileSync(path.join(rawDir, file.file), "utf8"));
      emptyGroups += lowfat.emptyGroups;
      emptyFrameArgs += lowfat.emptyFrameArgs;
      const joined = joinWords(lowfat.words, slots, join[lang], fallback);
      for (const w of lowfat.words) {
        if (tOf.has(w.id)) throw new SyntaxRefused(`MACULA id ${w.id} occurs twice`);
        tOf.set(w.id, tBase + w.t);
      }
      // A Hebrew word's morphs, in id order, are checked against its core token as one surface.
      const units = new Map<string, JoinedWord[]>();
      for (const w of [...joined].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
        if (w.position === null) continue;
        const key = `${w.ord}#${w.position}`;
        const unit = units.get(key);
        if (unit === undefined) units.set(key, [w]);
        else unit.push(w);
      }
      if (coreToken !== undefined) {
        for (const [key, unit] of units) {
          const [first] = unit;
          if (first === undefined || first.position === null) continue;
          const row = coreToken.get(first.ord, first.position);
          const want = surfaceKey(unit.map((u) => u.surface).join(""));
          const have = row === undefined ? null : surfaceKey(String(row["surface"]));
          if (have !== want && coreMismatches.length < 1000) coreMismatches.push(`${first.id} ${key}: ${want} vs core ${have ?? "no token"}`);
        }
      }

      lowfat.nodes.forEach((node, i) => {
        if (node.cls === "cl") clauses += 1;
        insertNode.run(
          nodeBase + i,
          node.parent === -1 ? null : nodeBase + node.parent,
          tBase + node.start,
          tBase + node.end,
          node.tag,
          node.cls,
          node.role,
          node.rule,
          node.cltype,
          node.nominalized ? 1 : 0,
          SOURCE_ID[lang],
        );
      });
      for (const w of joined) {
        insertWord.run(
          tBase + w.t,
          w.ord,
          w.position,
          w.word,
          w.id,
          w.node === -1 ? null : nodeBase + w.node,
          w.cls,
          w.role,
          w.surface,
          w.english,
        );
        rows += 1;
        for (const link of w.links) pending.push({ t: tBase + w.t, link });
      }
      tBase += lowfat.words.length;
      nodeBase += lowfat.nodes.length;
    }
  }
  // After every word: a referent can point back across a chapter file, and the foreign key on
  // target_t is checked row by row.
  for (const { t, link } of pending) {
    const target = tOf.get(link.target);
    if (target === undefined) {
      danglingLinks += 1;
      if (danglingExamples.length < 20) danglingExamples.push(`${link.kind} ${link.arg} -> ${link.target}`);
      continue;
    }
    insertLink.run(t, link.kind, link.arg, target);
    links += 1;
  }
  out.exec("COMMIT");
  out.exec("VACUUM");
  out.close();
  core?.close();

  // Same immutability rule as every bundle: unchanged bytes keep the file, changed bytes get a
  // version above anything on disk.
  const sha = sha256File(tmp);
  const highest = highestVersionOnDisk("syntax", outDir);
  const latest = path.join(outDir, syntaxFileName(highest));
  const reused = highest > 0 && sha256File(latest) === sha;
  const version = reused ? highest : highest + 1;
  const file = syntaxFileName(version);
  if (reused) rmSync(tmp);
  else renameSync(tmp, path.join(outDir, file));
  const full = path.join(outDir, file);
  return {
    file,
    version,
    sha256: sha,
    bytes: statSync(full).size,
    gzipBytes: gzipTranslation(readFileSync(full)).length,
    reused,
    books: books.size,
    nodes: nodeBase,
    clauses,
    rows,
    links,
    danglingLinks,
    danglingExamples,
    emptyGroups,
    emptyFrameArgs,
    join,
    coreMismatches,
    core: core === null ? null : (corePath ?? null),
  };
}

// ---------------------------------------------------------------------------
// Reading a verse back: "who does what to whom"
// ---------------------------------------------------------------------------

export interface SyntaxWord {
  t: number;
  ord: number;
  position: number | null;
  word: number;
  surface: string;
  english: string | null;
}

export interface Constituent {
  role: string;
  /** Node class ('np', 'pp', 'cl', …) or, for a single word, its word class. */
  cls: string | null;
  words: SyntaxWord[];
}

export interface ClauseView {
  id: number;
  /** Clauses enclosing this one. */
  depth: number;
  rule: string | null;
  role: string | null;
  constituents: Constituent[];
}

export interface FrameView {
  verb: SyntaxWord;
  args: Array<{ arg: string; words: SyntaxWord[] }>;
}

export interface VerseSyntax {
  clauses: ClauseView[];
  frames: FrameView[];
}

type Row = Record<string, unknown>;

const toWord = (row: Row): SyntaxWord => ({
  t: Number(row["t"]),
  ord: Number(row["ord"]),
  position: row["position"] === null ? null : Number(row["position"]),
  word: Number(row["word"]),
  surface: String(row["surface"]),
  english: row["english"] === null ? null : String(row["english"]),
});

const textOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);

/**
 * Every clause any word of the verse sits in, outermost first, with its role-bearing parts. A
 * clause can run past the verse (a sentence spans several) and its parts are returned whole, so the
 * caller sees the full subject even when it starts in the verse before.
 */
export function verseSyntax(db: DatabaseSync, ord: number): VerseSyntax {
  const clauseRows = db
    .prepare(
      `WITH RECURSIVE up(id) AS (
         SELECT node FROM words WHERE ord = ? AND node IS NOT NULL
         UNION SELECT n.parent FROM nodes n JOIN up ON n.id = up.id WHERE n.parent IS NOT NULL
       )
       SELECT n.* FROM nodes n JOIN up ON n.id = up.id WHERE n.class = 'cl' ORDER BY n.start_t, n.end_t DESC`,
    )
    .all(ord);
  const nodeById = db.prepare("SELECT * FROM nodes WHERE id = ?");
  const childNodes = db.prepare("SELECT * FROM nodes WHERE parent = ? ORDER BY start_t");
  const childWords = db.prepare("SELECT * FROM words WHERE node = ? AND role IS NOT NULL ORDER BY t");
  const span = db.prepare("SELECT * FROM words WHERE t BETWEEN ? AND ? ORDER BY ord, word, macula_id");
  const wordsOf = (row: Row): SyntaxWord[] => span.all(Number(row["start_t"]), Number(row["end_t"])).map(toWord);

  const depthOf = (row: Row): number => {
    let depth = 0;
    let parent = row["parent"];
    while (parent !== null && parent !== undefined) {
      const up = nodeById.get(Number(parent));
      if (up === undefined) break;
      if (up["class"] === "cl") depth += 1;
      parent = up["parent"];
    }
    return depth;
  };

  // A clause's parts are its role-bearing children; a role-less wrapper that is not itself a
  // clause (a coordination group) is looked through, as MACULA nests parts inside them.
  const partsOf = (id: number): Array<{ start: number; part: Constituent }> => {
    const parts: Array<{ start: number; part: Constituent }> = [];
    for (const child of childNodes.all(id)) {
      const role = textOrNull(child["role"]);
      if (role !== null) {
        parts.push({ start: Number(child["start_t"]), part: { role, cls: textOrNull(child["class"]), words: wordsOf(child) } });
      } else if (child["class"] !== "cl") parts.push(...partsOf(Number(child["id"])));
    }
    for (const w of childWords.all(id)) {
      parts.push({ start: Number(w["t"]), part: { role: String(w["role"]), cls: String(w["class"]), words: [toWord(w)] } });
    }
    return parts.sort((a, b) => a.start - b.start);
  };

  const clauses = clauseRows.map((row) => ({
    id: Number(row["id"]),
    depth: depthOf(row),
    rule: textOrNull(row["rule"]),
    role: textOrNull(row["role"]),
    constituents: partsOf(Number(row["id"])).map((p) => p.part),
  }));

  const byT = db.prepare("SELECT * FROM words WHERE t = ?");
  const frameRows = db
    .prepare(
      `SELECT l.t, l.arg, l.target_t FROM links l JOIN words w ON w.t = l.t
       WHERE w.ord = ? AND l.kind = 'frame' ORDER BY l.t, l.arg, l.target_t`,
    )
    .all(ord);
  const frames: FrameView[] = [];
  for (const row of frameRows) {
    const t = Number(row["t"]);
    let frame = frames.find((f) => f.verb.t === t);
    if (frame === undefined) {
      const verb = byT.get(t);
      if (verb === undefined) continue;
      frame = { verb: toWord(verb), args: [] };
      frames.push(frame);
    }
    const target = byT.get(Number(row["target_t"]));
    if (target === undefined) continue;
    const arg = String(row["arg"]);
    const slot = frame.args.find((a) => a.arg === arg);
    if (slot === undefined) frame.args.push({ arg, words: [toWord(target)] });
    else slot.words.push(toWord(target));
  }
  return { clauses, frames };
}
