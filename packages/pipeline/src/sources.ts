/**
 * Source definitions and the `ingest` stage.
 *
 * The manifest is *generated* here rather than maintained by hand: a hand-kept
 * manifest drifts the moment someone forgets, and PRD §11.2 requires every
 * entry to be traceable to an exact snapshot.
 *
 * Note on which Greek and Hebrew sources are primary: `docs/dataset-selection.md`
 * recommends STEPBible TAGNT/TAHOT, and that recommendation stands. This stage
 * still derives from MorphGNT and OSHB, because the seven golden fixtures were
 * authored by hand from those files and they are the only oracle the derive
 * stage can be checked against. Adopting TAGNT is then a *verifiable migration*
 * — does it reproduce the same derivation? — rather than an unverified swap.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { type License, type SourceManifestEntry } from "@yada/schema";

import { ensureDirs, MANIFEST, RAW } from "./paths.js";

export interface SourceFile {
  /** Local filename under content/raw. */
  file: string;
  url: string;
}

export interface SourceDef {
  key: string;
  source: string;
  dataset: string;
  license: License;
  attribution_text: string;
  homepage: string;
  commit: string;
  files: SourceFile[];
  modifications: string;
  /** True when the licence permits our use only conditionally. */
  encumbered?: string;
}

const MORPHGNT_COMMIT = "aaed91e57c8e4a8dc9a2383e129ca5e75fe6393d";
const OSHB_COMMIT = "3d15126fb1ef74867fc1434be1942e837932691f";
const STEP_COMMIT = "079db44a434e7f2bf5e33f95058e43d7437be92b";

const morphgnt = (name: string): SourceFile => ({
  file: name,
  url: `https://raw.githubusercontent.com/morphgnt/sblgnt/${MORPHGNT_COMMIT}/${name}`,
});

const oshb = (name: string): SourceFile => ({
  file: name,
  url: `https://raw.githubusercontent.com/openscriptures/morphhb/${OSHB_COMMIT}/wlc/${name}`,
});

export const SOURCES: SourceDef[] = [
  {
    key: "morphgnt",
    source: "MorphGNT",
    dataset: "morphgnt/sblgnt (morphological annotations)",
    license: "CC-BY-SA-3.0",
    attribution_text: "Morphological annotations from MorphGNT, licensed CC BY-SA 3.0.",
    homepage: "https://github.com/morphgnt/sblgnt",
    commit: MORPHGNT_COMMIT,
    files: [morphgnt("64-Jn-morphgnt.txt"), morphgnt("67-1Co-morphgnt.txt"), morphgnt("87-Re-morphgnt.txt")],
    modifications:
      "Parsed for lemma and morphology; apparatus markers stripped from display surfaces. Share-alike obligations for a closed-source app not yet assessed.",
  },
  {
    key: "sblgnt-text",
    source: "Society of Biblical Literature / Logos Bible Software",
    dataset: "SBLGNT (Greek text)",
    license: "CUSTOM_EULA",
    attribution_text:
      "Scripture quotations marked SBLGNT are from the SBL Greek New Testament. Copyright © 2010 Society of Biblical Literature and Logos Bible Software.",
    homepage: "https://sblgnt.com/license/",
    commit: MORPHGNT_COMMIT,
    files: [],
    modifications:
      "Carried inside the MorphGNT files. NOT CLEARED FOR COMMERCIAL USE — its own EULA, not a Creative Commons licence, and the terms have not been reviewed.",
    encumbered: "SBLGNT EULA has not been reviewed; blocks commercial distribution of the Greek text.",
  },
  // OSHB carries two licences in one repository, exactly as SBLGNT does: the
  // WLC text is public domain, the lemma and morphology data is CC BY 4.0.
  // They are separate manifest entries so the distinction survives — collapsing
  // them is how a licence problem gets lost.
  {
    key: "oshb",
    source: "Open Scriptures",
    dataset: "morphhb — lemma and morphology data",
    license: "CC-BY-4.0",
    attribution_text:
      "Lemma and morphology data from the Open Scriptures Hebrew Bible, licensed CC BY 4.0.",
    homepage: "https://github.com/openscriptures/morphhb",
    commit: OSHB_COMMIT,
    files: [oshb("Gen.xml"), oshb("Lev.xml"), oshb("Ps.xml"), oshb("Isa.xml")],
    modifications:
      "Morpheme separators parsed into structure; homograph letters folded onto Strong's numbers (7462 b -> H7462b).",
  },
  {
    key: "wlc-text",
    source: "Westminster Leningrad Codex",
    dataset: "morphhb — Westminster Leningrad Codex text",
    license: "PUBLIC_DOMAIN",
    attribution_text: "Hebrew text from the Westminster Leningrad Codex, public domain.",
    homepage: "https://github.com/openscriptures/morphhb",
    commit: OSHB_COMMIT,
    files: [],
    modifications:
      "Carried inside the morphhb files. Morpheme separators stripped from display surfaces; cantillation retained.",
  },
  {
    key: "tvtms",
    source: "STEPBible / Tyndale House Cambridge",
    dataset: "TVTMS — versification traditions",
    license: "CC-BY-4.0",
    attribution_text: "Versification data created by www.STEPBible.org based on work at Tyndale House Cambridge, CC BY 4.0.",
    homepage: "https://github.com/STEPBible/STEPBible-Data",
    commit: STEP_COMMIT,
    files: [
      {
        file: "TVTMS.txt",
        url: `https://raw.githubusercontent.com/STEPBible/STEPBible-Data/${STEP_COMMIT}/Versification/TVTMS%20-%20Translators%20Versification%20Traditions%20with%20Methodology%20for%20Standardisation%20for%20Eng%2BHeb%2BLat%2BGrk%2BOthers%20-%20STEPBible.org%20CC%20BY.txt`,
      },
    ],
    modifications: "Parsed for English/Hebrew mappings and superscription flags.",
  },
  {
    key: "tbesh",
    source: "STEPBible / Tyndale House Cambridge",
    dataset: "TBESH — brief Hebrew lexicon of Extended Strongs",
    license: "CC-BY-4.0",
    attribution_text: "Lexicon data created by www.STEPBible.org based on work at Tyndale House Cambridge, CC BY 4.0.",
    homepage: "https://github.com/STEPBible/STEPBible-Data",
    commit: STEP_COMMIT,
    files: [
      {
        file: "TBESH.txt",
        url: `https://raw.githubusercontent.com/STEPBible/STEPBible-Data/${STEP_COMMIT}/Lexicons/TBESH%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Hebrew%20-%20STEPBible.org%20CC%20BY.txt`,
      },
    ],
    modifications: "Parsed for lexical glosses keyed by extended Strong's number.",
    encumbered:
      "Definitions derive from the Abridged BDB by Online Bible; the file states permission should be gained before applying them in any project. Derive runs without it.",
  },
  {
    key: "tbesg",
    source: "STEPBible / Tyndale House Cambridge",
    dataset: "TBESG — brief Greek lexicon of Extended Strongs",
    license: "CC-BY-4.0",
    attribution_text: "Lexicon data created by www.STEPBible.org based on work at Tyndale House Cambridge, CC BY 4.0.",
    homepage: "https://github.com/STEPBible/STEPBible-Data",
    commit: STEP_COMMIT,
    files: [
      {
        file: "TBESG.txt",
        url: `https://raw.githubusercontent.com/STEPBible/STEPBible-Data/${STEP_COMMIT}/Lexicons/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt`,
      },
    ],
    // Read for the lemma -> Strong's mapping only. MorphGNT carries no Strong's
    // numbers, and this is the citable source that replaces recalling them.
    modifications:
      "Parsed for the lemma-to-extended-Strong's mapping; definitions not read. Lemma forms normalised to NFC to reconcile polytonic oxia with monotonic tonos.",
    // Unlike TBESH, the definitions here are Abbott-Smith (1922) and MiddleLiddell
    // rather than BDB via Online Bible, and the header carries no permission
    // clause — so the only live constraint is the shared redistribution request.
  },
];

/**
 * Dataset names that used to be managed here and no longer are.
 *
 * The merge below deliberately preserves manifest entries this stage does not
 * fetch — fonts, the spike's WEB text. That rule also preserves the *old* name
 * when a managed dataset is renamed, leaving a stale duplicate behind. It
 * happened once already: splitting `morphhb — WLC text with lemma and
 * morphology` into separate public-domain-text and CC-BY-annotation entries left
 * the original in place, still claiming one licence for both, which is the exact
 * conflation the split existed to remove. Retiring a name is explicit so a
 * licence entry cannot outlive the decision that replaced it.
 */
const RETIRED_DATASETS = new Set(["morphhb — WLC text with lemma and morphology"]);

async function fetchTo(url: string, dest: string): Promise<{ bytes: number; cached: boolean }> {
  if (existsSync(dest) && statSync(dest).size > 0) {
    return { bytes: statSync(dest).size, cached: true };
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  const body = Buffer.from(await response.arrayBuffer());
  writeFileSync(dest, body);
  return { bytes: body.length, cached: false };
}

export function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16);
}

/**
 * Fetch every pinned file, then regenerate the manifest from the source
 * definitions. Re-running with unchanged pins is a no-op.
 */
export async function ingest(): Promise<void> {
  ensureDirs();
  const retrievedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const entries: SourceManifestEntry[] = [];

  for (const def of SOURCES) {
    const digests: string[] = [];
    for (const file of def.files) {
      const dest = path.join(RAW, file.file);
      const { bytes, cached } = await fetchTo(file.url, dest);
      digests.push(`${file.file}:${sha256(dest)}`);
      console.log(`  ${cached ? "cached" : "fetched"}  ${file.file}  ${(bytes / 1024) | 0} KB`);
    }
    entries.push({
      source: def.source,
      dataset: def.dataset,
      version: def.commit.slice(0, 7),
      commit_hash: def.commit,
      license: def.license,
      attribution_text: def.attribution_text,
      url: def.homepage,
      retrieved_at: retrievedAt,
      modifications:
        def.modifications + (def.encumbered === undefined ? "" : ` ENCUMBERED: ${def.encumbered}`),
    });
    if (digests.length > 0) console.log(`  ${def.key}: ${digests.join(" ")}`);
  }

  // Preserve manifest entries for things this stage does not fetch (fonts, text).
  const existing: SourceManifestEntry[] = existsSync(MANIFEST)
    ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as SourceManifestEntry[])
    : [];
  const managed = new Set(SOURCES.map((s) => s.dataset));
  const dropped = existing.filter((e) => RETIRED_DATASETS.has(e.dataset));
  const merged = [
    ...entries,
    ...existing.filter((e) => !managed.has(e.dataset) && !RETIRED_DATASETS.has(e.dataset)),
  ];
  for (const entry of dropped) console.log(`  retired: ${entry.dataset}`);

  writeFileSync(MANIFEST, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`\nmanifest: ${merged.length} datasets -> sources.manifest.json`);
}
