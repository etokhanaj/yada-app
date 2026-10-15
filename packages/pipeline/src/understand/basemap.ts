/**
 * MS-01's base map: Natural Earth's 1:10m land, lakes and a few rivers (public domain, read from the
 * repository's own LICENSE.md: rule 3), cut to the lands the Bible names and simplified, written into
 * the app as a small generated file. The app draws it in its own tokens, offline, with no map
 * service and no native dependency (react-native-svg is already in the app).
 *
 * Two levels of detail: the Levant, where most places sit close together, keeps ~0.5 km; the rest of
 * the Mediterranean world ~2.5 km, enough for a map of Paul's journeys.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { sha256File } from "../package.js";
import { understandPaths } from "./package.js";
import { parsePins, readIfExists } from "./sources.js";

export type Ring = Array<[number, number]>;
export interface Box {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

/** Rome (12.5° E) to Susa and Ecbatana (48.5° E), Syene (24.1° N) to the Black Sea's south shore. */
export const WORLD: Box = { west: 10, south: 22, east: 52, north: 44 };
export const LEVANT: Box = { west: 33.5, south: 29, east: 37.5, north: 34.5 };

/** Sutherland–Hodgman: a ring cut to a box (edges along the box are kept, which a filled area needs). */
export function clipRing(ring: Ring, box: Box): Ring {
  const edges: Array<{ inside: (p: [number, number]) => boolean; cut: (a: [number, number], b: [number, number]) => [number, number] }> = [
    { inside: (p) => p[0] >= box.west, cut: (a, b) => at(a, b, (box.west - a[0]) / (b[0] - a[0])) },
    { inside: (p) => p[0] <= box.east, cut: (a, b) => at(a, b, (box.east - a[0]) / (b[0] - a[0])) },
    { inside: (p) => p[1] >= box.south, cut: (a, b) => at(a, b, (box.south - a[1]) / (b[1] - a[1])) },
    { inside: (p) => p[1] <= box.north, cut: (a, b) => at(a, b, (box.north - a[1]) / (b[1] - a[1])) },
  ];
  let out = ring;
  for (const e of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i]!;
      const prev = input[(i + input.length - 1) % input.length]!;
      if (e.inside(cur)) {
        if (!e.inside(prev)) out.push(e.cut(prev, cur));
        out.push(cur);
      } else if (e.inside(prev)) out.push(e.cut(prev, cur));
    }
    if (out.length === 0) break;
  }
  return out;
}

const at = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/**
 * A line cut to a box (Liang–Barsky per segment): one piece per stretch inside, each ending where it
 * crosses the edge. Dropping the points outside instead joined a river's two inside stretches with a
 * straight stroke across land the river never crossed (code review, 15 Oct 2026).
 */
export function clipLine(line: Ring, box: Box): Ring[] {
  const pieces: Ring[] = [];
  let cur: Ring | null = null;
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k]!;
    const b = line[k + 1]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    let t0 = 0;
    let t1 = 1;
    let inside = true;
    for (const [p, q] of [
      [-dx, a[0] - box.west],
      [dx, box.east - a[0]],
      [-dy, a[1] - box.south],
      [dy, box.north - a[1]],
    ] as const) {
      if (p === 0) {
        if (q < 0) inside = false;
        continue;
      }
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
    }
    if (!inside || t0 > t1) {
      cur = null;
      continue;
    }
    const start = t0 === 0 ? a : at(a, b, t0);
    const end = t1 === 1 ? b : at(a, b, t1);
    if (cur === null) pieces.push((cur = [start]));
    cur.push(end);
    // Leaving the box ends this piece; the next stretch inside starts a new one.
    if (t1 < 1) cur = null;
  }
  return pieces;
}

/** Douglas–Peucker, in degrees. */
export function simplify(points: Ring, tolerance: number): Ring {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distance(points[i]!, points[a]!, points[b]!);
      if (d > worst) {
        worst = d;
        index = i;
      }
    }
    if (worst > tolerance && index !== -1) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

function distance(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

const inBox = (p: [number, number], b: Box) => p[0] >= b.west && p[0] <= b.east && p[1] >= b.south && p[1] <= b.north;
const ringBox = (r: Ring): Box => ({
  west: Math.min(...r.map((p) => p[0])),
  east: Math.max(...r.map((p) => p[0])),
  south: Math.min(...r.map((p) => p[1])),
  north: Math.max(...r.map((p) => p[1])),
});
const overlaps = (a: Box, b: Box) => a.west <= b.east && a.east >= b.west && a.south <= b.north && a.north >= b.south;

/** Detail where the ring touches the Levant, coarse elsewhere; slivers under the tolerance dropped. */
export function prepare(ring: Ring, box: Box = WORLD): Ring | null {
  const clipped = clipRing(ring, box);
  if (clipped.length < 3) return null;
  const fine = overlaps(ringBox(clipped), LEVANT) && clipped.some((p) => inBox(p, LEVANT));
  const tol = fine ? 0.005 : 0.025;
  const s = simplify([...clipped, clipped[0]!], tol);
  const b = ringBox(s);
  if (s.length < 4 || (b.east - b.west < tol * 2 && b.north - b.south < tol * 2)) return null;
  return s.slice(0, -1);
}

type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] } | { type: "LineString"; coordinates: Ring } | { type: "MultiLineString"; coordinates: Ring[] };
interface Feature {
  properties: Record<string, unknown>;
  geometry: Geometry | null;
}

/** Outer rings of every polygon (land's holes are lakes, drawn from the lakes file instead). */
function outerRings(f: Feature): Ring[] {
  const g = f.geometry;
  if (g === null) return [];
  if (g.type === "Polygon") return g.coordinates.slice(0, 1);
  if (g.type === "MultiPolygon") return g.coordinates.map((p) => p[0]!).filter((r) => r !== undefined);
  return [];
}

function lines(f: Feature): Ring[] {
  const g = f.geometry;
  if (g === null) return [];
  if (g.type === "LineString") return [g.coordinates];
  if (g.type === "MultiLineString") return g.coordinates;
  return [];
}

/**
 * The rivers drawn, by Natural Earth's name: the Jordan and the great rivers the text names. Only
 * these: Natural Earth's European rivers came from the EU's JRC under their own grant (LICENSE.md).
 */
export const RIVERS = new Set(["Jordan", "Nile", "Euphrates", "Tigris"]);

/** Lakes the map fills: the Dead Sea and the Sea of Galilee are the two the text turns on. */
const LAKE_BOX: Box = { west: 34.5, south: 30.5, east: 36, north: 33.5 };

const round = (n: number) => Math.round(n * 1000) / 1000;
const flat = (r: Ring) => r.flatMap(([x, y]) => [round(x), round(y)]);

export function buildBasemap(land: Feature[], lakes: Feature[], rivers: Feature[]): { land: number[][]; lakes: number[][]; rivers: number[][] } {
  const landRings = land.flatMap(outerRings).flatMap((r) => (overlaps(ringBox(r), WORLD) ? [prepare(r)] : [])).filter((r): r is Ring => r !== null);
  const lakeRings = lakes
    .flatMap(outerRings)
    .filter((r) => overlaps(ringBox(r), LAKE_BOX))
    .map((r) => prepare(r, LAKE_BOX))
    .filter((r): r is Ring => r !== null);
  const riverLines = rivers
    .filter((f) => RIVERS.has(String(f.properties["name"] ?? f.properties["name_en"] ?? "")))
    .flatMap(lines)
    .flatMap((l) => clipLine(l, WORLD))
    .map((l) => simplify(l, 0.01))
    .filter((l) => l.length >= 2);
  return { land: landRings.map(flat), lakes: lakeRings.map(flat), rivers: riverLines.map(flat) };
}

export const NATURAL_EARTH_FILES = ["naturalearth/LICENSE.md", "naturalearth/ne_10m_land.geojson", "naturalearth/ne_10m_lakes.geojson", "naturalearth/ne_10m_rivers_lake_centerlines.geojson"] as const;

/** Rule 3: the repository's LICENSE.md must still say public domain. */
export function checkNaturalEarthLicence(text: string): void {
  if (!/Everything here is public domain/.test(text)) throw new Error("naturalearth/LICENSE.md no longer says public domain; read the new terms first");
}

export const BASEMAP_OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../../apps/mobile/src/data/basemap.generated.ts");

/** `yada basemap`: writes apps/mobile/src/data/basemap.generated.ts from the pinned Natural Earth files. */
export function basemapCommand(options: { raw?: string; out?: string } = {}): number {
  const raw = options.raw ?? understandPaths().raw;
  const out = options.out ?? BASEMAP_OUT;
  const pins = parsePins(readIfExists(path.join(raw, "maps-15oct.sha256")) ?? "");
  for (const f of NATURAL_EARTH_FILES) {
    if (!existsSync(path.join(raw, f)) || sha256File(path.join(raw, f)) !== pins.get(f)) {
      console.error(`basemap: ${f} is missing or does not match its pin in maps-15oct.sha256`);
      return 1;
    }
  }
  try {
    checkNaturalEarthLicence(readFileSync(path.join(raw, "naturalearth/LICENSE.md"), "utf8"));
  } catch (error) {
    console.error(`basemap: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const read = (f: string) => (JSON.parse(readFileSync(path.join(raw, f), "utf8")) as { features: Feature[] }).features;
  const map = buildBasemap(read("naturalearth/ne_10m_land.geojson"), read("naturalearth/ne_10m_lakes.geojson"), read("naturalearth/ne_10m_rivers_lake_centerlines.geojson"));
  const body = [
    "// Generated by `yada basemap` (packages/pipeline/src/understand/basemap.ts). Do not edit.",
    "// Natural Earth 1:10m land, lakes and rivers, v5.2.0-pre (nvkelso/natural-earth-vector ca96624), public domain",
    "// per its LICENSE.md; pinned in content/raw/maps-15oct.sha256. Rings are flat [lon, lat, lon, lat, …].",
    `export const BASEMAP_BOX = ${JSON.stringify(WORLD)} as const;`,
    `export const LAND: readonly (readonly number[])[] = ${JSON.stringify(map.land)};`,
    `export const LAKES: readonly (readonly number[])[] = ${JSON.stringify(map.lakes)};`,
    `export const RIVERS: readonly (readonly number[])[] = ${JSON.stringify(map.rivers)};`,
    "",
  ].join("\n");
  writeFileSync(out, body);
  const points = (rs: number[][]) => rs.reduce((n, r) => n + r.length / 2, 0);
  console.log(`basemap: ${map.land.length} land rings (${points(map.land)} points), ${map.lakes.length} lakes, ${map.rivers.length} river lines, ${(body.length / 1024).toFixed(0)} KB -> ${out}`);
  return 0;
}
