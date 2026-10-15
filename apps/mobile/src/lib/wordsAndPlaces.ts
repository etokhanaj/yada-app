/**
 * Build 6, pure: MM-03's word links and MS-01's places as the Understand bundle stores them
 * (packages/pipeline/src/understand/bundleExtras.ts), and the map's projection.
 *
 * Spans are UTF-16 offsets into the BSB verse exactly as core stores it. The file carries that text, and
 * nothing is marked unless the text on screen is the same string: on the WEB, KJV, LSV or a licensed
 * text, or a core packaged since, no offset is trusted (rule 4).
 */

export type Span = readonly [number, number];

/** "[[position, start, end], …]" -> position -> spans. Malformed rows are dropped, never guessed at. */
export function parseLinks(json: string): Map<number, Span[]> {
  const out = new Map<number, Span[]>();
  let rows: unknown;
  try {
    rows = JSON.parse(json);
  } catch {
    return out;
  }
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    if (!Array.isArray(r) || r.length !== 3 || !r.every((n) => Number.isInteger(n))) continue;
    const [p, s, e] = r as [number, number, number];
    if (s < 0 || e <= s) continue;
    const list = out.get(p) ?? [];
    if (list.length === 0) out.set(p, list);
    list.push([s, e]);
  }
  return out;
}

export interface WordLinks {
  /** The BSB verse the spans index. */
  readonly bsb: string;
  readonly links: Map<number, Span[]>;
}

/** A word's partner in the text shown, or null: the text must be the one the links were built on. */
export function partnerIn(shown: string, words: WordLinks | null, position: number | null): Span[] | null {
  if (words === null || position === null || shown !== words.bsb) return null;
  const spans = words.links.get(position);
  if (spans === undefined || spans.length === 0 || spans.some(([, e]) => e > shown.length)) return null;
  return spans;
}

/** VoiceOver's line: "In the BSB: came into being", the partner's words in order. */
export function partnerLabel(text: string, spans: readonly Span[]): string {
  return `In the BSB: ${spans.map(([s, e]) => text.slice(s, e)).join(" … ")}`;
}

export type MarkKind = "partner" | "place";

export interface Piece {
  readonly text: string;
  readonly mark: MarkKind | null;
  /** For a place: its id. */
  readonly place?: string;
}

/**
 * The verse cut into plain text, the partner's words and place names. Where a place name and the
 * partner overlap, the partner wins (it is what the reader just asked about) and the name stays plain.
 */
export function pieces(text: string, partner: readonly Span[] | null, places: ReadonlyArray<{ place: string; spans: readonly Span[] }>): Piece[] {
  const marks: Array<{ s: number; e: number; mark: MarkKind; place?: string }> = (partner ?? []).map(([s, e]) => ({ s, e, mark: "partner" as const }));
  for (const p of places) {
    for (const [s, e] of p.spans) {
      if (e > text.length || marks.some((m) => s < m.e && e > m.s)) continue;
      marks.push({ s, e, mark: "place", place: p.place });
    }
  }
  marks.sort((a, b) => a.s - b.s);
  const out: Piece[] = [];
  let at = 0;
  for (const m of marks) {
    if (m.s < at) continue;
    if (m.s > at) out.push({ text: text.slice(at, m.s), mark: null });
    out.push(m.place === undefined ? { text: text.slice(m.s, m.e), mark: m.mark } : { text: text.slice(m.s, m.e), mark: m.mark, place: m.place });
    at = m.e;
  }
  if (at < text.length) out.push({ text: text.slice(at), mark: null });
  return out;
}

/** A verse's places as stored: spans JSON per place. */
export function parsePlaceSpans(json: string): Span[] {
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(v)) return [];
  return v.flatMap((s): Span[] =>
    Array.isArray(s) && s.length === 2 && Number.isInteger(s[0]) && Number.isInteger(s[1]) && s[0] >= 0 && s[1] > s[0] ? [[s[0] as number, s[1] as number]] : [],
  );
}

export interface PlaceRow {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly modern: string;
  readonly lon: number;
  readonly lat: number;
  readonly score: number;
}

/** One line on what the data says: "Identified with Al Eizariya"; a place under its own name today, its kind. */
export function placeLine(p: PlaceRow): string {
  if (p.modern !== "" && p.modern !== p.name) return `Identified with ${p.modern}`;
  return p.kind === "" ? "" : p.kind.charAt(0).toUpperCase() + p.kind.slice(1);
}

// ---------------------------------------------------------------------------
// The map (MS-01): equirectangular around the place, scaled by the cosine of its latitude.
// ---------------------------------------------------------------------------

export interface View {
  readonly lon: number;
  readonly lat: number;
  /** Degrees of longitude across the map's width (before the cosine). */
  readonly span: number;
  readonly width: number;
  readonly height: number;
}

export function project(view: View, lon: number, lat: number): [number, number] {
  const k = Math.cos((view.lat * Math.PI) / 180);
  const scale = view.width / view.span;
  return [(lon - view.lon) * k * scale + view.width / 2, (view.lat - lat) * scale + view.height / 2];
}

/**
 * Alone, a place shows ~45 km of its country. With the passage's other places, just wide enough to hold
 * them (Bethany and Jerusalem, 3 km apart, sit ~7 km across), never wider than the base map can fill: a
 * place far from the rest (Rome beside Jerusalem) is left off rather than shrinking the focus to a dot.
 */
export function viewFor(focus: { lon: number; lat: number }, others: ReadonlyArray<{ lon: number; lat: number }>, width: number, height: number): View {
  const ALONE = 0.45;
  const CLOSEST = 0.08;
  const MAX = 8;
  const k = Math.cos((focus.lat * Math.PI) / 180);
  const needs = others
    .map((o) => Math.max((Math.abs(o.lon - focus.lon) * k * 2) / 0.8, ((Math.abs(o.lat - focus.lat) * 2) / 0.8) * (width / height)))
    .filter((n) => n <= MAX);
  const span = needs.length === 0 ? ALONE : Math.max(CLOSEST, ...needs);
  return { lon: focus.lon, lat: focus.lat, span, width, height };
}

type Box = readonly [number, number, number, number];
const clash = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/**
 * The other places to draw, nearest first: inside the map, with the dot and its label (set to the dot's
 * left, the place's own to its right) clear of every one already placed, so no name sits on another.
 * Widths are estimated at 0.6 em a letter, generous for Literata.
 */
export function placesToDraw<T extends { lon: number; lat: number; name: string }>(view: View, focusName: string, others: readonly T[], fontSize: number): Array<{ place: T; x: number; y: number }> {
  const cx = view.width / 2;
  const cy = view.height / 2;
  const w = (name: string, size: number) => name.length * size * 0.6;
  const taken: Box[] = [[cx - 10, cy - 10, cx + 13 + w(focusName, fontSize + 2), cy + 10]];
  const out: Array<{ place: T; x: number; y: number }> = [];
  const sorted = others
    .map((place) => {
      const [x, y] = project(view, place.lon, place.lat);
      return { place, x, y, d: Math.hypot(x - cx, y - cy) };
    })
    .sort((a, b) => a.d - b.d);
  for (const p of sorted) {
    if (p.x < 8 || p.x > view.width - 8 || p.y < 8 || p.y > view.height - 8) continue;
    const box: Box = [p.x - 8 - w(p.place.name, fontSize), p.y - fontSize, p.x + 5, p.y + fontSize * 0.6];
    if (box[0] < 0 || taken.some((t) => clash(t, box))) continue;
    taken.push(box);
    out.push({ place: p.place, x: p.x, y: p.y });
  }
  return out;
}

/** A flat ring as an SVG path in the view, or null when no point falls near it. */
export function ringPath(view: View, ring: readonly number[], close: boolean): string | null {
  let d = "";
  let near = false;
  for (let i = 0; i + 1 < ring.length; i += 2) {
    const lon = ring[i];
    const lat = ring[i + 1];
    if (lon === undefined || lat === undefined) break;
    const [x, y] = project(view, lon, lat);
    if (x > -view.width && x < 2 * view.width && y > -view.height && y < 2 * view.height) near = true;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  if (!near) return null;
  return close ? `${d}Z` : d;
}

/** Apple Maps at the point, labelled with the place's name (opened by Linking; needs a connection). */
export function appleMapsUrl(p: { name: string; lat: number; lon: number }): string {
  return `https://maps.apple.com/?ll=${p.lat.toFixed(6)},${p.lon.toFixed(6)}&q=${encodeURIComponent(p.name)}&z=12`;
}
