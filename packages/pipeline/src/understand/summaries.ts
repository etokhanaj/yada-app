import { createHash } from "node:crypto";
/**
 * A book's passage summaries and its report: passage_summary.py `main()`, ported. Each passage takes its
 * kind of writing (modes.ts), its headline by that mode's chain, a body of credited sentences framed with
 * whose words they are, the gate, the BSB's manuscript facts, and the fixed lines from John's tables.
 */

import {
  modeOf,
  alsoToldIn,
  beforeAfter,
  caseCounts,
  commandlike,
  conceptHeadings,
  conceptLine,
  containing,
  kindLine,
  lawTopic,
  makeOwner,
  openingSpeech,
  outlineNamed,
  plainWordsIn,
  sayingsLines,
  ustSubs,
} from "./modes.js";
import {
  BUDGET,
  GENEALOGY_HEAD,
  LEANS,
  LETTERS,
  MEASURE,
  OT,
  POETRY,
  QUOTE_FRAME,
  SENTENCE_CREDIT,
  SOURCE_NAMES,
  SPEECH,
  overStop,
  gate,
  genealogyLine,
  glyssenName,
  hasPerson,
  contentWords,
  joinedText,
  obsCandidates,
  passagesOf,
  psalmResult,
  sampleIds,
  speakerName,
  summarise,
  tyndaleFirstSentence,
  unbraced,
  unquoted,
  type Extra,
  type FixedLine,
  type HeadlineKind,
  type ObsCandidate,
  type PassageBookData,
  type PassageResult,
  type SummarySentence,
  type Where,
} from "./passage.js";
import { type OutlineSection, type VerseKey, vk } from "./sources.js";
import { approvedPositions } from "./verse.js";
import { compareTuples, pySplit, unique } from "./text.js";

const leq = (a: readonly number[], b: readonly number[]): boolean => compareTuples(a, b) <= 0;

const between = (n: number, lo: number, hi: number): boolean => n >= lo && n <= hi;

/**
 * An outline line cut short where tN had a link ("Yahweh responds to Hezekiah through.", Isaiah 37:21), or a
 * label introducing a quotation ("Recollection: “I will make one remember…”", Isaiah 63:7).
 */
const CUT_LINE = /\b(?:through|to|of|by|for|with|and|the|a|an|in|on|from)\.?$|^[A-Z][a-z]+:\s*“/i;

/** Outline lines that name a kind of text, not what happens in it: no headline of "What happens". */
const LABEL_LINE = /^(?:the\s+)?(?:greeting|greetings|introduction|conclusion|closing|heading|superscription|title|complaint|lament|prayer|praise|hymn|song|oracle|blessing|benediction)\b/i;

/**
 * Passages Henry's outline steers, only those John chose. Steering every passage changed 284 summaries
 * (`henry-steer-2026-10-16.txt` (in the private repo)); on 18 Oct 2026 John read all 284 and chose the new summary for these
 * 66 and kept the old for 218 (docs/review-2026-10-18-henry-prayers.md). Acts 9:23–25 was accepted on 16 Oct.
 */
const STEERED: ReadonlySet<string> = new Set([
  "GEN.8.13-8.19", "GEN.22.1-22.10", "GEN.50.15-50.21",
  "EXO.14.1-14.14", "EXO.15.1-15.21",
  "NUM.5.1-5.4", "NUM.22.1-22.21", "NUM.24.1-24.9", "NUM.26.63-26.65",
  "DEU.33.1-33.29",
  "JDG.3.12-3.30", "JDG.7.15-7.25", "JDG.10.6-10.18",
  "2SA.5.6-5.11", "2SA.10.9-10.19",
  "1KI.21.8-21.16", "1KI.22.1-22.12",
  "2KI.15.32-15.38", "2KI.21.19-21.26", "2KI.22.14-22.20", "2KI.24.6-24.9",
  "1CH.20.1-20.3", "1CH.23.24-23.32",
  "2CH.30.13-30.27",
  "NEH.1.1-1.11", "NEH.4.1-4.8",
  "EST.1.1-1.8",
  "JOB.13.1-13.28", "JOB.38.1-38.41",
  "ISA.59.1-59.17",
  "JER.12.5-12.13",
  "EZK.1.4-1.14", "EZK.1.22-1.28", "EZK.10.1-10.22", "EZK.13.1-13.16", "EZK.22.17-22.22",
  "OBA.1.1-1.14",
  "MIC.6.1-6.8",
  "NAM.2.1-2.13",
  "ZEC.8.1-8.23",
  "MAT.5.1-5.12",
  "ACT.4.1-4.12", "ACT.5.33-5.42", "ACT.9.23-9.25", "ACT.19.21-19.41", "ACT.20.7-20.12", "ACT.23.1-23.11",
  "ACT.23.12-23.22", "ACT.26.1-26.23",
  "ROM.15.1-15.6", "ROM.15.14-15.22",
  "GAL.2.11-2.21", "GAL.3.1-3.9",
  "EPH.2.1-2.10", "EPH.5.21-5.33", "EPH.6.5-6.9",
  "PHP.2.12-2.18",
  "2TH.3.1-3.5", "2TH.3.16-3.18",
  "2TI.3.10-3.17",
  "1JN.1.1-1.4",
  "3JN.1.9-1.14",
  "REV.5.1-5.10", "REV.11.15-11.19", "REV.16.1-16.16", "REV.20.7-20.10",
]);

export function summariseBook(data: PassageBookData, budget = BUDGET): PassageResult[] {
  const book = data.book;
  const ords = [...data.ordRef.keys()].sort((a, b) => a - b);
  const versesOf = (a: number, b: number): Array<[number, number]> =>
    ords.filter((o) => o >= a && o <= b).map((o) => data.ordRef.get(o) as [number, number]);
  const stories = data.stories.filter((s) => s.no !== 49 && s.no !== 50); // 49–50 cite single verses only
  // The approved word list: "apprentices" -> "disciples" and the rest, named in the UST credit.
  const ust = new Map<VerseKey, string>();
  const ustChanged = new Map<VerseKey, string[]>();
  for (const [k, t] of data.ust) {
    const [text, fired] = ustSubs(t, book, data.plainWords);
    ust.set(k, text);
    if (fired.length > 0) ustChanged.set(k, fired);
  }
  const letter = data.letters.letters[book];
  const cases = caseCounts(data.bsb.values());
  const span = (s: OutlineSection): number => [...data.ordRef.values()].filter((cv) => leq([s.c1, s.v1], cv) && leq(cv, [s.c2, s.v2])).length;
  const within = (s: { c1: number; v1: number; c2: number; v2: number }, cv: [number, number]): boolean => leq([s.c1, s.v1], cv) && leq(cv, [s.c2, s.v2]);
  const out: PassageResult[] = [];

  for (const p of passagesOf(data)) {
    let seen: string[] = [];
    // Whose words a verse's speech is (audit, 12 Oct 2026): one named speaker only. A group ID
    // ("priests/Levites") is never split into its first name, and a verse with two speakers (dialogue) gets no
    // single owner. Whether a sentence is the speech or narration around it is decided per sentence.
    const byVerse = new Map<VerseKey, Array<{ name: string; quotePosition: string | null }>>();
    for (const { ord, name: n, quotePosition } of data.speaking(p.startOrd, p.endOrd)) {
      if (n === "" || /^(narrator|interruption|Needs Review|scripture)/.test(n)) continue;
      const cv = data.ordRef.get(ord);
      if (cv !== undefined) byVerse.set(vk(...cv), [...(byVerse.get(vk(...cv)) ?? []), { name: n, quotePosition: quotePosition ?? null }]);
      // A slash joins alternatives or a group (Glyssen's own convention); a guide line names each once.
      for (const raw of n.split("/")) {
        const part = glyssenName(raw);
        // In the Old Testament, Glyssen's "Jesus", "Christ" or "Messiah" speakers are one tradition's reading.
        if (OT.has(book) && /\b(?:Jesus|Christ|Messiah)\b/.test(part)) continue;
        if (part !== "" && !seen.includes(part)) seen.push(part);
      }
    }
    let speakerOf = new Map<VerseKey, string>();
    const entire = new Set<VerseKey>();
    for (const [cv, rows] of byVerse) {
      const distinct = new Set(rows.map((r) => r.name));
      if (distinct.size !== 1 || [...distinct].some((n) => n.includes("/"))) continue;
      speakerOf.set(cv, glyssenName(rows[0]?.name ?? ""));
      if (rows.every((r) => r.quotePosition === "EntireVerse")) entire.add(cv);
    }
    const spokenVerses = [...byVerse.keys()].map((k) => k.split(":").map(Number) as [number, number]).sort(compareTuples);
    const prevSame = (cv: Where): boolean => {
      const prev = [...spokenVerses].reverse().find((x) => compareTuples(x, cv) < 0);
      return prev !== undefined && speakerOf.get(vk(...prev)) === speakerOf.get(vk(...cv)) && prev[0] === cv[0] && prev[1] + 1 === cv[1];
    };
    // The sentence is the speaker's own words: the whole verse is speech (Glyssen says so, or the verse before
    // has the same single speaker, so a long speech runs on, as in Exodus 21–23), or the sentence sits inside
    // the UST's quotation marks in that verse. Narration around a quote is never the speaker's (Acts 16:15).
    const spokenHere = (cv: Where, sentence: string): boolean => {
      if (!speakerOf.has(vk(...cv))) return false;
      const line = ust.get(vk(...cv)) ?? "";
      if (!line.includes("“") && (entire.has(vk(...cv)) || prevSame(cv))) return true;
      const core = sentence.replace(/[{}“”]/g, "").trim().slice(0, 40);
      const bare = line.replace(/[{}]/g, "");
      const at = bare.indexOf(core);
      if (at < 0) return false;
      const before = bare.slice(0, at);
      return before.split("“").length > before.split("”").length;
    };
    const names = [...seen.map((n) => (n.split(" (")[0] ?? "").split(",")[0] ?? ""), "Jesus", "John", "God"];
    const vs = versesOf(p.startOrd, p.endOrd);
    if (POETRY.has(book)) {
      out.push(psalmResult(data, p, vs));
      continue;
    }
    const mode = modeOf(book, vs, data.kinds);
    if (mode === "love") {
      // The Song never names its speakers; the UST's headings do (Glyssen marks every line "uncertain").
      const inside = new Set(vs.map(([c, v]) => vk(c, v)));
      speakerOf = new Map([...data.ustSpeakers].filter(([k]) => inside.has(k)));
      seen = unique(vs.map(([c, v]) => speakerOf.get(vk(c, v))).filter((x): x is string => x !== undefined));
    }
    const narrativeLike = mode === "narrative" || mode === "gospel";
    const bookText = vs.map(([c, v]) => `${data.bsb.get(vk(c, v)) ?? ""} ${ust.get(vk(c, v)) ?? ""}`).join(" ");
    let obs: { no: number; pool: ObsCandidate[] } | null = null;
    for (const st of narrativeLike ? stories : []) {
      const covering = st.spans.find((s) => s.book === book && vs.filter((cv) => within(s, cv)).length / Math.max(1, vs.length) >= 0.6);
      if (covering === undefined) continue;
      // passage_summary.py stops at the first span that covers 60%, pool or not, and tries the next story.
      const pool = obsCandidates(st, bookText);
      if (pool.length >= 3 && new Set(pool.map((x) => x.frame)).size >= 2) obs = { no: st.no, pool };
      if (obs !== null) break;
    }
    // A major debate is never settled: a short disputed range (up to 3 verses in one chapter) gives no
    // summary sentence. In a vision every line is framed as the vision, so a disputed range never states a
    // plain fact (gate h).
    const divs = data.debates.filter((d) => d.book === book && leq(d.from, vs.at(-1) as Where) && leq(vs[0] as Where, d.to));
    const divided = new Set(
      divs
        .filter((d) => d.from[0] === d.to[0] && d.to[1] - d.from[1] <= 2)
        .flatMap((d) => vs.filter((cv) => leq(d.from, cv) && leq(cv, d.to)).map(([c, v]) => vk(c, v))),
    );
    const owner = makeOwner({
      mode,
      speakerOf,
      bsb: data.bsb,
      letter,
      voice: data.kinds.voices[book]?.name,
      cases,
      visionTeller: data.kinds.voices["REV"]?.names?.[0] ?? "John",
      spokenHere: mode === "love" ? undefined : spokenHere,
    });
    const firstV = vs[0] as Where;
    // The passage opens with someone speaking.
    const opening = speakerOf.has(vk(...firstV)) ? firstV : null;
    const openingLine = opening ? openingSpeech(ust.get(vk(...firstV)) ?? "", speakerOf.get(vk(...firstV)), owner, firstV) : null;
    const events =
      mode === "love" ? [...data.events, ...data.outline.filter((x) => x.c1 === x.c2).map((x) => ({ chapter: x.c1, v1: x.v1, v2: x.v2, line: x.line }))] : data.events;
    // Henry's line for a section that starts inside the passage, or holds it and runs at most a third longer:
    // Genesis 46:16–18 sits inside his 46:5–27, whose line is about the whole journey (build 8 plan §D).
    const [sc, sv] = vs[0] as Where;
    const [ec, ev] = vs.at(-1) as Where;
    const steer = (STEERED.has(p.id) ? (data.henry ?? []) : [])
      .filter((h) => h.outline !== null && h.c1 === h.c2 && h.c1 === sc && sc === ec)
      .filter((h) => (h.v1 >= sv && h.v1 <= ev) || (h.v1 <= sv && h.v2 >= ev && h.v2 - h.v1 + 1 <= Math.ceil(((ev - sv + 1) * 4) / 3)))
      .map((h) => h.outline as string);
    const base = { label: p.label, verses: vs, ust, names, budget, tq: data.tq, events, asides: data.asides, owner, divided, tqGap: mode === "letter", opening, openingLine, steer };
    let res = mode === "sayings" ? null : summarise({ ...base, obs });
    if (res !== null && gate(res.key || "x", res.text, res.detail, true, budget, vs.length).some((f) => f.startsWith("b:") || f.startsWith("f:"))) {
      // Body chain after tQ and the UST, when the first pick leans (b) or is too thin (f): Tyndale's first
      // sentence on this range, then story sentences that match the book. Tyndale's own "we" is the note
      // writer's voice, and a plan's measurement is no summary: both are passed over.
      const extra: Extra[] = [];
      const ty = tyndaleFirstSentence(
        data.tyndaleInside(p.startOrd, p.endOrd),
        vs.map(([c, v]) => data.bsb.get(vk(c, v)) ?? "").join(" "),
        (sent) => !(mode === "plans" && MEASURE.test(sent)) && !hasPerson(unquoted(sent)),
      );
      if (ty !== null) extra.push({ sentence: ty, source: "Tyndale", where: [999, 0] });
      const last = vs.at(-1) as [number, number];
      for (const st of narrativeLike ? stories : []) {
        if (!st.spans.some((s) => s.book === book && leq([s.c1, s.v1], last) && leq(firstV, [s.c2, s.v2]))) continue;
        for (const c of obsCandidates(st, bookText)) extra.push({ sentence: c.sentence, source: `OBS ${st.no}.${c.frame + 1}`, where: [998, c.frame * 100 + c.index] });
      }
      if (extra.length > 0) res = summarise({ ...base, extra }) ?? res;
    }
    const [fc, fv] = vs[0] ?? [0, 0];
    const [lc, lv] = vs.at(-1) ?? [0, 0];
    const result: PassageResult = {
      id: p.id,
      label: p.label,
      startOrd: p.startOrd,
      endOrd: p.endOrd,
      range: `${fc}:${fv}–${lc}:${lv}`,
      speakers: seen.map(speakerName),
      headline: "",
      headlineKind: "What happens",
      headlineSource: null,
      mode,
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
      lead: [],
      about: [],
      debates: [],
      awaiting: [],
      flags: ["f: no candidate sentences"],
      sample: false,
    };
    const passageText = vs.map(([c, v]) => `${data.bsb.get(vk(c, v)) ?? ""} ${ust.get(vk(c, v)) ?? ""}`).join(" ");
    const chapters = new Set(vs.map(([c]) => c));
    const chapterText = [...data.bsb.keys()]
      .map((k) => k.split(":").map(Number) as [number, number])
      .filter(([c]) => chapters.has(c))
      .sort(compareTuples)
      .map(([c, v]) => `${data.bsb.get(vk(c, v)) ?? ""} ${ust.get(vk(c, v)) ?? ""}`)
      .join(" ");

    if (mode === "sayings") {
      // Proverbs: "Part of" the collection and the chapter's themes; no summary body (John, 12 Oct 2026).
      // Themes show only where tN names them (rule 4).
      const [coll, themes] = sayingsLines(vs, data.outline, data.tnNotes, data.events, data.plainWords);
      const flags = coll ? [] : ["a: no collection for Part of"];
      for (const t of [coll ?? "", ...themes]) if (/\s{2,}|\s[,.;:]|your language|translat|\d+:\d+/.test(t)) flags.push("g: text hygiene (tN)");
      Object.assign(result, {
        headline: coll ? `${plainWordsIn(coll, data.plainWords)}.` : "",
        headlineKind: "Part of" as HeadlineKind,
        headlineSource: coll ? "tN book outline" : null,
        themes,
        awaiting: divs.map((d) => `${p.id} (${d.question})`),
        flags,
        text: "",
      });
      out.push(result);
      continue;
    }
    if (res !== null) {
      const pool = obs?.pool;
      const obsOk = pool === undefined || res.detail.every((d) => !d.src.startsWith("OBS") || pool.some((x) => x.sentence === d.text));
      let key = res.key;
      let source: string | null = "tN outline";
      let kind: HeadlineKind = "What happens";
      let around: [string | null, string | null] | null = null;
      const label = p.label.trim().toLowerCase();
      if (mode === "law" || mode === "plans") {
        const [t, s] = lawTopic(vs, p.label, data.events, data.outline, span, mode, data.plainWords);
        [key, source, kind] = [t ?? "", s, "Topic"];
      } else if (LETTERS.has(book)) {
        // The narrowest containing section from the chapter outlines or the book outline, any length.
        const eventSecs: OutlineSection[] = data.events.map((e) => ({ c1: e.chapter, v1: e.v1, c2: e.chapter, v2: e.v2, line: e.line }));
        const secs = [...eventSecs, ...data.outline];
        const cont = containing(vs, secs).filter((x) => x.line !== "" && x.line.trim().toLowerCase() !== label);
        const top = cont[0];
        if (top !== undefined) {
          [key, source, kind] = [top.line, "tN outline", "Part of"];
          // Before this · After this, at the same level of the outline (John, 12 Oct 2026, Romans).
          const fromEvents = eventSecs.some((x) => x.c1 === top.c1 && x.v1 === top.v1 && x.c2 === top.c2 && x.v2 === top.v2 && x.line === top.line);
          around = beforeAfter(top, fromEvents ? eventSecs : data.outline);
        }
      }
      if (mode === "love") {
        // Each chapter of the Song holds several speeches: the outline item covering most of it leads.
        let best: OutlineSection | null = null;
        let bestN = -1;
        for (const x of data.outline) {
          const n = vs.filter((cv) => within(x, cv)).length;
          if (n > bestN) [best, bestN] = [x, n];
        }
        if (best !== null && vs.some((cv) => within(best as OutlineSection, cv))) [key, source] = [best.line, "tN book outline"];
      }
      if (mode === "visions" && key !== "" && !outlineNamed(key, chapterText)) key = "";
      if (key === "" && mode !== "law" && mode !== "plans") {
        // Then the book outline: the section that holds this passage, at most three times its length.
        const hit = containing(vs, data.outline).filter((e) => span(e) <= 3 * vs.length && (mode !== "visions" || outlineNamed(e.line, chapterText)));
        if (hit[0] !== undefined) [key, source] = [hit[0].line, "tN book outline"];
      }
      if (key === "" && !LETTERS.has(book) && mode !== "law" && mode !== "plans") {
        // No event names this passage (Acts' notes outline only six broad parts): say which part it belongs
        // to, as letters do; in a vision, only a part the passage itself names.
        const cont = containing(vs, data.outline).filter((e) => e.line.trim().toLowerCase() !== label && (mode !== "visions" || outlineNamed(e.line, chapterText)));
        if (cont[0] !== undefined) [key, source, kind] = [cont[0].line, "tN book outline", "Part of"];
      }
      if (key === "" && mode === "visions") {
        // What John sees, in tN's own words for the chapter's concepts, when every word is in the passage.
        const seenHeads = conceptHeadings(vs, data.tnNotes, passageText);
        if (seenHeads[0] !== undefined) [key, source, kind] = [seenHeads[0], "tN chapter introduction", "What John sees"];
      }
      if (key === "" && mode !== "law" && mode !== "plans") {
        // No outline line for this passage: the BSB's own headings in its first half, never its title.
        const half = vs[Math.floor(vs.length / 2)] as [number, number];
        const inside = new Set(vs.map(([c, v]) => vk(c, v)));
        const hs = data.headings.filter((h) => inside.has(vk(h.chapter, h.verse)) && leq([h.chapter, h.verse], half) && h.heading.trim().toLowerCase() !== label).map((h) => h.heading);
        if (hs.length > 0) [key, source] = [unique(hs).join(" · "), "BSB heading"];
      }
      if (key === "" && mode !== "law" && mode !== "plans") {
        // The BSB's passage and tN's outline cut at different verses (Malachi 1:1–5 against 1:1 and 1:2–5):
        // the outline section that covers at least two thirds of the passage says what it is part of. Only
        // where nothing above gave a headline, so no passing summary changes (13 Oct 2026).
        const share = (x: OutlineSection) => vs.filter((cv) => within(x, cv)).length / vs.length;
        const most = [...data.events.map((e) => ({ c1: e.chapter, v1: e.v1, c2: e.chapter, v2: e.v2, line: e.line })), ...data.outline]
          // …and it begins inside the passage: a title names what opens its section, so one that began earlier
          // names a scene this passage does not hold ("Isaac lies about Rebekah", 26:1–22, over Genesis 26:12–25).
          .filter((x) => x.line !== "" && !/^\d/.test(x.line) && x.line.trim().toLowerCase() !== label && share(x) >= 2 / 3 && leq(vs[0] as [number, number], [x.c1, x.v1]) && (mode !== "visions" || outlineNamed(x.line, chapterText)))
          .sort((a, b) => share(b) - share(a) || span(a) - span(b))[0];
        if (most !== undefined) [key, source, kind] = [most.line, "tN outline", "Part of"];
      }
      if ((key === "" || kind === "Part of") && mode !== "law" && mode !== "plans") {
        // A chapter introduction's part that starts at this passage's first verse and covers two thirds of
        // it says what happens here, where an outline only said what the passage is part of (15 Oct 2026:
        // 250 passages, chiefly Isaiah, Jeremiah, Ezekiel, Kings and Chronicles). Starting at the first verse
        // keeps out a part named for a later scene (1 Kings 14:21 against 14:19–24); labels are not events.
        // Three to twenty words: "Babylon." only repeats the passage's title, and a forty-word line is a summary.
        // At most twice the passage: a longer part is named for what comes later (Hebrews 3:1–19's "wilderness
        // generation" over 3:1–6).
        const covers = (x: OutlineSection) => vs.filter((cv) => within(x, cv)).length / vs.length;
        const first = vs[0] as [number, number];
        const part = [...data.parts, ...data.events.map((e) => ({ c1: e.chapter, v1: e.v1, c2: e.chapter, v2: e.v2, line: e.line }))].find(
          (x) => x.c1 === first[0] && x.v1 === first[1] && covers(x) >= 2 / 3 && x.line.trim().toLowerCase() !== label && span(x) <= 2 * vs.length && !LABEL_LINE.test(x.line) && !CUT_LINE.test(x.line) && between(pySplit(x.line).length, 3, 20),
        );
        if (part !== undefined) [key, source, kind, around] = [part.line, "tN chapter introduction", "What happens", null];
      }
      // An overview sentence and the text's own sentence for the same verse tell it twice, the overview out of
      // order ("Jacob traveled to Shechem, where he bought a piece of ground. {After that,} Jacob… arrived",
      // Genesis 33:18; John, 15 Oct 2026): the UST, which keeps the text's sequence, wins.
      // Only when it says the same thing (three fifths of its words again): an overview that says something else
      // on the same verse stays ("David built an altar", 2 Samuel 24:25; "silence in heaven", Revelation 8:1).
      const ust = res.detail.filter((d) => d.src.startsWith("UST"));
      const repeats = (d: SummarySentence): boolean => {
        const words = new Set(contentWords(d.raw ?? d.text));
        return ust.some((u) => vk(...u.where) === vk(...d.where) && words.size > 0 && contentWords(u.raw ?? u.text).filter((w) => words.has(w)).length / words.size >= 0.6);
      };
      const fewer = res.detail.filter((d) => !(d.src.startsWith("tQ") && repeats(d)));
      // Never at the cost of the summary itself: Acts 2:1–13 would fall below the sentences it needs.
      const once = fewer.length >= 3 ? fewer : res.detail;
      let detail: SummarySentence[] = once;
      let text = once.length === res.detail.length ? res.text : joinedText(once);
      let srcs = once.length === res.detail.length ? res.srcs : once.map((d) => d.src);
      let purpose: FixedLine | null = null;
      if (mode === "law" || mode === "plans") {
        // Topic, then purpose, then at most two lines of what God says, framed as his; never rule by rule.
        if (mode === "plans") {
          const [line, from] = kindLine(data.kinds, "purposes", book, vs);
          if (line !== null) purpose = { line, source: from ?? "", status: data.kinds.status };
        } else {
          // From tN itself, not one of John's tables, so it carries no table status.
          const line = conceptLine(firstV[0], data.tnNotes, key, p.label, data.name);
          if (line !== null) purpose = { line, source: "tN chapter introduction", status: "" };
        }
        let body = [...detail];
        // A line that leans ("He made a lid…") goes first, while another is left to carry the passage.
        for (const d of [...body]) {
          if (body.length > 1 && !QUOTE_FRAME.test(d.text) && LEANS.test(unbraced(d.raw ?? d.text))) body.splice(body.indexOf(d), 1);
        }
        while (body.length > 2) {
          const drop = body.find((d) => !d.setting && d !== body.at(-1)) ?? (body[1] as SummarySentence);
          body.splice(body.indexOf(drop), 1);
        }
        // Within the word budget: the longer line goes first, never the last one left.
        const plen = purpose === null ? 0 : pySplit(purpose.line).length;
        while (body.length > 1 && plen + body.reduce((n, d) => n + pySplit(d.text).length, 0) > budget * 1.3) {
          const longest = body.reduce((a, b) => (pySplit(b.text).length > pySplit(a.text).length ? b : a));
          body.splice(body.indexOf(longest), 1);
        }
        body = body.map((d) => ({ ...d, speech: speakerOf.has(vk(...d.where)) && d.src.startsWith("UST") && commandlike(unbraced(d.raw ?? d.text)) }));
        const fixed: SummarySentence[] =
          purpose === null
            ? []
            : [{ text: purpose.line, raw: purpose.line, src: mode === "law" ? "tN intro" : "purpose (draft)", where: firstV, aside: false, setting: false, fixed: true }];
        detail = [...fixed, ...body];
        text = joinedText(detail);
        srcs = detail.map((d) => d.src);
      }
      if (GENEALOGY_HEAD.test(p.label) && narrativeLike) {
        // A genealogy: the BSB heading leads, then one sentence, then at most the "runs from" line built
        // from the heading's own names.
        [key, source, kind] = [p.label, "BSB heading", "Genealogy"];
        const lead = detail.find((d) => !LEANS.test(d.text) && !SPEECH.test(d.text));
        const list = genealogyLine(p.label, vs.map(([c, v]) => data.bsb.get(vk(c, v)) ?? "").join(" "));
        detail = [...(lead === undefined ? [] : [lead]), ...(list === null ? [] : [{ text: list, src: "BSB names", where: firstV, aside: false, setting: false }])];
        text = detail.map((d) => d.text).join(" ");
        srcs = detail.map((d) => d.src);
      }
      if (mode === "debate" || mode === "love") detail = detail.map((d) => ({ ...d, speech: speakerOf.has(vk(...d.where)) && d.src.startsWith("UST") }));
      // A genealogy is its heading and one sentence; a law or plan passage is its topic, purpose and up to
      // two lines of speech: two in all.
      const need = kind === "Genealogy" ? 1 : mode === "law" || mode === "plans" ? 2 : null;
      const flags = gate(key, text, detail, obsOk, budget, vs.length, need, mode);
      // John's hand decisions (passage_reviews.json): a hold hides a summary the gate passed; an approval shows a
      // flagged one only while its text is the text he read.
      const review = data.reviews.get(p.id);
      if (review?.status === "held") flags.push(`held: ${review.reason ?? "by hand"}`);
      // The text as stored and shown: law and plans keep their purpose line apart (below), and John read that.
      const shownText = purpose === null ? text : joinedText(detail.filter((d) => !d.fixed));
      if (review?.status === "approved" && review.sha256 === createHash("sha256").update(shownText).digest("hex")) flags.length = 0;
      // A fixed data fact, not summary prose: a BSB manuscript footnote that names this passage's verses, as
      // one plain sentence; the rest of the note waits behind "Read the note" (John, 12 Oct 2026, Mark 16).
      // A variant fragment (Ruth 4:20's "…; most Hebrew manuscripts Salma") stays in the footnote.
      const vset = new Set(vs.map(([c, v]) => vk(c, v)));
      const facts: Array<{ fact: string; rest: string }> = [];
      for (const f of data.footnotes) {
        const m = /(\d+):(\d+) through (?:[1-3]?\s?[A-Z][a-z]+ )?(\d+):(\d+)/.exec(f.text);
        const named = m !== null && vset.has(vk(Number(m[1]), Number(m[2])));
        const [fact, rest] = footnoteFactOf(f.text);
        const plain = /^[A-Z][^;]*\.$/.test(fact) && !/\b(?:LXX|MT|DSS|Vulgate|Syriac|BYZ|TR|NA|SBL|ECM)\b/.test(fact) && pySplit(fact).length >= 6;
        if (plain && (named || (vset.has(vk(f.chapter, f.verse)) && /verses? \d+/.test(fact))) && !facts.some((x) => x.fact === fact && x.rest === rest)) facts.push({ fact, rest });
      }
      // The prophets' outline words ("Oracles About Judah") through the table John approves once.
      const plainName = Object.hasOwn(data.prophets.plain_names, key) ? data.prophets.plain_names[key] : undefined;
      const headlineStatus = plainName === undefined ? null : data.prophets.status;
      if (plainName !== undefined) {
        key = plainName;
        source = `${source ?? ""}, plain name ${data.prophets.status}`;
      }
      // Approved positions: sources' sentences, unchanged, credited to their sources only; John is never a credit.
      const approved = divs.filter((d) => approvedPositions(d).length > 0);
      const settings: FixedLine[] = [];
      const prophet = data.prophets.settings.find((x) => x.book === book && leq(x.from, firstV) && leq(vs.at(-1) as Where, x.to));
      if (prophet !== undefined) settings.push({ line: prophet.line, source: "tN book intro", status: data.prophets.status });
      const [kLine, kSource] = kindLine(data.kinds, "settings", book, vs);
      if (kLine !== null) settings.push({ line: kLine, source: kSource ?? "", status: data.kinds.status });
      if (letter !== undefined) settings.push({ line: letter.setting, source: "tN book intro", status: data.letters.status });
      const used = new Set(srcs.map((s) => s.split(" ")[0] ?? ""));
      const changed = unique(
        detail
          .filter((d) => d.src.startsWith("UST"))
          .flatMap((d) => (ustChanged.get(vk(...d.where)) ?? []).filter((f) => d.text.toLowerCase().includes((f.split(" → ")[1] ?? "").toLowerCase()))),
      ).sort();
      const credit =
        `From ${SOURCE_NAMES.filter(([k]) => used.has(k)).map(([, n]) => n).join(", ")}, adapted` +
        (changed.length > 0 ? `; UST words changed by list (${data.plainWords.status}): ${changed.join(", ")}` : "");
      Object.assign(result, {
        headline: key === "" ? "" : `${(key[0] ?? "").toUpperCase()}${key.slice(1)}${/[.?!]$/.test(key) ? "" : "."}`,
        headlineKind: kind,
        headlineSource: key === "" ? null : source,
        headlineStatus,
        text: shownText,
        words: pySplit(text).length,
        sentences: detail.map((d) => {
          const src = d.src.split(" ")[0] ?? "";
          return { ...d, source: src, credit: SENTENCE_CREDIT[src] ?? "" };
        }),
        srcs,
        credit,
        facts,
        around: around !== null && (around[0] !== null || around[1] !== null) ? { before: around[0], after: around[1] } : null,
        purpose,
        alsoToldIn: mode === "gospel" ? alsoToldIn(book, vs, data.parallels, data.bookNames, data.glyssenParallels(p.startOrd, p.endOrd)) : [],
        settings,
        debates: approved.flatMap((d) => approvedPositions(d).map((x) => ({ sentence: x.text, credit: x.source, ...(x.held_by ? { held_by: x.held_by } : {}) }))),
        awaiting: divs.filter((d) => !approved.includes(d)).map((d) => `${p.id} (${d.question})`),
        flags,
      });
    }
    out.push(result);
  }
  const sample = new Set(sampleIds(book, out.map((r) => r.id)));
  for (const r of out) r.sample = sample.has(r.id);
  return out;
}

/** One plain sentence of a footnote, and the rest of the note (sources.ts footnoteFact). */
function footnoteFactOf(note: string): [string, string] {
  const t = note.trim();
  const m = /(?<=[a-z0-9][.!?])\s+(?=[A-Z])/.exec(t);
  return m === null ? [t, ""] : [t.slice(0, m.index), t.slice(m.index + m[0].length)];
}

// ---------------------------------------------------------------------------
// The per-book report
// ---------------------------------------------------------------------------

export interface PassageReport {
  book: string;
  summaries: number;
  passing: number;
  flagged: Array<{ id: string; flags: string[] }>;
  /** Flag counts by check letter. */
  reasons: Record<string, number>;
  coverage: { ust: number; tq: number; obs: number; speakers: number };
  outlineLines: number;
  bookOutline: number;
  sample: string[];
  /** Passages touching a major debate with no approved note yet: John's list, not a flag. */
  awaitingDebates: string[];
  /** More than 15% flagged: a source gap; fix the rules before the book goes out. */
  stop: boolean;
}

export function passageReport(data: PassageBookData, results: readonly PassageResult[]): PassageReport {
  const flagged = results.filter((r) => r.flags.length > 0).map((r) => ({ id: r.id, flags: r.flags }));
  const reasons: Record<string, number> = {};
  for (const f of flagged.flatMap((x) => x.flags)) {
    const k = f.split(":")[0] ?? "";
    reasons[k] = (reasons[k] ?? 0) + 1;
  }
  const passages = passagesOf(data);
  const ords = [...data.ordRef.keys()].sort((a, b) => a - b);
  const allv = passages.flatMap((p) => ords.filter((o) => o >= p.startOrd && o <= p.endOrd).map((o) => data.ordRef.get(o) as [number, number]));
  const cov = (has: (cv: [number, number]) => boolean): number => Math.floor((100 * allv.filter(has).length) / Math.max(1, allv.length));
  const tqv = new Set(data.tq.map((t) => vk(t.chapter, t.verse)));
  const spkV = new Set([...data.speakerOrds].map((o) => data.ordRef.get(o)).filter((cv): cv is [number, number] => cv !== undefined).map(([c, v]) => vk(c, v)));
  const spans = data.stories.filter((s) => s.no !== 49 && s.no !== 50).flatMap((s) => s.spans.filter((x) => x.book === data.book));
  return {
    book: data.book,
    summaries: results.length,
    passing: results.length - flagged.length,
    flagged,
    reasons,
    coverage: {
      ust: cov(([c, v]) => data.ust.has(vk(c, v))),
      tq: cov(([c, v]) => tqv.has(vk(c, v))),
      obs: cov((cv) => spans.some((s) => leq([s.c1, s.v1], cv) && leq(cv, [s.c2, s.v2]))),
      speakers: cov(([c, v]) => spkV.has(vk(c, v))),
    },
    outlineLines: data.events.length,
    bookOutline: data.outline.length,
    sample: results.filter((r) => r.sample).map((r) => r.id),
    awaitingDebates: results.flatMap((r) => r.awaiting),
    stop: overStop(flagged.length, results.length),
  };
}
