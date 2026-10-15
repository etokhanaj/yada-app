/**
 * MS-01: places from OpenBible.info's Bible Geocoding Data (CC BY 4.0, read from the repository's own
 * license.txt and readme: rule 3), high-confidence identifications only, with the verses that name them.
 *
 * Never STEPBible data: OpenBible links places to TIPNR ids (linked_data.tipnr); those are not read.
 *
 * What counts as high confidence is OpenBible's own measure, as its readme defines it: the place's best
 * modern association scores 500 or more ("An overall total of 500 or higher represents high
 * confidence"), it is the only one at that score, and it resolves to a point. A region drawn as a dot,
 * a circle of uncertainty, or a gate placed at its city's centre would claim a precision the data does
 * not have (rule 4), so those are left out and counted.
 *
 * Coordinates OpenBible took from OpenStreetMap are ODbL, not CC BY ("OpenStreetMap data is licensed under
 * ODbL 1.0", readme); from Google Maps or Google Earth, commercial. Both are left out and counted, and so
 * is any place whose coordinates' source is not on CC_BY_COORDINATES.
 */

/**
 * The coordinates_source types kept as the dataset's own CC BY 4.0: every type in the pinned data
 * (bgd-7eb18a5) except OpenStreetMap ("osm", "osm_group") and Google Maps and Earth ("google_maps",
 * "google_earth_community"). An allow-list, so a place with no modern record, no source type, or a type
 * a later download adds is left out until its terms are read (rule 3). It was a deny-list, and those
 * places were kept (code review, 15 Oct 2026).
 */
const CC_BY_COORDINATES = new Set([
  "wikidata",
  "daahl",
  "megajordan",
  "geonames",
  "iaa",
  "palopenmaps",
  "known_book",
  "representative_point_in_region",
  "amudanan",
  "pleiades",
  "ane_kml",
  "wikipedia_article",
  "epsg_28191",
  "davidrumsey",
  "google_books",
  "representative_point_along_path",
  "webpage",
  "raremaps",
  "govmap",
  "musil_map",
  "hadashot_arkheologiyot",
  "wikimedia_commons",
  "corona",
  "van_de_velde_map",
  "topostext",
]);

export const HIGH_CONFIDENCE = 500;

export interface Place {
  /** OpenBible's ancient id ("a4f35bc"). */
  readonly id: string;
  /** "Bethany": the friendly id without its disambiguating number. */
  readonly name: string;
  /** The resolution's type: "settlement", "mountain", "spring", … */
  readonly kind: string;
  /** The modern location it is identified with ("Al Eizariya"). */
  readonly modern: string;
  readonly lon: number;
  readonly lat: number;
  /** OpenBible's association score, out of 1000. */
  readonly score: number;
  /** The spellings to find in the BSB: the dataset's most-used forms (see nameForms). */
  readonly forms: string[];
  /** USX references ("JHN 11:1") where a translation names the place. */
  readonly verses: string[];
}

export type PlaceSkip = "no identification" | "below 500" | "tied" | "not a point" | "other licence" | "named in no verse";

export interface OpenBiblePlaces {
  places: Place[];
  skipped: Record<PlaceSkip, number>;
}

interface Resolution {
  lonlat?: string;
  lonlat_type?: string;
  type?: string;
  modern_basis_id?: string;
}

interface Ancient {
  id: string;
  friendly_id: string;
  identifications?: Array<{ resolutions?: Resolution[] }>;
  modern_associations?: Record<string, { identification_ids: Array<[number, number]>; name: string; score: number }>;
  translation_name_counts?: Record<string, number>;
  verses?: Array<{ usx: string; instance_types?: Record<string, number> }>;
}

interface Modern {
  id: string;
  coordinates_source?: { type?: string };
}

const jsonl = <T>(text: string): T[] =>
  text
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as T);

/**
 * The forms a place goes by in English Bibles, each used at least a quarter as often as its most
 * common form. Jerusalem's counts include "Judah" (2) and "Jews" (1) beside "Jerusalem" (7819): a
 * rare form is a translation's paraphrase, and would mark the wrong word in the BSB.
 */
export function nameForms(counts: Readonly<Record<string, number>> | undefined, name: string): string[] {
  const entries = Object.entries(counts ?? {});
  const max = Math.max(0, ...entries.map(([, n]) => n));
  const forms = entries
    .filter(([f, n]) => n * 4 >= max && !ENGLISH_WORDS.has(f) && !(GENTILIC.test(f) && !GENTILIC.test(name)))
    .map(([f]) => f);
  return forms.length > 0 ? forms : ENGLISH_WORDS.has(name) ? [] : [name];
}

/**
 * Place names that are also everyday English words: "No" (Thebes, Nahum 3:8), "On" (Heliopolis), "Sin"
 * (Pelusium), "Iron" (Yiron). Matched case-exactly they still catch a sentence's first word, so they
 * are never marked in the text; the place still lists under its verses.
 */
const ENGLISH_WORDS = new Set(["No", "On", "Sin", "Iron"]);

/** "Gittite", "Alexandrians", "Carmelite": a people named from the place, not the place (rule 4). */
const GENTILIC = /(?:ites?|ians?)$/;

export function openBiblePlaces(ancientText: string, modernText: string): OpenBiblePlaces {
  const modern = new Map(jsonl<Modern>(modernText).map((m) => [m.id, m]));
  const skipped: Record<PlaceSkip, number> = { "no identification": 0, "below 500": 0, tied: 0, "not a point": 0, "other licence": 0, "named in no verse": 0 };
  const places: Place[] = [];
  for (const a of jsonl<Ancient>(ancientText)) {
    const assoc = Object.entries(a.modern_associations ?? {}).sort((x, y) => y[1].score - x[1].score);
    const top = assoc[0];
    if (top === undefined) {
      skipped["no identification"]++;
      continue;
    }
    if (top[1].score < HIGH_CONFIDENCE) {
      skipped["below 500"]++;
      continue;
    }
    if ((assoc[1]?.[1].score ?? -1) === top[1].score) {
      skipped.tied++;
      continue;
    }
    const [i, r] = top[1].identification_ids[0] ?? [-1, -1];
    const res = a.identifications?.[i]?.resolutions?.[r];
    const lonlat = res?.lonlat?.split(",").map(Number);
    if (res === undefined || res.lonlat_type !== "point" || lonlat === undefined || lonlat.length !== 2 || lonlat.some((n) => !Number.isFinite(n))) {
      skipped["not a point"]++;
      continue;
    }
    const sourceType = modern.get(res.modern_basis_id ?? top[0])?.coordinates_source?.type;
    if (sourceType === undefined || !CC_BY_COORDINATES.has(sourceType)) {
      skipped["other licence"]++;
      continue;
    }
    // A verse counts where at least one translation names the place (not only a pronoun or people group).
    const verses = (a.verses ?? []).filter((v) => (v.instance_types?.["name"] ?? 0) > 0).map((v) => v.usx);
    if (verses.length === 0) {
      skipped["named in no verse"]++;
      continue;
    }
    const name = a.friendly_id.replace(/\s+\d+$/, "");
    places.push({
      id: a.id,
      name,
      kind: res.type ?? "",
      modern: top[1].name,
      lon: lonlat[0]!,
      lat: lonlat[1]!,
      score: top[1].score,
      forms: nameForms(a.translation_name_counts, name),
      verses,
    });
  }
  return { places, skipped };
}

/** "JHN 11:1" -> ["JHN", 11, 1]. */
export function parseUsx(ref: string): [string, number, number] | null {
  const m = /^([1-4A-Z]{3}) (\d+):(\d+)$/.exec(ref);
  return m === null ? null : [m[1]!, Number(m[2]), Number(m[3])];
}

/** Every whole-word, case-exact occurrence of any form in the text, longest form first, never overlapping. */
export function findForms(text: string, forms: readonly string[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const form of [...forms].sort((a, b) => b.length - a.length)) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(form, from);
      if (at === -1) break;
      from = at + 1;
      const end = at + form.length;
      if (/[\p{L}\p{N}]/u.test(text[at - 1] ?? "") || /[\p{L}\p{N}]/u.test(text[end] ?? "")) continue;
      if (out.some(([s, e]) => at < e && end > s)) continue;
      out.push([at, end]);
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}

export interface VersePlace {
  readonly place: string;
  /** Where the BSB names it; empty when the BSB uses another word (a pronoun, "the city"). */
  readonly spans: Array<[number, number]>;
}

/**
 * The verse -> place index for one book. A name two places share in one verse marks neither: which
 * place a tap would open is not certain (rule 4). The place still lists under the verse.
 */
export function versePlaces(
  places: readonly Place[],
  book: string,
  ordOf: (chapter: number, verse: number) => number | null,
  bsbOf: (ord: number) => string,
): Map<number, VersePlace[]> {
  const byOrd = new Map<number, Array<{ place: Place }>>();
  for (const p of places) {
    for (const ref of p.verses) {
      const parsed = parseUsx(ref);
      if (parsed === null || parsed[0] !== book) continue;
      const ord = ordOf(parsed[1], parsed[2]);
      if (ord === null) continue;
      const list = byOrd.get(ord) ?? [];
      if (list.length === 0) byOrd.set(ord, list);
      if (!list.some((x) => x.place.id === p.id)) list.push({ place: p });
    }
  }
  const out = new Map<number, VersePlace[]>();
  for (const [ord, list] of byOrd) {
    const text = bsbOf(ord);
    const found = list.map(({ place }) => ({ place: place.id, spans: findForms(text, place.forms) }));
    const clash = (s: [number, number], self: string) => found.some((f) => f.place !== self && f.spans.some(([a, b]) => s[0] < b && s[1] > a));
    out.set(
      ord,
      found.map((f) => ({ place: f.place, spans: f.spans.filter((s) => !clash(s, f.place)) })),
    );
  }
  return out;
}

const CC_BY = "Creative Commons Attribution 4.0";

/**
 * Rule 3: the licence as the repository states it. license.txt is CC BY 4.0's legal code and the
 * readme's License section names it; a download that says otherwise refuses the build.
 */
export function checkOpenBibleLicence(licenseTxt: string, readme: string): string {
  if (!licenseTxt.includes("Attribution 4.0 International")) throw new Error("openbible/license.txt is no longer CC BY 4.0; read the new terms first");
  const section = /## License\s+([\s\S]*?)\n#/.exec(readme)?.[1] ?? "";
  if (!section.includes(CC_BY)) throw new Error(`openbible/readme.md's License section no longer names ${CC_BY}; read the new terms first`);
  return section.split("\n")[0]?.trim() ?? "";
}

export const OPENBIBLE_CREDIT = "Places and coordinates from OpenBible.info Bible Geocoding Data (high-confidence identifications only) · CC BY 4.0";

export const PLACES_DDL = `
CREATE TABLE places (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  kind   TEXT NOT NULL,
  modern TEXT NOT NULL,
  lon    REAL NOT NULL,
  lat    REAL NOT NULL,
  score  INTEGER NOT NULL
);
CREATE TABLE verse_places (
  ord   INTEGER NOT NULL,
  place TEXT NOT NULL REFERENCES places (id),
  spans TEXT NOT NULL,
  PRIMARY KEY (ord, place)
);
`;
