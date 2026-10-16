/**
 * Sources (SO-02): each dataset the app ships, as a reader would name it.
 *
 * The role and short name are Yada's words for the dataset (v2-review S15,
 * S16, S20); the licence and link come from the core bundle's `sources` row
 * and nothing else (rule 3). `encumbered` is never read here: it holds the
 * team's open legal questions (PRD 0E), not licence terms for readers.
 */

import type { SourceRow } from "../data/queries";

export type SourceGroup = "Bible text" | "Words and people" | "Understand" | "Today";

export interface SourceItem {
  readonly dataset: string;
  readonly group: SourceGroup;
  /** Role first (`Greek parsing`), or the translation's own name (`Berean Standard Bible`). */
  readonly title: string;
  /** The dataset and its licence: `MorphGNT · CC BY-SA 3.0`. */
  readonly subtitle: string;
  /** ST-04's trailing value: a translation's licence alone ("Public domain"), else the subtitle. */
  readonly value: string;
  readonly url: string;
  /** VoiceOver: the row is the link (S19). */
  readonly label: string;
  /**
   * The licence's own notice, shown verbatim under the row, where the licence
   * asks for it in so many words (CC BY-SA: the LSV).
   */
  readonly attribution: string | null;
}

/** Licence codes in the sources table, in the words readers know them by. SBLGNT's EULA is its own (S11). */
const LICENCE: Readonly<Record<string, string>> = {
  "CC-BY-SA-3.0": "CC BY-SA 3.0",
  "CC-BY-4.0": "CC BY 4.0",
  "CC-BY-SA-4.0": "CC BY-SA 4.0",
  PUBLIC_DOMAIN: "Public domain",
  CUSTOM_EULA: "Own licence",
  "OFL-1.1": "SIL OFL 1.1",
};

export function licenceLabel(code: string): string {
  return LICENCE[code] ?? code.replace(/[_-]/g, " ");
}

export const SPURGEON_DATASET = "Morning and Evening: Daily Readings, C. H. Spurgeon (CCEL ThML)";
export const DAILY_LIGHT_DATASET = "Daily Light on the Daily Path (CCEL ThML)";
export const PICTURES_DATASET = "Today’s pictures (Wikimedia Commons)";

/**
 * Keyed on the dataset name the pipeline writes from sources.manifest.json.
 * Fonts and the early WEB excerpt file are not listed: they carry no text a
 * reader reads as Scripture or word data.
 */
const ROLE: Readonly<Record<string, { group: SourceGroup; title: string; name: string }>> = {
  "SBLGNT (Greek text)": { group: "Words and people", title: "Greek New Testament", name: "SBLGNT" },
  "morphhb — Westminster Leningrad Codex text": { group: "Bible text", title: "Hebrew Bible", name: "Westminster Leningrad Codex" },
  "Berean Standard Bible (text)": { group: "Bible text", title: "Berean Standard Bible", name: "English · BSB" },
  "World English Bible, Protestant canon (engwebp)": { group: "Bible text", title: "World English Bible", name: "English · WEB" },
  "King James Version, 1769 standardised text (eng-kjv2006)": { group: "Bible text", title: "King James Version", name: "English · KJV" },
  "Literal Standard Version (englsv)": { group: "Bible text", title: "Literal Standard Version", name: "English · LSV" },
  "morphgnt/sblgnt (morphological annotations)": { group: "Words and people", title: "Greek parsing", name: "MorphGNT" },
  "morphhb — lemma and morphology data": { group: "Words and people", title: "Hebrew parsing", name: "OSHB" },
  "TAGNT — Translators Amalgamated Greek NT (per-word English glosses)": { group: "Words and people", title: "Greek word glosses", name: "STEPBible TAGNT" },
  "TAHOT — Translators Amalgamated Hebrew OT (per-morpheme English glosses)": { group: "Words and people", title: "Hebrew word glosses", name: "STEPBible TAHOT" },
  "TBESG — brief Greek lexicon of Extended Strongs": { group: "Words and people", title: "Greek dictionary forms", name: "STEPBible TBESG" },
  "TBESH — brief Hebrew lexicon of Extended Strongs": { group: "Words and people", title: "Hebrew dictionary forms", name: "STEPBible TBESH" },
  "TVTMS — versification traditions": { group: "Words and people", title: "Verse numbering", name: "STEPBible TVTMS" },
  // The syntax and speaker layers (sources.manifest.json, audit item 7, 12 Oct 2026).
  "MACULA Greek Linguistic Datasets — SBLGNT syntax trees (release 24.06.17)": { group: "Words and people", title: "Syntax", name: "MACULA Greek" },
  "MACULA Hebrew Linguistic Datasets — WLC syntax trees (release 26.04.13)": { group: "Words and people", title: "Hebrew syntax", name: "MACULA Hebrew" },
  "Glyssen character data — CharacterVerse.txt and CharacterDetail.txt (control file version 171)": { group: "Words and people", title: "Speakers", name: "Glyssen" },
  // Understand without AI (docs/no-ai-understand.md): each line's source, as its credit names it.
  "unfoldingWord Simplified Text (en_ust)": { group: "Understand", title: "In plain words", name: "unfoldingWord Simplified Text" },
  "unfoldingWord Translation Notes (en_tn)": { group: "Understand", title: "Readers differ, Explained and book introductions", name: "unfoldingWord Translation Notes" },
  "unfoldingWord Translation Questions (en_tq)": { group: "Understand", title: "Check what you read", name: "unfoldingWord Translation Questions" },
  "unfoldingWord Translation Words (en_tw)": { group: "Understand", title: "Key words", name: "unfoldingWord Translation Words" },
  "unfoldingWord Translation Word Links (en_twl)": { group: "Understand", title: "Key word links", name: "unfoldingWord Translation Word Links" },
  "unfoldingWord Open Bible Stories (en_obs)": { group: "Understand", title: "Passage summaries", name: "unfoldingWord Open Bible Stories" },
  "Berean Standard Bible translation tables (bsb_tables.tsv)": { group: "Understand", title: "Headings, footnotes and word links", name: "Berean tables" },
  // MS-01 (build 6): licences read from each repository's own files (rule 3; sources.manifest.json).
  "OpenBible.info Bible Geocoding Data — ancient places and modern locations (ancient.jsonl, modern.jsonl)": { group: "Understand", title: "Places", name: "OpenBible.info" },
  "Natural Earth 1:10m land, lakes and rivers (v5.2.0-pre)": { group: "Understand", title: "Map outlines", name: "Natural Earth" },
  "Keil and Delitzsch, Biblical Commentary on the Old Testament (English translation; vols 1, 2, 4, 5 and 6)": {
    group: "Understand",
    title: "Readings on debated passages",
    name: "Keil and Delitzsch",
  },
  "Ellicott, A Bible Commentary for English Readers, vols VII (Acts to Galatians) and VIII (Ephesians to Revelation)": {
    group: "Understand",
    title: "Readings on debated passages",
    name: "Ellicott’s Commentary",
  },
  "Driver and Neubauer, The Fifty-third Chapter of Isaiah According to the Jewish Interpreters, vol. II: Translations": {
    group: "Understand",
    title: "Readings on debated passages",
    name: "Driver and Neubauer",
  },
  "Adam Clarke's Commentary and Critical Notes on the Bible (CrossWire SWORD module Clarke 2.0)": {
    group: "Understand",
    title: "Readings on debated passages",
    name: "Adam Clarke’s Commentary",
  },
  // Build 6 item H: the word screen's grammar terms, one sentence each, credited there too. Listed once
  // core is packaged from the manifest that names them.
  "unfoldingWord Greek Grammar (en_ugg)": { group: "Words and people", title: "Greek grammar terms", name: "unfoldingWord Greek Grammar" },
  "unfoldingWord Hebrew Grammar (en_uhg)": { group: "Words and people", title: "Hebrew grammar terms", name: "unfoldingWord Hebrew Grammar" },
  "unfoldingWord Aramaic Grammar (en_uag)": { group: "Words and people", title: "Aramaic grammar terms", name: "unfoldingWord Aramaic Grammar" },
  "J. Gresham Machen, New Testament Greek for Beginners (Macmillan, 1923)": { group: "Words and people", title: "Greek grammar terms, six of them", name: "Machen’s Greek for Beginners" },
  // A downloaded Old Testament text; listed only once the app handles a text that has no New Testament.
  // Build 7a: Today's own sources, rows made by data/today.ts's todaySources().
  [SPURGEON_DATASET]: { group: "Today", title: "Devotional", name: "Spurgeon, Morning and Evening" },
  [DAILY_LIGHT_DATASET]: { group: "Today", title: "The day’s verse", name: "Daily Light on the Daily Path" },
  [PICTURES_DATASET]: { group: "Today", title: "Today’s pictures", name: "Wikimedia Commons" },
  "JPS Tanakh 1917, The Holy Scriptures According to the Masoretic Text (engjps)": { group: "Bible text", title: "JPS 1917", name: "English · JPS" },
};

/**
 * The app does not yet handle a translation with no New Testament, so JPS 1917 (Old Testament only) stays
 * off the page until it does (more-translations plan; JPS stays out of the bundle manifest too).
 */
export const OT_ONLY_TEXTS_READY = false;

const OT_ONLY: ReadonlySet<string> = new Set(["JPS Tanakh 1917, The Holy Scriptures According to the Masoretic Text (engjps)"]);

const ORDER = Object.keys(ROLE);

/** Licences whose terms put the notice itself on screen, not only the licence's name. */
const SHOWS_ATTRIBUTION: ReadonlySet<string> = new Set(["CC-BY-SA-4.0"]);

/**
 * The LSV's notice as its licence asks for it: "the above copyright and source
 * information", read from englsv_about.htm in the eBible download (rule 3,
 * 11 Oct 2026). It is shown in place of the row's text because core v5 was
 * packaged with an earlier wording that also named the Covenant Christian
 * Coalition; once core is packaged again from packages/pipeline/src/sources.ts
 * the two are the same. Also what shows if the row ever arrives without one: a
 * share-alike text is never shown without its attribution.
 */
const LSV_ATTRIBUTION =
  "Literal Standard Version. Copyright © 2020 Covenant Press. Licensed under CC BY-SA 4.0. From eBible.org.";

/** A sources row, with the version's code and name when it came from a downloaded translation. */
export type SourceInput = Pick<SourceRow, "dataset" | "license" | "url"> &
  Partial<Pick<SourceRow, "attribution">> & { readonly translation?: { readonly code: string; readonly name: string } };

/**
 * Not shown as text sources: the typefaces (their OFL files ship with them),
 * the pilot WEB excerpt, whose text and licence the full WEB row covers,
 * and Matthew Henry and Easton, pinned for build 8 but not yet in any bundle (15 Oct 2026): a source is
 * credited once its words reach a reader.
 */
function isOmitted(dataset: string): boolean {
  return (
    /^(Literata|Gentium Plus|Noto Serif Hebrew|Matthew Henry's Concise Commentary|Easton's Bible Dictionary)\b/.test(dataset) ||
    dataset === "World English Bible — John 1, Genesis 1, 1 Corinthians 14"
  );
}

export function sourceItems(rows: readonly SourceInput[], options: { otOnlyTexts?: boolean } = {}): SourceItem[] {
  const otOnly = options.otOnlyTexts ?? OT_ONLY_TEXTS_READY;
  return rows
    .flatMap((row) => {
      // A dataset not in the table still shows, under its own name: an attribution
      // must never vanish because a manifest string changed (licence rule 3).
      if (isOmitted(row.dataset)) return [];
      if (!otOnly && (OT_ONLY.has(row.dataset) || row.translation?.code === "JPS")) return [];
      const role =
        row.translation !== undefined
          ? { group: "Bible text" as const, title: row.translation.name, name: `English · ${row.translation.code}` }
          : (ROLE[row.dataset] ?? { group: "Words and people" as const, title: row.dataset, name: row.dataset });
      const given = row.attribution?.trim() ?? "";
      const attribution = !SHOWS_ATTRIBUTION.has(row.license)
        ? null
        : row.dataset === "Literal Standard Version (englsv)"
          ? LSV_ATTRIBUTION
          : given !== ""
            ? given
            : null;
      return [
        {
          dataset: row.dataset,
          group: role.group,
          title: role.title,
          subtitle: `${role.name} · ${licenceLabel(row.license)}`,
          value: role.group === "Bible text" ? licenceLabel(row.license) : `${role.name} · ${licenceLabel(row.license)}`,
          url: row.url,
          label: `${role.title}, ${role.name.replace(" · ", ", ")}, ${licenceLabel(row.license)}${attribution === null ? "" : `. ${attribution}`}, opens the source`,
          attribution,
        },
      ];
    })
    .sort((a, b) => rank(a) - rank(b));
}

/** The table's order; downloaded versions follow the built-in texts, in the order given (a stable sort). */
function rank(item: SourceItem): number {
  const at = ORDER.indexOf(item.dataset);
  if (at !== -1) return at;
  return item.group === "Bible text" ? ORDER.indexOf("morphgnt/sblgnt (morphological annotations)") - 0.5 : -1;
}

/**
 * Share-alike (edge case 8): Yada's adapted copy of the notes goes out under the same licence,
 * and says so with the licence's own address, which CC BY-SA 4.0 §3(a)(1) accepts in place of
 * the full text. Yada's words, not the source's: the one line on this page that is.
 */
export const ADAPTED_COPY =
  "Yada’s adapted copy of these notes is shared under the same licence, Creative Commons Attribution-ShareAlike 4.0 International: https://creativecommons.org/licenses/by-sa/4.0/";

/** A row of a downloaded study file's `sources` table (data/studyQueries.ts StudySource). */
export interface StudySourceInput {
  readonly key: string;
  readonly name: string;
  readonly license: string;
  readonly license_notice: string;
  readonly attribution: string;
  readonly modifications: string;
}

/**
 * Sources' Study notes group: each source's attribution, its licence statement as the package
 * printed it, and, for Tyndale's share-alike notes, what was changed (CC BY-SA asks for both).
 * Every word comes from the file's own row (rule 3); only the role title is Yada's.
 */
export function studySourceItem(row: StudySourceInput): { title: string; subtitle: string; lines: string[]; label: string } {
  const tyndale = row.key === "tosn";
  const title = tyndale ? "Study notes" : "Cross-references";
  const subtitle = `${row.name} · ${licenceLabel(row.license)}`;
  const lines = [
    row.attribution,
    row.license_notice,
    ...(tyndale ? [`Changes: ${row.modifications}`, ADAPTED_COPY] : []),
  ].filter((l) => l.trim() !== "");
  return { title, subtitle, lines, label: `${title}, ${row.name}, ${licenceLabel(row.license)}. ${lines.join(" ")}, opens the source` };
}
