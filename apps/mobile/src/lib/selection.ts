/**
 * Verse selection: tap selects, tap again extends.
 *
 * Selection never requires pixel-precise dragging (0A rubric item 4). The rules
 * are small enough to state and test:
 *   - nothing selected: a tap selects that verse
 *   - one verse selected: tapping it again clears; tapping another extends the
 *     range to it, in either direction
 *   - a range selected: a tap starts a fresh selection at the tapped verse
 */

export interface SelectionState {
  readonly anchor: number | null;
  readonly end: number | null;
}

export interface VerseSpan {
  readonly start: number;
  readonly end: number;
}

export const EMPTY_SELECTION: SelectionState = { anchor: null, end: null };

export function tapVerse(state: SelectionState, verse: number): SelectionState {
  if (state.anchor === null || state.end !== null) return { anchor: verse, end: null };
  if (verse === state.anchor) return EMPTY_SELECTION;
  return { anchor: state.anchor, end: verse };
}

export function selectionSpan(state: SelectionState): VerseSpan | null {
  if (state.anchor === null) return null;
  const end = state.end ?? state.anchor;
  return { start: Math.min(state.anchor, end), end: Math.max(state.anchor, end) };
}

export function isSelected(state: SelectionState, verse: number): boolean {
  const span = selectionSpan(state);
  return span !== null && verse >= span.start && verse <= span.end;
}

/** "John 1:1" or "John 1:1–3", with an en dash as a reference range takes. */
export function formatSpan(bookName: string, chapter: number, span: VerseSpan): string {
  return span.start === span.end
    ? `${bookName} ${chapter}:${span.start}`
    : `${bookName} ${chapter}:${span.start}–${span.end}`;
}

/** The ref string the sheets take: `JHN.1.1` or `JHN.1.1-3`. */
export function spanRef(book: string, chapter: number, span: VerseSpan): string {
  return span.start === span.end ? `${book}.${chapter}.${span.start}` : `${book}.${chapter}.${span.start}-${span.end}`;
}
