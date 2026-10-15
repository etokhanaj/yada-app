import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { NATURAL_EARTH_FILES, basemapCommand, clipLine, clipRing, simplify, type Ring } from "./basemap.js";
import { OPENBIBLE_FILES, loadOpenBible } from "./bundleExtras.js";
import { checkOpenBibleLicence, findForms, nameForms, openBiblePlaces, parseUsx, versePlaces } from "./places.js";

// Shaped as OpenBible's ancient.jsonl and modern.jsonl rows (readme, "Ancient places"), with only the
// fields the extraction reads.
const point = (lonlat: string, modern: string, type = "settlement") => ({ lonlat, lonlat_type: "point", type, modern_basis_id: modern });
const place = (o: {
  id: string;
  name: string;
  assoc: Array<[string, number, string?]>;
  resolutions?: unknown[];
  names?: Record<string, number>;
  verses?: Array<[string, Record<string, number>?]>;
}) => ({
  id: o.id,
  friendly_id: o.name,
  identifications: [{ resolutions: o.resolutions ?? [point("35.2559,31.7717", o.assoc[0]?.[0] ?? "m0")] }],
  modern_associations: Object.fromEntries(o.assoc.map(([id, score, name], i) => [id, { identification_ids: [[0, i]], name: name ?? id, score }])),
  translation_name_counts: o.names ?? { [o.name.replace(/ \d+$/, "")]: 10 },
  verses: (o.verses ?? [["JHN 11:1"]]).map(([usx, types]) => ({ usx, instance_types: types ?? { name: 10 } })),
});
const jsonl = (rows: unknown[]) => rows.map((r) => JSON.stringify(r)).join("\n");

const MODERN = jsonl([
  { id: "mBeth", coordinates_source: { type: "wikidata" } },
  { id: "mJer", coordinates_source: { type: "wikidata" } },
  { id: "mOsm", coordinates_source: { type: "osm" } },
  { id: "mGoo", coordinates_source: { type: "google_maps" } },
  { id: "mA", coordinates_source: { type: "wikidata" } },
  { id: "mB", coordinates_source: { type: "wikidata" } },
  { id: "mNoType", coordinates_source: {} },
  { id: "mNew", coordinates_source: { type: "some_future_source" } },
]);

describe("MS-01 extraction: high confidence only", () => {
  const ANCIENT = jsonl([
    place({ id: "a1", name: "Bethany 1", assoc: [["mBeth", 889, "Al Eizariya"]], verses: [["JHN 11:1"], ["JHN 11:18"]] }),
    place({ id: "a2", name: "Jerusalem", assoc: [["mJer", 1000, "Jerusalem"]], names: { Jerusalem: 7819, Judah: 2, Jews: 1 }, resolutions: [point("35.2342,31.7767", "mJer")] }),
    place({ id: "a3", name: "Emmaus", assoc: [["mA", 300], ["mB", 200]] }),
    place({ id: "a4", name: "Tied", assoc: [["mA", 500], ["mB", 500]], resolutions: [point("35,31", "mA"), point("35.1,31", "mB")] }),
    place({ id: "a5", name: "Judea", assoc: [["mA", 900]], resolutions: [{ lonlat: "35,31.5", lonlat_type: "representative point", type: "region", modern_basis_id: "mA" }] }),
    place({ id: "a6", name: "Gate", assoc: [["mJer", 700]], resolutions: [{ lonlat: "35.2342,31.7767", lonlat_type: "settlement", type: "gate", modern_basis_id: "mJer" }] }),
    place({ id: "a7", name: "Osm place", assoc: [["mOsm", 900]], resolutions: [point("35,31", "mOsm")] }),
    place({ id: "a8", name: "Google place", assoc: [["mGoo", 900]], resolutions: [point("35,31", "mGoo")] }),
    place({ id: "a9", name: "Pronoun only", assoc: [["mA", 900]], resolutions: [point("35,31", "mA")], verses: [["JHN 1:1", { helper: 3 }]] }),
    { id: "a10", friendly_id: "Eden", identifications: [], modern_associations: {}, verses: [] },
    // Fail closed (code review, 15 Oct 2026): no modern record, no source type, an unknown source type.
    place({ id: "a11", name: "No record", assoc: [["mMissing", 900]], resolutions: [point("35,31", "mMissing")] }),
    place({ id: "a12", name: "No type", assoc: [["mNoType", 900]], resolutions: [point("35,31", "mNoType")] }),
    place({ id: "a13", name: "New source", assoc: [["mNew", 900]], resolutions: [point("35,31", "mNew")] }),
  ]);
  const { places, skipped } = openBiblePlaces(ANCIENT, MODERN);

  it("keeps a place whose best identification scores 500 or more and resolves to one point", () => {
    expect(places.map((p) => p.id)).toEqual(["a1", "a2"]);
    const bethany = places[0]!;
    expect(bethany).toMatchObject({ name: "Bethany", modern: "Al Eizariya", lon: 35.2559, lat: 31.7717, score: 889, kind: "settlement" });
    expect(bethany.verses).toEqual(["JHN 11:1", "JHN 11:18"]);
  });

  it("counts every place left out, by reason", () => {
    expect(skipped).toEqual({ "no identification": 1, "below 500": 1, tied: 1, "not a point": 2, "other licence": 5, "named in no verse": 1 });
  });

  it("finds a place by its common forms only: Jerusalem never marks “Judah”", () => {
    expect(places[1]!.forms).toEqual(["Jerusalem"]);
  });
});

describe("MS-01 name forms", () => {
  it("keeps forms used at least a quarter as often as the most common", () => {
    expect(nameForms({ "Beth-shean": 10, "Beth Shan": 3, "Beth-shan": 1 }, "Beth-shean")).toEqual(["Beth-shean", "Beth Shan"]);
  });
  it("drops a people named from the place, and place names that are everyday words", () => {
    expect(nameForms({ Gath: 40, Gittite: 12 }, "Gath")).toEqual(["Gath"]);
    // With no form left, the dataset's own name for the place, as the BSB writes it in Nahum 3:8.
    expect(nameForms({ No: 5 }, "Thebes")).toEqual(["Thebes"]);
    expect(nameForms({ On: 5 }, "On")).toEqual([]);
  });
});

describe("MS-01 verse -> place index", () => {
  const places = openBiblePlaces(
    jsonl([
      place({ id: "a1", name: "Bethany 1", assoc: [["mBeth", 889]], verses: [["JHN 11:1"], ["JHN 12:1"], ["MRK 11:1"]] }),
      place({ id: "a2", name: "Jerusalem", assoc: [["mJer", 1000]], verses: [["JHN 11:18"], ["JHN 12:1"]] }),
      place({ id: "a3", name: "Bethany 2", assoc: [["mA", 600]], resolutions: [point("35.55,31.84", "mA")], verses: [["JHN 12:1"]] }),
    ]),
    MODERN,
  ).places;
  const ords: Record<string, number> = { "11:1": 1, "11:18": 18, "12:1": 101 };
  const text: Record<number, string> = {
    1: "Now a man named Lazarus was sick. He was from Bethany, the village of Mary and her sister Martha.",
    18: "Bethany was near Jerusalem, less than two miles away,",
    101: "Six days before the Passover, Jesus came to Bethany, the hometown of Lazarus, whom He had raised from the dead.",
  };
  const index = versePlaces(places, "JHN", (c, v) => ords[`${c}:${v}`] ?? null, (o) => text[o] ?? "");

  it("lists a book's verses only, each with where the BSB names the place", () => {
    expect([...index.keys()].sort((a, b) => a - b)).toEqual([1, 18, 101]);
    const at = text[1]!.indexOf("Bethany");
    expect(index.get(1)).toEqual([{ place: "a1", spans: [[at, at + 7]] }]);
  });

  it("a place the BSB names by another word still lists, with no mark", () => {
    // OpenBible lists Jerusalem at 11:18 and the BSB names it; the data's Bethany is not listed there.
    const j = text[18]!.indexOf("Jerusalem");
    expect(index.get(18)).toEqual([{ place: "a2", spans: [[j, j + 9]] }]);
    expect(index.get(101)?.find((p) => p.place === "a2")).toEqual({ place: "a2", spans: [] });
  });

  it("a name two places share in one verse marks neither", () => {
    expect(index.get(101)?.filter((p) => p.place !== "a2")).toEqual([
      { place: "a1", spans: [] },
      { place: "a3", spans: [] },
    ]);
  });
});

describe("MS-01 helpers", () => {
  it("finds whole words, case-exact, longest form first", () => {
    expect(findForms("Beth-shemesh and Beth were here; Bethany too", ["Beth", "Beth-shemesh"])).toEqual([[0, 12], [17, 21]]);
    expect(findForms("Ai and air", ["Ai"])).toEqual([[0, 2]]);
  });
  it("reads USX references", () => {
    expect(parseUsx("1CO 14:34")).toEqual(["1CO", 14, 34]);
    expect(parseUsx("Gen 1:1")).toBeNull();
  });
  it("reads the licence from the repository's own files (rule 3)", () => {
    const readme = "## License\n\nThis data is licensed under a [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) license.\n\n# About";
    expect(checkOpenBibleLicence("Attribution 4.0 International\n…", readme)).toContain("Creative Commons Attribution 4.0");
    expect(() => checkOpenBibleLicence("Attribution-ShareAlike 4.0 International", readme)).toThrow(/no longer CC BY 4.0/);
    expect(() => checkOpenBibleLicence("Attribution 4.0 International", "## License\n\nAll rights reserved.\n# About")).toThrow(/License section/);
  });
});

describe("MS-01 base map", () => {
  it("cuts a ring to a box", () => {
    const square: Ring = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const cut = clipRing(square, { west: 5, south: -1, east: 20, north: 20 });
    expect(cut.every(([x]) => x >= 5)).toBe(true);
    expect(cut).toHaveLength(4);
  });
  it("simplifies within a tolerance and keeps the ends", () => {
    const line: Ring = [[0, 0], [1, 0.001], [2, 0], [3, 5], [4, 0]];
    expect(simplify(line, 0.01)).toEqual([[0, 0], [2, 0], [3, 5], [4, 0]]);
  });
});

describe("MS-01 base map: rivers", () => {
  const box = { west: 0, south: 0, east: 10, north: 10 };
  it("cuts a line into the stretches inside the box, never joining them across the outside", () => {
    // In, out past the east edge, back in: two pieces, each ending on the edge.
    const line: Ring = [[2, 5], [8, 5], [14, 5], [14, 7], [8, 7], [4, 7]];
    expect(clipLine(line, box)).toEqual([
      [[2, 5], [8, 5], [10, 5]],
      [[10, 7], [8, 7], [4, 7]],
    ]);
  });
  it("keeps a segment that crosses the box with both ends outside", () => {
    expect(clipLine([[-5, 5], [15, 5]], box)).toEqual([[[0, 5], [10, 5]]]);
    expect(clipLine([[-5, 15], [15, 15]], box)).toEqual([]);
  });
});

/** content/raw in small, with maps-15oct.sha256 pinning whatever the files hold when `pin` runs. */
function mapsRaw(files: Record<string, string>): { raw: string; pin: () => void; put: (f: string, text: string) => void } {
  const raw = mkdtempSync(path.join(tmpdir(), "yada-maps-"));
  const put = (f: string, text: string) => {
    mkdirSync(path.dirname(path.join(raw, f)), { recursive: true });
    writeFileSync(path.join(raw, f), text);
  };
  for (const [f, text] of Object.entries(files)) put(f, text);
  const pin = () =>
    writeFileSync(
      path.join(raw, "maps-15oct.sha256"),
      Object.keys(files)
        .map((f) => `${createHash("sha256").update(readFileSync(path.join(raw, f))).digest("hex")}  ${f}\n`)
        .join(""),
    );
  pin();
  return { raw, pin, put };
}
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

describe("MS-01 OpenBible: pins and licence refuse (code review, 15 Oct 2026)", () => {
  const README = "## License\n\nThis data is licensed under a [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) license.\n\n# About";
  const files = (): Record<string, string> => ({
    [OPENBIBLE_FILES[0]]: "Attribution 4.0 International\n",
    [OPENBIBLE_FILES[1]]: README,
    [OPENBIBLE_FILES[2]]: jsonl([place({ id: "a1", name: "Bethany 1", assoc: [["mBeth", 889]] })]),
    [OPENBIBLE_FILES[3]]: MODERN,
  });
  const paths = (raw: string) => ({ content: path.dirname(raw), raw, bundles: raw });

  it("loads pinned, CC BY files", () => {
    const m = mapsRaw(files());
    made.push(m.raw);
    expect(loadOpenBible(paths(m.raw)).data.places.map((p) => p.id)).toEqual(["a1"]);
  });

  it("refuses a file that differs from its pin", () => {
    const m = mapsRaw(files());
    made.push(m.raw);
    m.put("openbible/data/modern.jsonl", MODERN.replace("wikidata", "osm"));
    expect(() => loadOpenBible(paths(m.raw))).toThrow(/modern.jsonl does not match its pin/);
  });

  it("refuses a missing file", () => {
    const m = mapsRaw(files());
    made.push(m.raw);
    rmSync(path.join(m.raw, "openbible/data/ancient.jsonl"));
    expect(() => loadOpenBible(paths(m.raw))).toThrow(/ancient.jsonl does not match its pin/);
  });

  it("refuses a pinned download whose licence changed (rule 3)", () => {
    const m = mapsRaw({ ...files(), [OPENBIBLE_FILES[0]]: "Attribution-NonCommercial 4.0 International\n" });
    made.push(m.raw);
    expect(() => loadOpenBible(paths(m.raw))).toThrow(/no longer CC BY 4.0/);
  });
});

describe("MS-01 base map: pins and licence refuse (code review, 15 Oct 2026)", () => {
  const empty = JSON.stringify({ features: [] });
  const files = (licence = "Everything here is public domain.\n"): Record<string, string> => ({
    [NATURAL_EARTH_FILES[0]]: licence,
    [NATURAL_EARTH_FILES[1]]: empty,
    [NATURAL_EARTH_FILES[2]]: empty,
    [NATURAL_EARTH_FILES[3]]: empty,
  });

  it("writes the map from pinned, public-domain files", () => {
    const m = mapsRaw(files());
    made.push(m.raw);
    const out = path.join(m.raw, "basemap.generated.ts");
    expect(basemapCommand({ raw: m.raw, out })).toBe(0);
    expect(readFileSync(out, "utf8")).toContain("export const LAND");
  });

  it("exits 1 and writes nothing when a file differs from its pin", () => {
    const m = mapsRaw(files());
    made.push(m.raw);
    m.put(NATURAL_EARTH_FILES[3], JSON.stringify({ features: [{}] }));
    const out = path.join(m.raw, "basemap.generated.ts");
    expect(basemapCommand({ raw: m.raw, out })).toBe(1);
    expect(existsSync(out)).toBe(false);
  });

  it("exits 1 and writes nothing when a file is missing", () => {
    const m = mapsRaw(files());
    made.push(m.raw);
    rmSync(path.join(m.raw, NATURAL_EARTH_FILES[1]));
    const out = path.join(m.raw, "basemap.generated.ts");
    expect(basemapCommand({ raw: m.raw, out })).toBe(1);
    expect(existsSync(out)).toBe(false);
  });

  it("exits 1 and writes nothing when the pinned LICENSE.md no longer says public domain (rule 3)", () => {
    const m = mapsRaw(files("All rights reserved.\n"));
    made.push(m.raw);
    const out = path.join(m.raw, "basemap.generated.ts");
    expect(basemapCommand({ raw: m.raw, out })).toBe(1);
    expect(existsSync(out)).toBe(false);
  });
});
