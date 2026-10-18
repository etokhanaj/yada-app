/**
 * The verse sheet's rules (build plan Phase 1; canvas VS-01–07, NA-01–08), kept apart from the screen so
 * each one is tested. Every line comes from the book's Understand bundle as published; nothing here
 * writes a sentence of its own beyond the fixed labels the plan names.
 */

import { type Reading, type UnderstandInfo, UnderstandInfoSchema, UNDERSTAND_FORMAT, type UnderstandVerse, type VerseLayers, isMissingVerse } from "@yada/schema";

import { type CatalogueEntry } from "../data/bookFiles";
import { resolveUrl } from "./translations";

export type UnderstandCatalogueEntry = UnderstandInfo & CatalogueEntry;

/** The manifest's `understand` list: schema-checked, known format only, one entry per book. */
export function parseUnderstandCatalogue(manifest: unknown, manifestUrl: string): UnderstandCatalogueEntry[] {
  if (manifest === null || typeof manifest !== "object") return [];
  const list = (manifest as { understand?: unknown }).understand;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: UnderstandCatalogueEntry[] = [];
  for (const raw of list as unknown[]) {
    const parsed = UnderstandInfoSchema.safeParse(raw);
    if (!parsed.success || parsed.data.format !== UNDERSTAND_FORMAT || seen.has(parsed.data.book)) continue;
    seen.add(parsed.data.book);
    out.push({ ...parsed.data, url: resolveUrl(manifestUrl, parsed.data.file) });
  }
  return out;
}

/** Whether Understand has anything to show for the verse, so the bar offers it only there. */
export function hasUnderstand(verse: UnderstandVerse): boolean {
  if (isMissingVerse(verse)) return verse.manuscripts.length > 0 || verse.plain !== null;
  const b = verse.beginner;
  return b.plain !== null || b.readers_differ.length > 0 || b.manuscripts.length > 0 || verse.facts.length > 0;
}

export interface Segment {
  readonly text: string;
  /** Words the UST adds to make the meaning clear, marked {…} in the source: italic and grey (VS-02). */
  readonly added: boolean;
}

/** "{This is} because God…" → the added words and the rest, braces removed. */
export function plainSegments(text: string): Segment[] {
  const out: Segment[] = [];
  for (const part of text.split(/(\{[^}]*\})/u)) {
    if (part === "") continue;
    const added = part.startsWith("{") && part.endsWith("}");
    out.push({ text: added ? part.slice(1, -1) : part, added });
  }
  return out;
}

export const wordCount = (text: string): number => text.split(/\s+/u).filter((w) => w !== "").length;

/** The plain line runs past this many words and it stands alone in the half view (Phase 1, VS-01). */
export const PLAIN_ALONE_WORDS = 30;

/**
 * One line under Readers differ: a reading, or on a verse whose debate is settled by data (an Old
 * Testament verse where a Jewish translation reads otherwise) the BSB's own "Or …" footnote (VS-06).
 */
export interface ReaderLine {
  readonly text: string;
  readonly reading: Reading | null;
}

export function readerLines(verse: VerseLayers): ReaderLine[] {
  const b = verse.beginner;
  const lines: ReaderLine[] = b.readers_differ.map((r) => ({ text: r.sentence, reading: r }));
  if (b.debate?.kind === "data") {
    for (const note of b.translators) {
      if (note.kind === "or") lines.push({ text: `The BSB’s own footnote: ${note.text.replace(/\.?$/u, ".")}`, reading: null });
    }
  }
  return lines;
}

export interface HalfView {
  /** Disputed verses lead with Readers differ, then the plain line as "One way to read it" (VS-03). */
  readonly readersFirst: boolean;
  readonly showPlain: boolean;
  /** The plain line set at reading size: the only large text in the half view (VS-01). */
  readonly plainLarge: boolean;
  /** At most one Notice fact, one that carries its own comparison. */
  readonly fact: string | null;
  readonly readers: ReaderLine[];
  readonly readersCount: number;
  /** "2 more in the full view" under approved positions (NA-02, VS-04); 0 otherwise. */
  readonly readersMore: number;
  readonly manuscripts: string[];
}

export function halfView(verse: VerseLayers): HalfView {
  const b = verse.beginner;
  const all = readerLines(verse);
  const readersFirst = b.order[0] === "readers_differ" && all.length > 0;
  if (readersFirst) {
    // Approved positions show the first readers_half in the half view; any other kind shows its first
    // reading, with the count in the lead-in (VS-03, VS-05).
    const positions = b.readers_differ.some((r) => r.source === "position");
    const shown = positions ? all.slice(0, Math.max(1, b.readers_half)) : all.slice(0, 1);
    return {
      readersFirst,
      showPlain: b.plain !== null,
      plainLarge: false,
      fact: null,
      readers: shown,
      readersCount: all.length,
      readersMore: positions ? b.readers_more : 0,
      manuscripts: b.manuscripts,
    };
  }
  const alone = b.plain !== null && wordCount(b.plain.text.replace(/[{}]/gu, "")) > PLAIN_ALONE_WORDS;
  return {
    readersFirst,
    showPlain: b.plain !== null,
    plainLarge: b.plain !== null,
    fact: alone ? null : (verse.facts.find((f) => f.startsWith("Translations differ")) ?? null),
    readers: alone ? [] : all.slice(0, 1),
    readersCount: all.length,
    readersMore: 0,
    manuscripts: alone ? [] : b.manuscripts,
  };
}

/** "Readers differ · 2", or the "together" lead-in where readings sit side by side (PSA 2:7, ISA 14). */
export function readersLead(verse: VerseLayers, count: number): string {
  return `${verse.beginner.readers_lead ?? "Readers differ"} · ${count}`;
}

/** The plain line's heading: "One way to read it" where readers differ, "In plain words" elsewhere. */
export function plainHeading(verse: VerseLayers): string {
  return verse.beginner.plain?.label ?? "In plain words";
}

/**
 * The BSB translators' own notes that are not already a reading: "Or only begotten or unique; also in
 * verse 18." They go under Notice in the full view.
 */
export function translatorNotes(verse: VerseLayers): string[] {
  if (verse.beginner.debate?.kind === "data") return verse.beginner.translators.filter((n) => n.kind !== "or").map((n) => noteLine(n.text));
  return verse.beginner.translators.filter((n) => n.kind === "or" || n.kind === "literally").map((n) => noteLine(n.text));
}

const noteLine = (text: string): string => `The BSB’s own footnote: ${text.replace(/\.?$/u, ".")}`;

/**
 * UX-09: under each verse in Verse by verse, what its Understand holds, in the order the sheet shows it:
 * "Readers differ · In plain words · Study note". A verse with none of these still has its words and other
 * translations (Original, Compare), and says so rather than nothing.
 */
export function behindLine(verse: UnderstandVerse): string {
  if (isMissingVerse(verse)) return verse.manuscripts.length > 0 ? "Manuscripts" : "Words and translations";
  const parts = [
    ...(readerLines(verse).length > 0 ? ["Readers differ"] : []),
    ...(verse.beginner.plain !== null ? ["In plain words"] : []),
    ...(verse.deeper.study_note !== null ? ["Study note"] : []),
    ...(verse.beginner.manuscripts.length > 0 ? ["Manuscripts"] : []),
  ];
  return parts.length === 0 ? "Words and translations" : parts.join(" · ");
}

/** EG-02: the one line while a book's Understand waits for a connection. */
export function offlineLine(bookName: string): string {
  return `Understand for ${bookName} downloads when you’re online.`;
}

/**
 * UX-11: on a version other than the BSB, a fact that quotes the BSB's wording says so ("In the BSB, “are to be
 * silent” translates…"), and the BSB translators' own footnotes step aside: they are notes on words the reader
 * isn't reading. Facts that already name their versions ("Translations differ: … (BSB) · … (KJV)") stand.
 */
export function factsFor(verse: VerseLayers, translation: string): string[] {
  if (translation === "BSB") return [...translatorNotes(verse), ...verse.facts];
  return verse.facts.map((f) => (/^“[^”]+” translates\b/u.test(f) ? `In the BSB, ${f}` : f));
}

/** "1 Jn 4:9-10" → "1 Jn 4:9–10": en dash in ranges (review §6). */
export const alongsideLabel = (ref: string): string => ref.replace(/(\d)-(\d)/gu, "$1–$2");

/** VoiceOver reads the added words once per line: "added for clarity" (Phase 1, VS-02). */
export function spokenPlain(text: string): string {
  const segments = plainSegments(text);
  if (!segments.some((s) => s.added)) return text;
  return `${segments.map((s) => s.text).join("")} (Some words added for clarity.)`;
}
