/**
 * The passage guide's rules (build plan Phase 2), apart from the screen so each is tested.
 */

import { type LabelledLine, type Passage, ordToParts } from "@yada/schema";

/** The passages a selection touches, in order (UX-07: a range across two shows the first, then a row). */
export function passagesTouched(passages: readonly Passage[], lo: number, hi: number): Passage[] {
  return passages.filter((p) => p.startOrd <= hi && lo <= p.endOrd).sort((a, b) => a.startOrd - b.startOrd);
}

/** "1:3–5", or "1:15–2:3" across a chapter. */
export function versesLabel(lo: number, hi: number): string {
  const a = ordToParts(lo);
  const b = ordToParts(hi);
  if (lo === hi) return `${a.chapter}:${a.verse}`;
  return a.chapter === b.chapter ? `${a.chapter}:${a.verse}–${b.verse}` : `${a.chapter}:${a.verse}–${b.chapter}:${b.verse}`;
}

const STOP = new Set(["the", "a", "an", "of", "for", "to", "in", "on", "and", "or", "with", "by", "at", "words", "after", "when", "his", "her", "him", "he", "she", "it", "was", "is", "came"]);

function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}’']+/gu) ?? []).map((w) => w.replace(/[’']s$/u, "")).filter((w) => !STOP.has(w) && w.length > 1);
}

/**
 * True when nearly every content word of `line` is already in `shown`: Isaiah 40's setting line "Words of
 * comfort for the exiles in Babylon." under the section name "Comfort for the exiles in Babylon", or Psalm
 * 51's "Written when Nathan the prophet came to David…" over the superscription that says it. John's
 * decision (12 Oct 2026): a line shows only where the text it repeats isn't on screen.
 */
export function repeats(line: string, shown: readonly string[]): boolean {
  const words = contentWords(line);
  if (words.length === 0) return false;
  const seen = new Set(shown.flatMap(contentWords));
  return words.filter((w) => seen.has(w)).length / words.length >= 0.8;
}

export interface InShort {
  /** "Jesus teaches Nicodemus about being born again.", or null where the passage has none (a psalm). */
  readonly headline: string | null;
  /** The summary's sentences, a psalm's lead lines, a letter's place, a setting or purpose line. */
  readonly lines: string[];
  /** Data facts in fixed sentences: "Some manuscripts place verses 34–35 after verse 40." */
  readonly facts: string[];
}

export function inShort(passage: Passage): InShort {
  const headline = passage.headline.trim() === "" ? null : passage.headline;
  const lines: string[] = [];
  const shown = headline === null ? [] : [headline];
  const add = (line: string | null | undefined) => {
    if (line === null || line === undefined || line.trim() === "") return;
    if (repeats(line, shown) || lines.includes(line)) return;
    lines.push(line);
    shown.push(line);
  };
  for (const lead of passage.psalm_lead) add(lead.text);
  for (const s of passage.sentences) add(s.text);
  if (passage.around !== null) {
    const parts = [
      passage.around.before === null ? null : `Before this: ${passage.around.before}`,
      passage.around.after === null ? null : `After this: ${passage.around.after}`,
    ].filter((p): p is string => p !== null);
    if (parts.length > 0) add(parts.join(" · "));
  }
  if (passage.themes.length > 0) add(`Themes: ${passage.themes.join(" · ")}`);
  add(passage.purpose?.line);
  for (const s of passage.settings) add(s.line);
  return { headline, lines, facts: passage.facts.map((f) => f.fact) };
}

/**
 * The lines a psalm or a prophet's section shows above its text in the reader (JR-01, JR-02, JR-04): at
 * most two, each dropped where it repeats what the reader already sees there (the superscription, the
 * section heading).
 */
export function readerLeadLines(passage: Passage, onScreen: readonly string[]): string[] {
  const shown = [...onScreen];
  const out: string[] = [];
  const candidates: string[] = passage.mode === "psalms" ? passage.psalm_lead.map((l: LabelledLine) => l.text) : passage.settings.map((s) => s.line);
  for (const line of candidates) {
    if (out.length === 2) break;
    if (repeats(line, shown)) continue;
    out.push(line);
    shown.push(line);
  }
  return out;
}

export interface GuideRow {
  readonly page: "verses" | "notes" | "key-words" | "check" | "about";
  readonly title: string;
  readonly note: string;
}

/** More, in a fixed order (NA-04, JR-03, JR-05). */
export function guideRows(passage: Passage, verseCount: number): GuideRow[] {
  const range = versesLabel(passage.startOrd, passage.endOrd);
  const rows: GuideRow[] = [];
  if (passage.psalm_about.length > 0) rows.push({ page: "about", title: "About this psalm", note: "Title, the picture, how it moves" });
  // UX pass, 15 Oct 2026: "each with its Understand" was app jargon, and a source's name as a row's line is a code
  // the Sources page holds (John, 12 Oct 2026: codes only in Sources).
  rows.push({ page: "verses", title: "Verse by verse", note: `${verseCount} ${verseCount === 1 ? "verse" : "verses"}` });
  rows.push({ page: "notes", title: "Study notes", note: `Tyndale on ${range}` });
  rows.push({ page: "key-words", title: "Key words", note: "What its main words mean" });
  rows.push({ page: "check", title: "Check what you read", note: "Questions from the passage" });
  return rows;
}

/** The Sources row's one line, as on the verse sheet; the passage's credit is on the Sources page it opens. */
export function guideSources(): string {
  return "Every source and licence";
}

const PROPHETS = new Set(["ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL"]);

export interface ProphetLead {
  /** The section's plain name ("Comfort for the exiles in Babylon"), where a new section starts. */
  readonly section: string | null;
  /** When and to whom ("Words of comfort for the exiles in Babylon."), where it changes and isn't a repeat. */
  readonly setting: string | null;
}

/**
 * JR-04: a prophet's section in plain words, and one setting line, above the first passage of each section.
 * The headline of a prophet's passage is its section's plain name (prophets.json). John, 12 Oct 2026: the
 * setting line shows only where the section name isn't already saying it.
 */
export function prophetLeads(passages: readonly Passage[]): Map<string, ProphetLead> {
  const out = new Map<string, ProphetLead>();
  let section = "";
  let setting = "";
  for (const p of passages) {
    if (!PROPHETS.has(p.id.split(".")[0] ?? "")) continue;
    const name = p.headline.replace(/\.$/u, "");
    const line = p.settings[0]?.line ?? "";
    const newSection = name !== "" && name !== section;
    const newSetting = line !== "" && line !== setting;
    section = name === "" ? section : name;
    setting = line === "" ? setting : line;
    if (!newSection && !newSetting) continue;
    const shownSection = newSection ? name : null;
    const shownSetting = newSetting && !repeats(line, [name, p.label]) ? line : null;
    if (shownSection !== null || shownSetting !== null) out.set(p.id, { section: shownSection, setting: shownSetting });
  }
  return out;
}

/** The two halves of a verse on their own lines (JR-01's tip quotes Psalm 27:1 this way), text unaltered. */
export function halves(text: string): string[] {
  return text.split(/(?<=[?!.;])\s+(?=[A-Z])/u).filter((s) => s !== "");
}
