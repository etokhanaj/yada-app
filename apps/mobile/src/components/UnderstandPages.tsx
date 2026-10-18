/**
 * Pages pushed inside the verse sheet or the passage guide (build plan Phases 1–2): Key words (DI-01, DI-02),
 * Check what you read, About this psalm (JR-03), Verse by verse (UX-09) and See also (SN-08). Each reads
 * the book's Understand bundle and says where it comes from once, at its foot.
 */

import { BOOK_CODES, type BookCode, type TranslationWord, formatDisplayRef, formatVerseId, isMissingVerse, ordToParts } from "@yada/schema";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { useCore, useQuery } from "../data/AppData";
import { bookBounds, getTextsForOrds, readableTranslations } from "../data/queries";
import { loadPassageFor, loadVersesInRange } from "../data/understand";
import { usePalette } from "../design/tokens";
import { FONTS } from "../design/type";
import { resolveRef } from "../lib/chapters";
import { DICTIONARY_CREDIT } from "../lib/dictionary";
import { passageSubtitle } from "../lib/passageGuide";
import { mergeSeeAlso, OPENBIBLE_LINE } from "../lib/study";
import { spokenText } from "../lib/supplied";
import { notInLine } from "../lib/translations";
import { behindLine } from "../lib/understand";
import { useSettings } from "../state/settings";
import { Icon } from "./Icon";
import { useSheetBase } from "./navigation";
import { Row, RowNote, Section, SheetScreen, UNDERSTAND_EXIT } from "./Sheet";
import { SeeAlsoRow, useShownSeeAlso, useVerseStudy } from "./StudyLayer";
import { Chrome, Prose, Scripture } from "./Type";
import { DivineText } from "./Verse";

const TQ_CREDIT = "Translation Questions, adapted from unfoldingWord · CC BY‑SA 4.0";
const TN_CREDIT = "Translation Notes, adapted from unfoldingWord · CC BY‑SA 4.0 · Berean Standard Bible, public domain";
const BSB_FOOTNOTES_CREDIT = "The Berean Standard Bible’s own footnotes · public domain";

const idOf = (ord: number): string => formatVerseId(ordToParts(ord));

/** "‹ 14:34": the back label names where it goes (DN-06). */
function shortRef(ord: number): string {
  const p = ordToParts(ord);
  return `${p.chapter}:${p.verse}`;
}

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s+/u)[0] ?? text;
}

/** The terms a verse or a passage names, each once, in order. */
async function termsIn(book: BookCode, lo: number, hi: number): Promise<TranslationWord[]> {
  const seen = new Map<string, TranslationWord>();
  for (const { verse } of await loadVersesInRange(book, lo, hi)) {
    if (isMissingVerse(verse)) continue;
    for (const k of verse.deeper.key_words) if (!seen.has(k.term)) seen.set(k.term, k);
  }
  return [...seen.values()];
}

export function KeyWordsPage({ refText }: { refText: string }) {
  const span = resolveRef(refText);
  const base = useSheetBase();
  const { data } = useQuery(async () => (span === null ? [] : termsIn(span.book, span.startOrd, span.endOrd)), [refText]);
  if (span === null) return null;
  const title = span.startOrd === span.endOrd ? formatDisplayRef(ordToParts(span.startOrd)) : refText;
  return (
    <SheetScreen title="Key words" subtitle={title} backLabel={title} testID="key-words" {...UNDERSTAND_EXIT}>
      {(data ?? []).map((k, i) => (
        <Row key={k.term} first={i === 0} onPress={() => router.push({ pathname: `${base}/term`, params: { ref: refText, term: k.term } })} label={`${k.term}, ${firstSentence(k.definition)}`} testID={`term-${k.term}`}>
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            {k.term}
          </Chrome>
          <Prose step="claim" tone="muted">
            {firstSentence(k.definition)}
          </Prose>
        </Row>
      ))}
      <Chrome step="note" tone="muted" style={{ marginTop: 16 }}>
        {DICTIONARY_CREDIT}
      </Chrome>
    </SheetScreen>
  );
}

/**
 * A term's page (DI-02, DN-01): its definition, then the verses of this book that name it, each with its
 * BSB text. Only this book: a count "in the Bible" would need every book's file on the phone.
 */
export function TermPage({ refText, term }: { refText: string; term: string }) {
  const core = useCore();
  const span = resolveRef(refText);
  const { data } = useQuery(async () => {
    if (span === null) return null;
    const verses = await loadVersesInRange(span.book, ...bookBounds(span.book));
    const uses: number[] = [];
    let article: TranslationWord | null = null;
    for (const { ord, verse } of verses) {
      if (isMissingVerse(verse)) continue;
      const hit = verse.deeper.key_words.find((k) => k.term === term);
      if (hit === undefined) continue;
      article ??= hit;
      uses.push(ord);
    }
    const texts = await getTextsForOrds(core, uses.slice(0, 50), "BSB");
    return { article, uses, texts };
  }, [refText, term]);
  if (span === null) return null;
  const back = shortRef(span.startOrd);
  return (
    <SheetScreen title={term} subtitle="Dictionary" backLabel={back} testID="term" {...UNDERSTAND_EXIT}>
      {data?.article != null ? <Prose step="explanation">{data.article.definition}</Prose> : null}
      {data != null && data.uses.length > 0 ? (
        <Section title={`In ${BOOK_CODES[span.book].name} · ${data.uses.length} ${data.uses.length === 1 ? "place" : "places"}`}>
          {data.uses.slice(0, 50).map((ord, i) => (
            <Row key={ord} first={i === 0} onPress={() => router.push({ pathname: "/evidence/peek", params: { ref: idOf(ord), from: idOf(span.startOrd), note: "" } })} testID={`use-${ord}`}>
              <Chrome tone="ink" style={{ fontWeight: "500" }}>
                {formatDisplayRef(ordToParts(ord))}
              </Chrome>
              <Scripture step="claim" numberOfLines={2}>
                {data.texts.get(ord) ?? ""}
              </Scripture>
            </Row>
          ))}
        </Section>
      ) : null}
      <Chrome step="note" tone="muted" style={{ marginTop: 16 }}>
        {DICTIONARY_CREDIT}
      </Chrome>
    </SheetScreen>
  );
}

export function CheckPage({ refText }: { refText: string }) {
  const span = resolveRef(refText);
  const { data } = useQuery(async () => {
    if (span === null) return [];
    return (await loadVersesInRange(span.book, span.startOrd, span.endOrd)).flatMap(({ ord, verse }) =>
      isMissingVerse(verse) ? [] : verse.deeper.check.map((c) => ({ ord, ...c })),
    );
  }, [refText]);
  if (span === null) return null;
  return (
    <SheetScreen title="Check what you read" subtitle={refText.includes("-") ? undefined : formatDisplayRef(ordToParts(span.startOrd))} backLabel={null} testID="check" {...UNDERSTAND_EXIT}>
      {(data ?? []).map((c) => (
        <CheckQuestion key={`${c.ord}-${c.q}`} q={c.q} a={c.a} where={shortRef(c.ord)} />
      ))}
      <Chrome step="note" tone="muted" style={{ marginTop: 16 }}>
        {TQ_CREDIT}
      </Chrome>
    </SheetScreen>
  );
}

/**
 * One question (UW-02 `.qrow`): the question, then a visible "Show the answer" / "Hide the answer" in accent
 * with its chevron, the answer indented under it. Before, the whole row was the control and nothing on screen
 * said an answer was there (design QA, 18 Oct 2026).
 */
export function CheckQuestion({ q, a, where }: { q: string; a: string; where?: string }) {
  const palette = usePalette();
  const [shown, setShown] = useState(false);
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.divider }}>
      {where !== undefined ? (
        <Chrome step="note" tone="muted">
          {where}
        </Chrome>
      ) : null}
      <Prose step="claim">{q}</Prose>
      <Pressable
        onPress={() => setShown((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: shown }}
        accessibilityLabel={shown ? "Hide the answer" : "Show the answer"}
        style={({ pressed }) => [{ minHeight: 44, flexDirection: "row", alignItems: "center", columnGap: 6 }, pressed ? { opacity: 0.6 } : null]}
      >
        <Chrome tone="accent" size={15} style={{ fontWeight: "600" }}>
          {shown ? "Hide the answer" : "Show the answer"}
        </Chrome>
        <Icon name={shown ? "up" : "down"} size={16} tone="accent" />
      </Pressable>
      {shown ? (
        <Prose step="claim" tone="muted" style={{ paddingLeft: 12, paddingBottom: 4 }}>
          {a}
        </Prose>
      ) : null}
    </View>
  );
}

/**
 * What the manuscripts differ on (VS-04's Go deeper "Manuscripts" row): the BSB's own manuscript footnotes on
 * this verse, then on the other verses of its passage, each under its verse. Offered only where the verse has
 * one; nothing here that the footnotes don't say (rule 4).
 */
export function ManuscriptsPage({ refText }: { refText: string }) {
  const span = resolveRef(refText);
  const { data } = useQuery(async () => {
    if (span === null) return null;
    const passage = await loadPassageFor(span.book, span.startOrd);
    const lo = passage?.startOrd ?? span.startOrd;
    const hi = passage?.endOrd ?? span.startOrd;
    const notes = (await loadVersesInRange(span.book, lo, hi)).flatMap(({ ord, verse }) => {
      const lines = isMissingVerse(verse) ? verse.manuscripts : verse.beginner.manuscripts;
      return lines.length === 0 ? [] : [{ ord, lines }];
    });
    return { notes };
  }, [refText]);
  if (span === null) return null;
  const display = formatDisplayRef(ordToParts(span.startOrd));
  const here = (data?.notes ?? []).filter((n) => n.ord === span.startOrd);
  const around = (data?.notes ?? []).filter((n) => n.ord !== span.startOrd);
  return (
    <SheetScreen title="Manuscripts" subtitle={display} backLabel={shortRef(span.startOrd)} testID="manuscripts" {...UNDERSTAND_EXIT}>
      {here.flatMap((n) => n.lines).map((line) => (
        <Prose key={line} step="claim" style={{ marginBottom: 10 }}>
          {line}
        </Prose>
      ))}
      {around.length > 0 ? (
        <Section title="Elsewhere in this passage">
          {around.map((n) => (
            <View key={n.ord} style={{ marginBottom: 12 }}>
              <Chrome step="note" tone="muted" style={{ fontWeight: "600" }}>
                {shortRef(n.ord)}
              </Chrome>
              {n.lines.map((line) => (
                <Prose key={line} step="claim">
                  {line}
                </Prose>
              ))}
            </View>
          ))}
        </Section>
      ) : null}
      <Chrome step="note" tone="muted" style={{ marginTop: 16 }}>
        {BSB_FOOTNOTES_CREDIT}
      </Chrome>
    </SheetScreen>
  );
}

/** About this psalm (JR-03): the title, the picture and how it moves, sources once at the foot. */
export function AboutPsalmPage({ refText }: { refText: string }) {
  const span = resolveRef(refText);
  const { data } = useQuery(async () => (span === null ? null : loadPassageFor(span.book, span.startOrd)), [refText]);
  if (span === null) return null;
  const chapter = ordToParts(span.startOrd).chapter;
  const groups = new Map<string, string[]>();
  for (const line of data?.psalm_about ?? []) groups.set(line.label, [...(groups.get(line.label) ?? []), line.text]);
  return (
    <SheetScreen title="About this psalm" subtitle={`Psalm ${chapter}`} backLabel={null} testID="about-psalm" {...UNDERSTAND_EXIT}>
      {[...groups].map(([label, lines], i) => (
        <Section key={label} title={label} first={i === 0}>
          {lines.map((l) => (
            <Prose key={l} step="explanation" style={{ marginBottom: 6 }}>
              {l}
            </Prose>
          ))}
        </Section>
      ))}
      <Chrome step="note" tone="muted" style={{ marginTop: 24 }}>
        {TN_CREDIT}
      </Chrome>
    </SheetScreen>
  );
}

/**
 * Verse by verse (UX-09 `.row.vbv`): each verse's number, its words in the version being read, and one muted line
 * of what its Understand holds; the verse's Understand one push away. Before, each row was the UST plain line,
 * which said nothing of what lay behind it.
 */
export function VersesPage({ refText }: { refText: string }) {
  const core = useCore();
  const span = resolveRef(refText);
  const base = useSheetBase();
  const translation = useSettings((s) => s.translation);
  // The reader's own version where the phone has it; a licensed one is read through the BSB here, as in Understand.
  const code = readableTranslations().includes(translation) ? translation : "BSB";
  const { data } = useQuery(async () => {
    if (span === null) return null;
    const [verses, passage] = await Promise.all([loadVersesInRange(span.book, span.startOrd, span.endOrd), loadPassageFor(span.book, span.startOrd)]);
    const texts = await getTextsForOrds(core, verses.map((v) => v.ord), code);
    return { verses, passage, texts };
  }, [refText, code]);
  if (span === null) return null;
  return (
    <SheetScreen title="Verse by verse" subtitle={data?.passage == null ? undefined : passageSubtitle(data.passage)} backLabel={null} testID="verses" {...UNDERSTAND_EXIT}>
      {(data?.verses ?? []).map(({ ord, verse }, i) => {
        const p = ordToParts(ord);
        const text = data?.texts.get(ord) ?? "";
        const shown = text === "" ? notInLine(code) : text;
        const behind = behindLine(verse);
        return (
          <Row key={ord} first={i === 0} onPress={() => router.push({ pathname: `${base}/verse`, params: { ref: idOf(ord) } })} label={`Verse ${p.verse}. ${spokenText(shown, code)}. ${behind}. Opens Understand ${p.verse}`} testID={`verses-row-${p.verse}`}>
            <View style={{ flexDirection: "row", columnGap: 12, alignItems: "flex-start" }}>
              <Chrome step="note" tone="muted" style={{ minWidth: 18, marginTop: 3, fontVariant: ["tabular-nums"] }}>
                {p.verse}
              </Chrome>
              <View style={{ flex: 1, rowGap: 4 }}>
                <Scripture step="claim" style={{ fontFamily: FONTS.scripture }} tone={text === "" ? "muted" : "ink"}>
                  {text === "" ? shown : <DivineText text={text} translation={code} />}
                </Scripture>
                <RowNote>{behind}</RowNote>
              </View>
            </View>
          </Row>
        );
      })}
    </SheetScreen>
  );
}

/** See also, all of it (SN-08): OpenBible's cross-references for the verse, pushed inside the sheet. */
export function SeeAlsoPage({ refText }: { refText: string }) {
  const core = useCore();
  const span = resolveRef(refText);
  const { data } = useQuery(async () => (span === null ? null : (await getTextsForOrds(core, [span.startOrd], "BSB")).get(span.startOrd)), [refText]);
  const study = useVerseStudy(span?.book ?? "JHN", span?.startOrd ?? 0, data ?? undefined);
  const items = useShownSeeAlso(mergeSeeAlso([], study.kind === "ready" ? study.study.xrefs : []));
  if (span === null) return null;
  const display = formatDisplayRef(ordToParts(span.startOrd));
  return (
    <SheetScreen title="See also" subtitle={display} backLabel={display} verseId={idOf(span.startOrd)} testID="see-also" {...UNDERSTAND_EXIT}>
      {items.map((item, i) => (
        <SeeAlsoRow key={`${item.source}-${item.start}-${item.end}`} item={item} from={idOf(span.startOrd)} first={i === 0} ax={false} />
      ))}
      {items.length > 0 ? (
        <Chrome step="note" tone="muted" style={{ marginTop: 8 }} testID="openbible-source">
          {OPENBIBLE_LINE}
        </Chrome>
      ) : null}
    </SheetScreen>
  );
}
