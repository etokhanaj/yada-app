/**
 * Grammar labels in plain words (build 6, item H). Each term the word screen's Form line prints
 * (morphTerms in @yada/schema) gets the first sentence of the matching article's Summary, or of its
 * Glossary where the Greek grammar has no Summary, word for word with the reStructuredText markup
 * taken off. Sources, read from the zips in YADA_ROOT/content/raw/uw-grammar at the commits pinned below:
 *
 *   unfoldingWord Hebrew Grammar (en_uhg), Greek Grammar (en_ugg), Aramaic Grammar (en_uag),
 *   each CC BY-SA 4.0 by its own LICENSE.md (rule 3; checked every run).
 *
 * Never STEPBible morphology: it asks not to be redistributed (sources.ts, TAHOT/TAGNT notes).
 *
 * Rule 2: every entry is `draft` in grammar.json until John approves it in the review tool's Extracts
 * queue; only approved entries are written into the app (apps/mobile/src/data/grammar.generated.ts).
 * Rule 4: a term with no article of its own (rare Hebrew stems, Aramaic "determined") gets nothing.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { type GrammarLanguage, grammarKey, morphTerms } from "@yada/schema";

import { highestVersionOnDisk } from "./package.js";
import { ZipRefused, readZip } from "./zip.js";

export class GrammarRefused extends Error {}

export interface Grammar {
  repo: "en_uhg" | "en_ugg" | "en_uag";
  name: string;
  commit: string;
  /** sha256 of git.door43.org/unfoldingWord/<repo>/archive/<commit>.zip as downloaded to uw-grammar/<repo>.zip. */
  zipSha256: string;
  /** "The original work by unfoldingWord is available from …", as each LICENSE.md words it. */
  original: string;
}

/**
 * Pinned 15 Oct 2026, the master heads that day. All three LICENSE.md files name unfoldingword.org/uhg as
 * the original's address, the Greek and Aramaic ones included; that is what each asks a copy to say.
 */
export const GRAMMARS: Readonly<Record<GrammarLanguage, Grammar>> = {
  greek: {
    repo: "en_ugg",
    name: "unfoldingWord Greek Grammar",
    commit: "e358acbf9c86ae0f0c381df0ccf5e1ddd7e54a84",
    zipSha256: "e823f8411be8db471d1341fbff69a5e4ca15f9dcaf8778131ecc2ab2d609eff4",
    original: "unfoldingword.org/uhg",
  },
  hebrew: {
    repo: "en_uhg",
    name: "unfoldingWord Hebrew Grammar",
    commit: "ddad74ff2632140569c8ab49cf2950bd4cccf768",
    zipSha256: "58d07d5e5058720dca02f5324596e086f34a46dfdf302a7bb82e766614353993",
    original: "unfoldingword.org/uhg",
  },
  aramaic: {
    repo: "en_uag",
    name: "unfoldingWord Aramaic Grammar",
    commit: "6babf1977048702caa3bddf12f57507e318caf0e",
    zipSha256: "07a895083f493f5ff94a39b7f88a085b74a7416daf950cb9c1dc0b8227a43e8f",
    original: "unfoldingword.org/uhg",
  },
};

/** CC BY-SA 4.0: the unfoldingWord® mark dropped, and what changed said. */
export const GRAMMAR_CREDIT: Readonly<Record<GrammarLanguage, string>> = {
  greek: "unfoldingWord, shortened",
  hebrew: "unfoldingWord, shortened",
  aramaic: "unfoldingWord, shortened",
};

/**
 * J. Gresham Machen, New Testament Greek for Beginners (Macmillan, copyright 1923; the scan is the 1937
 * printing, archive.org newtestamentgree00mach). Public domain: published in the US in 1923, and Machen died
 * in 1937. For the Greek terms John rejected as wrong or empty in the unfoldingWord grammar (decision 23),
 * a sentence chosen from Machen's own text, never written: each must occur, once, in the pinned scan.
 */
export const MACHEN = {
  file: "machen/newtestamentgree00mach_djvu.txt",
  sha256: "624879603ae83b3b0aca5b126c719255b71fa0aeb6402b77e8eb01ba951ff9cb",
  credit: "Machen, 1923",
} as const;

export const MACHEN_SENTENCES: Readonly<Record<string, { text: string; ref: string }>> = {
  "greek:accusative": { text: "The object of a transitive verb is placed in the accusative case.", ref: "§34" },
  "greek:genitive": { text: "The genitive case expresses possession.", ref: "§35" },
  "greek:dative": { text: "The dative case is the case of the indirect object.", ref: "§36" },
  "greek:middle": {
    text: "The middle voice represents the subject as acting in some way that concerns itself, or as acting upon something that belongs to itself.",
    ref: "lesson on the middle voice",
  },
  "greek:perfect": { text: "The Greek perfect tense denotes the present state resultant upon a past action.", ref: "§452" },
  "greek:optative": { text: "The optative is still retained to express a wish.", ref: "lesson on the optative" },
};

/** The scan's text with line-end hyphens joined and whitespace made single, as the sentences above are matched. */
export function machenText(raw: string): string {
  return raw.replace(/-\s*\n\s*/g, "").replace(/\s+/g, " ");
}

/** Machen's scan against its pin, or null where content/raw does not have it (the Greek terms then keep their gaps). */
export function readMachen(raw: string): string | null {
  return readPinned(raw, CHOSEN.machen);
}

export type ChosenSource = "machen" | "burton" | "gesenius" | "winer";

interface ChosenSentence {
  text: string;
  ref: string;
  /** Where the file's OCR misreads the printed page: what to find in the file, and the note John sees. */
  ocr?: { reads: string; note: string };
}

interface ChosenGrammar {
  /** Each file under content/raw with its sha256, read in this order as one text. */
  files: Readonly<Record<string, string>>;
  credit: string;
  text: (raw: string) => string;
  sentences: Readonly<Record<string, ChosenSentence>>;
}

/** Proofread Wikisource wikitext as plain text: italics, footnotes and the term template dropped, as the page prints it. */
export function wikisourceText(raw: string): string {
  return raw
    .replace(/<ref>[\s\S]*?<\/ref>/g, "")
    .replace(/\{\{GHGterm\|([^}]*)\}\}/g, "$1")
    .replace(/'{2,3}/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Grammars whose sentences are chosen by hand for terms the unfoldingWord grammars explain wrongly or not at all
 * (build 8, 16 Oct 2026). Each sentence is the book's own, found once in its pinned file and checked against the
 * page scan; an OCR slip is recorded beside it, never silently fixed.
 */
export const CHOSEN: Readonly<Record<ChosenSource, ChosenGrammar>> = {
  machen: { files: { [MACHEN.file]: MACHEN.sha256 }, credit: MACHEN.credit, text: machenText, sentences: MACHEN_SENTENCES },
  // Burton, 3rd edition (Chicago, 1903; copyright 1900). Public domain: a US publication before 1929, and Burton
  // died in 1925. Machen's "simple past tense" left out the whole-event view John asked for.
  burton: {
    files: { "burton/cu31924021607449_djvu.txt": "12d1e3c10606cc5212e8378b29c035c2b769e2b5c9283f55d50779b7b72965f8" },
    credit: "Burton, 1903",
    text: machenText,
    sentences: {
      "greek:aorist": {
        text: "The constant characteristic of the Aorist tense in all of its moods, including the participle, is that it represents the action denoted by it indefinitely; i.e. simply as an event, neither on the one hand picturing it in progress, nor on the other affirming the existence of its result.",
        ref: "§35, p. 16",
        ocr: {
          reads: "The constant characteristic of the Aorist tense in all of its moods, including the participle, is that it represents the action denoted by it indefinitely; 7¢.e. simply as an event, neither on the one hand picturing it in progress, nor on the other affirming the existence of its result.",
          note: "The scan's OCR reads “7¢.e.”; the printed page has “i.e.” (checked against the page image, 16 Oct 2026).",
        },
      },
    },
  },
  // Gesenius' Hebrew Grammar (Kautzsch–Cowley, 1910), from Wikisource's transcription (CC BY-SA 4.0, from the page
  // footer). The Page: revisions are pinned; both are marked unproofread there, so each sentence was read against
  // the page image. The 1909 scan Gesenius was first tried from is OCR noise (decision 25).
  gesenius: {
    files: {
      "gesenius/page271-rev8193852.wiki": "f580e24e789fca84cef1ae6044c7ade64829ae635d15bafb9d642a6e264633cf",
      "gesenius/page154-rev8193761.wiki": "f43d193e432775d909c575e4177eb034c9a06c36f37e6da10f589b4e3e504709",
    },
    credit: "Gesenius, 1910, Wikisource",
    text: wikisourceText,
    sentences: {
      // One sentence defines both states, so it serves both terms.
      "hebrew:absolute": {
        text: "Thus in Hebrew only the noun which stands before a genitive suffers a change, and in grammatical language is said to be dependent, or in the construct state, while a noun which has not a genitive after it is said to be in the absolute state.",
        ref: "§89a, p. 247",
      },
      "hebrew:construct": {
        text: "Thus in Hebrew only the noun which stands before a genitive suffers a change, and in grammatical language is said to be dependent, or in the construct state, while a noun which has not a genitive after it is said to be in the absolute state.",
        ref: "§89a, p. 247",
      },
      "hebrew:cohortative": {
        text: "The cohortative expresses the direction of the will to an action and thus denotes especially self-encouragement (in the 1st plur. an exhortation to others at the same time), a resolution or a wish, as an optative, &c., see § 108.",
        ref: "§48e, p. 130",
      },
    },
  },
  // Winer, A Grammar of the Chaldee Language, tr. H. B. Hackett (Andover, 1845). Public domain. en_uag's
  // state_determined.rst is a copy of its absolute-state article.
  winer: {
    files: { "winer/grammarofchaldee00wine_djvu.txt": "ec1125843677853dd170fb22e79d68f48c3a267b9d7bb4402e8c6cc2278c1111" },
    credit: "Winer, 1845",
    // This scan breaks words at a line end with "¬".
    text: (raw) => raw.replace(/[-¬]\s*\n\s*/g, "").replace(/\s+/g, " "),
    sentences: {
      "aramaic:determined": {
        text: "In addition to the absolute and construct state, we have here also the status emphaticus, or emphatic state, as it is termed, and which was designed originally to express the noun with the definite article.",
        ref: "§32.1, p. 87",
      },
    },
  },
};

/** A grammar's files against their pins as one text, or null where content/raw lacks any of them. */
function readPinned(raw: string, g: ChosenGrammar): string | null {
  const parts: string[] = [];
  for (const [file, sha256] of Object.entries(g.files)) {
    const full = path.join(raw, file);
    if (!existsSync(full)) return null;
    const bytes = readFileSync(full);
    if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new GrammarRefused(`${full} does not match its pin`);
    parts.push(g.text(bytes.toString("utf8")));
  }
  return parts.join(" ");
}

/** Every chosen grammar's text, or a refusal naming the first one content/raw lacks. */
export function readChosen(raw: string): Record<ChosenSource, string> {
  const out = {} as Record<ChosenSource, string>;
  for (const source of Object.keys(CHOSEN) as ChosenSource[]) {
    const text = readPinned(raw, CHOSEN[source]);
    if (text === null) throw new GrammarRefused(`${Object.keys(CHOSEN[source].files).map((f) => path.join(raw, f)).join(", ")} missing`);
    out[source] = text;
  }
  return out;
}

/**
 * Spelling and agreement slips in the unfoldingWord sentences John rejected (15 Oct 2026), corrected and
 * shown to him beside the original (decision 24). Wording is never changed, only the slip: a correction
 * applies only while its exact original is in the sentence.
 */
export const CORRECTIONS: Readonly<Record<string, readonly [string, string]>> = {
  "greek:imperative": ["mood is is a mood", "mood is a mood"],
  "greek:passive": ["the action of the verbs is performed", "the action of the verb is performed"],
  "greek:pluperfect": ["in existance", "in existence"],
  "hebrew:pulal": ["that it similar", "that is similar"],
  "hebrew:qal": ["the simplest of form", "the simplest form"],
  "aramaic:peal": ["the simplest of form", "the simplest form"],
  "aramaic:construct": ["The contruct state", "The construct state"],
};

const STEMS_HEBREW = [
  "qal", "niphal", "piel", "pual", "hiphil", "hophal", "hithpael", "polel", "polal", "hithpolel", "poel", "poal", "palel", "pulal",
  "qal passive", "pilpel", "polpal", "hithpalpel", "nithpael", "pealal", "pilel", "hothpaal", "tiphil", "hishtaphel", "nithpalel", "nithpoel", "hithpoel",
];
const STEMS_ARAMAIC = [
  "peal", "peil", "hithpeel", "niphal", "pael", "ithpaal", "hithpaal", "aphel", "haphel", "saphel", "shaphel", "hophal", "ithpeel", "hishtaphel",
  "ishtaphel", "hithaphel", "polel", "hithpoel", "hithpolel", "hithpalpel", "hephal", "tiphel", "poel", "palpel", "ithpalpel", "ithpolel", "ittaphal",
];
const SEMITIC: Readonly<Record<string, string>> = {
  perfect: "verb_perfect",
  "sequential perfect": "verb_sequential_perfect",
  imperfect: "verb_imperfect",
  "sequential imperfect": "verb_sequential_imperfect",
  cohortative: "verb_cohortative",
  jussive: "verb_jussive",
  imperative: "verb_imperative",
  participle: "participle_active",
  "passive participle": "participle_passive",
  "infinitive absolute": "infinitive_absolute",
  "infinitive construct": "infinitive_construct",
  absolute: "state_absolute",
  construct: "state_construct",
  determined: "state_determined",
  dual: "number_dual",
  common: "gender_common",
  "both genders": "gender_both",
  "pronominal suffix": "suffix_pronominal",
  "directional he": "suffix_directional_he",
  "paragogic he": "suffix_paragogic_he",
  "paragogic nun": "suffix_paragogic_nun",
  "direct object marker": "particle_direct_object_marker",
};

/** Each label morphTerms can print, per language, to the article that should explain it. */
export const ARTICLES: Readonly<Record<GrammarLanguage, Readonly<Record<string, string>>>> = {
  greek: {
    present: "tense_present", imperfect: "tense_imperfect", future: "tense_future", aorist: "tense_aorist", perfect: "tense_perfect", pluperfect: "tense_pluperfect",
    active: "voice_active", middle: "voice_middle", passive: "voice_passive",
    indicative: "mood_indicative", imperative: "mood_imperative", subjunctive: "mood_subjunctive", optative: "mood_optative", infinitive: "mood_infinitive", participle: "mood_participle",
    nominative: "case_nominative", genitive: "case_genitive", dative: "case_dative", accusative: "case_accusative", vocative: "case_vocative",
    comparative: "comparative", superlative: "superlative",
  },
  hebrew: { ...Object.fromEntries(STEMS_HEBREW.map((s) => [s, `stem_${s.replace(/ /g, "_")}`])), ...SEMITIC },
  aramaic: { ...Object.fromEntries(STEMS_ARAMAIC.map((s) => [s, `stem_${s.replace(/ /g, "_")}`])), ...SEMITIC },
};

// ---------------------------------------------------------------------------
// Reading an article
// ---------------------------------------------------------------------------

/** A section underline; en_ugg also underlines with "_" (mood_participle, tense_pluperfect). */
const UNDERLINE = /^\s*([=\-~^"'`#*+_])\1{2,}\s*$/;

/** reStructuredText inline markup off: :ref:`words<target>` to its words, ``literal`` and *emphasis* to plain text. */
export function cleanRst(text: string): string {
  return text
    .replace(/:ref:`([^`<]*?)\s*<[^>]*>`/g, "$1")
    .replace(/:ref:`([^`]*)`/g, "$1")
    .replace(/`([^`<]+?)\s*<[^>]+>`_+/g, "$1")
    .replace(/``([^`]+)``/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** The article's own `.. _id:` anchor, which must be the id it is filed under (en_uag's state_determined is a copy of state_absolute). */
export function articleAnchor(rst: string): string | null {
  return /^\.\. _([\w-]+):\s*$/m.exec(rst)?.[1] ?? null;
}

/**
 * The first paragraph of the Summary section, or of the Glossary where there is no Summary, with
 * `.. include::` files read in place. A Glossary paragraph starts with the term itself
 * ("**Aorist** -"), which is dropped. Other directives (tables, notes) are skipped.
 */
export function firstParagraph(
  rst: string,
  include: (file: string) => string | null,
): { section: "Summary" | "Glossary"; text: string; unfinished: boolean } | null {
  const lines = rst.replace(/\r/g, "").split("\n");
  for (const section of ["Summary", "Glossary"] as const) {
    // "Glossary     [UNDER CONSTRUCTION]" (en_ugg mood_optative) is still the Glossary; John sees the mark.
    const at = lines.findIndex((l, i) => new RegExp(`^${section}\\b`).test(l.trim()) && UNDERLINE.test(lines[i + 1] ?? ""));
    if (at < 0) continue;
    const body: string[] = [];
    for (let i = at + 2; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (UNDERLINE.test(lines[i + 1] ?? "") && line.trim() !== "") break;
      const inc = /^\.\. include::\s*(\S+)/.exec(line.trim());
      if (inc?.[1] !== undefined) {
        body.push(...(include(inc[1]) ?? "").replace(/\r/g, "").split("\n"), "");
        continue;
      }
      body.push(line);
    }
    const paragraphs: string[] = [];
    let current: string[] = [];
    let inDirective = false;
    for (const line of body) {
      if (line.trim() === "") {
        if (current.length > 0) paragraphs.push(current.join(" "));
        current = [];
        continue;
      }
      // A directive (table, note, image) and its indented body are not prose.
      if (/^\.\.\s/.test(line.trim())) {
        inDirective = true;
        continue;
      }
      if (inDirective && /^\s/.test(line)) continue;
      inDirective = false;
      current.push(line.trim());
    }
    if (current.length > 0) paragraphs.push(current.join(" "));
    // A Glossary entry may open with its own headword: "**Aorist**   -  Aorist is …".
    const text = paragraphs.map((p) => cleanRst(section === "Glossary" ? p.replace(/^\*\*[^*]+\*\*\s*[-–]\s*/, "") : p)).find((p) => p !== "");
    if (text === undefined) continue;
    return { section, text, unfinished: /UNDER CONSTRUCTION/i.test(lines[at] ?? "") };
  }
  return null;
}

/** The first sentence, split where a full stop is followed by a capital; "e.g." and "i.e." do not end one. */
export function firstSentence(paragraph: string): string {
  const m = /^.*?[.!?](?=\s+[A-Z(“"]|$)/.exec(paragraph.replace(/\b(e\.g|i\.e)\./g, "$1\u0000"));
  return (m?.[0] ?? paragraph).replace(/\u0000/g, ".").trim();
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

export type GrammarStatus = "draft" | "approved" | "rejected";

export interface GrammarEntry {
  /** `${language}:${label}`, as grammarKey makes it. */
  key: string;
  label: string;
  language: GrammarLanguage;
  text: string;
  /** For John: the file and section, and the paragraph the sentence was cut from. Never shown in the app. */
  ref: string;
  paragraph: string;
  /** Tokens carrying this term in core, for the order John reviews in. */
  tokens: number;
  status: GrammarStatus;
  /** For John: a spelling correction, shown beside the original. */
  note?: string;
  /** A chosen grammar's sentence in place of the unfoldingWord one; credited to that book in the app. */
  source?: ChosenSource;
  /** Sentences John rejected for this term: one never comes back as a draft. */
  rejected?: string[];
}

export interface GrammarGap {
  key: string;
  reason: string;
}

/**
 * The grammars' files by their path in the archives ("en_uhg/content/verb_imperfect.rst"), which is also
 * their path under uw-grammar. Read from the pinned zips, never the extracted tree beside them: no pin
 * covers that tree, so an edited sentence or LICENSE.md there would have shipped (code review, 15 Oct 2026).
 */
export type GrammarFiles = (file: string) => string | null;

/** Each zip checked against its pin in GRAMMARS, then read whole; a zip that is missing or differs refuses. */
export function grammarFiles(rawDir: string, grammars: Readonly<Record<GrammarLanguage, Grammar>> = GRAMMARS): GrammarFiles {
  const files = new Map<string, string>();
  for (const g of Object.values(grammars)) {
    const zip = path.join(rawDir, `${g.repo}.zip`);
    if (!existsSync(zip)) throw new GrammarRefused(`${zip} is missing`);
    const bytes = readFileSync(zip);
    if (createHash("sha256").update(bytes).digest("hex") !== g.zipSha256) throw new GrammarRefused(`${zip} does not match its pin (${g.commit.slice(0, 7)})`);
    let entries: Map<string, Buffer>;
    try {
      entries = readZip(bytes);
    } catch (error) {
      if (error instanceof ZipRefused) throw new GrammarRefused(`${zip}: ${error.message}`);
      throw error;
    }
    for (const [name, data] of entries) if (name.startsWith(`${g.repo}/`)) files.set(name, data.toString("utf8"));
  }
  return (file) => files.get(file) ?? null;
}

const CC_BY_SA = "Creative Commons Attribution-ShareAlike 4.0 International License";

/** Rule 3: read the licence from each repo's LICENSE.md; refuse one that no longer grants CC BY-SA 4.0. */
export function checkGrammarLicence(files: GrammarFiles, language: GrammarLanguage): string {
  const file = `${GRAMMARS[language].repo}/LICENSE.md`;
  const text = files(file);
  if (text === null) throw new GrammarRefused(`${file} is missing`);
  if (!text.includes(CC_BY_SA)) throw new GrammarRefused(`${file} no longer says ${CC_BY_SA}`);
  return text.trim();
}

/**
 * An include's path inside the archives, or null when it leaves them. path.posix.normalize("en_uhg/../x")
 * is "x", outside every repo; a bare prefix test let "en_uhg-copy/…" pass for "en_uhg" (review, 15 Oct 2026).
 */
export function includePath(repo: string, inc: string): string | null {
  // en_uag includes the Hebrew grammar's shared summaries by its submodule path, "en_uhg/content/includes/…".
  const p = path.posix.normalize(/^en_u[hga]g\//.test(inc) ? inc : `${repo}/content/${inc}`);
  return /^en_u[hga]g\//.test(p) ? p : null;
}

/** One term's sentence from the grammars, or why there is none. */
export function grammarSentence(files: GrammarFiles, language: GrammarLanguage, label: string): { text: string; ref: string; paragraph: string } | { reason: string } {
  const id = ARTICLES[language][label];
  if (id === undefined) return { reason: "no article for this term" };
  const repo = GRAMMARS[language].repo;
  const rst = files(`${repo}/content/${id}.rst`);
  if (rst === null) return { reason: `no ${repo}/${id}.rst` };
  // en_uag's state_determined.rst is a copy of state_absolute (anchor and title both say so): it must not
  // explain "determined". A misspelt anchor on the right article (stem_ithpal under "Stem Ithpa'al") is fine.
  const anchor = articleAnchor(rst);
  const title = articleTitle(rst);
  if (anchor !== id && title !== id) return { reason: `${id}.rst is filed as ${anchor ?? "nothing"} (“${title ?? ""}”), a copy of another article` };
  const found = firstParagraph(rst, (inc) => {
    const p = includePath(repo, inc);
    return p === null ? null : files(p);
  });
  if (found === null) return { reason: `${id}.rst has no Summary or Glossary` };
  return {
    text: firstSentence(found.text),
    ref: `${repo}/content/${id}.rst ${found.section}${found.unfinished ? " [UNDER CONSTRUCTION in the source]" : ""}`,
    paragraph: found.text,
  };
}

/** The title line as an id: "Stem Ithpa'al" -> "stem_ithpaal". */
export function articleTitle(rst: string): string | null {
  const lines = rst.replace(/\r/g, "").split("\n");
  const at = lines.findIndex((l, i) => l.trim() !== "" && /^\s*=+\s*$/.test(lines[i + 1] ?? ""));
  return at < 0 ? null : (lines[at] ?? "").trim().toLowerCase().replace(/['’]/g, "").replace(/\s+/g, "_");
}

export function buildGrammar(
  files: GrammarFiles,
  terms: ReadonlyArray<{ label: string; language: GrammarLanguage; tokens: number }>,
  previous: readonly GrammarEntry[],
  chosen: Readonly<Partial<Record<ChosenSource, string>>> = {},
): { entries: GrammarEntry[]; gaps: GrammarGap[] } {
  for (const language of Object.keys(GRAMMARS) as GrammarLanguage[]) checkGrammarLicence(files, language);
  const built: GrammarEntry[] = [];
  const gaps: GrammarGap[] = [];
  for (const t of terms) {
    const key = grammarKey(t);
    const old = previous.find((e) => e.key === key);
    const rejected = [...new Set([...(old?.rejected ?? []), ...(old?.status === "rejected" ? [old.text] : [])])];
    // A sentence John rejected for the same term in another language (Hebrew "construct", which en_uag's
    // corrected copy now matches word for word) is rejected here too.
    const rejectedElsewhere = previous.filter((e) => e.label === t.label && e.key !== key).flatMap((e) => [...(e.rejected ?? []), ...(e.status === "rejected" ? [e.text] : [])]);
    const source = (Object.keys(CHOSEN) as ChosenSource[]).find((s) => CHOSEN[s].sentences[key] !== undefined && chosen[s] !== undefined);
    let found: { text: string; ref: string; paragraph: string; note?: string; source?: ChosenSource } | { reason: string };
    if (source !== undefined) {
      const pick = CHOSEN[source].sentences[key] as ChosenSentence;
      const scan = chosen[source] ?? "";
      const needle = pick.ocr?.reads ?? pick.text;
      const at = scan.indexOf(needle);
      if (at < 0 || scan.indexOf(needle, at + 1) >= 0) throw new GrammarRefused(`${source}'s sentence for ${key} is not in its pinned file exactly once`);
      found = {
        text: pick.text,
        ref: `${Object.keys(CHOSEN[source].files).join(" + ")} ${pick.ref}`,
        paragraph: pick.text,
        source,
        ...(pick.ocr === undefined ? {} : { note: pick.ocr.note }),
      };
    } else {
      const uw = grammarSentence(files, t.language, t.label);
      const fix = CORRECTIONS[key];
      found = "reason" in uw || fix === undefined || !uw.text.includes(fix[0]) ? uw : { ...uw, text: uw.text.replace(fix[0], fix[1]), note: `Spelling corrected from the source: “${fix[0]}” → “${fix[1]}”.` };
    }
    if ("reason" in found) {
      gaps.push({ key, reason: found.reason });
      continue;
    }
    // John's latest decision on this exact text wins (an undo-then-approve included); the rejected lists only
    // decide a text that is new to this entry (review, 15 Oct 2026).
    const status: GrammarStatus =
      old !== undefined && old.text === found.text ? old.status : rejected.includes(found.text) || rejectedElsewhere.includes(found.text) ? "rejected" : "draft";
    built.push({
      key,
      label: t.label,
      language: t.language,
      text: found.text,
      ref: found.ref,
      paragraph: found.paragraph,
      tokens: t.tokens,
      status,
      ...(found.note === undefined ? {} : { note: found.note }),
      ...(found.source === undefined ? {} : { source: found.source }),
      ...(rejected.length === 0 ? {} : { rejected }),
    });
  }
  // One sentence for two terms of one language explains neither: Hebrew tiphil and hishtaphel share one word for
  // word (decision 24). Both are held, as gaps, until a source tells them apart. Across languages a shared sentence
  // is en_uag including en_uhg's summaries, which John approved term by term. A chosen sentence is picked for each
  // term by hand (Gesenius' one sentence defines both the absolute and the construct state), so it is exempt.
  const entries = built.filter((e) => {
    if (e.source !== undefined) return true;
    const twin = built.find((o) => o !== e && o.text === e.text && o.language === e.language);
    if (twin === undefined) return true;
    gaps.push({ key: e.key, reason: `same sentence as ${twin.key}` });
    return false;
  });
  return { entries, gaps };
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export const GRAMMAR_FILE = "grammar.json";

export const GRAMMAR_WHY =
  "Build 6 item H (15 Oct 2026): each grammar term on the word screen's Form line, with the first sentence of the matching unfoldingWord " +
  "Grammar article's Summary (or Glossary), word for word. Built by `yada grammar --write` (packages/pipeline/src/grammar.ts). 'status' is " +
  "'draft' until John approves it in the review tool's Extracts queue; only approved entries are written into the app " +
  "(apps/mobile/src/data/grammar.generated.ts). Since John's review, six Greek terms take a sentence from Machen's New Testament Greek " +
  "for Beginners (1923, public domain) instead; since build 8 the aorist is Burton's (1903), the Hebrew absolute, construct and cohortative " +
  "Gesenius' (1910, Wikisource), and the Aramaic determined state Winer's (1845); spelling slips are corrected with a note saying so, a sentence shared by two terms is " +
  "held, and 'rejected' lists sentences that never return as drafts. " +
  "This table is an adapted copy, published under CC BY-SA 4.0 like its unfoldingWord sources.";

export function readGrammar(dir: string): GrammarEntry[] {
  const file = path.join(dir, GRAMMAR_FILE);
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { entries?: unknown };
  if (!Array.isArray(parsed.entries)) throw new GrammarRefused(`${GRAMMAR_FILE} has no entries list`);
  return parsed.entries as GrammarEntry[];
}

export function writeGrammar(dir: string, entries: readonly GrammarEntry[], gaps: readonly GrammarGap[]): void {
  const pins = Object.fromEntries(Object.values(GRAMMARS).map((g) => [g.repo, g.commit]));
  writeFileSync(path.join(dir, GRAMMAR_FILE), `${JSON.stringify({ _why: GRAMMAR_WHY, pins, gaps, entries }, null, 1)}\n`, "utf8");
}

/** The app's copy: approved entries only, so nothing unreviewed is in the binary (rule 2). */
export function appGrammarModule(entries: readonly GrammarEntry[]): string {
  const approved = entries.filter((e) => e.status === "approved").sort((a, b) => a.key.localeCompare(b.key));
  const table = Object.fromEntries(approved.map((e) => [e.key, e.text]));
  return [
    "// Generated by `yada grammar --write` from packages/pipeline/prototypes/data/grammar.json. Do not edit.",
    "// Approved entries only (rule 2). Adapted from the unfoldingWord Hebrew, Greek and Aramaic Grammars, CC BY-SA 4.0, and",
    "// J. Gresham Machen's New Testament Greek for Beginners (1923), Burton's Moods and Tenses (1903) and Winer's Chaldee Grammar",
    "// (1845), public domain, and Gesenius' Hebrew Grammar (1910) from Wikisource, CC BY-SA 4.0.",
    "",
    `export const GRAMMAR_SENTENCES: Readonly<Record<string, string>> = ${JSON.stringify(table, null, 2)};`,
    "",
    `export const GRAMMAR_CREDITS = ${JSON.stringify(GRAMMAR_CREDIT, null, 2)} as const;`,
    "",
    "/** Terms whose sentence is another grammar's, not the unfoldingWord grammar's. */",
    `export const GRAMMAR_ENTRY_CREDITS: Readonly<Record<string, string>> = ${JSON.stringify(Object.fromEntries(approved.flatMap((e) => (e.source === undefined ? [] : [[e.key, CHOSEN[e.source].credit]]))), null, 2)};`,
    "",
  ].join("\n");
}

/**
 * `yada grammar [--write]`: the grammar table for the word screen (build 6 item H), as a dry-run report
 * of every term core's tokens use, with its sentence or the gap. `--write` refreshes grammar.json for the
 * review tool (decisions kept while a sentence is unchanged) and the app's approved-only copy.
 */
export function grammarCommand(
  args: readonly string[],
  options: { raw: string; bundles: string; dataDir: string; appFile: string; grammars?: Readonly<Record<GrammarLanguage, Grammar>> },
): number {
  let files: GrammarFiles;
  try {
    files = grammarFiles(path.join(options.raw, "uw-grammar"), options.grammars);
  } catch (error) {
    if (error instanceof GrammarRefused) {
      console.error(`grammar: REFUSED. ${error.message}`);
      return 1;
    }
    throw error;
  }
  const coreVersion = highestVersionOnDisk("core", options.bundles);
  if (coreVersion === 0) {
    console.error(`grammar: no core bundle in ${options.bundles}`);
    return 1;
  }
  const core = new DatabaseSync(path.join(options.bundles, `core.v${coreVersion}.db`), { readOnly: true });
  const counts = new Map<string, { label: string; language: GrammarLanguage; tokens: number }>();
  try {
    for (const r of core.prepare("SELECT morph, COUNT(*) AS n FROM tokens WHERE morph IS NOT NULL AND morph <> '' GROUP BY morph").all()) {
      for (const t of morphTerms(String(r["morph"]))) {
        const c = counts.get(grammarKey(t)) ?? { ...t, tokens: 0 };
        c.tokens += Number(r["n"]);
        counts.set(grammarKey(t), c);
      }
    }
  } finally {
    core.close();
  }
  const terms = [...counts.values()].sort((a, b) => a.language.localeCompare(b.language) || b.tokens - a.tokens);
  let built: ReturnType<typeof buildGrammar>;
  try {
    // Without a chosen grammar's file its terms would fall back to sentences John rejected and lose any approval
    // (review, 15 Oct 2026): refuse, as an unpinned grammar zip does.
    built = buildGrammar(files, terms, readGrammar(options.dataDir), readChosen(options.raw));
  } catch (error) {
    if (error instanceof GrammarRefused) {
      console.error(`grammar: REFUSED. ${error.message}`);
      return 1;
    }
    throw error;
  }
  for (const e of built.entries) console.log(`  ${e.key.padEnd(30)} ${String(e.tokens).padStart(6)}  ${e.text}`);
  for (const g of built.gaps) console.log(`  ${g.key.padEnd(30)}   none  ${g.reason}`);
  console.log(`grammar: ${built.entries.length} entries, ${built.gaps.length} terms with nothing, from core.v${coreVersion}`);
  if (args.includes("--write")) {
    writeGrammar(options.dataDir, built.entries, built.gaps);
    writeFileSync(options.appFile, appGrammarModule(built.entries), "utf8");
    console.log(`wrote ${path.join(options.dataDir, GRAMMAR_FILE)} and ${options.appFile} (${built.entries.filter((e) => e.status === "approved").length} approved)`);
  }
  return 0;
}
