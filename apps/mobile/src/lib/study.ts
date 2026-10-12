/**
 * The study layer in Understand (artifact "How Yada uses the open study notes", approved by John
 * 11 Oct 2026; canvas SN-01–08, TD-01–03): Tyndale Open Study Notes and OpenBible.info
 * cross-references, from the book's own downloaded study bundle (`study-jhn.v1.db`, DDL in
 * @yada/schema study.ts). Pure, so it can be tested.
 *
 * The notes are shown as published. What changes is presentation only: the leading verse
 * reference in bold ("1:1") is dropped when it names exactly the verse the sheet already names;
 * Tyndale's " • " separators become paragraph breaks; a note that opens on quoted words says they
 * are the NLT's. The Sources page says so, as CC BY-SA asks. Nothing here generates, shortens or
 * rewords a note, and nothing in the app sends one anywhere: the notes quote the NLT (CLAUDE.md
 * rule 9).
 */

import {
  BOOK_CODES,
  type BookCode,
  compareXrefs,
  lookupBook,
  ordToParts,
  type RankedXref,
  STUDY_FORMAT,
  type StudyInfo,
  StudyInfoSchema,
  verseOrd,
} from "@yada/schema";

import { resolveUrl } from "./translations";

/** Inline, under the opening of a note. */
export const TYNDALE_SHORT = "Tyndale Open Study Notes, CC BY-SA 4.0";
/** On the Study notes page, where the quoted words are read in full. */
export const TYNDALE_LINE = "Tyndale Open Study Notes, CC BY-SA 4.0. Quoted words are the NLT’s.";
export const OPENBIBLE_LINE = "Cross-references from OpenBible.info, CC BY 4.0.";

// ---------------------------------------------------------------------------
// Note markup -> segments
// ---------------------------------------------------------------------------

/** One run of note text and the distinctions Tyndale marks on it. */
export interface NoteSegment {
  readonly text: string;
  /** `<x>`: words quoted from the Bible text (Tyndale's NLT), set in italics. */
  readonly quoted: boolean;
  readonly italic: boolean;
  readonly bold: boolean;
  /** `<sc>`: the divine name, BC/AD. */
  readonly smallCaps: boolean;
}

export interface NoteParagraph {
  /** `<h>`: a heading line inside a longer note or article. */
  readonly heading: boolean;
  readonly segments: readonly NoteSegment[];
}

const TAG = /<(\/?)(h|x|i|b|sc)>/g;

function decode(text: string): string {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

const sameStyle = (a: NoteSegment, b: Omit<NoteSegment, "text">) =>
  a.quoted === b.quoted && a.italic === b.italic && a.bold === b.bold && a.smallCaps === b.smallCaps;

function parseLine(line: string): NoteSegment[] {
  const open = { h: 0, x: 0, i: 0, b: 0, sc: 0 };
  const segments: NoteSegment[] = [];
  let at = 0;
  const push = (raw: string) => {
    if (raw === "") return;
    const text = decode(raw);
    const style = { quoted: open.x > 0, italic: open.i > 0, bold: open.b > 0, smallCaps: open.sc > 0 };
    const last = segments.at(-1);
    if (last !== undefined && sameStyle(last, style)) segments[segments.length - 1] = { ...last, text: last.text + text };
    else segments.push({ text, ...style });
  };
  for (const match of line.matchAll(TAG)) {
    push(line.slice(at, match.index));
    at = (match.index ?? 0) + match[0].length;
    const tag = match[2] as keyof typeof open;
    if (match[1] === "/") open[tag] = Math.max(0, open[tag] - 1);
    else open[tag] += 1;
  }
  push(line.slice(at));
  return segments;
}

/**
 * Tyndale joins a note's separate points with " • " inside one paragraph (John 1:4: "…new life
 * through rebirth (John 1:13). • As one of his first creative acts…"). Each point becomes its own
 * paragraph (canvas, SN brief 2); the bullet itself is a separator, not a word, and goes.
 */
function splitPoints(segments: readonly NoteSegment[]): NoteSegment[][] {
  const out: NoteSegment[][] = [[]];
  for (const s of segments) {
    const parts = s.text.split(/\s*•\s*/);
    parts.forEach((part, i) => {
      if (i > 0) out.push([]);
      if (part !== "") out[out.length - 1]?.push({ ...s, text: part });
    });
  }
  return out;
}

function trimEnds(segments: readonly NoteSegment[]): NoteSegment[] {
  const out = [...segments];
  const first = out[0];
  if (first !== undefined) out[0] = { ...first, text: first.text.replace(/^\s+/, "") };
  const last = out.at(-1);
  if (last !== undefined) out[out.length - 1] = { ...last, text: last.text.replace(/\s+$/, "") };
  return out.filter((s) => s.text !== "");
}

/**
 * A note fragment (study.ts: `<h> <x> <i> <b> <sc>`, paragraphs on "\n", `&amp;` escaped) as
 * paragraphs of styled runs. A tag outside that set is kept as text rather than dropped: the
 * package refuses such a note, so seeing one means a packaging bug, and a stray `<` on screen is
 * honest where silently losing words is not.
 */
export function parseNoteMarkup(fragment: string): NoteParagraph[] {
  return fragment
    .split("\n")
    .filter((line) => line.trim() !== "")
    .flatMap((line) => {
      const heading = /^<h>[\s\S]*<\/h>$/.test(line.trim());
      return splitPoints(parseLine(line)).map((segments) => ({ heading, segments: trimEnds(segments) }));
    })
    .filter((p) => p.segments.length > 0);
}

/** The words alone, for VoiceOver and for measuring. */
export function plainNote(paragraphs: readonly NoteParagraph[]): string {
  return paragraphs.map((p) => p.segments.map((s) => s.text).join("")).join("\n");
}

/**
 * Drops a note's leading `<b>1:1</b>` when it names exactly this verse, which the sheet's title
 * already says (artifact, "Study notes"). Any other lead stays: "1:1-18" says the note is about
 * the passage, and "4:1b" that it covers half the verse.
 */
export function stripOwnReference(fragment: string, chapter: number, verse: number): string {
  const match = /^<b>\s*(\d+):(\d+)\s*<\/b>/.exec(fragment);
  if (match === null || Number(match[1]) !== chapter || Number(match[2]) !== verse) return fragment;
  return fragment.slice(match[0].length).replace(/^\s+/, "");
}

/** A ranged note's own lead (`<b>1:1-18</b>`), dropped because its "On 1:1–18" line says it. */
export function stripLeadReference(fragment: string): string {
  return fragment.replace(/^<b>\s*(?:Pss? )?[\d:–\-,ab ]+\s*<\/b>\s*/, "");
}

/**
 * Tyndale's passage note as the passage guide shows it: as published, its lead range dropped
 * because the guide's title says it, in the guide's plain paragraphs. The guide draws no italics,
 * so a note quoting the NLT carries the credit that says so: the BSB is beside it and its words
 * differ (canvas SN-03). Null when nothing is left to show.
 */
export function guideNote(fragment: string): { text: string; credit: string } | null {
  const paragraphs = parseNoteMarkup(stripLeadReference(fragment)).filter((p) => !p.heading);
  if (paragraphs.length === 0) return null;
  return {
    text: paragraphs.map((p) => p.segments.map((s) => s.text).join("")).join("\n\n"),
    credit: paragraphs.some((p) => p.segments.some((s) => s.quoted)) ? TYNDALE_LINE : TYNDALE_SHORT,
  };
}

/**
 * A note that opens on the NLT's words, `<x>the darkness can never extinguish it:</x> Or…`
 * (John 1:5), names them as the NLT's: Yada shows the BSB above, whose words differ ("has not
 * overcome it"), so a reader must not take them for the verse on screen (canvas SN-03). Returns
 * the lemma without its colon and the rest of the first paragraph, or null when the note does not
 * open on quoted words.
 */
export function leadingLemma(paragraph: NoteParagraph): { lemma: string; rest: NoteSegment[] } | null {
  const [first, ...others] = paragraph.segments;
  if (first === undefined || !first.quoted) return null;
  let lemma = first.text.trim();
  let rest = others;
  if (lemma.endsWith(":")) {
    lemma = lemma.slice(0, -1).trim();
  } else {
    // The colon set just outside the quoted words: `<x>light</x>: …`.
    const next = others[0];
    if (next === undefined || !next.text.startsWith(":")) return null;
    rest = [{ ...next, text: next.text.slice(1) }, ...others.slice(1)];
  }
  if (lemma === "") return null;
  const tail = trimEnds(rest);
  return { lemma, rest: tail };
}

// ---------------------------------------------------------------------------
// Which notes a verse shows
// ---------------------------------------------------------------------------

export interface StudyNoteRow {
  readonly id: number;
  readonly ord_start: number;
  readonly ord_end: number;
  readonly kind: string;
  readonly title?: string | null;
  readonly text: string;
}

/** A note's range includes the verse: both ends inclusive, as the SQL reads it. */
export function covers(row: Pick<StudyNoteRow, "ord_start" | "ord_end">, ord: number): boolean {
  return row.ord_start <= ord && ord <= row.ord_end;
}

/**
 * Understand's Study notes: verse notes (kind `note`) whose range includes the verse, the
 * verse's own note first, then notes on passages around it from the narrowest out, so 1:1's own
 * note leads and 1:1–18's follows. Introductions and theme articles cover whole books or stories
 * and are not verse notes; profiles show under People.
 */
export function notesForVerse(rows: readonly StudyNoteRow[], ord: number): StudyNoteRow[] {
  const span = (r: StudyNoteRow) => r.ord_end - r.ord_start;
  return rows
    .filter((r) => r.kind === "note" && covers(r, ord))
    .sort((a, b) => span(a) - span(b) || b.ord_start - a.ord_start || a.id - b.id);
}

/**
 * Tyndale's passage note for a pericope (the guide's opener, artifact "Free for the guide"): the
 * shortest note on a range of verses that covers the whole pericope, so John 1:1–18 gets
 * Tyndale's note on 1:1-18 rather than one on 1:1–2:12. A single-verse note never opens a
 * passage. Null when no note covers it.
 */
export function passageNoteFor<T extends Pick<StudyNoteRow, "id" | "kind" | "ord_start" | "ord_end">>(
  rows: readonly T[],
  startOrd: number,
  endOrd: number,
): T | null {
  const span = (r: T) => r.ord_end - r.ord_start;
  const fits = rows.filter((r) => r.kind === "note" && r.ord_end > r.ord_start && r.ord_start <= startOrd && r.ord_end >= endOrd);
  return [...fits].sort((a, b) => span(a) - span(b) || a.id - b.id)[0] ?? null;
}

/** True when the note is on this verse alone, not a passage around it. */
export function isOwnNote(row: Pick<StudyNoteRow, "ord_start" | "ord_end">, ord: number): boolean {
  return row.ord_start === ord && row.ord_end === ord;
}

/** "On 1:1–18": a ranged note's line, in the sheet's own terms (the book is in the title). */
export function onRangeLine(row: Pick<StudyNoteRow, "ord_start" | "ord_end">): string {
  const a = ordToParts(row.ord_start);
  return `On ${rangeTitle(row.ord_start, row.ord_end).replace(`${BOOK_CODES[a.book].name} `, "")}`;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The names a profile answers to: its title, and each name of a pair ("Adam and Eve"). */
export function profileNames(title: string): string[] {
  const parts = title.split(/\s+and\s+/).map((p) => p.trim()).filter((p) => p !== "");
  return [...new Set([title.trim(), ...(parts.length > 1 ? parts : [])])];
}

/**
 * The words a verse may name a profile by: its names, and for a people ("The Samaritans",
 * "Pharisees") the plural without "The" and its singular, so "a Samaritan woman" finds them.
 */
export function matchNames(title: string): string[] {
  const names = profileNames(title).map((n) => n.replace(/^The\s+/, ""));
  const singular = names.flatMap((n) => (/[^s]s$/.test(n) && /^[A-Z]/.test(n) && !/us$/.test(n) ? [n.slice(0, -1)] : []));
  return [...new Set([...names, ...singular])];
}

/** The verses a profile itself points to: where Tyndale anchors it, and its "Passages for Further Study". */
export function profileCites(profile: Pick<StudyNoteRow, "ord_start" | "ord_end" | "text" | "title">, book: BookCode, ord: number): boolean {
  if (covers(profile, ord)) return true;
  const further = profileBody(profile.text, profile.title ?? "").further;
  return further !== null && parseFurtherStudy(further, book).some((s) => s.start <= ord && ord <= s.end);
}

/**
 * The profiles named in a verse (canvas TD-01), and only where the name cannot be the wrong
 * person: the name must be a whole word of the verse's BSB text (case matters, so "Word" never
 * matches "word"), and the profile itself must cite this verse, by its own range or its passage
 * list. Many people share a name (John, Mary, Judas, James, Simon, Joseph, Herod, Zechariah), and
 * a name alone would put John the Baptist's profile on John the apostle's verses (coordinator,
 * edge case 1). Shown as rows, never links inside the text: a row is one 44 pt stop for VoiceOver.
 */
export function peopleInVerse<T extends Pick<StudyNoteRow, "kind" | "title" | "ord_start" | "ord_end" | "text">>(
  profiles: readonly T[],
  verseText: string,
  book: BookCode,
  ord: number,
): T[] {
  return profiles.filter(
    (p) =>
      p.kind === "profile" &&
      typeof p.title === "string" &&
      matchNames(p.title).some((name) => new RegExp(`(^|[^\\p{L}])${escapeRegExp(name)}(?=$|[^\\p{L}])`, "u").test(verseText)) &&
      profileCites(p, book, ord),
  );
}

/** A search that is a book's name ("John") is looking for the book, never a person first (edge case 1). */
export function isBookQuery(query: string): boolean {
  return lookupBook(query.trim()) !== null;
}

// ---------------------------------------------------------------------------
// Notes that point to other notes
// ---------------------------------------------------------------------------

export interface NoteReference {
  readonly book: BookCode;
  readonly start: number;
  readonly end: number;
}

/**
 * The other notes a note sends the reader to: "see study note on 1:22", "(see Gen 7:11-12 and
 * study note)", "see also 2:15 and study note there" (992 notes do). Each becomes a row under the
 * note that opens that verse's notes (edge case 2), so no reference is left dead. A reference
 * without a book is in the note's own book.
 */
export function noteReferences(text: string, book: BookCode): NoteReference[] {
  const plain = text.replace(/<[^>]+>/g, "");
  const ref = String.raw`((?:[1-3]\s?)?[A-Z][a-z]+\.?\s)?(\d+):(\d+)(?:[-–](?:(\d+):)?(\d+))?`;
  const patterns = [new RegExp(String.raw`study notes? on ${ref}`, "g"), new RegExp(String.raw`${ref}\s+and\s+(?:the\s+)?study note`, "g")];
  const out: NoteReference[] = [];
  const seen = new Set<string>();
  for (const pattern of patterns) {
    for (const m of plain.matchAll(pattern)) {
      const named = m[1]?.trim().replace(/\.$/, "");
      // A capitalised word before the reference that is not a book ("See 2:15 and study note")
      // is the sentence, not a book: the reference is in the note's own book.
      const code = (named === undefined || named === "" ? null : lookupBook(named)) ?? book;
      const c = Number(m[2]);
      const v = Number(m[3]);
      if (c < 1 || c > BOOK_CODES[code].chapters) continue;
      const start = verseOrd(code, c, v);
      const end = m[5] === undefined ? start : verseOrd(code, m[4] === undefined ? c : Number(m[4]), Number(m[5]));
      const key = `${start}-${end}`;
      if (end < start || seen.has(key)) continue;
      seen.add(key);
      out.push({ book: code, start, end });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Profiles whose title matches a search, by whole word from its start ("Nico" finds Nicodemus). */
export function profileMatches(title: string, query: string): boolean {
  const q = query.trim();
  if (q.length < 2) return false;
  return new RegExp(`(^|[^\\p{L}])${escapeRegExp(q)}`, "iu").test(title);
}

export interface ProfileBody {
  readonly paragraphs: NoteParagraph[];
  /** The "Passages for Further Study" line, as printed. */
  readonly further: string | null;
}

/** A profile's text without its title heading (the sheet's header says it), and its study passages apart. */
export function profileBody(text: string, title: string): ProfileBody {
  const paragraphs = parseNoteMarkup(text);
  const words = (p: NoteParagraph) => p.segments.map((s) => s.text).join("").trim();
  const at = paragraphs.findIndex((p) => p.heading && /^Passages? for Further Study$/i.test(words(p)));
  const body = (at === -1 ? paragraphs : paragraphs.slice(0, at)).filter((p, i) => !(i === 0 && p.heading && words(p) === title.trim()));
  const furtherLine = at === -1 ? undefined : paragraphs[at + 1];
  return { paragraphs: body, further: furtherLine === undefined ? null : words(furtherLine) };
}

export type Pronoun = "him" | "her" | "them";

/**
 * Whom a profile is about, only where the profile itself makes it plain (canvas SN brief 6): a
 * pair ("Adam and Eve") or a people ("The Samaritans") is "them"; one person is "him" or "her"
 * when the profile's own pronouns clearly say so. Otherwise null, and nothing is said: a guess at
 * someone's sex would be a claim the source never made.
 */
export function profilePronoun(title: string, text: string): Pronoun | null {
  const t = title.trim();
  if (profileNames(t).length > 1 || /^The\s/.test(t) || /(?:ites|ians|ans|ees)$/.test(t)) return "them";
  const count = (re: RegExp) => (text.match(re) ?? []).length;
  const he = count(/\b(he|him|his|himself)\b/gi);
  const she = count(/\b(she|her|hers|herself)\b/gi);
  if (he >= 3 && he >= she * 3) return "him";
  if (she >= 3 && she >= he * 3) return "her";
  return null;
}

/** The profile page's passage list: "Read about him", or plainly "Passages" when unsaid. */
export function readAboutLabel(title: string, text: string): string {
  const p = profilePronoun(title, text);
  return p === null ? "Passages" : `Read about ${p}`;
}

/** A People row's second line (canvas TD-01): "Who he was", or null when the profile does not say. */
export function whoLine(title: string, text: string): string | null {
  const p = profilePronoun(title, text);
  return p === null ? null : { him: "Who he was", her: "Who she was", them: "Who they were" }[p];
}

export interface OrdSpan {
  readonly start: number;
  readonly end: number;
}

/**
 * Tyndale's "Passages for Further Study" line as verse spans: "John 3:1-9; 7:50; 19:39-42",
 * "Gen 1:3-28; Ps 33:6, 9; 1 Jn 1:1". A reference without a book takes the one before it; one
 * without a chapter ("9" after "33:6") takes the chapter before. Anything unreadable is skipped,
 * never guessed: the row list is a convenience, the paragraph above it stays as printed.
 */
export function parseFurtherStudy(line: string, defaultBook: BookCode): OrdSpan[] {
  const spans: OrdSpan[] = [];
  let book: BookCode = defaultBook;
  let chapter: number | null = null;
  for (const group of line.split(";")) {
    for (const rawItem of group.split(",")) {
      const item = rawItem.trim().replace(/^(?:see|cp\.?|e\.g\.)\s+/i, "");
      if (item === "") continue;
      const named = /^((?:[1-3]\s?)?[A-Za-z][A-Za-z.]*(?:\s(?:of\s)?[A-Za-z]+)*)\s+(\d.*)$/.exec(item);
      let refText = item;
      if (named !== null) {
        const found = lookupBook((named[1] ?? "").replace(/\.$/, ""));
        if (found === null) continue;
        book = found;
        chapter = null;
        refText = named[2] ?? "";
      }
      const full = /^(\d+):(\d+)[ab]?(?:\s*[-–]\s*(?:(\d+):)?(\d+)[ab]?)?$/.exec(refText);
      const verseOnly = /^(\d+)[ab]?(?:\s*[-–]\s*(\d+)[ab]?)?$/.exec(refText);
      const chapters = BOOK_CODES[book].chapters;
      let span: OrdSpan | null = null;
      if (full !== null) {
        const c = Number(full[1]);
        const v = Number(full[2]);
        const endC = full[3] === undefined ? c : Number(full[3]);
        const endV = full[4] === undefined ? v : Number(full[4]);
        if (c >= 1 && c <= chapters && endC >= c) {
          span = { start: verseOrd(book, c, v), end: verseOrd(book, endC, endV) };
          chapter = endC;
        }
      } else if (verseOnly !== null && chapter !== null && named === null) {
        const v = Number(verseOnly[1]);
        const endV = verseOnly[2] === undefined ? v : Number(verseOnly[2]);
        span = { start: verseOrd(book, chapter, v), end: verseOrd(book, chapter, endV) };
      }
      if (span !== null && span.end >= span.start) spans.push(span);
    }
  }
  return spans;
}

// ---------------------------------------------------------------------------
// See also
// ---------------------------------------------------------------------------

/** Shown on Understand before "Show all" (canvas SN-01: 3 rows). */
export const SEE_ALSO_FIRST = 3;

/** Most votes first; the votes rank the list and are never shown (artifact, "See also"). */
export function rankXrefs<T extends RankedXref>(rows: readonly T[]): T[] {
  return [...rows].sort(compareXrefs);
}

export type SeeAlsoItem =
  | { readonly source: "yada"; readonly start: number; readonly end: number; readonly ref: string; readonly note: string | null }
  | { readonly source: "openbible"; readonly start: number; readonly end: number };

/**
 * See also is one list (canvas SN-01, SN-08): Yada's own related passages first, each with its
 * note saying why, then OpenBible's cross-references not already listed, best-voted first. A
 * cross-reference is already listed when it overlaps a related passage.
 */
export function mergeSeeAlso(
  related: ReadonlyArray<{ readonly ref: string; readonly note: string | null; readonly start: number; readonly end: number }>,
  xrefs: readonly RankedXref[],
): SeeAlsoItem[] {
  const yada: SeeAlsoItem[] = related.map((r) => ({ source: "yada", ...r }));
  const overlaps = (x: RankedXref) => related.some((r) => x.to_ord_start <= r.end && r.start <= x.to_ord_end);
  const open: SeeAlsoItem[] = rankXrefs(xrefs)
    .filter((x) => !overlaps(x))
    .map((x) => ({ source: "openbible", start: x.to_ord_start, end: x.to_ord_end }));
  return [...yada, ...open];
}

/** "Genesis 1:1", "John 1:1–3", "Genesis 1:1–2:3", "Haggai 2:20 – Zechariah 1:1". */
export function rangeTitle(startOrd: number, endOrd: number): string {
  const a = ordToParts(startOrd);
  const b = ordToParts(endOrd);
  const onePsalm = a.book === "PSA" && b.book === "PSA" && a.chapter === b.chapter;
  const name = (book: BookCode) => (onePsalm ? "Psalm" : BOOK_CODES[book].name);
  const head = `${name(a.book)} ${a.chapter}:${a.verse}`;
  if (startOrd === endOrd) return head;
  if (a.book !== b.book) return `${head} – ${name(b.book)} ${b.chapter}:${b.verse}`;
  if (a.chapter === b.chapter) return `${head}–${b.verse}`;
  return `${head}–${b.chapter}:${b.verse}`;
}

/** VoiceOver reads "–" as nothing useful: "John 1:1 to 3". */
export function spokenRange(title: string): string {
  return title.replace(/\s*–\s*/g, " to ");
}

// ---------------------------------------------------------------------------
// Catalogue and the download row
// ---------------------------------------------------------------------------

export type StudyCatalogueEntry = StudyInfo & { readonly url: string };

/**
 * The manifest's `study` list, schema-checked as translations are (lib/translations.ts): an
 * entry whose digest or licence is missing is never offered. A format this build cannot read is
 * left out quietly; the notes are an extra, so there is no update line for them.
 */
export function parseStudyCatalogue(manifest: unknown, manifestUrl: string): StudyCatalogueEntry[] {
  if (manifest === null || typeof manifest !== "object") return [];
  const list = (manifest as { study?: unknown }).study;
  if (!Array.isArray(list)) return [];
  const seen = new Set<BookCode>();
  const out: StudyCatalogueEntry[] = [];
  for (const raw of list as unknown[]) {
    const parsed = StudyInfoSchema.safeParse(raw);
    if (!parsed.success || parsed.data.format !== STUDY_FORMAT || seen.has(parsed.data.book)) continue;
    seen.add(parsed.data.book);
    out.push({ ...parsed.data, url: resolveUrl(manifestUrl, parsed.data.file) });
  }
  return out;
}

/**
 * The three one-line states Understand shows while a book's notes are not on the phone (canvas
 * SN brief 4). Downloads ask nothing, so none of these offers a download; only a failure offers
 * "Try again".
 */
export function fetchingLine(book: BookCode): string {
  return `Getting the study notes for ${BOOK_CODES[book].name}.`;
}

export function failedLine(book: BookCode): string {
  return `The study notes for ${BOOK_CODES[book].name} didn’t download.`;
}

export const OFFLINE_LINE = "Study notes download when you’re online.";

/** "Getting…" waits this long before it shows, so a quick download never flashes a line. */
export const FETCHING_DELAY_MS = 1000;

/** A See also row in Go further: "3 passages". */
export function passagesLine(n: number): string {
  return `${n} ${n === 1 ? "passage" : "passages"}`;
}

/**
 * Launch, before any study file opens: rows to drop and files to delete. Same pass as
 * sweepTranslations: a `.partial` from a crash, a file whose check failed, and an older version
 * a newer download replaced each kept space for good otherwise.
 */
export function sweepStudy<R extends { book: string; file: string; removed: number }>(
  rows: readonly R[],
  files: readonly string[],
): { keep: R[]; dropRows: string[]; deleteFiles: string[] } {
  const keep = rows.filter((r) => r.removed !== 1);
  const named = new Set(keep.map((r) => r.file));
  return {
    keep,
    dropRows: rows.filter((r) => r.removed === 1).map((r) => r.book),
    deleteFiles: files.filter((f) => !named.has(f)),
  };
}

/**
 * Whether a note needs "Read the whole note" at four lines: more than one paragraph, or more
 * words than four lines hold at this width and size. An estimate (a serif averages about half
 * its size per character); erring long only shows the link on a note that just fits.
 */
export function needsMore(paragraphs: readonly NoteParagraph[], width: number, fontSize: number, lines = 4): boolean {
  if (paragraphs.length > 1) return true;
  const perLine = Math.max(8, Math.floor(width / (fontSize * 0.5)));
  return plainNote(paragraphs).length > perLine * lines * 0.92;
}
