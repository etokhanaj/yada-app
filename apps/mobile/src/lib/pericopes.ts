/**
 * Passage Understand resolves a selection to the pericopes it touches.
 *
 * The rule from the design brief: a multi-verse selection is answered by the
 * passage(s) it falls in, never by stitching verse explanations into a new one.
 * When a pericope has its own generated payload, that is what shows; otherwise
 * its label, then the existing verse entries inside the selection, in order.
 */

export interface PericopeRow {
  readonly pericope_id: string;
  readonly label: string;
  readonly start_ord: number;
  readonly end_ord: number;
  readonly review_status: string | null;
  readonly payload: string | null;
}

export interface EntryRow {
  readonly verse_id: string;
  readonly ord: number;
  readonly pericope_id: string;
  readonly review_status: string;
  readonly payload: string;
}

export interface ResolvedPericope<P extends PericopeRow = PericopeRow, E extends EntryRow = EntryRow> {
  readonly pericope: P;
  /** The selection clipped to this pericope. */
  readonly startOrd: number;
  readonly endOrd: number;
  /** Verse entries inside the clipped range, in canonical order. */
  readonly entries: E[];
}

export interface PassageResolution<P extends PericopeRow = PericopeRow, E extends EntryRow = EntryRow> {
  readonly pericopes: Array<ResolvedPericope<P, E>>;
  /** Entries in the selection that no pericope covers. Shown, never dropped. */
  readonly loose: E[];
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function resolvePassage<P extends PericopeRow, E extends EntryRow>(
  pericopes: readonly P[],
  entries: readonly E[],
  startOrd: number,
  endOrd: number,
): PassageResolution<P, E> {
  const lo = Math.min(startOrd, endOrd);
  const hi = Math.max(startOrd, endOrd);
  const inSelection = entries.filter((e) => e.ord >= lo && e.ord <= hi).sort((a, b) => a.ord - b.ord);

  // Hand-authored boundaries can overlap at the edges; ordering by start then
  // end keeps the passage list in reading order whatever the source did.
  const touched = pericopes
    .filter((p) => overlaps(p.start_ord, p.end_ord, lo, hi))
    .sort((a, b) => a.start_ord - b.start_ord || a.end_ord - b.end_ord);

  const claimed = new Set<string>();
  const resolved = touched.map((pericope) => {
    const startClip = Math.max(lo, pericope.start_ord);
    const endClip = Math.min(hi, pericope.end_ord);
    const own = inSelection.filter((e) => e.ord >= startClip && e.ord <= endClip && !claimed.has(e.verse_id));
    for (const e of own) claimed.add(e.verse_id);
    return { pericope, startOrd: startClip, endOrd: endClip, entries: own };
  });

  return { pericopes: resolved, loose: inSelection.filter((e) => !claimed.has(e.verse_id)) };
}

/** The pericope containing one verse, preferring the narrowest when boundaries nest. */
export function pericopeForVerse<P extends PericopeRow>(pericopes: readonly P[], ord: number): P | null {
  const containing = pericopes.filter((p) => p.start_ord <= ord && ord <= p.end_ord);
  containing.sort((a, b) => a.end_ord - a.start_ord - (b.end_ord - b.start_ord) || a.start_ord - b.start_ord);
  return containing[0] ?? null;
}
