/**
 * The reader's layout rules, pure so they can be tested: LORD in small
 * capitals, which actions the bar offers, keeping the selected verse above
 * the docked bar, and when the header steps back.
 */

import { BOOK_CODES, type BookCode } from "@yada/schema";

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export interface TextSegment {
  readonly text: string;
  /** Rendered in small capitals (amendment 12). */
  readonly smallCaps: boolean;
  /** A word the LSV's translators supplied, drawn muted (lib/supplied.ts). */
  readonly supplied?: boolean;
  /** A passage guide's evidence mark (PG-10): semibold, dotted accent underline. */
  readonly marked?: boolean;
}

/**
 * Splits segments at character ranges [start, end) of their joined text and
 * flags the parts inside one. Display only: the text itself never changes.
 */
export function markSegments(segments: readonly TextSegment[], ranges: ReadonlyArray<readonly [number, number]>): TextSegment[] {
  if (ranges.length === 0) return [...segments];
  const cuts = new Set<number>();
  for (const [a, b] of ranges) {
    cuts.add(a);
    cuts.add(b);
  }
  const inside = (at: number) => ranges.some(([a, b]) => at >= a && at < b);
  const out: TextSegment[] = [];
  let at = 0;
  for (const s of segments) {
    let from = 0;
    const points = [...cuts].filter((c) => c > at && c < at + s.text.length).sort((x, y) => x - y).map((c) => c - at);
    for (const to of [...points, s.text.length]) {
      if (to > from) out.push({ ...s, text: s.text.slice(from, to), ...(inside(at + from) ? { marked: true } : {}) });
      from = to;
    }
    at += s.text.length;
  }
  return out;
}

/**
 * The BSB prints the divine name as LORD (and GOD where it renders YHWH after
 * Adonai). Shown in small capitals, the BSB's own print convention; the text
 * stays the source's capitals, only its drawing changes.
 */
export function splitDivineName(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(/\b(LORD|GOD)(?=\b|’)/g)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), smallCaps: false });
    out.push({ text: m[0], smallCaps: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), smallCaps: false });
  return out;
}

// After "For the choirmaster." may come a tune or instrument, as a sentence ("According to Gittith.") or a quoted name that
// ends inside its quotes (Psalm 80: “The Lilies of the Covenant.”); without them the calm close (RT-03) showed the
// superscription as Psalm 80's first words (simulator, 18 Oct 2026).
const SUPERSCRIPTION = /^((?:For the choirmaster[^.]*\.(?:\s+(?!A (?:Psalm|Song|Maskil|Miktam|Prayer|Shiggaion)\b)(?:[^.“]*“[^”]*”|[^.“]+\.))*\s+)?A (?:Psalm|Song|Maskil|Miktam|Prayer|Shiggaion)\b[^.]*\.)\s+/u;

/**
 * Psalm 119's eight-verse sections open with their Hebrew letter in capitals ("ALEPH Blessed are…"); an excerpt is
 * the psalm's words, not the heading (Today's psalms card, 12d QA, 24 Oct 2026).
 */
const ACROSTIC = /^(?:ALEPH|BETH|GIMEL|DALETH|HE|WAW|VAV|ZAYIN|HETH|CHETH|TETH|YODH|YOD|KAPH|LAMEDH|LAMED|MEM|NUN|SAMEKH|AYIN|PE|TSADDE|TSADE|QOPH|RESH|SHIN|SIN|TAW|TAV)\s+(?=[A-Z])/u;

/**
 * List excerpts drop a psalm's superscription, which the BSB prints inside
 * verse 1: Psalm 23:1 begins "The LORD", not "A Psalm of David." (S18). They drop Psalm 119's letter headings too.
 */
export function excerptOf(text: string): string {
  return text.replace(SUPERSCRIPTION, "").replace(ACROSTIC, "");
}

/**
 * Amendment 12 (P-01): a psalm's title, which the BSB prints inside verse 1,
 * set on its own line. Display only: both parts are the translation's words.
 */
export function splitSuperscription(text: string): { title: string | null; body: string } {
  const m = SUPERSCRIPTION.exec(text);
  return m === null ? { title: null, body: text } : { title: m[1] ?? null, body: text.slice(m[0].length) };
}

/** "Psalms 23" reads wrong; a single psalm is a Psalm. */
export function chapterTitle(book: BookCode, chapter: number): string {
  return `${book === "PSA" ? "Psalm" : BOOK_CODES[book].name} ${chapter}`;
}

/** Where three letters read badly, the abbreviation printed Bibles use. */
const SHORT_NAMES: Readonly<Record<string, string>> = {
  Thessalonians: "Thess",
  Philippians: "Phil",
  Philemon: "Phlm",
  Ecclesiastes: "Eccl",
  Deuteronomy: "Deut",
  Judges: "Judg",
};

/**
 * The return chip names where it returns to, in a narrow header: "1 Cor 14:34".
 * Long book names shorten to their first three letters, as printed Bibles do.
 */
export function shortRef(ref: { book: BookCode; chapter: number; verse: number }): string {
  const name = BOOK_CODES[ref.book].name;
  const parts = name.split(" ");
  const last = parts[parts.length - 1] ?? name;
  const short = ref.book === "SNG" ? "Song" : name.length <= 6 ? name : [...parts.slice(0, -1), SHORT_NAMES[last] ?? last.slice(0, 3)].join(" ");
  return `${short} ${ref.chapter}:${ref.verse}`;
}

// ---------------------------------------------------------------------------
// A chosen verse's sheet
// ---------------------------------------------------------------------------

export type VerseTile = "sit" | "note" | "share" | "compare" | "save" | "play";

/**
 * RD-31: under the colours and the primary (Understand, or Original when the verse has no Understand: then it is the
 * only way to the verse's Greek, J01-15), the labelled tiles in the frame's order. Sit only for an open translation and
 * a short selection: it reads the words aloud (rule 9). Play from only when the chapter can be read aloud (AU-03).
 */
export function verseTiles(sittable: boolean, playable: boolean): VerseTile[] {
  return [...(sittable ? (["sit"] as const) : []), "note", "share", "compare", "save", ...(playable ? (["play"] as const) : [])];
}

/**
 * Share's menu (RD-31: Copy lives in Share). No image of a licensed translation's words: its rights holder's terms
 * cover quoting text with the notice, not making pictures of it (CLAUDE.md rule 9, docs/licensed-translations.md).
 */
export function shareActions(imageable: boolean): string[] {
  return ["Share", ...(imageable ? ["Share as an image"] : []), "Copy"];
}

/**
 * How far to scroll so the selection sits between the header and the bar
 * (brief §4: the selected verse scrolls to stay above it). Positive scrolls
 * the content up. Zero when it already fits. A selection taller than the gap
 * starts at the header, so its opening words are what stays visible.
 */
export function scrollToClearBar(
  selection: { top: number; bottom: number },
  bounds: { headerBottom: number; barTop: number },
  gap = 12,
): number {
  const room = bounds.barTop - gap - (bounds.headerBottom + gap);
  const height = selection.bottom - selection.top;
  if (height > room) return selection.top - (bounds.headerBottom + gap);
  if (selection.bottom > bounds.barTop - gap) return selection.bottom - (bounds.barTop - gap);
  if (selection.top < bounds.headerBottom + gap) return selection.top - (bounds.headerBottom + gap);
  return 0;
}

/**
 * Where the docked bar starts, in window y: it sits on the bottom edge. Null
 * until the bar has been measured, so a selection is never placed against a
 * bar of height zero (it would leave the verse under the real one).
 */
export function barTopIn(windowHeight: number, barHeight: number): number | null {
  return barHeight > 0 ? windowHeight - barHeight : null;
}

/**
 * Where Understand starts at its medium detent, in window y (amendment 1: the
 * verse stays visible above it). `medium` is the detent as a fraction of the
 * screen, SHEET_MEDIUM in the app.
 */
export function sheetTopIn(windowHeight: number, medium: number): number {
  return windowHeight * (1 - medium);
}

// ---------------------------------------------------------------------------
// Header step-back (canvas D-05)
// ---------------------------------------------------------------------------

export interface HeaderScroll {
  readonly collapsed: boolean;
  /** Offset the current direction of travel started from. */
  readonly anchor: number;
  readonly last: number;
}

export const HEADER_START: HeaderScroll = { collapsed: false, anchor: 0, last: 0 };

/** Down-scroll that steps the header back (D-05 motion note). */
const COLLAPSE_AFTER = 24;
/** Up-scroll that restores it; small, so a reader reaching for the controls gets them at once. */
const RESTORE_AFTER = 8;

/**
 * Only the reader's own drags move the header. VoiceOver focus moves and
 * programmatic jumps never collapse it (build-plan risk: the title must stay
 * reachable), so `userDriven` is false for those.
 */
export function headerOnScroll(state: HeaderScroll, y: number, userDriven: boolean): HeaderScroll {
  if (y <= 0) return { collapsed: false, anchor: 0, last: y };
  const goingDown = y > state.last;
  const wasGoingDown = state.last >= state.anchor;
  const anchor = goingDown === wasGoingDown ? state.anchor : state.last;
  if (!userDriven) return { collapsed: state.collapsed, anchor, last: y };
  if (!state.collapsed && goingDown && y - anchor >= COLLAPSE_AFTER) return { collapsed: true, anchor, last: y };
  if (state.collapsed && !goingDown && anchor - y >= RESTORE_AFTER) return { collapsed: false, anchor, last: y };
  return { collapsed: state.collapsed, anchor, last: y };
}
