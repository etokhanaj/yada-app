/**
 * Start here's progress through John, and the one lead Home shows from it
 * (canvas ON-01, ON-05, ON-07; edge cases decided 11 Oct 2026). Pure, so the
 * rules are tested once.
 *
 * A passage counts as read when its guide's Next row is reached (ON-04: "the
 * reader reaches that Next row; nothing announces it"). Progress counts the
 * passages finished, not the highest one reached, so opening passage 10 first
 * never claims 1–9 (edge case 3).
 */

export const START_HERE_BOOK = "JHN";

/** The thread_progress row that holds "the passage after the one last finished" (thread.tsx's step). */
export const THREAD = "start-here-john";

/**
 * One thread_progress row per finished passage. A row each, not a count or a
 * bitmask in `step`: two devices merging their progress (iCloud, package B)
 * take the union of rows, and a count would add up the same passage twice.
 */
export const READ_PREFIX = `${THREAD}/read/`;

export function readThread(pericopeId: string, thread: string = THREAD): string {
  return `${thread}/read/${pericopeId}`;
}

/** Each book's own progress thread; John's is Start here's, so its rows stay where Home reads them. */
export function bookThread(book: string): string {
  return book === START_HERE_BOOK ? THREAD : `book-${book}`;
}

/**
 * The step a finished passage leaves: the index of the passage after it (thread.tsx reads
 * `lastFinished = step - 1`). Review, 12 Oct 2026: the boundary passed index + 1 and skipped one.
 */
export function stepAfter(finishedIndex: number): number {
  return finishedIndex + 1;
}

export function pericopeOfReadThread(thread: string): string | null {
  return thread.startsWith(READ_PREFIX) ? thread.slice(READ_PREFIX.length) : null;
}

export interface Passage {
  readonly pericope_id: string;
  readonly label: string;
  readonly start_ord: number;
  readonly end_ord: number;
}

/**
 * The passage to offer next: the one after the passage last finished, or the
 * first unread after it, wrapping to the start. Null once all are read (edge
 * case 2: no Next, no celebration). `lastFinished` is an index, -1 for none.
 */
export function nextPassage(count: number, read: ReadonlySet<number>, lastFinished: number): number | null {
  if (read.size >= count) return null;
  for (let step = 1; step <= count; step++) {
    const i = (lastFinished + step + count) % count;
    if (!read.has(i)) return i;
  }
  return null;
}

/** Index of the passage that holds `ord`, or -1. */
export function passageIndexAt(passages: readonly Passage[], ord: number): number {
  return passages.findIndex((p) => p.start_ord <= ord && ord <= p.end_ord);
}

/** Indexes of the finished passages, from the read pericope ids (unknown ids are ignored). */
export function readIndexes(passages: readonly Passage[], readIds: Iterable<string>): Set<number> {
  const ids = new Set(readIds);
  const out = new Set<number>();
  passages.forEach((p, i) => {
    if (ids.has(p.pericope_id)) out.add(i);
  });
  return out;
}

export type HomeLead =
  /** First launch, nothing read anywhere (ON-01). */
  | { readonly kind: "start" }
  /**
   * A reading place (ON-05). `passage` is John's passage holding it, when the
   * place is in John. `johnNext` is the quiet row under Continue, set only when
   * the place is outside John and a John passage is still to read (edge case 1).
   */
  | { readonly kind: "continue"; readonly passage: number | null; readonly johnNext: number | null }
  /** The passage last read is finished: the lead itself becomes Next (ON-07). */
  | { readonly kind: "next"; readonly passage: number };

/**
 * Home has one lead at a time (ON-05, ON-07): Continue while a passage is in
 * progress, Next once it is finished, never both for one reader.
 *
 * - No place and nothing read: Start here.
 * - A place in John, in a passage not yet finished: Continue.
 * - A place in John, in a finished passage: Next, if any passage is unread;
 *   with all 46 read, Continue at the place (edge case 2).
 * - A place in any other book: Continue, with John's Next as one quiet row
 *   under it when a passage is unread (edge case 1).
 * - No place but some read (progress synced from another device, edge case 8):
 *   Next.
 */
export function homeLead(input: {
  readonly passages: readonly Passage[];
  readonly read: ReadonlySet<number>;
  readonly lastFinished: number;
  /** The saved reading place: its book and ord, or null. */
  readonly place: { readonly book: string; readonly ord: number } | null;
}): HomeLead {
  const { passages, read, lastFinished, place } = input;
  const next = nextPassage(passages.length, read, lastFinished);
  if (place === null) {
    if (read.size === 0) return { kind: "start" };
    return next === null ? { kind: "start" } : { kind: "next", passage: next };
  }
  if (place.book !== START_HERE_BOOK) return { kind: "continue", passage: null, johnNext: next };
  const at = passageIndexAt(passages, place.ord);
  if (at >= 0 && read.has(at) && next !== null) return { kind: "next", passage: next };
  return { kind: "continue", passage: at >= 0 ? at : null, johnNext: null };
}

export type ListMark = "done" | "next" | "todo";

/** Start here's marks (PG-06): finished passages done, one Next, the rest plain. */
export function listMark(index: number, read: ReadonlySet<number>, next: number | null): ListMark {
  if (read.has(index)) return "done";
  return index === next ? "next" : "todo";
}

/** "2 of 46 passages read" (ON-05): finished passages, never the highest index. */
export function progressLine(readCount: number, count: number): string {
  return `${readCount} of ${count} passages read`;
}

/**
 * What VoiceOver hears for the progress line (ON-05): the line names no book because the lead
 * above it does, but heard alone it would not say which passages (canvas label, QA 11 Oct 2026).
 */
export function progressLabel(readCount: number, count: number): string {
  return `${readCount} of ${count} passages in John read`;
}

/**
 * Whether the guide's Next row has come into view: its bottom edge at or
 * above the bottom of the visible scroll area. `rowY` and `rowHeight` are in
 * content coordinates, `scrollY` the content offset, `viewport` the visible
 * height (less anything drawn over its foot).
 */
export function nextRowReached(rowY: number, rowHeight: number, scrollY: number, viewport: number): boolean {
  if (rowHeight <= 0 || viewport <= 0) return false;
  return rowY + rowHeight <= scrollY + viewport + 0.5;
}

/**
 * MM-05: three days or more since the place was saved is a return after a gap: Home says "Where you
 * stopped" and never how long it has been. Three days is Yada's choice, logged for John.
 */
export const GAP_DAYS = 3;

export function backAfterGap(savedAt: string | null, now: Date): boolean {
  if (savedAt === null) return false;
  const at = Date.parse(savedAt);
  return Number.isFinite(at) && now.getTime() - at >= GAP_DAYS * 86_400_000;
}
