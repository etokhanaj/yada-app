/**
 * More translations (brief §8.20, docs/more-translations-plan.md, canvas
 * MT-02–05): the catalogue of downloadable versions, their covers, and the
 * words each row shows and speaks. Pure, so it can be tested.
 *
 * The catalogue is the `translations` list in the bundle manifest the
 * pipeline publishes to R2 (plan, Build 4). Every licence, attribution and
 * size here is read from that list or from the downloaded file itself, never
 * written into the app (rule 3).
 */

import { BUNDLE_FORMAT, type TranslationInfo, TranslationInfoSchema } from "@yada/schema";

import { formatMB, spokenMB } from "./progress";
import { verifySha256 } from "./sha256";

// ---------------------------------------------------------------------------
// Covers
// ---------------------------------------------------------------------------

/** The five brand tones (plan, "Translation covers"). Tone is identity, never state. */
export type CoverTone = "forest" | "paper" | "ink" | "lime" | "sage";

export const COVER_TONES: Readonly<Record<CoverTone, { ground: string; groundDark?: string; text: string }>> = {
  forest: { ground: "#183F35", text: "#F7F8F0" },
  paper: { ground: "#F7F8F0", text: "#183F35" },
  ink: { ground: "#16231E", groundDark: "#0B120F", text: "#DBEC9A" },
  lime: { ground: "#DBEC9A", text: "#183F35" },
  sage: { ground: "#526D63", text: "#F7F8F0" },
};

/** Fixed per version so readers learn them; a new version brings its own `cover` in the manifest. */
const KNOWN_COVERS: Readonly<Record<string, CoverTone>> = {
  BSB: "forest",
  NKJV: "forest",
  WEB: "paper",
  YLT: "paper",
  NLT: "paper",
  KJV: "ink",
  LSV: "lime",
  MSB: "lime",
  ASV: "sage",
  NIV: "sage",
};

function isCoverTone(value: unknown): value is CoverTone {
  return typeof value === "string" && value in COVER_TONES;
}

export function coverTone(code: string, fromManifest?: unknown): CoverTone {
  if (isCoverTone(fromManifest)) return fromManifest;
  return KNOWN_COVERS[code] ?? "paper";
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/**
 * One downloadable version: the pipeline's manifest entry (`TranslationInfo`
 * in @yada/schema, written by `yada package translation`), plus `url`, its
 * `file` resolved against the manifest it came from. `license` is the
 * LicenseSchema code; screens show it through `licenceLabel` (lib/sources.ts).
 */
export type CatalogueEntry = TranslationInfo & { readonly url: string };

export interface Catalogue {
  readonly entries: CatalogueEntry[];
  /** The manifest, or one of its entries, is a format newer than this build reads. */
  readonly needsUpdate: boolean;
}

/** A `format` above the one this build reads. Anything else is left to the schema. */
function newerFormat(value: unknown): boolean {
  return typeof value === "number" && value > BUNDLE_FORMAT;
}

/**
 * The manifest's `translations` list, keeping only entries the pipeline's own
 * schema accepts. A malformed entry is dropped rather than half-shown: a
 * version whose digest or licence is missing must never be offered for
 * download. The app was first built to its own entry shape (`url`, free-text
 * licence) and could not read what the pipeline published; parsing with the
 * shared schema keeps the two from drifting again.
 *
 * A newer `format`, on the manifest or on an entry, is a file this build
 * cannot read: offered, it would download and then fail its check on every
 * tap. It is kept out of Download, and `needsUpdate` says so on screen, so a
 * version does not vanish without a word. Checked before the schema, since a
 * newer entry may not match this build's shape at all.
 */
export function parseCatalogue(manifest: unknown, manifestUrl: string): Catalogue {
  if (manifest === null || typeof manifest !== "object") return { entries: [], needsUpdate: false };
  const { format, translations: list } = manifest as { format?: unknown; translations?: unknown };
  if (!Array.isArray(list)) return { entries: [], needsUpdate: false };
  if (newerFormat(format)) return { entries: [], needsUpdate: list.length > 0 };
  const out: CatalogueEntry[] = [];
  const seen = new Set<string>();
  let needsUpdate = false;
  for (const raw of list as unknown[]) {
    if (raw === null || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (newerFormat(e["format"])) {
      needsUpdate = true;
      continue;
    }
    // A tone this build does not know falls back to the version's fixed cover rather than
    // hiding the version: the cover is identity, never a reason to refuse a text.
    const code = typeof e["code"] === "string" ? e["code"] : "";
    const parsed = TranslationInfoSchema.safeParse({ ...e, cover: coverTone(code, e["cover"]) });
    if (!parsed.success || seen.has(parsed.data.code)) continue;
    seen.add(parsed.data.code);
    out.push({ ...parsed.data, url: resolveUrl(manifestUrl, parsed.data.file) });
  }
  return { entries: out, needsUpdate };
}

/** Under Download when the manifest offers what this build cannot read. */
export const UPDATE_LINE = "Update Yada to get more translations.";

/**
 * An entry's url, resolved against the manifest's own location. By hand:
 * React Native's URL joins a relative path onto the whole base, file name and all.
 */
export function resolveUrl(manifestUrl: string, url: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  if (url.startsWith("/")) return `${/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i.exec(manifestUrl)?.[0] ?? ""}${url}`;
  return `${manifestUrl.slice(0, manifestUrl.lastIndexOf("/") + 1)}${url}`;
}

/**
 * A downloaded file is the one the manifest names, by size and by digest,
 * before it is moved into place or attached: a wrong or truncated file is never read.
 */
export async function verifyDownload(bytes: Uint8Array, entry: Pick<CatalogueEntry, "bytes" | "sha256">): Promise<boolean> {
  return bytes.length === entry.bytes && (await verifySha256(bytes, entry.sha256));
}

/**
 * The text to show for one verse in `code`. A downloaded version that lacks
 * the verse (in the manifest's `missing`, or a blank row: the ASV leaves
 * Matthew 23:14 empty) gives null, never BSB's words under ASV's name. Other codes keep the BSB
 * fallback: a licensed version is not in core, so the sheet shows BSB there.
 */
export function verseTextIn(texts: Readonly<Partial<Record<string, string>>>, code: string, downloaded: boolean): string | null {
  const own = texts[code];
  if (own !== undefined) return own;
  return downloaded ? null : (texts["BSB"] ?? "");
}

/**
 * True when verseTextIn shows BSB's words for `code`: a licensed version is not in
 * core, and explanations are built only from the Greek, Hebrew and open texts
 * (CLAUDE.md rule 9), so the sheet must say whose words it is showing.
 */
export function bsbStandsIn(texts: Readonly<Partial<Record<string, string>>>, code: string, downloaded: boolean): boolean {
  return code !== "BSB" && !downloaded && texts[code] === undefined && texts["BSB"] !== undefined;
}

/** The muted line that says so in Understand; the peek, which explains nothing, says "Shown in BSB". */
export const BSB_BASIS = "Explanation based on BSB";

/** What stands in for a verse a version does not print, muted, as the reader leaves it out. */
export function notInLine(code: string): string {
  return `Not in ${code}`;
}

/** The ATTACH schema name: an identifier SQLite accepts unquoted, unique per file. */
export function schemaName(code: string, version: number): string {
  return `tr_${code.toLowerCase()}_v${version}`;
}

export interface SweepPlan<R> {
  /** Live rows, to attach in order. */
  readonly attach: R[];
  /** Codes of rows marked removed, to delete. */
  readonly dropRows: string[];
  /** Names in the translations folder no live row names, to delete. */
  readonly deleteFiles: string[];
}

/**
 * Launch, before anything attaches: which rows and files go. A file can only
 * be deleted while nothing has it attached (FTS5, data/bundles.ts rule 1), so
 * one that failed its check after ATTACH waits for this pass. It finds a file
 * whose row is marked removed, a download moved into place whose check then
 * failed (it never got a row), and a `.partial` left by a crash: each once
 * kept about 7.5 MB for good.
 */
export function sweepTranslations<R extends { code: string; file: string; removed: number }>(
  rows: readonly R[],
  files: readonly string[],
): SweepPlan<R> {
  const attach = rows.filter((r) => r.removed !== 1);
  const named = new Set(attach.map((r) => r.file));
  return {
    attach,
    dropRows: rows.filter((r) => r.removed === 1).map((r) => r.code),
    deleteFiles: files.filter((f) => !named.has(f)),
  };
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

type DownloadSizes = { readonly bytes: number; readonly download_bytes?: number | undefined };

/**
 * "3.4 MB" under a Download row: what the download costs, which is what the row
 * offers. The space it takes is stated once it is on the phone ("Downloaded ·
 * 7.5 MB"). Two sizes and a year on one muted line read as noise (John, 10 Oct 2026).
 */
export function downloadLine(entry: DownloadSizes): string {
  return formatMB(entry.download_bytes ?? entry.bytes);
}

/** "Downloaded · 1.3 MB" (MT-04). */
export function downloadedLine(bytes: number): string {
  return `Downloaded · ${formatMB(bytes)}`;
}

/** VoiceOver: each row is one element (plan, accessibility 4). */
export const rowLabel = {
  builtIn: (name: string, current: boolean) => (current ? `${name}, selected` : name),
  downloaded: (name: string, bytes: number, current: boolean) =>
    `${name}, ${current ? "selected, " : ""}downloaded, ${spokenMB(bytes)}`,
  download: (entry: Pick<CatalogueEntry, "name" | "bytes" | "download_bytes">, online: boolean) =>
    `${entry.name}, ${spokenMB(entry.download_bytes ?? entry.bytes)}, ${online ? "download" : "needs a connection"}`,
  downloading: (name: string, pct: number) => `${name}, downloading, ${pct} percent`,
  online: (name: string, publisher: string) => `${name}, ${publisher}, needs a connection`,
};

/**
 * On your iPhone order: the built-in four as the core bundle ships them, then
 * downloads in the order they were saved.
 */
export function onPhoneOrder(builtIn: readonly string[], downloaded: readonly string[]): string[] {
  return [...builtIn, ...downloaded.filter((c) => !builtIn.includes(c))];
}

/** What a removed translation leaves the reader in: BSB if it was the one being read. */
export function afterRemove(current: string, removed: string): string {
  return current === removed ? "BSB" : current;
}
