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

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { type License, type SourceManifestEntry } from "@yada/schema";

import { ensureDirs, MANIFEST, RAW } from "./paths.js";

export interface SourceFile {
  /** Local filename under content/raw. */
  file: string;
  url: string;
  /** The URL is a zip; extract this member into `file`. */
  zipMember?: string;
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
  /**
   * The publisher offers no versioned URL, so the snapshot is pinned by content
   * digest instead of commit. `ingest` refuses to silently accept a changed file:
   * a source update must be a deliberate migration (PRD §11.2), never drift.
   */
  pinnedByDigest?: boolean;
}

const MORPHGNT_COMMIT = "aaed91e57c8e4a8dc9a2383e129ca5e75fe6393d";
const OSHB_COMMIT = "3d15126fb1ef74867fc1434be1942e837932691f";
const STEP_COMMIT = "079db44a434e7f2bf5e33f95058e43d7437be92b";

const MORPHGNT_BOOKS = ["61-Mt", "62-Mk", "63-Lk", "64-Jn", "65-Ac", "66-Ro", "67-1Co", "68-2Co", "69-Ga", "70-Eph", "71-Php", "72-Col", "73-1Th", "74-2Th", "75-1Ti", "76-2Ti", "77-Tit", "78-Phm", "79-Heb", "80-Jas", "81-1Pe", "82-2Pe", "83-1Jn", "84-2Jn", "85-3Jn", "86-Jud", "87-Re"];
const OSHB_BOOKS = ["Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam", "2Sam", "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh", "Esth", "Job", "Ps", "Prov", "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos", "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal"];

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
    // All 27 books: the interlinear is complete at launch (PRD §7).
    files: MORPHGNT_BOOKS.map((b) => morphgnt(`${b}-morphgnt.txt`)),
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
    // All 39 books, in canonical order.
    files: OSHB_BOOKS.map((b) => oshb(`${b}.xml`)),
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
  // ---------------------------------------------------------------------------
  // English translations. None of these publishers offers a versioned URL, so
  // each is pinned by content digest.
  // ---------------------------------------------------------------------------
  {
    key: "bsb",
    source: "Berean Bible / Bible Hub",
    dataset: "Berean Standard Bible (text)",
    license: "PUBLIC_DOMAIN",
    attribution_text: "The Holy Bible, Berean Standard Bible, BSB. Dedicated to the public domain.",
    homepage: "https://bereanbible.com",
    commit: "unversioned",
    pinnedByDigest: true,
    files: [{ file: "bsb.txt", url: "https://bereanbible.com/bsb.txt" }],
    modifications:
      "Verse-per-line text parsed into verse ids. Read from the file header: 'This text of God's Word has been dedicated to the public domain.'",
  },
  {
    key: "web",
    source: "eBible.org",
    dataset: "World English Bible, Protestant canon (engwebp)",
    license: "PUBLIC_DOMAIN",
    attribution_text: "World English Bible (WEB). Public domain. 'World English Bible' is a trademark of eBible.org.",
    homepage: "https://ebible.org/web/",
    commit: "unversioned",
    pinnedByDigest: true,
    files: [
      {
        file: "engwebp_vpl.txt",
        url: "https://ebible.org/Scriptures/engwebp_vpl.zip",
        zipMember: "engwebp_vpl.txt",
      },
    ],
    // The trademark condition is real and easy to break: the name may only be
    // used for the unaltered text. Whitespace is the only thing touched.
    modifications:
      "Verse text used unaltered apart from whitespace. The WEB name is a trademark: if the text is ever changed, it must not be called the World English Bible.",
  },
  {
    key: "kjv",
    source: "eBible.org / CrossWire",
    dataset: "King James Version, 1769 standardised text (eng-kjv2006)",
    license: "PUBLIC_DOMAIN",
    attribution_text: "King James Version. Public domain outside the United Kingdom.",
    homepage: "https://ebible.org/kjv/",
    commit: "unversioned",
    pinnedByDigest: true,
    files: [
      {
        file: "eng-kjv2006_vpl.txt",
        url: "https://ebible.org/Scriptures/eng-kjv2006_vpl.zip",
        zipMember: "eng-kjv2006_vpl.txt",
      },
    ],
    modifications:
      "Pilcrows removed. Square brackets marking translator-supplied words (the printed italics) are removed from display text, so that distinction is not currently shown.",
    encumbered:
      "Crown letters patent: printing or importing the KJV in the UK requires permission (Cambridge University Press, Oxford University Press, Collins). Public domain elsewhere. Confirm the UK position with CUP before commercial distribution — PRD 0E.",
  },
  // ---------------------------------------------------------------------------
  // Contextual English glosses for the interlinear. STEPBible's own per-word
  // translations, so none of the Online Bible permission problem TBESH carries.
  // ---------------------------------------------------------------------------
  {
    key: "tahot",
    source: "STEPBible / Tyndale House Cambridge",
    dataset: "TAHOT — Translators Amalgamated Hebrew OT (per-morpheme English glosses)",
    license: "CC-BY-4.0",
    attribution_text: "Hebrew glosses created by www.STEPBible.org based on work at Tyndale House Cambridge, CC BY 4.0.",
    homepage: "https://github.com/STEPBible/STEPBible-Data",
    commit: STEP_COMMIT,
    files: ["Gen-Deu", "Jos-Est", "Job-Sng", "Isa-Mal"].map((part) => ({
      file: `TAHOT-${part}.txt`,
      url: `https://raw.githubusercontent.com/STEPBible/STEPBible-Data/${STEP_COMMIT}/Translators%20Amalgamated%20OT%2BNT/TAHOT%20${part}%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt`,
    })),
    modifications:
      "Only the English gloss column is used, aligned to OSHB tokens by consonantal surface within each verse. Words the alignment cannot place are left without a gloss and counted, never guessed.",
    encumbered: "STEPBible asks that the data not be redistributed directly; bundling it needs their confirmation — PRD 0E.",
  },
  {
    key: "tagnt",
    source: "STEPBible / Tyndale House Cambridge",
    dataset: "TAGNT — Translators Amalgamated Greek NT (per-word English glosses)",
    license: "CC-BY-4.0",
    attribution_text: "Greek glosses created by www.STEPBible.org based on work at Tyndale House Cambridge, CC BY 4.0.",
    homepage: "https://github.com/STEPBible/STEPBible-Data",
    commit: STEP_COMMIT,
    files: ["Mat-Jhn", "Act-Rev"].map((part) => ({
      file: `TAGNT-${part}.txt`,
      url: `https://raw.githubusercontent.com/STEPBible/STEPBible-Data/${STEP_COMMIT}/Translators%20Amalgamated%20OT%2BNT/TAGNT%20${part}%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt`,
    })),
    modifications:
      "Only words carried by the SBL edition are used, aligned to MorphGNT tokens by accent-stripped surface within each verse. Only the English gloss column is used.",
    encumbered: "STEPBible asks that the data not be redistributed directly; bundling it needs their confirmation — PRD 0E.",
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

async function fetchTo(file: SourceFile, dest: string): Promise<{ bytes: number; cached: boolean }> {
  if (existsSync(dest) && statSync(dest).size > 0) {
    return { bytes: statSync(dest).size, cached: true };
  }
  const response = await fetch(file.url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${file.url}`);
  const body = Buffer.from(await response.arrayBuffer());

  if (file.zipMember === undefined) {
    writeFileSync(dest, body);
    return { bytes: body.length, cached: false };
  }

  // eBible publishes archives only. The zip is kept beside the extracted file
  // so the digest can always be recomputed from what was actually downloaded.
  const zipPath = `${dest}.zip`;
  writeFileSync(zipPath, body);
  const member = execFileSync("unzip", ["-p", zipPath, file.zipMember], {
    maxBuffer: 256 * 1024 * 1024,
  });
  writeFileSync(dest, member);
  return { bytes: member.length, cached: false };
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
  const previousManifest: SourceManifestEntry[] = existsSync(MANIFEST)
    ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as SourceManifestEntry[])
    : [];

  for (const def of SOURCES) {
    const digests: string[] = [];
    for (const file of def.files) {
      const dest = path.join(RAW, file.file);
      const { bytes, cached } = await fetchTo(file, dest);
      digests.push(`${file.file}:${sha256(dest)}`);
      console.log(`  ${cached ? "cached" : "fetched"}  ${file.file}  ${(bytes / 1024) | 0} KB`);
    }
    // A publisher with no versioned URL is pinned by what was downloaded. If the
    // content has changed since the manifest was written, that is a source
    // migration and must be accepted deliberately rather than absorbed.
    let version = def.commit.slice(0, 7);
    let commitHash = def.commit;
    if (def.pinnedByDigest === true) {
      commitHash = `sha256:${createHash("sha256").update(digests.join("|")).digest("hex")}`;
      version = commitHash.slice(7, 19);
      const previous = previousManifest.find((e) => e.dataset === def.dataset);
      if (
        previous !== undefined &&
        previous.commit_hash !== commitHash &&
        process.env["YADA_ACCEPT_SOURCE_UPDATE"] !== "1"
      ) {
        throw new Error(
          `${def.dataset} changed since it was pinned (${previous.commit_hash} -> ${commitHash}). ` +
            "Source updates are migrations, not drift: review the change, then re-run with YADA_ACCEPT_SOURCE_UPDATE=1.",
        );
      }
    }
    entries.push({
      source: def.source,
      dataset: def.dataset,
      version,
      commit_hash: commitHash,
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
