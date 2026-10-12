/**
 * Sources (SO-02): each dataset the app ships, as a reader would name it.
 *
 * The role and short name are Yada's words for the dataset (v2-review S15,
 * S16, S20); the licence and link come from the core bundle's `sources` row
 * and nothing else (rule 3). `encumbered` is never read here: it holds the
 * team's open legal questions (PRD 0E), not licence terms for readers.
 */

import type { SourceRow } from "../data/queries";

export type SourceGroup = "Bible text" | "Word data";

export interface SourceItem {
  readonly dataset: string;
  readonly group: SourceGroup;
  /** Role first (`Greek parsing`), or the translation's own name (`Berean Standard Bible`). */
  readonly title: string;
  /** The dataset and its licence: `MorphGNT · CC BY-SA 3.0`. */
  readonly subtitle: string;
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

/**
 * Keyed on the dataset name the pipeline writes from sources.manifest.json.
 * Fonts and the early WEB excerpt file are not listed: they carry no text a
 * reader reads as Scripture or word data.
 */
const ROLE: Readonly<Record<string, { group: SourceGroup; title: string; name: string }>> = {
  "SBLGNT (Greek text)": { group: "Bible text", title: "Greek New Testament", name: "SBLGNT" },
  "morphhb — Westminster Leningrad Codex text": { group: "Bible text", title: "Hebrew Bible", name: "Westminster Leningrad Codex" },
  "Berean Standard Bible (text)": { group: "Bible text", title: "Berean Standard Bible", name: "English · BSB" },
  "World English Bible, Protestant canon (engwebp)": { group: "Bible text", title: "World English Bible", name: "English · WEB" },
  "King James Version, 1769 standardised text (eng-kjv2006)": { group: "Bible text", title: "King James Version", name: "English · KJV" },
  "Literal Standard Version (englsv)": { group: "Bible text", title: "Literal Standard Version", name: "English · LSV" },
  "morphgnt/sblgnt (morphological annotations)": { group: "Word data", title: "Greek parsing", name: "MorphGNT" },
  "morphhb — lemma and morphology data": { group: "Word data", title: "Hebrew parsing", name: "OSHB" },
  "TAGNT — Translators Amalgamated Greek NT (per-word English glosses)": { group: "Word data", title: "Greek word glosses", name: "STEPBible TAGNT" },
  "TAHOT — Translators Amalgamated Hebrew OT (per-morpheme English glosses)": { group: "Word data", title: "Hebrew word glosses", name: "STEPBible TAHOT" },
  "TBESG — brief Greek lexicon of Extended Strongs": { group: "Word data", title: "Greek dictionary forms", name: "STEPBible TBESG" },
  "TBESH — brief Hebrew lexicon of Extended Strongs": { group: "Word data", title: "Hebrew dictionary forms", name: "STEPBible TBESH" },
  "TVTMS — versification traditions": { group: "Word data", title: "Verse numbering", name: "STEPBible TVTMS" },
};

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
 * and the pilot WEB excerpt, whose text and licence the full WEB row covers.
 */
function isOmitted(dataset: string): boolean {
  return /^(Literata|Gentium Plus|Noto Serif Hebrew)$/.test(dataset) || dataset === "World English Bible — John 1, Genesis 1, 1 Corinthians 14";
}

export function sourceItems(rows: readonly SourceInput[]): SourceItem[] {
  return rows
    .flatMap((row) => {
      // A dataset not in the table still shows, under its own name: an attribution
      // must never vanish because a manifest string changed (licence rule 3).
      if (isOmitted(row.dataset)) return [];
      const role =
        row.translation !== undefined
          ? { group: "Bible text" as const, title: row.translation.name, name: `English · ${row.translation.code}` }
          : (ROLE[row.dataset] ?? { group: "Word data" as const, title: row.dataset, name: row.dataset });
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
