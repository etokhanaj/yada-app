/**
 * Passage boundaries, from each book's Understand passages (data/understand.ts loadPericopes).
 */

export interface PericopeRow {
  readonly pericope_id: string;
  readonly label: string;
  readonly start_ord: number;
  readonly end_ord: number;
  readonly review_status: string | null;
  readonly payload: string | null;
}

/** The pericope containing one verse, preferring the narrowest when boundaries nest. */
export function pericopeForVerse<P extends PericopeRow>(pericopes: readonly P[], ord: number): P | null {
  const containing = pericopes.filter((p) => p.start_ord <= ord && ord <= p.end_ord);
  containing.sort((a, b) => a.end_ord - a.start_ord - (b.end_ord - b.start_ord) || a.start_ord - b.start_ord);
  return containing[0] ?? null;
}
