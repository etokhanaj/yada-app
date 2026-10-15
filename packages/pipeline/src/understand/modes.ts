/**
 * Modes by kind of writing (John, 12 Oct 2026), ported from passage_summary.py. A law code, a building
 * plan, a debate, the Teacher's reflections, a collection of sayings, love poetry and visions each need
 * their own summary shape, and in each the summary says whose words it gives. Which passages take which
 * mode, and every fixed line a reader sees, come from John's tables (prototypes/data/kinds.json,
 * letters.json, plain_words.json); nothing shows as approved until he approves it (rule 2).
 *
 * The common rule: whenever the words belong to someone other than the narrator (a speaker, a letter
 * writer, God giving commands, the Teacher, a vision), the summary says whose words they are.
 */

import {
  GOSPELS,
  LEANS,
  LETTERS,
  MEASURE,
  OT,
  POETRY,
  QUOTE_FRAME,
  REPORTED,
  REPORTED_IN,
  SPEECH,
  SUMMARY_STOP,
  VISION,
  contentWords,
  framed,
  hasPerson,
  inner,
  unbraced,
  unquoted,
  type Kinds,
  type Owner,
  type PlainWords,
  type Where,
} from "./passage.js";
import { type OutlineEvent, type OutlineSection, type VerseKey, vk } from "./sources.js";
import { compareTuples, escapeRegExp, pySplit, unique } from "./text.js";

const leq = (a: readonly number[], b: readonly number[]): boolean => compareTuples(a, b) <= 0;

/** The passage's kind of writing, by its middle verse: Psalms, a range in kinds.json, a letter, a Gospel, or narrative. */
export function modeOf(book: string, vs: ReadonlyArray<[number, number]>, kinds: Kinds): string {
  if (POETRY.has(book)) return "psalms";
  const mid = vs[Math.floor(vs.length / 2)] as [number, number];
  const hit = kinds.modes.find((m) => m.book === book && leq(m.from, mid) && leq(mid, m.to));
  if (hit !== undefined) return hit.mode;
  return LETTERS.has(book) ? "letter" : GOSPELS.has(book) ? "gospel" : "narrative";
}

/** The setting or purpose line (kinds.json) whose range holds the passage. */
export function kindLine(kinds: Kinds, which: "settings" | "purposes", book: string, vs: ReadonlyArray<[number, number]>): [string, string] | [null, null] {
  const first = vs[0] as [number, number];
  const last = vs.at(-1) as [number, number];
  const x = kinds[which].find((k) => k.book === book && leq(k.from, first) && leq(last, k.to));
  return x === undefined ? [null, null] : [x.line, x.source];
}

const capitalLike = (match: string, to: string): string => (/^\p{Lu}/u.test(match) ? (to[0] ?? "").toUpperCase() + to.slice(1) : to);

/**
 * The approved word list (plain_words.json): "apprentices" -> "disciples" (Mark test, 12 Oct 2026).
 * Returns the text and the changes made, which the UST credit names.
 */
export function ustSubs(text: string, book: string, plain: PlainWords): [string, string[]] {
  const fired: string[] = [];
  let out = text;
  for (const s of plain.ust_substitutions) {
    const scope = pySplit(s.books);
    if (!(scope.includes(book) || (scope.includes("NT") && !OT.has(book)))) continue;
    const next = out.replace(new RegExp(`\\b${escapeRegExp(s.from)}\\b`, "gi"), (m) => capitalLike(m, s.to));
    if (next !== out) {
      fired.push(`${s.from} → ${s.to}`);
      out = next;
    }
  }
  return [out, fired];
}

/** tN's translator terms through the plain-words table ("quadrupeds" -> "animals", Leviticus 11). */
export function plainWordsIn(text: string, plain: PlainWords): string {
  const entries = Object.entries(plain.plain_words)
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e[0].length - a.e[0].length || a.i - b.i)
    .map(({ e }) => e);
  return entries.reduce((t, [k, v]) => t.replace(new RegExp(`\\b${escapeRegExp(k)}\\b`, "gi"), (m) => capitalLike(m, v)), text);
}

/**
 * The other Gospels' tellings of this passage: the BSB's section parallels under the passage's headings,
 * else Glyssen's parallel-passage column for its speech verses. Only what the data names (rule 4).
 */
export function alsoToldIn(
  book: string,
  vs: ReadonlyArray<[number, number]>,
  parallels: ReadonlyArray<{ chapter: number; verse: number; refs: string[] }>,
  bookNames: ReadonlyMap<string, string>,
  glyssen: readonly string[] = [],
): string[] {
  const names = new Map([...GOSPELS].filter((g) => g !== book).map((g) => [bookNames.get(g) ?? g, g]));
  const inside = new Set(vs.map(([c, v]) => vk(c, v)));
  const out: string[] = [];
  for (const p of parallels) {
    if (!inside.has(vk(p.chapter, p.verse))) continue;
    for (const raw of p.refs) {
      const r = raw.replace(/-/g, "–");
      if (names.has(r.split(" ")[0] ?? "") && !out.includes(r)) out.push(r);
    }
  }
  if (out.length === 0) {
    for (const raw of glyssen) {
      for (const part of raw.split(/\s*;\s*/)) {
        const m = /^([1-3]?[A-Z]{2,3})\s+(\d+)[.:](\d+(?:[-–]\d+)?(?:,\d+)*)/.exec(part);
        if (m === null || !GOSPELS.has(m[1] ?? "") || m[1] === book) continue;
        const r = `${bookNames.get(m[1] ?? "") ?? ""} ${m[2]}:${(m[3] ?? "").replace(/-/g, "–")}`;
        if (!out.includes(r)) out.push(r);
      }
    }
  }
  return out;
}

/**
 * An outline item names a section in a few words. A tN bullet that is prose ("There are multiple different
 * curtains described using three different Hebrew words: …", Exodus 26) or that quotes the text for
 * translators ("Third-person: “If his offering”", Leviticus 1) is not one.
 */
export function outlineItem(t: string): boolean {
  return pySplit(t).length <= 20 && !/[“”[\];]|:\s|\.$/.test(t) && !/\b(?:person|singular|plural|masculine|feminine|Scenario|quote|ULT|UST)\b/.test(t);
}

const NUMBER_WORDS = new Set(["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "twelve", "thousand", "hundred", "first", "second", "third", "fourth", "fifth", "sixth", "seventh"]);

const stem4 = (word: string): string => {
  const w = word.replace(/’/g, "'");
  return w.length >= 5 ? w.slice(0, 4) : w;
};

/**
 * True when the text names what an outline section is about: one of its title's content words (numbers
 * aside) occurs in it. Revelation 13 sits inside tN's "The seven trumpets (8:2–13:18)" but no trumpet
 * sounds in the chapter (John, 12 Oct 2026: tighter containment for visions).
 */
export function outlineNamed(title: string, text: string): boolean {
  const have = new Set(contentWords(text).map(stem4));
  return contentWords(title).some((w) => !NUMBER_WORDS.has(w) && have.has(stem4(w)));
}

/** Translation Notes markdown as the Psalms and concept notes are read (links to words, rc:// links and bold dropped). */
function md(text: string): string {
  return text.replace(/\\n/g, "\n").replace(/\[\[rc:\/\/[^\]]*\]\]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*/g, "");
}

type TnNotes = ReadonlyArray<{ ref: string; support: string; note: string }>;

const intro = (tn: TnNotes, c: number): string => {
  const row = tn.find((r) => r.ref === `${c}:intro`);
  return row === undefined ? "" : md(row.note);
};

/** "## " sections of a chapter introduction, the heading line first. */
const sections = (text: string): string[] => text.split(/^## /m).slice(1);

const chaptersOf = (vs: ReadonlyArray<[number, number]>): number[] => [...new Set(vs.map(([c]) => c))].sort((a, b) => a - b);

/**
 * tN's chapter-introduction concept headings ("Religious and Cultural Concepts") whose every content word is
 * in the passage: what a vision shows, in tN's words ("Two witnesses", "Great white throne", Revelation).
 */
export function conceptHeadings(vs: ReadonlyArray<[number, number]>, tn: TnNotes, text: string): string[] {
  const have = new Set(contentWords(text).map(stem4));
  const out: string[] = [];
  for (const c of chaptersOf(vs)) {
    for (const sec of sections(intro(tn, c))) {
      if (!sec.startsWith("Religious and Cultural")) continue;
      for (const m of sec.matchAll(/^### (.+)$/gm)) {
        const h = m[1] ?? "";
        const ws = contentWords(h).filter((w) => !NUMBER_WORDS.has(w));
        if (ws.length > 0 && !/[“”"]/.test(h) && ws.every((w) => have.has(stem4(w)))) out.push(h.trim());
      }
    }
  }
  return out;
}

/** Outline sections that hold the whole passage, narrowest first. */
export function containing(vs: ReadonlyArray<[number, number]>, secs: readonly OutlineSection[]): OutlineSection[] {
  const first = vs[0] as [number, number];
  const last = vs.at(-1) as [number, number];
  return secs
    .filter((x) => leq([x.c1, x.v1], first) && leq(last, [x.c2, x.v2]))
    .map((x, i) => ({ x, i }))
    .sort((a, b) => compareTuples([(a.x.c2 - a.x.c1) * 1000 + (a.x.v2 - a.x.v1), -a.x.c1, -a.x.v1], [(b.x.c2 - b.x.c1) * 1000 + (b.x.v2 - b.x.v1), -b.x.c1, -b.x.v1]) || a.i - b.i)
    .map(({ x }) => x);
}

/**
 * The outline sections either side of `sec`: the one ending just before it starts and the one starting just
 * after it ends. John, 12 Oct 2026: a letter shows where its argument comes from and goes.
 */
export function beforeAfter(sec: OutlineSection, secs: readonly OutlineSection[]): [string | null, string | null] {
  const stable = (xs: OutlineSection[], key: (x: OutlineSection) => number[]): OutlineSection[] =>
    xs
      .map((x, i) => ({ x, i }))
      .sort((a, b) => compareTuples(key(a.x), key(b.x)) || a.i - b.i)
      .map(({ x }) => x);
  const prev = stable(
    secs.filter((x) => compareTuples([x.c2, x.v2], [sec.c1, sec.v1]) < 0),
    (x) => [x.c2, x.v2, x.c1, x.v1],
  );
  const next = stable(
    secs.filter((x) => compareTuples([x.c1, x.v1], [sec.c2, Math.min(sec.v2, 998)]) > 0),
    (x) => [x.c1, x.v1, x.c2, x.v2],
  );
  return [prev.at(-1)?.line ?? null, next[0]?.line ?? null];
}

/** A headline through the plain-words table, credited to it when it changed a word. */
export function topic(t: string, source: string, plain: PlainWords): [string, string] {
  const p = plainWordsIn(t, plain);
  return [p, source + (p !== t ? `, plain words ${plain.status}` : "")];
}

/**
 * A law or plan passage's headline is its topic, never tN prose (John, 12 Oct 2026). In order: a
 * book-outline item that fits the passage (at most 3× its length); the narrowest chapter-outline item that
 * holds it, else one starting in its first half; the narrowest book-outline item that holds it; for law
 * only, the BSB heading. Every candidate must be an outline item, through the plain-words table.
 */
export function lawTopic(
  vs: ReadonlyArray<[number, number]>,
  label: string,
  events: readonly OutlineEvent[],
  outline: readonly OutlineSection[],
  span: (s: OutlineSection) => number,
  mode: string,
  plain: PlainWords,
): [string, string] | [null, null] {
  const first = vs[0] as [number, number];
  const half = vs[Math.floor(vs.length / 2)] as [number, number];
  const last = vs.at(-1) as [number, number];
  const fit = containing(vs, outline).filter((x) => span(x) <= 3 * vs.length && outlineItem(x.line));
  if (fit[0] !== undefined) return topic(fit[0].line, "tN book outline", plain);
  const items = events.filter((e) => outlineItem(e.line));
  const hold = items.filter((e) => leq([e.chapter, e.v1], first) && e.chapter === first[0] && first[0] === last[0] && e.v2 >= last[1]);
  const narrowest = hold.reduce<OutlineEvent | null>((best, e) => (best === null || e.v2 - e.v1 < best.v2 - best.v1 ? e : best), null);
  if (narrowest !== null) return topic(narrowest.line, "tN outline", plain);
  const starts = items.filter((e) => leq(first, [e.chapter, e.v1]) && leq([e.chapter, e.v1], half));
  const earliest = starts.reduce<OutlineEvent | null>(
    (best, e) => (best === null || compareTuples([e.chapter, e.v1, -(e.v2 - e.v1)], [best.chapter, best.v1, -(best.v2 - best.v1)]) < 0 ? e : best),
    null,
  );
  if (earliest !== null) return topic(earliest.line, "tN outline", plain);
  const wide = containing(vs, outline).filter((x) => outlineItem(x.line));
  if (wide[0] !== undefined) return topic(wide[0].line, "tN book outline", plain);
  if (mode === "law") return topic(label, "BSB heading", plain);
  return [null, null];
}

/**
 * The purpose for a law passage: one sentence from the tN chapter introduction's concept notes, the one whose
 * heading or sentence shares most words with the topic, preferring one that says what something means or is
 * for (Leviticus 11). Translator wording is never shown; "This chapter" becomes the chapter's name.
 */
export function conceptLine(c: number, tn: TnNotes, topicText: string, label: string, bookName: string): string | null {
  let best: string | null = null;
  let bestScore = 0;
  const tw = new Set(contentWords(`${topicText} ${label}`));
  for (const sec of sections(intro(tn, c))) {
    if (!/^(?:Religious and Cultural|Important Concepts|Special Concepts)/.test(sec)) continue;
    for (const sub of sec.split(/^### /m).slice(1)) {
      const nl = sub.indexOf("\n");
      const head = nl === -1 ? sub : sub.slice(0, nl);
      const body = nl === -1 ? "" : sub.slice(nl + 1);
      const para = body.trim().split("\n\n")[0] ?? "";
      const s1 = (para.split(/(?<=[a-z][.!?])\s+(?=[A-Z“])/)[0] ?? "").trim().replace(/\s*\((?:See|see)[^)]*\)/g, "");
      const n = pySplit(s1).length;
      if (!s1.endsWith(".") || /ULT|UST|translat|your language|\(|\d+:\d+|^(?:First|As|However|But|It|They|These|This was)\b/.test(s1) || n < 8 || n > 32) continue;
      const ov = new Set([...contentWords(head), ...contentWords(s1)].filter((w) => tw.has(w))).size;
      const sc = ov + (/\bmean(?:s|ing)?\b|\bpurpose\b|\bso that\b|\bbecause\b|\bwas (?:a|an|the)\b/.test(s1) ? 0.5 : 0);
      if (ov > 0 && sc > bestScore) [best, bestScore] = [s1, sc];
    }
  }
  if (best === null) return null;
  const name = `${bookName} ${c}`;
  return best.replace(/\b[Tt]his chapter\b/g, name).replace(new RegExp(`^In ${escapeRegExp(name)}, ([\\p{L}\\p{N}_])`, "u"), (_, ch: string) => ch.toUpperCase());
}

/**
 * Proverbs: "Part of" the collection (tN book outline) and the themes tN names for the chapter, its
 * concept-note headings and the outline items inside the collection. No summary body (John, 12 Oct 2026).
 */
export function sayingsLines(
  vs: ReadonlyArray<[number, number]>,
  outline: readonly OutlineSection[],
  tn: TnNotes,
  events: readonly OutlineEvent[],
  plain: PlainWords,
): [string | null, string[]] {
  const cont = containing(vs, outline);
  const coll = cont.at(-1)?.line ?? null;
  const themes: string[] = [];
  for (const c of chaptersOf(vs)) {
    for (const sec of sections(intro(tn, c))) {
      if (sec.startsWith("Religious and Cultural")) themes.push(...[...sec.matchAll(/^### (.+)$/gm)].map((m) => (m[1] ?? "").trim()));
    }
  }
  for (const x of cont.slice(0, -1)) themes.push(x.line);
  const first = vs[0] as [number, number];
  const last = vs.at(-1) as [number, number];
  themes.push(...events.filter((e) => leq([e.chapter, e.v1], last) && leq(first, [e.chapter, e.v2]) && outlineItem(e.line)).map((e) => e.line));
  // A label for a part of the page ("Title") is not a theme.
  return [coll, unique(themes).filter((t) => t !== "" && t !== coll && !["Title", "Introduction", "Conclusion"].includes(t)).map((t) => plainWordsIn(t, plain))];
}

// ---------------------------------------------------------------------------
// Whose words: the owner of each summary line
// ---------------------------------------------------------------------------

const LOWER_START = new Set(
  ("the a an then when after as there all every some one another while at in on from later next before now also each many its his her " +
    "their two three four five six seven twelve twenty-four out with no suddenly immediately instead both around behind beside inside " +
    "among those these people anyone everyone nobody if").split(" "),
);

/** How the book's BSB writes each word: lowercase uses minus mid-sentence capitalised ones, and the capitalised set. */
export interface CaseCounts {
  lower: ReadonlyMap<string, number>;
  caps: ReadonlySet<string>;
}

export function caseCounts(texts: Iterable<string>): CaseCounts {
  const bsb = [...texts];
  const lower = new Map<string, number>();
  const caps = new Set<string>();
  for (const t of bsb) {
    for (const m of t.matchAll(/\b([a-z][a-z’'-]+)\b/g)) lower.set(m[1] ?? "", (lower.get(m[1] ?? "") ?? 0) + 1);
  }
  for (const t of bsb) {
    // A word the BSB capitalises mid-sentence ("God", "Lord") counts as a name.
    for (const m of t.matchAll(/(?<=[a-z,;] )([A-Z][a-z’'-]+)/g)) {
      const w = (m[1] ?? "").toLowerCase();
      lower.set(w, (lower.get(w) ?? 0) - 1);
      caps.add(w);
    }
  }
  return { lower, caps };
}

/**
 * A sentence placed after a frame ("In John’s vision, the angel…") loses its capital unless it opens on a
 * name: a word the BSB writes in lowercase ("Men will be startled") is not a name; "Satan" and "God" are.
 */
export function lowerFirst(s: string, cases: CaseCounts): string {
  const w = /^[{(]?([A-Za-z’'-]+)/.exec(s);
  if (w === null) return s;
  const low = (w[1] ?? "").toLowerCase();
  const lower = LOWER_START.has(low) || SUMMARY_STOP.has(low) || (cases.lower.get(low) ?? 0) > 0 || !cases.caps.has(low);
  return lower ? (s[0] ?? "").toLowerCase() + s.slice(1) : s;
}

/** Whom God speaks to, in the BSB's own words before the line ("The LORD said to Moses"). */
const ADDRESS = /\b(?:LORD|God)\s+(?:said|spoke|called)\s+(?:again\s+)?to\s+(Moses and Aaron|Moses and Eleazar|Moses|Aaron)\b/g;

/** The person God last spoke to before this verse, within `back` verses of the BSB; null when it doesn't say. */
export function addressee(bsb: ReadonlyMap<VerseKey, string>, cv: Where, back = 150): string | null {
  const keys = [...bsb.keys()]
    .map((k) => k.split(":").map(Number) as [number, number])
    .filter((k) => leq(k, cv))
    .sort(compareTuples)
    .slice(-back);
  for (const k of keys.reverse()) {
    const hits = [...(bsb.get(vk(k[0], k[1])) ?? "").matchAll(ADDRESS)];
    const to = hits.at(-1)?.[1];
    if (to === undefined) continue;
    // "Speak to the Israelites and say…" in the same or next two verses: the words are for them, through
    // Moses. "God tells Moses: “…your descendants…”" read as Moses' own descendants (Leviticus 26:40;
    // John, 15 Oct 2026).
    const next = [0, 1, 2].map((d) => bsb.get(vk(k[0], k[1] + d)) ?? "").join(" ");
    const audience = MESSAGE_FOR.exec(next)?.[1];
    return audience === undefined ? to : `${audience.replace(/^(?:the )?(?:people of Israel|sons of Israel)$/, "the Israelites")} through ${to}`;
  }
  return null;
}

/**
 * Whom a message to Moses is for: only a speech he is to relay ("Speak to the Israelites and say to them:",
 * Leviticus 25:2; "Command Aaron and his sons:", 6:9). "Tell the Israelites to bring Me an offering" (Exodus
 * 25:2) is one instruction; the rest of that speech is to Moses ("You will receive…").
 */
const MESSAGE_FOR =
  /\b(?:Speak to|Say to|Command|Tell)\s+(the Israelites|the people of Israel|the sons of Israel|the whole congregation of Israel|Aaron and his sons|Aaron)(?:\s+and\s+(?:say|tell)|\s*:|,\s*(?:saying|and say|[‘“])|\s+that\b)/;

const PAST = /\b(?:\w+ed|went|came|made|did|gave|took|brought|told|said|saw|stopped|was|were|had|put|set|built|wove|cast|sent|spoke)\b/;
const MODAL = /\b(?:must|should|shall|will|may|are to|is to|have to|has to)\b/;
/** The commands that open lines in the law and the plans ("Make the sacred apron from finely twisted linen"). */
const IMPERATIVE =
  /^(?:Make|Put|Take|Bring|Cover|Overlay|Set|Place|Attach|Hang|Fasten|Build|Command|Tell|Speak|Do|Have|Present|Anoint|Consecrate|Dedicate|Offer|Slaughter|Kill|Burn|Wash|Sprinkle|Dress|Pour|Use|Fold|Weave|Cast|Join|Prepare|Keep|Remember|Observe|Give|Sew|Engrave|Mount|Insert|Cut|Eat|Leave|Celebrate|Count|Collect|Treat|Love|Honor|Rest|Work|Stop)\b/;

/**
 * A line inside God's or Moses' speech that is the speech itself (a command, a "must", an I or you), not
 * the narrator's report in the same verse ("So the people stopped bringing gifts", Exodus 36:6).
 */
export function commandlike(s: string): boolean {
  return hasPerson(s) || SPEECH.test(s) || MODAL.test(s) || !PAST.test(s) || IMPERATIVE.test(s);
}

/**
 * [shown, raw] for a speech that opens in the passage's first verse and runs on past it ("Our God says,
 * “Comfort my people! Yes, comfort them!" continues in Isaiah 40:2). Split into sentences its first line is
 * cut in half and dropped, so the verse's own words of the speech are framed with the speaker instead.
 */
export function openingSpeech(verse: string, speaker: string | undefined, own: Owner | null = null, cv: Where | null = null): [string, string] | null {
  const count = (ch: string): number => verse.split(ch).length - 1;
  if (!speaker || count("“") <= count("”")) return null;
  let words = verse.slice(verse.lastIndexOf("“") + 1).trim();
  // Its first lines, up to 20 words: a speech that runs on (a parable told in one verse) is not read in full.
  const kept: string[] = [];
  for (const m of words.matchAll(/[^.!?]+[.!?]+/g)) {
    const part = m[0].trim();
    if (kept.length > 0 && pySplit([...kept, part].join(" ")).length > 20) break;
    kept.push(part);
  }
  words = kept.join(" ");
  const n = pySplit(words).length;
  if (n < 3 || n > 30) return null;
  const shown = own !== null && cv !== null ? own(cv, words, "UST") : words;
  if (shown === null) return null;
  return [shown === words ? framed(words, speaker) : shown, words];
}

export interface OwnerOptions {
  mode: string;
  speakerOf: ReadonlyMap<VerseKey, string>;
  bsb: ReadonlyMap<VerseKey, string>;
  letter?: { author: string; recipients: string } | undefined;
  voice?: string | undefined;
  cases: CaseCounts;
  /** The vision's teller (kinds.json voices.REV.names[0]). */
  visionTeller?: string;
  /** Whether a UST sentence is the verse's speaker's own words (summaries.ts spokenHere); absent, every one is. */
  spokenHere?: ((cv: Where, sentence: string) => boolean) | undefined;
}

/** The sentence as shown, saying whose words it is, or null to leave it out (John, 12 Oct 2026, common rule). */
export function makeOwner(o: OwnerOptions): Owner {
  const { mode, speakerOf, bsb, letter, voice, cases } = o;
  return (cv, s, src) => {
    const b = unbraced(s);
    let sp = o.spokenHere === undefined || src !== "UST" || o.spokenHere(cv, s) ? speakerOf.get(vk(cv[0], cv[1])) : undefined;
    if (mode === "plans" && MEASURE.test(s)) return null;
    // tQ reports the speech itself ("Paul says the gospel is…", "The Teacher says that…").
    if (src === "tQ" && REPORTED.test(s) && mode !== "visions") return s;
    if (mode === "law" || mode === "plans") {
      if (sp && !s.includes("“") && commandlike(b)) {
        if (src === "tQ") {
          // tQ paraphrases; it can't be quoted as God's words. It stays only when it reports them itself.
          return /\b(?:Yahweh|God|the LORD|Moses)\b[^.]*?\b(?:tell|told|say|said|command|instruct|want|warn|speak|spoke)/.test(s) ? s : null;
        }
        return framed(s, sp, ["God", "Yahweh", "LORD"].includes(sp) ? addressee(bsb, cv) : null);
      }
    }
    if (mode === "letter" && letter) {
      if (hasPerson(b) || SPEECH.test(b) || (b.endsWith("!") && pySplit(b).length <= 10)) {
        // tQ's paraphrase is not the writer's words, so it is never quoted as his.
        if (src === "tQ") return null;
        return `${letter.author} tells ${letter.recipients}: “${inner(s)}”`;
      }
      return s;
    }
    if (mode === "teacher" && voice) {
      if (/\b(?:Teacher|Qoheleth)\b/.test(s)) return s;
      if (src === "UST") return framed(s, voice);
      return `${voice} says that ${lowerFirst(s, cases)}`;
    }
    if ((mode === "debate" || mode === "love") && sp && !s.includes("“")) {
      // In a debate every speech is one side's; in the Song every line is the woman's or the man's. A tQ line
      // stays only when it reports the speech itself ("Job’s wife wanted him to curse God and die").
      if (src === "tQ") return REPORTED.test(s) || REPORTED_IN.test(s) ? s : null;
      return framed(s, sp);
    }
    // tQ paraphrases: a tQ line in someone's first or second person is left out.
    if (src === "tQ" && hasPerson(unquoted(b)) && !REPORTED_IN.test(s)) return null;
    let out = s;
    if (mode === "visions" && /^(?:\{?(?:Then|After (?:this|that)|And|Next|Now)\b,?\}?\s+)?I (?:saw|heard|looked|turned|watched|noticed|wept|fell|went|took)\b/.test(b)) {
      // John tells his own vision as "I saw…"; the verse's other speaker did not say it.
      sp = o.visionTeller ?? "John";
    }
    if (src !== "tQ" && sp && !out.includes("“") && (SPEECH.test(b) || /^(?:Yes|Oh|O)\b/.test(b) || hasPerson(b) || (b.endsWith("!") && pySplit(b).length <= 10))) {
      // An oracle, prayer or command the UST gives without quotation marks: framed with its speaker.
      out = framed(out, sp);
      // Glyssen's "first living creature" keeps its small letter after the frame.
      if (mode === "visions" && /^\p{Ll}/u.test(sp)) out = (out[0] ?? "").toLowerCase() + out.slice(1);
    }
    if (!QUOTE_FRAME.test(out) && hasPerson(unquoted(b))) {
      // First-person words with no speaker in the verse are the writer's own ("we sailed", Acts 16). A book
      // whose writer the data names frames them with him; otherwise the line is left out.
      if (!voice) return null;
      out = framed(out, voice);
    }
    if (mode === "visions" && !/\bJohn\b/.test(out)) {
      // A linking word that tied the line to the one before it goes with the frame.
      out = VISION + lowerFirst(QUOTE_FRAME.test(out) ? out : out.replace(/^(?:But|And|Then|So|Now|Also|Yes|Indeed),?\s+(?=\S)/, ""), cases);
    }
    return out;
  };
}

/** Lines that lean on the one before, for the law and plans body. */
export const leansRaw = (raw: string): boolean => LEANS.test(unbraced(raw));
