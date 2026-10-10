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
}

/** Licence codes in the sources table, in the words readers know them by. SBLGNT's EULA is its own (S11). */
const LICENCE: Readonly<Record<string, string>> = {
  "CC-BY-SA-3.0": "CC BY-SA 3.0",
  "CC-BY-4.0": "CC BY 4.0",
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
  "morphgnt/sblgnt (morphological annotations)": { group: "Word data", title: "Greek parsing", name: "MorphGNT" },
  "morphhb — lemma and morphology data": { group: "Word data", title: "Hebrew parsing", name: "OSHB" },
  "TAGNT — Translators Amalgamated Greek NT (per-word English glosses)": { group: "Word data", title: "Greek word glosses", name: "STEPBible TAGNT" },
  "TAHOT — Translators Amalgamated Hebrew OT (per-morpheme English glosses)": { group: "Word data", title: "Hebrew word glosses", name: "STEPBible TAHOT" },
  "TBESG — brief Greek lexicon of Extended Strongs": { group: "Word data", title: "Greek dictionary forms", name: "STEPBible TBESG" },
  "TBESH — brief Hebrew lexicon of Extended Strongs": { group: "Word data", title: "Hebrew dictionary forms", name: "STEPBible TBESH" },
  "TVTMS — versification traditions": { group: "Word data", title: "Verse numbering", name: "STEPBible TVTMS" },
};

const ORDER = Object.keys(ROLE);

/**
 * Not shown as text sources: the typefaces (their OFL files ship with them),
 * and the pilot WEB excerpt, whose text and licence the full WEB row covers.
 */
function isOmitted(dataset: string): boolean {
  return /^(Literata|Gentium Plus|Noto Serif Hebrew)$/.test(dataset) || dataset === "World English Bible — John 1, Genesis 1, 1 Corinthians 14";
}

export function sourceItems(rows: readonly Pick<SourceRow, "dataset" | "license" | "url">[]): SourceItem[] {
  return rows
    .flatMap((row) => {
      // A dataset not in the table still shows, under its own name: an attribution
      // must never vanish because a manifest string changed (licence rule 3).
      if (isOmitted(row.dataset)) return [];
      const role = ROLE[row.dataset] ?? { group: "Word data" as const, title: row.dataset, name: row.dataset };
      return [
        {
          dataset: row.dataset,
          group: role.group,
          title: role.title,
          subtitle: `${role.name} · ${licenceLabel(row.license)}`,
          url: row.url,
          label: `${role.title}, ${role.name.replace(" · ", ", ")}, ${licenceLabel(row.license)}, opens the source`,
        },
      ];
    })
    .sort((a, b) => ORDER.indexOf(a.dataset) - ORDER.indexOf(b.dataset));
}
