/**
 * Passage summaries without AI: a port of passage_summary.py (12 Oct 2026). An extractive summary
 * of each passage from credited open data, gated by checks a–i (docs/no-ai-understand.md, "Rolling
 * out to every book"). Every word shown is a source's, adapted only by rule, or a fixed template's.
 *
 * Method, in order: passages (the book's pericopes, else the BSB's sections); a headline from the
 * Translation Notes' outlines or the BSB's headings; a body of sentences from the Translation
 * Questions' answers and the UST, then Tyndale's first sentence and Open Bible Stories; a setting,
 * turning point and outcome picked by TextRank within the word budget; whose words each line is
 * (modes.ts); the gate; a seeded sample of five for John to read once; a per-book report that stops
 * the book above 15% flagged. The book driver is summaries.ts.
 */

import { CREDITS, parseVk, type ObsStory, type OutlineEvent, type OutlineSection, type TqAnswer, type VerseKey, vk } from "./sources.js";
import { argmax, compareTuples, escapeRegExp, fill, pySplit, seededSample, stripChars, unique } from "./text.js";

export const BUDGET = 55;
export const SAMPLE_PER_BOOK = 5;
/** Above this share flagged, a book has a source gap: stop and tell John before it goes out. */
export const STOP_SHARE = 0.15;
/**
 * …and at least this many flagged: in a book of three or four passages one weak summary is 25–33%, which
 * says nothing about a source gap (John, 13 Oct 2026: Philemon, 2 John). A flagged summary is hidden in
 * the app either way; the stop keeps out a book whose sources fail it wholesale.
 */
export const STOP_MIN_FLAGGED = 3;

/** The rollout's stop rule: over 15% of a book's summaries flagged, and at least three of them. */
export const overStop = (flagged: number, summaries: number): boolean => flagged >= STOP_MIN_FLAGGED && flagged / Math.max(1, summaries) > STOP_SHARE;

/**
 * Letters argue rather than narrate: their headline says which part of the argument a passage
 * belongs to ("Part of:"), from the narrowest outline section that contains it, however long. Under
 * the narrative rule 22 of 45 in 1 Corinthians were flagged, so the rule was fixed (12 Oct 2026).
 */
export const LETTERS: ReadonlySet<string> = new Set([
  "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD",
]);
export const GOSPELS: ReadonlySet<string> = new Set(["MAT", "MRK", "LUK", "JHN"]);

export const SUMMARY_STOP = new Set(
  `a an the and or but if then so that this these those of to in into on onto at by for from with without
as is are was were be been being am do does did done have has had having it its it's he him his she her they them
their we us our you your i me my not no nor all any some each every who whom whose which what when where why how
will would shall should can could may might must also very just only even than too here there about after before
again because while until up down out over under said says say tell told one two three yes now very own such
people person thing things way day time made make makes god's`.split(/\s+/),
);

/**
 * A sentence that leans on the one before it ("He said this…", "When they arrived…") can't stand alone.
 * A linking word before the pronoun leans just the same ("Instead, they will be priests…", Revelation 20:6).
 */
export const LEANS =
  /^(?:(This|That|These|Those|He|She|They|It|So|I|We|You)\b|(?:If|When|Because|After|Before|Although|Since|While)\s+(?:he|she|they|it|we|you|I)\b|(?:Instead|Rather|However|Therefore|Also|But|And|Then|So|Yet|Nevertheless|Indeed|As a result|For this reason|Because of this|One day|Later|Now|Soon|Next|After that|At that time|Sometime later),?\s+(?:he|she|they|it)\b)/;
const SAID_THIS = /\bsaid this\b/;

/**
 * Blessings and commands the UST gives without quotation marks ("May you become great in the clan of
 * Ephrathah…", Ruth 4:11) read as the summary's own voice: they are speech, not narration.
 */
export const SPEECH =
  /^(?:May (?:you|he|she|they|it|the Lord|God|Yahweh)\b|Let (?:us|me|him|her|them|the)\b|Do not\b|Don’t\b|Go\b|Come\b|Listen\b|O\s|Oh\b|[A-Z][a-z]+, (?:you|do|go|come|listen|let|may|hear)\b)/;

/**
 * A sentence cut inside the UST's {implied words}: the brace it lost is put back at its edge, so the added
 * words stay marked as added ("We are sending this letter} to…" → "{We are sending this letter} to…",
 * 2 Thessalonians 1:1; John's review, 15 Oct 2026). Only braces change, never a word.
 */
export function rebraced(s: string): string {
  let depth = 0;
  let open = 0;
  for (const ch of s) {
    if (ch === "{") depth++;
    else if (ch === "}") {
      if (depth === 0) open++;
      else depth--;
    }
  }
  return `${"{".repeat(open)}${s}${"}".repeat(depth)}`;
}

/** The speaker a sentence names before its quotation: "Moses also said to all the gathered Israelites, “". */
const SAID_BY = /\b([A-Z][a-z]+)(?:\s+(?:also|then|again))?\s+(?:said|told|says|tells)\b/;

/** A line framed with whose words it is: "God says: “…”", "Paul tells the believers in Rome: “…”". */
export const QUOTE_FRAME = /^[^“]{1,90}? (?:says?|tells? [^:“]{1,60}?): “/;

/** First- and second-person words: someone's, never Yada's (gate check h). */
export function hasPerson(text: string): boolean {
  return /\bI\b/.test(text) || /\b(?:me|my|mine|myself|we|us|our|ours|ourselves|you|your|yours|yourself|yourselves)\b/i.test(text);
}

/** Reported speech names its speaker itself ("The Teacher says that whatever seems new already existed"). */
export const REPORTED_IN =
  /\b(?:says?|said|tells?|told|asks?|asked|wants?|wanted|commands?|commanded|warns?|warned)\b(?: [\p{L}\p{N}_’]+){0,3} (?:that|to|if|whether|not to)\b/u;
export const REPORTED =
  /^(?:The )?[A-Z][\p{L}\p{N}_’]*(?: [a-z’]+){0,2} (?:says?|said|tells?|told|asks?|asked|teaches|taught|writes|wrote|thinks|thought|advises|warns|urges)\b/u;

/** The leaning and speech tests read past the UST's added-word braces and brackets ("{So} he…"). */
export const unbraced = (s: string): string => s.replace(/[{}()]/g, "").trim();

/** Quotations removed, for the first- and second-person test. */
export const unquoted = (s: string): string => s.replace(/“[^”]*”/g, " ");

const GROUP_NAMES = new Set([
  "Disciples", "Elders", "Pharisees", "Sadducees", "Jews", "People", "Crowds", "Soldiers", "Apostles",
  "Israelites", "Philistines", "Levites", "Priests", "Seraphs", "Angels", "Brothers", "Sons", "Men", "Women",
]);

/**
 * A group speaks in the plural ("Chief priests say", "Disciples say"); one named person never does, whatever
 * the name ends in ("Cornelius says", "James says"), and "the man who told the guards and priests" is one man.
 */
export function isPlural(who: string): boolean {
  const subject = (who.split(/\s+(?:who|whom|that|of|from|to|in|at|on|with)\s+|,/)[0] ?? "").trim();
  const ws = pySplit(subject);
  const head = ws.at(-1) ?? who;
  return (
    GROUP_NAMES.has(head) ||
    ["women", "men", "people", "children"].includes(head) ||
    (head.endsWith("s") && /^\p{Ll}/u.test(head)) ||
    (ws.length > 1 && head.endsWith("s") && /^\p{Lu}/u.test(head) && /^\p{Ll}/u.test(ws[0] ?? "")) ||
    subject.includes(" and ")
  );
}

const QUANTITY =
  "(?:one|two|three|four|five|six|seven|some|another|still another|yet another|other|first|second|third|fourth|fifth|sixth|seventh|loud|powerful|many|several|all|both|certain)";

/**
 * Glyssen files a speaker under its noun, with the count or adjective after a comma ("angels in white,
 * two"); a reader sees it the English way round ("two angels in white", John, 12 Oct 2026). A list ("sea
 * captains, seafarers, sailors") stays as it is.
 */
export function speakerName(name: string): string {
  const m = new RegExp(`^([^,]+),\\s+(${QUANTITY})$`).exec(name.trim());
  return m === null ? name : `${m[2]} ${m[1]}`;
}

/** A sentence placed inside a frame's quotation marks: its own quotations become single marks. */
export const inner = (sentence: string): string => sentence.trim().replace(/“/g, "‘").replace(/”/g, "’");

/**
 * Speech in a summary is always someone's: "God says: “…”", or "God tells Moses: “…”" when the passage
 * names who is spoken to. Never Yada's own voice (Isaiah test, 12 Oct 2026).
 */
export function framed(sentence: string, speaker: string, to: string | null = null): string {
  const who = ["God", "Yahweh", "LORD", "Lord", "Yahweh (God)"].includes(speaker) ? "God" : speakerName(speaker);
  const plural = isPlural(who);
  const verb = to ? `${plural ? "tell" : "tells"} ${to}` : plural ? "say" : "says";
  return `${(who[0] ?? "").toUpperCase()}${who.slice(1)} ${verb}: “${inner(sentence)}”`;
}

/**
 * Glyssen's name for a speaker without its bracketed notes ("voice of one calling (preparing way for
 * Christ)" states one tradition's reading as fact) and without a cut-off tail ("seraph, one of the").
 */
export function glyssenName(name: string): string {
  return stripChars(name.replace(/\s*\([^)]*\)/g, "").trim().replace(/,?\s+(?:one\s+)?of\s+the$/, ""), " ,");
}

/** A sentence can also close with "}" or ")" and the next open with "(" (John 19:31's "…Jewish law}. (Since …"). */
export function summarySentences(text: string): string[] {
  return text
    .split(/(?:(?<=[.!?])|(?<=[.!?][’”)}]))\s+(?=[“‘{(A-Z])/)
    .map((p) => p.trim())
    .filter((p) => pySplit(p).length >= 4);
}

/** Content words for scoring: lower case, braces dropped, stop words and words of two letters out. */
export function contentWords(text: string): string[] {
  return (text.toLowerCase().replace(/[{}]/g, "").match(/[a-z’']+/g) ?? []).filter((w) => !SUMMARY_STOP.has(w) && w.length > 2);
}

const count = (s: string, ch: string): number => s.split(ch).length - 1;

/**
 * Quotation marks open and close inside the sentence, so no speech is cut in half. A sentence that closes
 * one quotation before it opens the next (Luke 13:27) holds the end of one speech and the start of another.
 * Single marks too, where a quotation inside a speech is cut (Matthew 5:21); a closing mark is one not
 * followed by a letter, so "Jesse’s" is no quotation.
 */
export function balanced(s: string): boolean {
  const opens = count(s, "‘");
  const singlesOk = (s.match(/’(?![A-Za-z])/g) ?? []).length >= opens && (opens > 0 || !/’[”]?$/.test(s));
  return (
    count(s, "“") === count(s, "”") &&
    !s.startsWith("”") &&
    !s.startsWith("’") &&
    singlesOk &&
    (!s.includes("”") || (s.includes("“") && s.indexOf("“") < s.indexOf("”")))
  );
}

/** A sentence that reports what happens, not one spoken inside the story. */
export const narration = (s: string): boolean => balanced(s) && !s.startsWith("“");

export function isNarrative(s: string, names: readonly string[]): number {
  if ((s.startsWith("“") || s.startsWith("‘")) && /(”|’|”\.|’\.)$/.test(s.trimEnd())) return 0;
  const lower = s.toLowerCase();
  const hit = names.some((n) => lower.includes(n.toLowerCase()));
  const past = /\b\w+ed\b|\b(went|came|said|saw|told|gave|took|made|did|was|were|became)\b/.test(lower);
  return hit && past ? 1 : past ? 0.6 : 0.3;
}

export function textrank(sents: readonly string[], d = 0.85, iterations = 40): number[] {
  const toks = sents.map((s) => new Set(contentWords(s)));
  const n = sents.length;
  const w = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const a = toks[i] as Set<string>;
      const b = toks[j] as Set<string>;
      if (i === j || a.size === 0 || b.size === 0) continue;
      const ov = [...a].filter((x) => b.has(x)).length;
      if (ov > 0) (w[i] as number[])[j] = ov / (Math.log(a.size + 1) + Math.log(b.size + 1));
    }
  }
  let score = new Array<number>(n).fill(1);
  for (let it = 0; it < iterations; it += 1) {
    const next: number[] = [];
    for (let i = 0; i < n; i += 1) {
      let s = 0;
      for (let j = 0; j < n; j += 1) {
        const row = w[j] as number[];
        const total = row.reduce((x, y) => x + y, 0);
        const wji = row[i] as number;
        if (wji !== 0 && total !== 0) s += (wji / total) * (score[j] as number);
      }
      next.push(1 - d + d * s);
    }
    score = next;
  }
  const top = Math.max(...score) || 1;
  return score.map((x) => x / top);
}

const stem = (w: string): string => w.replace(/’/g, "'").slice(0, 5);

export interface ObsCandidate {
  sentence: string;
  frame: number;
  index: number;
}

/**
 * Sentences from a story that the book's own account supports. Stories spanning several Gospels
 * blend in details from the others, so the test is strict (rule 4: never state what the book
 * doesn't say): no speech, no sentence that leans on the one before, every name and number in this
 * passage's BSB or UST text, and 85% of its content words by stem ("groups of 50" is Luke's).
 */
export function obsCandidates(story: ObsStory, bookText: string): ObsCandidate[] {
  const jw = new Set(contentWords(bookText).map(stem));
  const jlow = bookText.toLowerCase();
  const out: ObsCandidate[] = [];
  story.frames.forEach((frame, fi) => {
    let depth = 0; // open quotation marks before this sentence: a summary reports what happens, not part of a speech
    summarySentences(frame).forEach((sent, si) => {
      const insideQuote = depth > 0;
      depth += count(sent, "“") - count(sent, "”");
      if (insideQuote || sent.includes("“") || sent.includes("”")) return;
      const ws = new Set(contentWords(sent));
      if (ws.size === 0 || !balanced(sent)) return;
      if (/^(This|That|These|Those|He|She|They|It|His|Her|Their|Then)\b/.test(sent)) return;
      const names = [...sent.matchAll(/(?<![.!?“]\s)(?<!^)\b([A-Z][a-z]+)\b/g)]
        .map((m) => m[1] ?? "")
        .filter((n) => !["God", "Jesus", "Lord", "I", "Teacher"].includes(n));
      if (names.some((n) => !jlow.includes(n.toLowerCase()))) return;
      if ([...ws].filter((w) => jw.has(stem(w))).length / ws.size < 0.85) return;
      if ((sent.match(/\b\d+\b/g) ?? []).some((n) => !jlow.includes(n))) return;
      out.push({ sentence: sent, frame: fi, index: si });
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Measurable reasons to leave a line out
// ---------------------------------------------------------------------------

function syllables(word: string): number {
  const w = word.toLowerCase();
  let n = (w.match(/[aeiouy]+/g) ?? []).length;
  if (w.endsWith("e") && !w.endsWith("le") && !w.endsWith("ee") && n > 1) n -= 1;
  return Math.max(1, n);
}

/** Flesch–Kincaid grade of one sentence: a measure, not a judgment. */
export function grade(s: string): number {
  const ws = s.match(/[A-Za-z’']+/g) ?? [];
  if (ws.length === 0) return 0;
  return 0.39 * ws.length + (11.8 * ws.reduce((n, w) => n + syllables(w), 0)) / ws.length - 15.59;
}

/**
 * tQ answers follow the ULT's word order, which can put the verb before its subject ("By the witnesses of
 * the Law and the Prophets has a righteousness … been made known", Romans 3:21). Such an answer reads
 * harder than the UST's line for the same verse, so the UST line is used (John, 12 Oct 2026).
 */
const INVERTED =
  /^(?:By|In|Through|With|From|To|Of|Into|Upon|On|At|For|Under|Among)\b[^,;.]{3,90}?\s(?:has|have|had|is|was|were|are|will|shall|did|does|do|can|could|would|should|must)\s+(?:a|an|the|this|that|these|those|his|her|their|its|our|God|he|she|they|it|we|you|I|[A-Z][a-z]+)\b/;

/**
 * Inverted syntax anywhere; and in a letter, where tQ keeps the ULT's argument most closely, an answer whose
 * sentences average at least 5 grades above the UST's for the verse. Answers under 15 words are judged on
 * syntax alone, since a short sentence's grade turns on its names.
 */
export function readsHarder(answer: string, ustLine: string, gap = true): string | null {
  if (INVERTED.test(answer)) return "inverted syntax";
  const us = summarySentences(ustLine);
  const qs = summarySentences(answer);
  if (gap && us.length > 0 && qs.length > 0 && pySplit(answer).length >= 15) {
    const gUst = us.reduce((n, x) => n + grade(x), 0) / us.length;
    const gAns = qs.reduce((n, x) => n + grade(x), 0) / qs.length;
    if (gAns >= 12 && gAns - gUst >= 5) return "reads harder";
  }
  return null;
}

/**
 * A garbled sentence says the same five words twice (with two content words among them), or its "if"
 * clause and its result say the same thing ("If anyone’s enemies are going to capture him, they will
 * capture him", Revelation 13:10). "Show everyone how great" twice (John 17:1) is rhetoric, not a garble.
 */
export function repeatsItself(s: string): boolean {
  const ws = s.toLowerCase().match(/[a-z’']+/g) ?? [];
  const seen = new Map<string, number>();
  for (let i = 0; i + 5 <= ws.length; i += 1) {
    const gram = ws.slice(i, i + 5);
    const key = gram.join(" ");
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if ((seen.get(key) ?? 0) > 1 && gram.filter((w) => !SUMMARY_STOP.has(w)).length >= 2) return true;
  }
  const m = /^[^\p{L}\p{N}_]*(?:If|When|Whenever)\b([^,]+),\s*([^,]+?)[.!?]?[’”]?$/u.exec(s);
  if (m !== null) {
    const cond = new Set(contentWords(m[1] ?? ""));
    const res = new Set(contentWords(m[2] ?? ""));
    return res.size > 0 && [...res].every((w) => cond.has(w));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Choosing the sentences
// ---------------------------------------------------------------------------

/** Where a sentence comes from: a verse, or (-1 | 998, frame*100+sentence) for a story, (999, 0) for Tyndale. */
export type Where = [number, number];

export interface SummarySentence {
  /** As shown: framed with whose words it is where that applies. */
  text: string;
  /** The sentence itself, for scoring and the leaning checks. */
  raw?: string;
  src: string;
  where: Where;
  aside: boolean;
  setting: boolean;
  /** A fixed line (a plan's purpose), outside the whose-words check. */
  fixed?: boolean;
  /** A speaker's own words, which must be framed as theirs (gate check h). */
  speech?: boolean;
}

export interface Extra {
  sentence: string;
  source: string;
  where: Where;
}

export interface Summary {
  key: string;
  text: string;
  srcs: string[];
  detail: SummarySentence[];
}

/** The sentence as shown, framed with whose words it is, or null to leave it out (modes.ts). */
export type Owner = (cv: Where, sentence: string, source: "tQ" | "UST") => string | null;

export interface SummariseInput {
  label: string;
  /** The passage's verses, in order. */
  verses: ReadonlyArray<[number, number]>;
  ust: ReadonlyMap<VerseKey, string>;
  names: readonly string[];
  budget?: number;
  tq?: readonly TqAnswer[];
  events?: readonly OutlineEvent[];
  asides?: ReadonlySet<VerseKey>;
  obs?: { no: number; pool: readonly ObsCandidate[] } | null;
  extra?: readonly Extra[];
  owner?: Owner;
  /** Verses a short major debate is about (debates.json): no sentence comes from them. */
  divided?: ReadonlySet<VerseKey>;
  /** In a letter, a tQ answer five grades harder than the UST line gives way to it. */
  tqGap?: boolean;
  /** The passage opens with someone speaking (its first verse has a speaker). */
  opening?: Where | null;
  /** That opening speech, framed and raw, when it runs on past the first verse. */
  openingLine?: [string, string] | null;
}

const whereKey = (w: Where): VerseKey => vk(w[0], w[1]);
const leq = (a: Where, b: Where): boolean => compareTuples(a, b) <= 0;
const sameWhere = (a: Where, b: Where): boolean => a[0] === b[0] && a[1] === b[1];

interface Row {
  s: string;
  raw: string;
  where: Where;
  source: string;
}

export function summarise(input: SummariseInput): Summary | null {
  const budget = input.budget ?? BUDGET;
  const asides = input.asides ?? new Set<VerseKey>();
  const events = input.events ?? [];
  const own: Owner = input.owner ?? ((_, s) => s);
  const vs = input.verses;
  const inside = new Set(vs.map(([c, v]) => vk(c, v)));
  let rows: Row[] = [];
  let tq = input.tq ?? [];
  if (input.obs) {
    // A story that covers the passage already retells it in order and plain words: its supported
    // sentences are the pool, in the story's own order.
    for (const p of input.obs.pool) rows.push({ s: p.sentence, raw: p.sentence, where: [-1, p.frame * 100 + p.index], source: `OBS ${input.obs.no}.${p.frame + 1}` });
    tq = [];
  }
  // The translation questions' answers come first: they state the passage's key facts in plain words.
  for (const { chapter: c, verse: v, answer } of tq) {
    if (!inside.has(vk(c, v)) || !balanced(answer)) continue;
    if (readsHarder(answer, input.ust.get(vk(c, v)) ?? "", input.tqGap ?? false) !== null) continue;
    let parts = summarySentences(answer).filter(balanced);
    if (parts.length === 0) parts = [answer];
    // An answer on an aside verse (11:1–2 runs on into Mary's later anointing) keeps its first sentence.
    if (asides.has(vk(c, v + 1)) || asides.has(vk(c, v))) parts = parts.slice(0, 1);
    for (const x of parts) {
      const shown = own([c, v], x, "tQ");
      if (shown === null || repeatsItself(x)) continue;
      rows.push({ s: shown, raw: x, where: [c, v], source: "tQ" });
    }
  }
  // The UST always backs the tQ answers: the leaning filter can leave too few answers (John 21:1–14).
  if (!input.obs) {
    // The UST's sentences run across verses ("…created the earth and the heavens," continues in Genesis
    // 2:5), so the passage is joined first and split into whole sentences, each credited to the verse it
    // starts in.
    let joined = "";
    const startsAt: Array<[number, Where]> = [];
    for (const [c, v] of vs) {
      const t = input.ust.get(vk(c, v)) ?? "";
      if (t === "") continue;
      startsAt.push([joined.length, [c, v]]);
      joined += `${t} `;
    }
    let pos = 0;
    const quoteOpenings: typeof rows = [];
    for (const cut of summarySentences(joined.trim())) {
      const at = joined.indexOf(cut, pos);
      const s = rebraced(cut);
      if (at >= 0) pos = at + cut.length;
      const cv = [...startsAt].reverse().find(([off]) => off <= Math.max(at, 0))?.[1] ?? (vs[0] as Where);
      if (!balanced(s) && /[“‘]/.test(s)) {
        // A speech that opens a list and closes verses later ("Moses also said…, “This is what Yahweh has
        // commanded: ‘Everyone who wants to should bring Yahweh a gift. They should bring…", Exodus 35:4–9):
        // the quotation's first whole sentence, kept only when it can be framed as its speaker's (15 Oct 2026).
        const words = s.slice(Math.max(s.lastIndexOf("“"), s.lastIndexOf("‘")) + 1).trim();
        const opening = /^[^“”‘’]*?[.!?](?=\s|$)/.exec(words)?.[0];
        const ownLine = opening === undefined || pySplit(opening).length < 5 ? null : own(cv, opening, "UST");
        // Where the speaker data gives the verse to the narrator, the sentence names the speaker itself, before
        // its quotation mark ("Moses also said to all the gathered Israelites, “…").
        const named = SAID_BY.exec(s.slice(0, s.indexOf("“")))?.[1];
        const framedLine = ownLine !== null && QUOTE_FRAME.test(ownLine) ? ownLine : ownLine !== null && named !== undefined ? framed(opening as string, named) : null;
        // Only where nothing else stands (below): elsewhere it would reshuffle hundreds of summaries that read well.
        if (framedLine !== null) quoteOpenings.push({ s: framedLine, raw: opening as string, where: cv, source: "UST" });
        continue;
      }
      if (!balanced(s) || !/[.!?][’”]?$/.test(s) || repeatsItself(s)) continue;
      const shown = own(cv, s, "UST");
      if (shown !== null) rows.push({ s: shown, raw: s, where: cv, source: "UST" });
    }
    if (input.openingLine && input.opening) rows.push({ s: input.openingLine[0], raw: input.openingLine[1], where: input.opening, source: "UST" });
    if (rows.length === 0) rows = quoteOpenings;
    rows = rows
      .map((r, i) => ({ r, i }))
      .sort((x, y) => compareTuples(x.r.where, y.r.where) || Number(x.r.source !== "tQ") - Number(y.r.source !== "tQ") || x.i - y.i)
      .map(({ r }) => r);
  }
  // Last in the body chain: Tyndale's first sentence on the range, then Open Bible Stories sentences.
  for (const e of input.extra ?? []) rows.push({ s: e.sentence, raw: e.sentence, where: e.where, source: e.source });
  const divided = input.divided;
  if (divided !== undefined && divided.size > 0) rows = rows.filter((r) => !divided.has(whereKey(r.where)));
  // Every source, not only tQ answers: a sentence that leans on the one before can't stand here. Speech
  // framed with its speaker stands ("Job says: “I wish…”"); a vision frame doesn't make "he" stand.
  const keep = rows.filter((r) => QUOTE_FRAME.test(r.s) || (!LEANS.test(unbraced(r.raw)) && !SPEECH.test(unbraced(r.raw)) && !SAID_THIS.test(r.raw)));
  if (keep.length >= 3) rows = keep;
  if (rows.length === 0) return null;

  const sents = rows.map((r) => r.s);
  const cen = textrank(sents);
  const first = vs[0] as Where;
  const half = (vs[Math.floor(vs.length / 2)] ?? first) as Where;
  const last = (vs.at(-1) ?? first) as Where;
  // The key event: the chapter-outline section starting in the passage's first half, or ending inside it.
  let cands = events.filter(
    (e) => leq(first, [e.chapter, e.v1]) && inside.has(vk(e.chapter, e.v1)) && (leq([e.chapter, e.v1], half) || leq([e.chapter, e.v2], last)),
  );
  // A section can begin a few verses earlier and contain the passage (6:22–71 holds 6:25–59).
  if (cands.length === 0) cands = events.filter((e) => compareTuples([e.chapter, e.v1], first) < 0 && e.chapter === first[0] && first[0] === last[0] && e.v2 >= last[1]);
  const labelWords = new Set(contentWords(input.label));
  // A passage can span two sections (11:1–16, 11:17–44): the one sharing most words with its title, then the longer.
  const key = argmax(cands, (e) => [contentWords(e.line).filter((w) => labelWords.has(w)).length, e.v2 - e.v1])?.line ?? "";
  const title = new Set([...labelWords, ...contentWords(key)]);
  const keyWords = new Set(contentWords(key));
  const n = sents.length;
  const all = [...Array(n).keys()];
  const narr = all.filter((i) => narration(sents[i] as string));
  // An aside may introduce a passage, never carry its turning point or ending (11:2's later anointing).
  const late = new Set(all.filter((i) => !asides.has(whereKey((rows[i] as Row).where))));
  const pool = narr.length >= 2 ? narr : all;
  const words = (i: number): Set<string> => new Set(contentWords(sents[i] as string));
  const len = (i: number): number => pySplit(sents[i] as string).length;

  const score = (i: number): number => {
    const ws = words(i);
    const tit = [...ws].filter((w) => title.has(w)).length / Math.max(1, title.size);
    return 0.55 * (cen[i] as number) + 0.3 * tit + 0.15 * isNarrative(sents[i] as string, input.names) + (rows[i]?.source === "tQ" ? 0.1 : 0);
  };
  // Setting: the first narration that names a person or place from the passage's own words.
  let setting =
    pool.find((i) => {
      const lower = (sents[i] as string).toLowerCase();
      return input.names.some((nm) => lower.includes(nm.toLowerCase())) || [...words(i)].some((w) => title.has(w));
    }) ?? (pool[0] as number);
  const opening = input.opening;
  if (opening) {
    // A passage that opens with someone speaking starts with that speech, not a later voice (John, 12 Oct,
    // approved: Isaiah 40:1–5 opens with "Comfort, comfort my people"). The speech itself, framed or
    // quoted, is preferred over a tQ line about it.
    const at = all.filter((i) => sameWhere((rows[i] as Row).where, opening) && (QUOTE_FRAME.test(sents[i] as string) || !LEANS.test(unbraced((rows[i] as Row).raw))));
    const spoken = at.filter((i) => QUOTE_FRAME.test(sents[i] as string) || (sents[i] as string).includes("“"));
    const chosen = (spoken.length > 0 ? spoken : at)[0];
    if (chosen !== undefined) setting = chosen;
  }
  // Outcome: the last narration in the passage, unless it is the setting.
  const ends = pool.filter((i) => late.has(i));
  const outcome = ends.length > 0 && ends.at(-1) !== setting ? (ends.at(-1) as number) : null;
  // Turning point: the most central sentence between them that adds new words.
  const covered = new Set([...words(setting), ...(outcome === null ? [] : words(outcome))]);
  const overlap = (i: number): number => {
    const ws = words(i);
    return [...ws].filter((w) => covered.has(w)).length / Math.max(1, ws.size);
  };
  // Never repeat the setting: a sentence mostly made of words already chosen adds nothing.
  let middle = all.filter((i) => setting < i && i < (outcome ?? n) && overlap(i) < 0.6 && late.has(i));
  // Choose among sentences that fit the budget with the setting and outcome: three beat two long ones (check f).
  const base = len(setting) + (outcome === null ? 0 : len(outcome));
  const fits = middle.filter((i) => base + len(i) <= budget * 1.3);
  if (fits.length > 0) middle = fits;
  const turn =
    argmax(middle, (i) => score(i) + 1.5 * ([...words(i)].filter((w) => keyWords.has(w)).length / Math.max(1, keyWords.size)) + 0.3 * (1 - overlap(i))) ?? null;
  const picks = [setting, turn, outcome].filter((i): i is number => i !== null);
  // Keep inside the budget: drop the turning point first, then the outcome, never the setting.
  const size = (): number => picks.reduce((s, i) => s + len(i), 0);
  for (const drop of [turn, outcome]) {
    if (size() > budget * 1.3 && drop !== null && picks.includes(drop) && picks.length > 1) picks.splice(picks.indexOf(drop), 1);
  }
  picks.sort((a, b) => a - b);
  const srcs = picks.map((i) => {
    const r = rows[i] as Row;
    return r.source.startsWith("OBS") || r.source.startsWith("Tyndale") ? r.source : `${r.source} ${r.where[0]}:${r.where[1]}`;
  });
  const detail = picks.map((i, k): SummarySentence => {
    const r = rows[i] as Row;
    return { text: r.s, raw: r.raw, src: srcs[k] as string, where: r.where, aside: asides.has(whereKey(r.where)), setting: i === setting };
  });
  return { key, text: joinedText(detail), srcs, detail };
}

/**
 * The summary as read. Neighbouring lines framed with the same speaker read as one frame: "Job says: “… …”",
 * not "Job says: … Job says: …" (John, 12 Oct 2026, Job).
 */
export function joinedText(detail: ReadonlyArray<Pick<SummarySentence, "text">>): string {
  const out: string[] = [];
  let prev: string | null = null;
  for (const d of detail) {
    const head = QUOTE_FRAME.exec(d.text)?.[0] ?? null;
    const lastOut = out.at(-1);
    if (head !== null && head === prev && lastOut !== undefined && lastOut.endsWith("”")) out[out.length - 1] = `${lastOut.slice(0, -1)} ${d.text.slice(head.length)}`;
    else out.push(d.text);
    prev = head;
  }
  return out.join(" ");
}

// ---------------------------------------------------------------------------
// The gate (John, 12 Oct 2026)
// ---------------------------------------------------------------------------

/** The vision frame (kinds.json voices.REV.vision). */
export const VISION = "In John’s vision, ";

/** A plan's size or count of parts ("50 loops", "100 cubits") is a measurement, not what it is about (Exodus 26). */
const NUMBER = "(?:\\d[\\d,]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|hundred|half)";
export const MEASURE = new RegExp(
  `\\b(?:cubits?|spans?|handbreadths?|shekels?|talents?|meters?|centimeters?|feet|foot|inches|liters?|kilograms?)\\b|\\b${NUMBER}(?:\\s+\\w+){0,2}\\s+(?:loops|rings|clasps|fasteners|bars|frames|bases|sockets|posts|pillars|curtains|hangings|boards|hooks|cups|branches|pieces)\\b`,
  "i",
);

/**
 * Summaries are extractive from credited sources, so they ship without per-entry approval. A bad pick can
 * still mislead, so every summary passes these checks or is flagged, naming the check, for John to fix.
 */
export function gate(
  key: string,
  text: string,
  detail: readonly SummarySentence[],
  obsOk = true,
  budget = BUDGET,
  nVerses = 99,
  need: number | null = null,
  mode = "narrative",
): string[] {
  const fails: string[] = [];
  const rawOf = (d: SummarySentence): string => d.raw ?? d.text;
  // No "no headline" check: a summary whose body passes shows under the passage's own title (John, 15 Oct 2026).
  for (const d of detail) {
    if (!QUOTE_FRAME.test(d.text) && (LEANS.test(unbraced(rawOf(d))) || SAID_THIS.test(rawOf(d)))) fails.push(`b: leans on missing context (${d.src})`);
  }
  const n = pySplit(text).length;
  if (n > budget * 1.3) fails.push(`c: over budget (${n} words)`);
  for (const d of detail) if (d.aside && !d.setting) fails.push(`d: aside verse carries the story (${d.src})`);
  if (!obsOk) fails.push("e: Open Bible Stories sentence not supported by John");
  const distinct: string[] = [];
  for (const d of detail) {
    const ws = new Set(contentWords(rawOf(d)));
    if (ws.size > 0 && distinct.every((x) => [...ws].filter((w) => contentWords(x).includes(w)).length / ws.size < 0.6)) distinct.push(rawOf(d));
  }
  // g: text hygiene. Glitches that pass a–f but would ship (Genesis and Ruth test, 12 Oct 2026).
  for (const d of detail) {
    const t = d.text;
    if (/\s[’']\s?s\b|[\p{L}\p{N}_][’']\s+s\b/u.test(t)) fails.push(`g: stray space in a possessive (${d.src})`);
    if (/\b\d+:\d+/.test(t)) fails.push(`g: verse reference left in a sentence (${d.src})`);
    // An implied-words brace closed before it opened: the sentence was cut inside the UST's {…} ("We are
    // sending this letter} to…", 2 Thessalonians 1:1; 15 Oct 2026). An open brace left unclosed and square
    // brackets (verses missing from early manuscripts) are the source's own and stay as they shipped.
    if ([...t].reduce((depth, ch) => (depth < 0 ? depth : ch === "{" ? depth + 1 : ch === "}" ? depth - 1 : depth), 0) < 0) fails.push(`g: implied-words brace closed before it opens (${d.src})`);
    if (/\s{2,}|\s[,.;:!?]|[,;:]$|,\s(?:He|She|They|It|We|His|Her)\s/.test(t)) fails.push(`g: spacing or dangling punctuation (${d.src})`);
    if (SPEECH.test(t) && !QUOTE_FRAME.test(t)) fails.push(`g: unquoted speech read as narration (${d.src})`);
    if (repeatsItself(rawOf(d))) fails.push(`g: sentence repeats itself (${d.src})`);
  }
  // A trailing book name is a broken outline line ("Joseph’s death Genesis"), unless a preposition needs it.
  if (key !== "" && (/\s{2,}/.test(key) || (/\s(?:Genesis|Exodus|Matthew|Mark|Luke|John|Acts)\.?$/.test(key) && !/\b(?:for|of|in|to|from|about|on|with|the)\s+\w+\.?$/.test(key)))) {
    fails.push("g: broken headline");
  }
  // h: whose words (John, 12 Oct 2026, every mode). First- or second-person words outside quotation marks
  // are someone's, never Yada's: the line must be framed with its owner. In a vision every line is framed as
  // the vision; in the Teacher's book every line names the Teacher.
  for (const d of detail) {
    const t = d.text;
    if (d.fixed) continue;
    if (!QUOTE_FRAME.test(t) && !REPORTED.test(t) && !REPORTED_IN.test(t) && hasPerson(unquoted(t))) fails.push(`h: whose words? first or second person, not framed (${d.src})`);
    if (mode === "visions" && !(t.startsWith(VISION) || /\bJohn\b/.test(t)) && !d.src.startsWith("Tyndale")) fails.push(`h: vision line not framed as John’s vision (${d.src})`);
    if (mode === "teacher" && !/\b(?:Teacher|Qoheleth)\b/.test(t) && !d.src.startsWith("Tyndale")) fails.push(`h: the Teacher’s words not named as his (${d.src})`);
    if (["law", "plans", "debate", "love"].includes(mode) && d.speech && !QUOTE_FRAME.test(t)) fails.push(`h: a speaker’s words not framed as theirs (${d.src})`);
  }
  // i: a plan gives no measurements ("100 cubits", "50 loops"; John, 12 Oct 2026, Exodus 26).
  if (mode === "plans") for (const d of detail) if (MEASURE.test(rawOf(d))) fails.push(`i: measurement in a plan (${d.src})`);
  // A short passage (12 verses or fewer) is told in two sentences; longer ones need three. A genealogy's
  // heading says what the list is, so one sentence is enough; a law or plan passage needs two.
  const needed = need ?? (nVerses <= 12 ? 2 : 3);
  if (distinct.length < needed) fails.push(`f: ${distinct.length} distinct sentences, needs ${needed}`);
  return fails;
}

/**
 * The fixed sample John reads once per book. The seed is "yada-summary-sample-<BOOK>", drawn as
 * CPython 3.9's random.Random(seed).sample draws it (text.ts), so the sample repeats run to run and
 * is the one the prototype printed. Returned in passage order.
 */
export function sampleIds(book: string, ids: readonly string[], n = SAMPLE_PER_BOOK): string[] {
  const picked = new Set(seededSample(`yada-summary-sample-${book}`, ids, Math.min(n, ids.length)));
  return ids.filter((id) => picked.has(id));
}


// ---------------------------------------------------------------------------
// A book's passages
// ---------------------------------------------------------------------------

export interface Pericope {
  id: string;
  label: string;
  startOrd: number;
  endOrd: number;
}

export interface PassageReview {
  status: "held" | "approved";
  reason?: string;
  sha256?: string;
}

export interface PassageBookData {
  book: string;
  /** Core's name for the book. */
  name: string;
  /** Every verse core has for the book, verse 0 (a psalm title) included: ord -> [chapter, verse]. */
  ordRef: ReadonlyMap<number, [number, number]>;
  /** BSB text per verse. */
  bsb: ReadonlyMap<VerseKey, string>;
  /** The UST, read as passage_summary.py reads it. */
  ust: ReadonlyMap<VerseKey, string>;
  tq: readonly TqAnswer[];
  events: readonly OutlineEvent[];
  /** passage_reviews.json: John's holds and approvals, by passage id. */
  reviews: ReadonlyMap<string, PassageReview>;
  /** tnGuides parts: bare-range chapter-introduction lines, for headlines only. */
  parts: readonly OutlineSection[];
  asides: ReadonlySet<VerseKey>;
  outline: readonly OutlineSection[];
  headings: ReadonlyArray<{ chapter: number; verse: number; heading: string }>;
  /** BSB footnotes that mention manuscripts, by the verse they hang on, in the tables' order. */
  footnotes: ReadonlyArray<{ chapter: number; verse: number; text: string }>;
  /** The book's own pericopes, from its Understand bundle; empty when it has none. */
  pericopes: readonly Pericope[];
  /** Glyssen character names with `speaks` rows in an ord range, by ord then line. */
  speaking: (startOrd: number, endOrd: number) => Array<{ ord: number; name: string; quotePosition?: string | null }>;
  /** Every Translation Notes row (reference, support reference, note), for the Psalms intros. */
  tnNotes: ReadonlyArray<{ ref: string; support: string; note: string }>;
  /** Ords with any `speaks` row, for the coverage report. */
  speakerOrds: ReadonlySet<number>;
  /** Tyndale verse notes wholly inside an ord range, by start. */
  tyndaleInside: (startOrd: number, endOrd: number) => string[];
  stories: readonly ObsStory[];
  debates: readonly Debate[];
  prophets: Prophets;
  /** Core's book names by code ("MAT" -> "Matthew"), for the parallels line. */
  bookNames: ReadonlyMap<string, string>;
  /** The BSB's cross-reference links under its headings, by verse (BookTables.parallels). */
  parallels: ReadonlyArray<{ chapter: number; verse: number; refs: string[] }>;
  /** Glyssen's parallel-passage column for the speech verses in an ord range ("MAT 8.23-27"). */
  glyssenParallels: (startOrd: number, endOrd: number) => string[];
  /** The UST's own speaker headings (Song of Songs). */
  ustSpeakers: ReadonlyMap<VerseKey, string>;
  kinds: Kinds;
  letters: Letters;
  plainWords: PlainWords;
}

export type HeadlineKind = "What happens" | "Part of" | "Genealogy" | "Topic" | "What John sees";

/** A fixed line from one of John's tables, with where it came from and the table's status. */
export interface FixedLine {
  line: string;
  source: string;
  status: DraftStatus;
}

/** kinds.json: which passages take which mode, and the settings, purposes and voices they show. */
export interface Kinds {
  status: DraftStatus;
  modes: ReadonlyArray<{ book: string; from: [number, number]; to: [number, number]; mode: string; source: string }>;
  settings: ReadonlyArray<{ book: string; from: [number, number]; to: [number, number]; line: string; source: string }>;
  purposes: ReadonlyArray<{ book: string; from: [number, number]; to: [number, number]; line: string; source: string }>;
  voices: Readonly<Record<string, { name?: string; vision?: string; names?: string[]; source: string }>>;
}

/** letters.json: each letter's writer, readers and one setting line. */
export interface Letters {
  status: DraftStatus;
  letters: Readonly<Record<string, { author: string; recipients: string; setting: string; source: string }>>;
}

/** plain_words.json: the UST substitutions and the plain words for tN's translator terms. */
export interface PlainWords {
  status: DraftStatus;
  ust_substitutions: ReadonlyArray<{ from: string; to: string; books: string; count?: number; why?: string }>;
  plain_words: Readonly<Record<string, string>>;
}

export const NO_KINDS: Kinds = { status: "draft", modes: [], settings: [], purposes: [], voices: {} };
export const NO_LETTERS: Letters = { status: "draft", letters: {} };
export const NO_PLAIN_WORDS: PlainWords = { status: "draft", ust_substitutions: [], plain_words: {} };

export interface PassageResult {
  id: string;
  label: string;
  startOrd: number;
  endOrd: number;
  range: string;
  speakers: string[];
  headline: string;
  headlineKind: HeadlineKind;
  headlineSource: string | null;
  /** The passage's kind of writing (modes.ts): narrative, gospel, letter, law, plans, debate, teacher, sayings, love, visions, psalms. */
  mode: string;
  text: string;
  words: number;
  sentences: Array<SummarySentence & { source: string; credit: string }>;
  srcs: string[];
  credit: string;
  /** BSB manuscript footnotes as one plain sentence each, with the rest of the note behind "Read the note". */
  facts: Array<{ fact: string; rest: string }>;
  /** A letter's "Before this · After this", from the outline at the same level. */
  around: { before: string | null; after: string | null } | null;
  /** A law passage's purpose (tN chapter introduction) or a plan's (kinds.json). */
  purpose: FixedLine | null;
  /** A Gospel passage's other tellings ("Matthew 8:23–27"). */
  alsoToldIn: string[];
  /** Proverbs: the chapter's themes (tN). */
  themes: string[];
  /** Setting lines from John's tables: the prophets', the kinds', the letter's. */
  settings: FixedLine[];
  /** Whether the headline went through the prophets' plain-name table, and that table's status. */
  headlineStatus: DraftStatus | null;
  /** Psalms mode: at most two lines before the psalm, in place of a summary. */
  lead: PsalmLine[];
  /** Psalms mode: everything else, behind "About this psalm". */
  about: PsalmLine[];
  /** Approved positions for the major debates the passage touches, each a source's sentence and its source. */
  debates: Array<{ sentence: string; credit: string; held_by?: string }>;
  /** Debates the passage touches that have no approved note yet ("question" is for John's list only). */
  awaiting: string[];
  flags: string[];
  sample: boolean;
}

/** The credit each sentence carries, by its source's first word. */
export const SENTENCE_CREDIT: Readonly<Record<string, string>> = {
  tQ: CREDITS.tq,
  UST: CREDITS.ust,
  OBS: CREDITS.obs,
  Tyndale: CREDITS.tyndale,
  tN: CREDITS.tn,
  // The genealogy line's names are the BSB heading's own, found in the BSB text, not its footnotes.
  BSB: "Berean Standard Bible · public domain",
};

/** A genealogy's fixed sentence (Genesis 10, 1 Chronicles 1–9); John reviews it once like TEMPLATES. */
export const GENEALOGY_TEMPLATE = "The list runs from {first} to {last}.";
/**
 * A heading that names a list of people ("The Descendants of Cain", "Genealogy from Shem to Abram",
 * "Terah’s Descendants"), not one that mentions sons ("Jacob Blesses His Sons"). A count rules a heading
 * out: "The Seven Sons of Sceva" (Acts 19) is a story about seven men, not a family list.
 */
export const GENEALOGY_HEAD =
  /^(?!.*\b(?:Two|Three|Four|Five|Six|Seven|Parable)\b).*(?:\b(?:Descendants|Genealogy|Generations|Sons|Family|Line|Records?|Clans?|Families) (?:of|from)\b|’s (?:Descendants|Sons|Family|Line)\b|^Genealogy\b)/;
const GENEALOGY_WORDS = new Set(["The", "Descendants", "Genealogy", "Generations", "Sons", "Family", "Line", "Record", "Records", "Clan", "Clans", "Families", "From", "To", "Of"]);

/**
 * "The list runs from A to B." only when the heading itself names both ends and both appear in the
 * passage. A list's last capitalised word is often a brother, a place or another name for the same man
 * ("from Shem to Haran" under "Genealogy from Shem to Abram"), so the text's own last name is never used
 * (John, 12 Oct 2026). A heading with one name ("The Descendants of Cain") gets no line.
 */
export function genealogyLine(label: string, bsbText: string): string | null {
  const head = (label.match(/\b[A-Z][a-z]+(?:’s)?\b/g) ?? []).map((w) => w.replace(/’s$/, "")).filter((w) => !GENEALOGY_WORDS.has(w));
  const first = head[0];
  const last = head.at(-1);
  if (first === undefined || last === undefined || head.length < 2 || first === last) return null;
  if (![first, last].every((n) => new RegExp(`\\b${escapeRegExp(n)}\\b`).test(bsbText))) return null;
  return fill(GENEALOGY_TEMPLATE, { first, last });
}
export const SOURCE_NAMES: ReadonlyArray<[string, string]> = [
  ["tQ", "unfoldingWord Translation Questions"],
  ["UST", "the UST"],
  ["OBS", "Open Bible Stories"],
  ["Tyndale", "Tyndale Open Study Notes"],
  ["tN", "unfoldingWord Translation Notes"],
];

/** A book without its own passage divisions (1 Corinthians had one) uses the BSB's sections, heading to heading. */
export function passagesOf(data: PassageBookData): Pericope[] {
  const chapters = Math.max(0, ...[...data.ordRef.values()].map(([c]) => c));
  if (data.pericopes.length >= chapters) return [...data.pericopes].sort((a, b) => a.startOrd - b.startOrd);
  const ordOf = new Map<VerseKey, number>();
  for (const [o, [c, v]] of data.ordRef) if (v > 0) ordOf.set(vk(c, v), o);
  const keys = [...ordOf.keys()].map(parseVk).sort(compareTuples);
  let starts = unique(data.headings.map((h) => vk(h.chapter, h.verse)).filter((k) => ordOf.has(k)))
    .map(parseVk)
    .sort(compareTuples);
  if (starts.length === 0) starts = Array.from({ length: chapters }, (_, i) => [i + 1, 1] as [number, number]);
  const labels = new Map<VerseKey, string>();
  for (const h of data.headings) if (!labels.has(vk(h.chapter, h.verse))) labels.set(vk(h.chapter, h.verse), cleanHeading(h.heading));
  const sections = starts.map((st, i) => {
    const next = starts[i + 1];
    const lastKey = next === undefined ? (keys.at(-1) as [number, number]) : (keys[keys.findIndex((k) => compareTuples(k, next) === 0) - 1] as [number, number]);
    return {
      id: `${data.book}.${st[0]}.${st[1]}-${lastKey[0]}.${lastKey[1]}`,
      label: labels.get(vk(st[0], st[1])) ?? `${data.name} ${st[0]}`,
      startOrd: ordOf.get(vk(st[0], st[1])) as number,
      endOrd: ordOf.get(vk(lastKey[0], lastKey[1])) as number,
    };
  });
  // A section under 3 verses (genealogy splits such as Genesis 10:1, 46:16–18) joins the next one for its
  // summary, or the previous one at a book's end; the reader still shows the BSB's own headings. Length is
  // counted in ords, as the prototype counts it.
  const join = (a: Pericope, b: Pericope): Pericope => ({
    id: `${a.id.split("-")[0] ?? ""}-${b.id.split("-")[1] ?? ""}`,
    label: a.label,
    startOrd: a.startOrd,
    endOrd: b.endOrd,
  });
  // Psalms never merge: each psalm is its own unit, however short (Psalm 117 has two verses).
  if (POETRY.has(data.book)) return sections;
  const merged: Array<{ p: Pericope; n: number }> = [];
  for (const p of sections) {
    const n = p.endOrd - p.startOrd + 1;
    const prev = merged.at(-1);
    if (prev !== undefined && prev.n < 3) merged[merged.length - 1] = { p: join(prev.p, p), n: prev.n + n };
    else merged.push({ p, n });
  }
  const tail = merged.at(-1);
  if (merged.length > 1 && tail !== undefined && tail.n < 3) {
    merged.pop();
    const prev = merged.pop() as { p: Pericope; n: number };
    merged.push({ p: join(prev.p, tail.p), n: prev.n + tail.n });
  }
  return merged.map((m) => m.p);
}

// ---------------------------------------------------------------------------
// Old Testament rules, known divides and Psalms mode (John, 12 Oct 2026)
// ---------------------------------------------------------------------------

export const POETRY: ReadonlySet<string> = new Set(["PSA"]);
export const OT: ReadonlySet<string> = new Set([
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB",
  "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP",
  "HAG", "ZEC", "MAL",
]);

/** Data John approves once; nothing marked draft or candidate is shown as approved (rule 2). */
export type DraftStatus = string;

/**
 * A major debate (John, 12 Oct 2026): a passage where readers divide and tN gives one side or none.
 * A summary never settles it: no sentence comes from a short disputed range, and "Readers differ" shows
 * only a note John (or a reviewer he trusts) wrote and approved. packages/pipeline/prototypes/data/debates.json.
 */
export interface Debate {
  book: string;
  from: [number, number];
  to: [number, number];
  question: string;
  status?: DraftStatus;
  /**
   * Option 3 (John, 12 Oct 2026): sources' own sentences, unchanged, each approved or rejected by John; who
   * holds it when named. `side` (John, 15 Oct 2026) is John's internal label for the view a position holds,
   * never shown; `side_suggested` is machine-written and counts for nothing until he accepts it (rule 2).
   * `axis` names the question a position answers where a passage asks two (Hosea 1:2); untagged positions
   * share one. Approved positions on two or more distinct non-framing sides of one axis show.
   */
  positions?: ReadonlyArray<{
    text: string;
    source?: string | null;
    status?: DraftStatus;
    held_by?: string | null;
    side?: string | null;
    side_suggested?: string | null;
    axis?: string | null;
    axis_suggested?: string | null;
  }>;
  /** How its readings sit: "differ" (the default) or "together" (Psalm 2:7, Isaiah 14:12–15). */
  relation?: "differ" | "together";
  /** What a disputed verse shows (John, 12 Oct 2026): "data", "tn-readings", "positions" or "held". */
  kind?: "data" | "tn-readings" | "positions" | "held";
}

/**
 * Prophets: plain names for tN's outline words ("Oracles About Judah" -> "Messages to Judah") and one
 * setting line per book section. packages/pipeline/prototypes/data/prophets.json.
 */
export interface Prophets {
  status: DraftStatus;
  plain_names: Readonly<Record<string, string>>;
  settings: ReadonlyArray<{ book: string; from: [number, number]; to: [number, number]; line: string; source: string }>;
}

export const NO_PROPHETS: Prophets = { status: "draft", plain_names: {}, settings: [] };

/** The tables' headings carry numeric entities only ("&#1488; ALEPH"); these few named ones for safety. */
function decodeEntities(text: string): string {
  const named: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) return String.fromCodePoint(parseInt(body.slice(2), 16));
    if (body.startsWith("#")) return String.fromCodePoint(Number(body.slice(1)));
    return named[body.toLowerCase()] ?? whole;
  });
}

/**
 * A BSB heading as a reader should see it: entities decoded ("&#1488; ALEPH" -> "א Aleph"), the
 * Psalter's book divisions dropped ("BOOK I Psalms 1–41 The Two Paths" -> "The Two Paths").
 */
export function cleanHeading(heading: string): string {
  return decodeEntities(heading)
    .replace(/^BOOK [IVX]+\s+Psalms\s+\d+[–-]\d+\s*/, "")
    .replace(/\b([A-Z]{3,})\b/g, (w: string) => (w[0] ?? "") + w.slice(1).toLowerCase())
    .replace(/\s+/g, " ")
    .trim();
}

/** Translation Notes markdown without dropping "(See: …)", as the Psalms intros are read. */
function mdKeepSee(text: string): string {
  return text.replace(/\\n/g, "\n").replace(/\[\[rc:\/\/[^\]]*\]\]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*/g, "");
}

/** tN's type words for a psalm, to plain words John approves once; tN's jargon is never shown. */
export const PSALM_KIND: ReadonlyArray<[RegExp, string]> = [
  [/penitential/i, "A prayer asking God to forgive"],
  [/psalms? of trust|\btrust\b psalm/i, "A song of trust in God"],
  [/thanksgiving/i, "A song of thanks"],
  [/lament|supplication|complaint/i, "A prayer from someone in trouble"],
  [/songs? of ascents/i, "A song for pilgrims going up to Jerusalem"],
  [/worship psalms?/i, "A song of worship"],
  [/royal psalm|\broyal\b|honou?ring the king/i, "A psalm about the king"],
  [/wisdom psalm|\bwisdom\b/i, "A psalm about how to live"],
  [/hymn|praise|enthronement/i, "A song of praise"],
  [/imprecatory/i, "A prayer asking God to judge enemies"],
  [/deliverance/i, "A psalm about God’s rescue"],
  [/labeled as “prayers”|\bprayers?\b/i, "A prayer"],
];

/** The opening of a BSB superscription, which the BSB prints inside verse 1. */
const TITLE_RE =
  /^(?:For the (?:choirmaster|director)|A (?:Psalm|Song|Maskil|Miktam|Prayer|Shiggaion)|Of (?:David|Solomon|Asaph|the sons)|According to|To the tune|With stringed|On the |A psalm|Of the sons|Concerning )/;

export interface PsalmLine {
  label: string;
  text: string;
  source: string;
}

const capWords = (text: string, n: number): string => {
  const ws = pySplit(text);
  return ws.slice(0, n).join(" ") + (ws.length > n ? "…" : "");
};

const rstrip = (text: string, chars: string): string => {
  let i = text.length;
  while (i > 0 && chars.includes(text[i - 1] ?? "")) i -= 1;
  return text.slice(0, i);
};

/**
 * A psalm needs context more than a summary. At most two lines before the psalm, in John's order
 * (12 Oct 2026): when it was written, then the turn it makes or its main picture, then what kind of
 * psalm it is. Everything else (title, a longer picture, how it moves) waits behind "About this psalm".
 * All from data. Psalm 119's stanzas get the stanza by name.
 */
export function psalmLines(
  chapter: number,
  vs: ReadonlyArray<[number, number]>,
  tnNotes: PassageBookData["tnNotes"],
  bsbVerse1: string,
  label: string,
  stanza: number | null,
): { lead: PsalmLine[]; about: PsalmLine[] } {
  const introRow = tnNotes.find((r) => r.ref === `${chapter}:intro`);
  const intro = introRow === undefined ? "" : mdKeepSee(introRow.note);
  const afterStructure = intro.includes("Structure and Formatting") ? intro.slice(intro.indexOf("Structure and Formatting") + "Structure and Formatting".length) : intro;
  const struct = intro === "" ? "" : (afterStructure.split("##")[0] ?? "");
  // The type is named in the section's prose before its outline.
  const prose = struct
    .split("\n\n")
    .filter((x) => x.trim() !== "" && !/^\s*\d+\./.test(x.trim()))
    .join(" ");
  let kind = PSALM_KIND.find(([pattern]) => pattern.test(prose))?.[1] ?? null;
  let kindLabel = "What kind";
  if (kind === null) {
    // tN's own description ("Psalm 19 is a psalm about how God has revealed himself…"), about 12 words.
    const m = /\b(?:is|was) (?:a|an) (?:psalm|song|poem) (about|of|in which) ([^.(]+)/.exec(prose);
    if (m !== null) kind = `A psalm ${rstrip(pySplit(`${m[1]} ${m[2]}`).slice(0, 12).join(" "), ",;")}${pySplit(`${m[1]} ${m[2]}`).length > 12 ? "…" : ""}`;
  }
  // Psalms 42 and 43 say so in the intro, not only in the structure section.
  if (kind === null && /(?:probably )?originally one psalm/.test(`${prose} ${intro}`)) {
    const other = /[Pp]salms (\d+) and (\d+)/.exec(`${prose} ${intro}`);
    kind = other === null ? "Probably one psalm with its neighbour at first" : `Psalms ${other[1]} and ${other[2]} were probably one psalm at first`;
    kindLabel = "About";
  }
  if (kind === null) {
    const m = /Purpose:\s*([^\n]+)/.exec(intro);
    if (m !== null) {
      const purpose = rstrip((m[1] ?? "").trim(), ".");
      kind = (purpose[0] ?? "").toUpperCase() + purpose.slice(1);
      kindLabel = "What it’s for";
    }
  }
  // The BSB superscription, split off verse 1.
  const titleParts: string[] = [];
  for (const sent of bsbVerse1.split(/(?<=[.])\s+/)) {
    if (TITLE_RE.test(sent) || (titleParts.length > 0 && /^When /.test(sent))) titleParts.push(sent);
    else break;
  }
  const title = titleParts.join(" ");
  // The picture: the intro's metaphor paragraph, else the first metaphor note, translator wording removed.
  let picture: string | null = null;
  const metaphor = /### (?:Extended )?Metaphor\s*\n+(.+?)(?:\n|$)/.exec(intro);
  const cand =
    metaphor?.[1] ??
    tnNotes.filter((r) => r.ref.startsWith(`${chapter}:`) && r.ref !== `${chapter}:intro` && /figs-(?:ex)?metaphor/.test(r.support)).map((r) => mdKeepSee(r.note).split("\n")[0] ?? "")[0];
  if (cand) {
    const sent = (cand.replace(/\s*\(See:[^)]*\)/g, "").split(/(?<=[.])\s+/)[0] ?? "").replace(/^.*?\bmetaphor in which\s+/, "").replace(/^Here,?\s+/, "");
    // A picture compares ("as if", "like"); background under the heading (Psalm 42's sons of Korah) is not one.
    const compares = /\bas (?:if|though)\b|\blike\b|\bpicture|\bimage|\bspeaks? of\b|\bspeaking of\b|\brepresents?\b/.test(sent);
    if (!/your language|translat/i.test(sent) && pySplit(sent).length >= 6 && compares) picture = (sent[0] ?? "").toUpperCase() + sent.slice(1);
  }
  // How it moves: the intro outline, at most 3 items, each about 12 words.
  let moves = [...struct.matchAll(/^\s*\d+\.\s+(.+?)\s*\((\d+(?:[–-]\d+)?)\)\s*$/gm)].map((m) => {
    const txt = capWords((m[1] ?? "").replace(/\s*\([^)]*\)/g, "").trim(), 12);
    const range = (m[2] ?? "").replace(/-/g, "–");
    const lead = /^(David|Yahweh|God|Israel|Jerusalem|Zion)/.test(txt) ? txt : (txt[0] ?? "").toLowerCase() + txt.slice(1);
    return `${range.includes("–") ? "Verses" : "Verse"} ${range}: ${lead}`;
  });
  if (moves.length > 3) moves = [moves[0] ?? "", moves[Math.floor(moves.length / 2)] ?? "", moves.at(-1) ?? ""];
  // The turn, only where tN states one ("moves from intense distress … to renewed confidence", Psalm 77).
  let turn: string | null = null;
  const mt = /\bmoves from ([^.;]+? to [^.;]+?)(?: by [^.;]+)?[.;]/.exec(`${prose} ${intro}`);
  if (mt !== null && pySplit(mt[1] ?? "").length <= 16) turn = `It moves from ${(mt[1] ?? "").trim()}.`;
  // Written when: the superscription's occasion, only where the title gives one ("when the prophet Nathan
  // came to him…", Psalm 51). Never an "occasion unknown" line (John, 12 Oct 2026).
  let when: string | null = null;
  const mw = /(?:^|,\s*|\.\s*)[Ww]hen (.+?)\.?$/.exec(title);
  if (mw !== null) {
    // The occasion ends at its own sentence end; the BSB runs the title into verse 1 (Psalm 54).
    let occ = (mw[1] ?? "").trim().split(/(?<=[.?!]”)\s+|(?<=[.])\s+/)[0] ?? "";
    const author = /\b[Oo]f (David|Solomon|Moses)\b/.exec(title);
    // "when he fled", "came to him": the first pronoun becomes the named author, so the line stands alone.
    if (author !== null) occ = occ.replace(/\b(?:he|him)\b/, author[1] ?? "");
    when = `Written when ${occ.endsWith("”") ? occ : `${rstrip(occ, ".")}.`}`;
  }
  const first = vs[0] ?? [chapter, 1];
  const last = vs.at(-1) ?? first;
  if (stanza !== null) {
    // Psalm 119's 22 stanzas: the stanza by name and what a stanza is; the psalm's type behind "About".
    const name = /([\u0590-\u05FF]\s*[\p{L}\p{N}_]+)\s*$/u.exec(label)?.[1] ?? label;
    return {
      lead: [
        { label: "Stanza", text: `${name} · ${first[0]}:${first[1]}–${last[1]}`, source: "BSB heading" },
        { label: "About", text: "One of 22 stanzas; each begins with the next letter of the Hebrew alphabet.", source: "tN intro (acrostic)" },
      ],
      about: kind ? [{ label: kindLabel, text: kind, source: "tN intro" }] : [],
    };
  }
  const pool: PsalmLine[] = [];
  if (when !== null) pool.push({ label: "Written when", text: when, source: "BSB superscription" });
  if (turn !== null) pool.push({ label: "The turn", text: turn, source: "tN intro" });
  // A picture longer than a line (Psalm 51's ink and scroll) waits behind "About this psalm".
  else if (picture !== null && pySplit(picture).length <= 22) pool.push({ label: "The picture", text: picture, source: "tN" });
  if (kind) pool.push({ label: kindLabel, text: kind, source: "tN intro" });
  const lead = pool.slice(0, 2);
  const about = pool.slice(2);
  if (title !== "") about.push({ label: "Title", text: title, source: "BSB superscription" });
  if (picture !== null && !lead.some((l) => l.label === "The picture")) about.push({ label: "The picture", text: picture, source: "tN" });
  for (const mv of moves) about.push({ label: "How it moves", text: mv, source: "tN outline" });
  return { lead, about };
}

/** Psalms mode's own gate: something before the psalm, at most two lines of it, clean text throughout. */
export function psalmGate(lead: readonly PsalmLine[], about: readonly PsalmLine[]): string[] {
  const fails: string[] = [];
  if (lead.length === 0) fails.push("a: nothing to show before the psalm");
  if (lead.length > 2) fails.push(`f: ${lead.length} lines before the psalm, at most 2`);
  for (const l of [...lead, ...about]) if (/&#|\bBOOK [IVX]+\b|\s{2,}|\s[,.;:]|your language|translat/.test(l.text)) fails.push(`g: text hygiene (${l.source})`);
  return fails;
}

export function psalmResult(data: PassageBookData, p: Pericope, vs: ReadonlyArray<[number, number]>): PassageResult {
  const [c0, v0] = vs[0] ?? [0, 0];
  const [lc, lv] = vs.at(-1) ?? [0, 0];
  let stanza: number | null = null;
  if (c0 === 119) {
    const starts = data.headings.filter((h) => h.chapter === 119).map((h): Where => [h.chapter, h.verse]);
    stanza = starts.length === 0 ? null : 1 + starts.filter((cv) => compareTuples(cv, [c0, v0]) < 0).length;
  }
  const { lead, about } = psalmLines(c0, vs, data.tnNotes, data.bsb.get(vk(c0, 1)) ?? "", p.label, stanza);
  return {
    id: p.id,
    label: p.label,
    startOrd: p.startOrd,
    endOrd: p.endOrd,
    range: `${c0}:${v0}–${lc}:${lv}`,
    speakers: [],
    headline: "",
    headlineKind: "What happens",
    headlineSource: null,
    mode: "psalms",
    text: "",
    words: 0,
    sentences: [],
    srcs: [],
    credit: "",
    facts: [],
    around: null,
    purpose: null,
    alsoToldIn: [],
    themes: [],
    settings: [],
    headlineStatus: null,
    lead,
    about,
    debates: [],
    awaiting: [],
    flags: psalmGate(lead, about),
    sample: false,
  };
}

/**
 * Tyndale's first sentence on a range, for the body chain. A note that opens on an NLT lemma is
 * skipped, and so is one whose first sentence carries an NLT lemma the passage's BSB does not use:
 * no NLT wording reaches anything a beginner sees, marked or not (rule 9; assemble.py `rule9`). The
 * prototype dropped the lemma tags and kept the words, which showed NLT wording unmarked in Mark
 * 12:38–40 and Luke 6:20–26 and 22:1–6; here those notes give way to the next one on the range.
 */
export function tyndaleFirstSentence(notes: readonly string[], bsbText: string, accept: (sentence: string) => boolean = () => true): string | null {
  const lower = bsbText.toLowerCase();
  for (const t of notes) {
    const body = (t.trim().replace(/^<b>[^<]*<\/b>\s*/, "").split(" • ")[0] ?? "").split("\n")[0] ?? "";
    if (body.startsWith("<x>")) continue;
    // The text with its tags removed, and where each NLT lemma (<x>…</x>) starts in it.
    let stripped = "";
    const lemmas: Array<{ at: number; words: string }> = [];
    for (const m of body.matchAll(/<x>([^<]+)<\/x>|<[^>]+>|[^<]+|</g)) {
      if (m[1] !== undefined) {
        lemmas.push({ at: stripped.length, words: m[1] });
        stripped += m[1];
      } else if (!/^<[^>]+>$/.test(m[0])) stripped += m[0];
    }
    const first = stripped.split(/(?<=[.!?])\s+(?=[A-Z“])/)[0] ?? "";
    if (lemmas.some((l) => l.at < first.length && !lower.includes(l.words.toLowerCase().replace(/^[ .,:;]+|[ .,:;]+$/g, "")))) continue;
    const sent = first.replace(/\s*\((?:see|cp\.|also)?[^()]*\d+:\d+[^()]*\)/g, "").trim();
    // A reference cut in half at "cp." leaves an open bracket ("…a messianic action (cp."): such a fragment
    // is passed over. It only arises among the notes the NLT rule reaches past (Luke 19:45).
    const balancedBrackets = sent.split("(").length === sent.split(")").length;
    if (pySplit(sent).length >= 6 && !/^(This|That|These|Those|He|She|They|It|So|I|We|You)\b/.test(sent) && balancedBrackets && accept(sent)) return sent;
  }
  return null;
}

