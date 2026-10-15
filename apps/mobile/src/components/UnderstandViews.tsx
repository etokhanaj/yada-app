/**
 * The verse sheet (build plan Phase 1; canvas VS-01–07, NA-01–08): one sheet over the reader with a half
 * view and a full view, read from the book's Understand bundle (docs/no-ai-understand.md). No AI wrote
 * any line here: each is a published source adapted by rule, a fact in a fixed sentence, or a reference.
 *
 * - Half view (medium detent): the plain line at reading size, at most one Notice fact that carries
 *   its own comparison, Readers differ with its count and first reading, then "More on this verse",
 *   which grows the same sheet. A plain line past 30 words stands alone (VS-01).
 * - Disputed verses lead with Readers differ, then "One way to read it" at body size, then the
 *   manuscripts fact (VS-03–06).
 * - Full view (large detent): the verse again at reading size, the first view in full, Go deeper in a
 *   fixed order (Original · Compare · Study notes · Key words · Sources), then every reading, every fact,
 *   Read it alongside and People (VS-02, VS-04, VS-06, VS-07).
 * - Header: the reference, with the passage under it (John, 12 Oct: plain names, codes only in Sources;
 *   NA-02's header). Source names appear in headings only where two sources share a slot.
 * - A book whose Understand is not on the phone keeps study notes and People (SN-03).
 *
 * A selection of several verses opens the passage guide with those verses first (Phase 2, UX-06).
 */

import { BOOK_CODES, type BookCode, formatDisplayRef, formatVerseId, type MissingVerse, ordToParts, type Passage, type VerseLayers, isMissingVerse, parseVerseId, verseOrd } from "@yada/schema";
import { router, useNavigation } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";

import { useAppData, useCore, useLog, useQuery } from "../data/AppData";
import { keptAt, loadSettings, saveSetting } from "../data/user";
import { formatDay } from "../lib/dates";
import { BUILT_IN, getLanguageLetters, getTexts, getTokens, isDownloaded, scriptOf, type Token } from "../data/queries";
import { leadingInPhrase, sharedOpening } from "../lib/sameWords";
import { useTranslations } from "../data/translations";
import { loadPassageFor, loadVerse, useUnderstandFile } from "../data/understand";
import { SHEET_MEDIUM, useAXLevel, usePalette } from "../design/tokens";
import { formatRangeInBook, resolveRef } from "../lib/chapters";
import { compareSelection } from "../lib/compare";
import { compareLine, originalLine } from "../lib/goFurther";
import { missingOriginalNote } from "../lib/omissions";
import { originalLanguage } from "../lib/originalLanguage";
import { spokenText } from "../lib/supplied";
import { BSB_BASIS, bsbStandsIn, notInLine, onPhoneOrder, verseTextIn } from "../lib/translations";
import {
  alongsideLabel,
  halfView,
  plainHeading,
  plainSegments,
  readerLines,
  readersLead,
  spokenPlain,
  translatorNotes,
} from "../lib/understand";
import { useSettings } from "../state/settings";
import { useSheets } from "../state/sheets";
import { HearPassage } from "./HearPassage";
import { Icon } from "./Icon";
import { glossCaption, OriginalWords } from "./OriginalWords";
import { useVerseMarks } from "./BsbPartner";
import { usePartner } from "../state/partner";
import { PassageGuide } from "./PassageGuide";
import { Row, RowNote, Section, SheetScreen, type SheetSizeValue, TextLink, UNDERSTAND_EXIT } from "./Sheet";
import { hasStatusLine, PeopleRows, SeeAlsoSection, StudyNotesInline, StudyStatus, useShownSeeAlso, useVerseStudy } from "./StudyLayer";
import { mergeSeeAlso } from "../lib/study";
import { Chrome, Label, Original, Prose, Scripture } from "./Type";

export type UnderstandSection = "original" | "compare";

const verseIdOf = (ord: number): string => formatVerseId(ordToParts(ord));

export function UnderstandRoute({ refText, section }: { refText: string; section?: UnderstandSection }) {
  const span = resolveRef(refText);
  if (span === null) return null;
  if (span.startOrd === span.endOrd) return <VerseSheet book={span.book} ord={span.startOrd} section={section} />;
  // Phase 2, UX-06/07: Understand on a range opens the passage guide with the reader's verses first.
  return <PassageGuide book={span.book} startOrd={span.startOrd} endOrd={span.endOrd} />;
}

/**
 * Grows the sheet to its full view. react-native-screens moves a presented sheet only when its allowed
 * detents change, so the large one alone is offered for a moment and both are offered back once it
 * has settled, leaving the reader free to drag down again.
 */
function useGrowSheet(): () => void {
  const navigation = useNavigation();
  return () => {
    const sheet = navigation.getParent() ?? navigation;
    // The index moves with the detents: [1] with an initial index of 1 is out of bounds, which threw when
    // the sheet opened full (Settings › Open Understand in full; QA, 13 Oct 2026).
    sheet.setOptions({ sheetAllowedDetents: [1], sheetInitialDetentIndex: 0 });
    setTimeout(() => sheet.setOptions({ sheetAllowedDetents: [SHEET_MEDIUM, 1], sheetInitialDetentIndex: 1 }), 450);
  };
}

function VerseSheet({ book, ord, section }: { book: BookCode; ord: number; section?: UnderstandSection }) {
  const core = useCore();
  const { user } = useAppData();
  const log = useLog();
  const ax = useAXLevel() >= 1;
  const [{ large, byReader }, setSize] = useState<SheetSizeValue>({ large: false, headerHeight: 0, byReader: false });
  const translation = useSettings((s) => s.translation);
  const setUnderstandFull = useSettings((s) => s.setUnderstandFull);
  const file = useUnderstandFile(book);
  const grow = useGrowSheet();
  const parts = ordToParts(ord);
  const verseId = verseIdOf(ord);
  const display = formatDisplayRef(parts);

  const [attempt, setAttempt] = useState(0);
  const { data, error } = useQuery(async () => {
    const [texts, tokens, verse, passage] = await Promise.all([getTexts(core, ord), getTokens(core, ord), loadVerse(book, ord), loadPassageFor(book, ord)]);
    return { texts, tokens, verse, passage };
  }, [book, ord, file, attempt]);

  useEffect(() => log("understand_open", verseId), [log, verseId]);
  // The last height the reader chose is remembered (Phase 1): only a drag of theirs counts, never an
  // open at a section or More on this verse. Not at AX sizes, where the sheet always opens large.
  useEffect(() => {
    if (byReader && !ax) setUnderstandFull(large);
  }, [large, byReader, ax, setUnderstandFull]);

  // More on this verse shows the full view whether or not the sheet manages to grow: it only rendered once the
  // sheet reported large, so where the detent change didn't take, the tap did nothing (John, 15 Oct 2026).
  const [more, setMore] = useState(false);
  const full = large || ax || more || section !== undefined;
  useEffect(() => {
    if (section !== undefined && !large && !ax && !useSettings.getState().understandFull && !useSettings.getState().understandOpenFull) grow();
    // Only on open: the reader may drag down afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MM-06: a verse kept before says so under the title, with the day it was kept; never how long ago.
  const { data: kept } = useQuery(() => keptAt(user, verseId), [verseId]);
  const passageLine = data?.passage === undefined || data.passage === null ? undefined : passageSubtitle(data.passage);
  const keptLine = kept === undefined || kept === null ? undefined : `Kept ${formatDay(new Date(kept))}`;
  const subtitle = passageLine !== undefined && keptLine !== undefined ? `${passageLine} · ${keptLine}` : (passageLine ?? keptLine);
  // MM-03 / MS-01 (components/BsbPartner.tsx): the tapped word's BSB partner and the verse's places.
  const marks = useVerseMarks(book, ord, data === undefined ? "" : (verseTextIn(data.texts, translation, isDownloaded(translation)) ?? notInLine(translation)));
  if (data === undefined && error !== undefined) {
    // US-08: the verse in the title, one sentence, Try again; never an empty sheet or an error code.
    return (
      <SheetScreen title={display} subtitle="Understand" backLabel={display} onSize={setSize} testID="understand-failed" {...UNDERSTAND_EXIT}>
        <Prose step="claim" tone="muted">
          This verse’s explanation couldn’t be opened.
        </Prose>
        <Row first chevron={false} onPress={() => setAttempt((n) => n + 1)} testID="understand-retry">
          <Chrome tone="accent" style={{ fontWeight: "600" }}>
            Try again
          </Chrome>
        </Row>
      </SheetScreen>
    );
  }
  if (data === undefined) {
    // The title from the start, so a slow open never shows an empty header (US-08).
    return <SheetScreen title={display} subtitle={subtitle} backLabel={display} onSize={setSize} {...UNDERSTAND_EXIT}>{null}</SheetScreen>;
  }
  const verseText = verseTextIn(data.texts, translation, isDownloaded(translation)) ?? notInLine(translation);
  const fromBsb = bsbStandsIn(data.texts, translation, isDownloaded(translation));
  const layers = data.verse !== null && !isMissingVerse(data.verse) ? data.verse : null;

  return (
    <SheetScreen title={display} subtitle={subtitle} backLabel={display} verseId={verseId} onSize={setSize} testID="understand" {...UNDERSTAND_EXIT}>
      {fromBsb ? (
        <Chrome step="note" tone="muted" style={{ marginBottom: 12 }} testID="bsb-basis">
          {BSB_BASIS}
        </Chrome>
      ) : null}
      {/* VS-07: once the verse is no longer visible above the sheet, it is repeated here at reading size. */}
      {/* Not after More on this verse at half height: the verse is still in view above the sheet. */}
      {large || ax || section !== undefined ? (
        <Scripture style={{ marginBottom: 20 }} accessibilityLabel={`Verse ${parts.verse}, ${spokenText(verseText, translation)}${marks.label}`} testID="verse-repeat">
          <Text style={{ fontSize: 12 }}>{parts.verse} </Text>
          {marks.text}
        </Scripture>
      ) : null}
      {large || ax || section !== undefined ? marks.join : null}
      {layers !== null && (data.texts["BSB"] ?? "").includes("LORD") ? <LordFirstTime verseId={verseId} verse={layers} /> : null}
      {data.verse !== null && isMissingVerse(data.verse) ? <MissingVerseBody verse={data.verse} /> : null}
      {layers !== null ? (
        full ? (
          <FullView book={book} ord={ord} verse={layers} tokens={data.tokens.words.length} bsb={data.texts["BSB"]} section={section} />
        ) : (
          <HalfViewBody
            book={book}
            verse={layers}
            passage={data.passage ?? null}
            onMore={() => {
              setMore(true);
              grow();
            }}
          />
        )
      ) : data.verse === null || isMissingVerse(data.verse) ? (
        <NoUnderstand book={book} ord={ord} file={file} bsb={data.texts["BSB"]} tokens={data.tokens.words.length} />
      ) : null}
    </SheetScreen>
  );
}

/**
 * A verse the BSB leaves out (Mark 9:44, John 5:4): the manuscripts fact where the data has one, and
 * the UST's bracketed line where it keeps the verse; Original and Compare follow (NoUnderstand).
 */
function MissingVerseBody({ verse }: { verse: MissingVerse }) {
  const palette = usePalette();
  if (verse.manuscripts.length === 0 && verse.plain === null) return null;
  return (
    <>
      {verse.manuscripts.length > 0 ? (
        <Section title="Manuscripts" first>
          {verse.manuscripts.map((m) => (
            <Prose key={m} step="claim">
              {m}
            </Prose>
          ))}
        </Section>
      ) : null}
      {verse.plain !== null ? (
        <Section title="In plain words" first={verse.manuscripts.length === 0}>
          <Prose step="explanation" accessibilityLabel={spokenPlain(verse.plain.text)}>
            {plainSegments(verse.plain.text).map((s, i) =>
              s.added ? (
                <Text key={i} style={{ fontStyle: "italic", fontFamily: "LiterataItalic", color: palette.mutedInk }}>
                  {s.text}
                </Text>
              ) : (
                s.text
              ),
            )}
          </Prose>
        </Section>
      ) : null}
      <View style={{ height: 20 }} />
    </>
  );
}

/** "Nicodemus by night · 3:1–21" under the reference (NA-02). */
export function passageSubtitle(passage: Passage): string {
  return `${passage.label} · ${formatRangeInBook(passage.id)}`;
}

function HalfViewBody({ book, verse, passage, onMore }: { book: BookCode; verse: VerseLayers; passage: Passage | null; onMore: () => void }) {
  const half = halfView(verse);
  const readers =
    half.readers.length > 0 ? (
      <Section title={readersLead(verse, half.readersCount)} first={half.readersFirst}>
        {half.readers.map((line) => (
          <Prose key={line.text} step="claim" style={{ marginBottom: 10 }}>
            {line.text}
          </Prose>
        ))}
        {half.readersMore > 0 ? (
          <Chrome step="note" tone="muted">
            {half.readersMore} more in the full view
          </Chrome>
        ) : null}
      </Section>
    ) : null;
  const plain = half.showPlain ? <PlainLine book={book} verse={verse} large={half.plainLarge} first={!half.readersFirst} /> : null;
  return (
    <>
      {half.readersFirst ? readers : plain}
      {half.readersFirst ? plain : null}
      {half.fact !== null ? (
        <Section title="Notice">
          <Prose step="claim">{half.fact}</Prose>
        </Section>
      ) : null}
      {half.readersFirst ? null : readers}
      {half.manuscripts.length > 0 ? (
        <Section title="Manuscripts">
          {half.manuscripts.map((m) => (
            <Prose key={m} step="claim">
              {m}
            </Prose>
          ))}
        </Section>
      ) : null}
      {/* UL-01: the verse's passage read aloud from its first verse, above More on this verse. */}
      {passage !== null ? (
        <View style={{ marginTop: 20 }}>
          <HearPassage book={book} startOrd={passage.startOrd} range={passageSubtitle(passage)} />
        </View>
      ) : null}
      <View style={{ marginTop: passage !== null ? 0 : 20 }}>
        {/* Grows this sheet rather than pushing a page (review §2.3): a disclosure, so ⌄ rather than ›. Without
            it the row read as plain text (UX pass, 15 Oct 2026). */}
        <Row first onPress={onMore} chevron={false} trailing={<Icon name="down" size={16} tone="muted" />} label="More on this verse" hint="Opens the full view" testID="more-on-verse">
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            More on this verse
          </Chrome>
        </Row>
      </View>
    </>
  );
}

/** The plain line, its voice line ("Paul tells them:") and its added words in grey italics (VS-02). */
function PlainLine({ book, verse, large, first }: { book: BookCode; verse: VerseLayers; large: boolean; first: boolean }) {
  const palette = usePalette();
  const core = useCore();
  const script = scriptOf(book);
  const [tip, setTip] = useState(false);
  const ref = parseVerseId(verse.verse);
  const ord = ref === null ? null : verseOrd(ref.book, ref.chapter, ref.verse);
  const { data: letters } = useQuery(async () => (script === "greek" || ord === null ? [] : getLanguageLetters(core, ord, ord)), [ord, script]);
  const plain = verse.beginner.plain;
  if (plain === null) return null;
  const segments = plainSegments(plain.text);
  const tipText = `Added to make the meaning clear. Not in the ${originalLanguage(script, letters ?? [])}.`;
  return (
    <Section title={plainHeading(verse)} first={first}>
      {verse.beginner.voice !== null ? (
        <Chrome step="note" tone="ink" style={{ fontWeight: "600", marginBottom: 4 }}>
          {verse.beginner.voice}
        </Chrome>
      ) : null}
      <Prose
        step={large ? "explanation" : "claim"}
        accessibilityLabel={spokenPlain(plain.text)}
        // The italic words are one tap each on screen; VoiceOver reads the paragraph as one, so the tip
        // is its activate action (QA, 13 Oct 2026).
        {...(segments.some((seg) => seg.added)
          ? {
              accessibilityHint: "Double-tap for what the italic words are",
              accessibilityActions: [{ name: "activate" as const }],
              onAccessibilityAction: () => {
                setTip((v) => !v);
                if (!tip) AccessibilityInfo.announceForAccessibility(tipText);
              },
            }
          : {})}
        testID="plain-line"
        style={large ? null : styles.serif}
      >
        {segments.map((s, i) =>
          s.added ? (
            <Text
              key={i}
              onPress={() => {
                setTip((v) => !v);
                if (!tip) AccessibilityInfo.announceForAccessibility(tipText);
              }}
              style={{ fontStyle: "italic", fontFamily: "LiterataItalic", color: palette.mutedInk }}
            >
              {s.text}
            </Text>
          ) : (
            s.text
          ),
        )}
      </Prose>
      {tip ? (
        // A muted line under the paragraph, not a panel (design rules: no cards); a 44 pt target that closes it.
        <Pressable onPress={() => setTip(false)} accessibilityRole="button" accessibilityHint="Closes this note" style={styles.tip} testID="added-tip">
          <Chrome step="note" tone="muted">
            {tipText}
          </Chrome>
        </Pressable>
      ) : null}
    </Section>
  );
}

function FullView({
  book,
  ord,
  verse,
  tokens,
  bsb,
  section,
}: {
  book: BookCode;
  ord: number;
  verse: VerseLayers;
  tokens: number;
  bsb: string | undefined;
  section?: UnderstandSection;
}) {
  const verseId = verseIdOf(ord);
  const lines = readerLines(verse);
  const readersFirst = verse.beginner.order[0] === "readers_differ" && lines.length > 0;
  const notes = [...translatorNotes(verse), ...verse.facts];
  const study = useVerseStudy(book, ord, bsb);
  const people = study.kind === "ready" ? study.study.people : [];

  const readers =
    lines.length > 0 ? (
      <Section title={readersLead(verse, lines.length)} first={readersFirst}>
        {lines.map((line, i) => (
          <ReadingBlock key={line.text} text={line.text} options={line.reading?.full_note === true ? line.reading.options : []} first={i === 0} />
        ))}
      </Section>
    ) : null;
  const plain = <PlainLine book={book} verse={verse} large={!readersFirst} first={!readersFirst} />;

  return (
    <View testID="understand-full">
      {readersFirst ? readers : plain}
      {readersFirst ? plain : null}
      {verse.beginner.manuscripts.length > 0 ? (
        <Section title="Manuscripts">
          {verse.beginner.manuscripts.map((m) => (
            <Prose key={m} step="claim">
              {m}
            </Prose>
          ))}
        </Section>
      ) : null}
      <GoDeeper book={book} ord={ord} verse={verse} tokens={tokens} section={section} />
      {readersFirst ? null : readers}
      {notes.length > 0 ? (
        <Section title="Notice">
          {notes.map((n) => (
            <Prose key={n} step="claim" style={{ marginBottom: 10 }}>
              {n}
            </Prose>
          ))}
        </Section>
      ) : null}
      {verse.alongside.length > 0 ? (
        <Section title="Read it alongside">
          {verse.alongside.map((ref, i) => (
            <Row key={ref} first={i === 0} onPress={() => router.push({ pathname: "/evidence/peek", params: { ref, from: verseId, note: "" } })} testID={`alongside-${i}`}>
              <Chrome tone="ink" style={{ fontWeight: "500" }}>
                {alongsideLabel(ref)}
              </Chrome>
            </Row>
          ))}
        </Section>
      ) : null}
      {verse.deeper.explained.length > 0 ? (
        <Section title="Explained">
          {verse.deeper.explained.map((e) => (
            <Prose key={e.id} step="claim" style={{ marginBottom: 10 }}>
              {e.text}
            </Prose>
          ))}
        </Section>
      ) : null}
      {people.length > 0 ? (
        <Section title="People and places">
          <PeopleRows people={people} book={book} from={verseId} first />
        </Section>
      ) : null}
      {verse.deeper.check.length > 0 ? <CheckWhatYouRead items={verse.deeper.check} /> : null}
    </View>
  );
}

/** A reading cut at its first sentence keeps the whole note behind "Read the full note" (VS-04). */
function ReadingBlock({ text, options, first }: { text: string; options: readonly string[]; first: boolean }) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  return (
    <View style={[{ paddingVertical: 10 }, first ? null : { boxShadow: `0 -1px 0 ${palette.divider}` }]}>
      <Prose step="claim">{text}</Prose>
      {options.length > 0 ? (
        open ? (
          options.map((o, i) => (
            <Prose key={o} step="claim" tone="muted" style={{ marginTop: 8 }}>
              {`${i + 1}. ${o}`}
            </Prose>
          ))
        ) : (
          <TextLink label="Read the full note" onPress={() => setOpen(true)} />
        )
      ) : null}
    </View>
  );
}

/** Questions from Translation Questions, each answer behind its question. */
function CheckWhatYouRead({ items }: { items: ReadonlyArray<{ q: string; a: string }> }) {
  const [shown, setShown] = useState<ReadonlySet<number>>(new Set());
  return (
    <Section title="Check what you read">
      {items.map((item, i) => (
        <Row
          key={item.q}
          first={i === 0}
          chevron={false}
          onPress={() => setShown((s) => new Set(s.has(i) ? [...s].filter((x) => x !== i) : [...s, i]))}
          label={shown.has(i) ? `${item.q} ${item.a}` : item.q}
          hint={shown.has(i) ? undefined : "Shows the answer"}
        >
          <Prose step="claim">{item.q}</Prose>
          {shown.has(i) ? (
            <Prose step="claim" tone="muted">
              {item.a}
            </Prose>
          ) : null}
        </Row>
      ))}
    </Section>
  );
}

/**
 * Go deeper, in a fixed order (Phase 1): Original · Compare · Study notes · Key words · Sources. Original
 * expands in place; the others push inside this sheet.
 */
function GoDeeper({ book, ord, verse, tokens, section }: { book: BookCode; ord: number; verse: VerseLayers; tokens: number; section?: UnderstandSection }) {
  const translation = useSettings((s) => s.translation);
  const compareWith = useSettings((s) => s.compareWith);
  const installedCodes = useTranslations((s) => s.installed).map((t) => t.code);
  const verseId = verseIdOf(ord);
  const compareOrder = [translation, ...compareSelection(translation, onPhoneOrder(BUILT_IN, installedCodes), compareWith)];
  const study = verse.deeper.study_note;
  const terms = verse.deeper.key_words.map((k) => k.term);
  return (
    <Section title="Go deeper">
      <OriginalRow book={book} ord={ord} tokens={tokens} open={section === "original"} />
      <Row
        onPress={() => router.push({ pathname: "/evidence/translations", params: { ref: verseId } })}
        label={`Compare, ${compareLine(compareOrder)}`}
        testID="open-compare"
      >
        <Chrome tone="ink" style={{ fontWeight: "500" }}>
          Compare
        </Chrome>
        <RowNote>{compareOrder.join(" · ")}</RowNote>
      </Row>
      {study !== null ? (
        <Row onPress={() => router.push({ pathname: "/understand/notes", params: { ref: verseId } })} label="Study notes, Tyndale" testID="open-study-notes">
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            Study notes
          </Chrome>
          <RowNote>Adapted from Tyndale Open Study Notes</RowNote>
        </Row>
      ) : null}
      {terms.length > 0 ? (
        <Row onPress={() => router.push({ pathname: "/understand/key-words", params: { ref: verseId } })} label={`Key words, ${terms.join(", ")}`} testID="open-key-words">
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            Key words
          </Chrome>
          <RowNote>{terms.join(" · ")}</RowNote>
        </Row>
      ) : null}
      <Row onPress={() => router.push("/understand/sources")} label="Sources, every source and licence" testID="open-sources">
        <Chrome tone="ink" style={{ fontWeight: "500" }}>
          Sources
        </Chrome>
        <RowNote>Every source and licence</RowNote>
      </Row>
    </Section>
  );
}

function OriginalRow({ book, ord, tokens, open: initiallyOpen }: { book: BookCode; ord: number; tokens: number; open: boolean }) {
  const core = useCore();
  const palette = usePalette();
  const [open, setOpen] = useState(initiallyOpen);
  const openWord = useSheets((s) => s.openWord);
  const script = scriptOf(book);
  const { data: letters } = useQuery(async () => (script === "greek" ? [] : getLanguageLetters(core, ord, ord)), [ord, script]);
  const language = originalLanguage(script, letters ?? []);
  const verseId = verseIdOf(ord);
  const omission = missingOriginalNote(verseId, script, tokens > 0);
  const second = omission !== null ? "Why no words are shown" : originalLine(tokens, 0);
  const { data } = useQuery(async () => (open ? getTokens(core, ord) : null), [ord, open]);
  return (
    <>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={[`Original ${language}`, second, open ? "expanded" : "collapsed"].join(", ")}
        testID="toggle-original"
        style={({ pressed }) => [styles.disclosure, pressed ? { backgroundColor: palette.fill } : null]}
      >
        <View style={{ flex: 1, minWidth: 0, rowGap: 4 }}>
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            Original {language}
          </Chrome>
          <RowNote>{second}</RowNote>
        </View>
        {/* Swaps rather than rotates, so Reduce Motion needs no branch (brief §5). */}
        <Icon name={open ? "up" : "down"} size={18} tone="muted" />
      </Pressable>
      {open ? (
        <View style={{ paddingVertical: 8 }}>
          {omission !== null ? (
            <Prose step="claim" tone="muted" testID="omission-note">
              {omission}
            </Prose>
          ) : data !== undefined && data !== null ? (
            <>
              <SameFirstWords ord={ord} words={data.words} />
              <OriginalWords
                tokens={data}
                script={script}
                chosen={openWord?.startsWith(`${ord}:`) === true ? Number(openWord.split(":")[1]) : undefined}
                onWord={(word) => {
                  useSheets.getState().setOpenWord(`${word.ord}:${word.position}`);
                  usePartner.getState().setWord(`${word.ord}:${word.position}`);
                  router.push({ pathname: "/evidence/word", params: { ord: String(word.ord), pos: String(word.position), from: verseId } });
                }}
              />
              <Prose step="note" tone="muted" style={{ marginTop: 16 }}>
                {glossCaption(data)}
              </Prose>
            </>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

/**
 * A book whose Understand is not on the phone, or a verse it has nothing for: study notes, People and See
 * also lead (SN-03), then Original and Compare. While the book's file downloads, one quiet line.
 */
function NoUnderstand({ book, ord, file, bsb, tokens }: { book: BookCode; ord: number; file: "ready" | "fetching" | "none"; bsb: string | undefined; tokens: number }) {
  const ax = useAXLevel() >= 1;
  const translation = useSettings((s) => s.translation);
  const compareWith = useSettings((s) => s.compareWith);
  const installedCodes = useTranslations((s) => s.installed).map((t) => t.code);
  const verseId = verseIdOf(ord);
  const study = useVerseStudy(book, ord, bsb);
  const ready = study.kind === "ready" ? study.study : null;
  const people = ready?.people ?? [];
  const seeAlso = useShownSeeAlso(mergeSeeAlso([], ready?.xrefs ?? []));
  const compareOrder = [translation, ...compareSelection(translation, onPhoneOrder(BUILT_IN, installedCodes), compareWith)];
  const status = hasStatusLine(study);
  const led = people.length > 0 || status || (ready?.notes.length ?? 0) > 0 || seeAlso.length > 0;
  const rows: ReactNode = (
    <>
      <OriginalRow book={book} ord={ord} tokens={tokens} open={!led} />
      <Row onPress={() => router.push({ pathname: "/evidence/translations", params: { ref: verseId } })} label={`Compare, ${compareLine(compareOrder)}`} testID="open-compare">
        <Chrome tone="ink" style={{ fontWeight: "500" }}>
          Compare
        </Chrome>
        <RowNote>{compareOrder.join(" · ")}</RowNote>
      </Row>
    </>
  );
  return (
    <>
      {file === "fetching" ? (
        <Chrome step="note" tone="muted" role="status" style={{ marginBottom: 16 }} testID="understand-fetching">
          {`Getting Understand for ${BOOK_CODES[book].name}.`}
        </Chrome>
      ) : null}
      {people.length > 0 ? (
        <Section title="People and places" first>
          <PeopleRows people={people} book={book} from={verseId} first />
        </Section>
      ) : null}
      {status ? <StudyStatus book={book} state={study} first={people.length === 0} /> : null}
      {ready !== null ? <StudyNotesInline study={ready} ord={ord} from={verseId} first={people.length === 0} /> : null}
      <SeeAlsoSection items={seeAlso} from={verseId} ax={ax} first={people.length === 0 && !status && (ready?.notes.length ?? 0) === 0} />
      {led ? <Section title="Go deeper">{rows}</Section> : rows}
    </>
  );
}

const styles = StyleSheet.create({
  serif: { fontFamily: "Literata" },
  tip: {
    minHeight: 44,
    justifyContent: "center",
    marginTop: 4,
  },
  disclosure: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    minHeight: 44,
    paddingVertical: 12,
  },
});


/**
 * MM-11: LORD in small capitals, the first time on this phone. A translation's own preface says what it
 * stands for, quoted exactly and credited: the BSB's pages do not explain it, so the WEB's preface does
 * (ebible.org/eng-web/FRT01.htm, pinned in content/raw/prefaces; approved by John, 13 Oct 2026). Then the
 * key word Yahweh comes first, when the verse has it. Shown once; never again after.
 */
// John chose the second sentence alone (13 Oct 2026): shorter, and still the preface's own words.
const LORD_PREFACE =
  "All other editions of the World English Bible translate the same name as “LORD” (all capital letters), or when used with “Lord” (mixed case, translated from “Adonai”), GOD.";

function LordFirstTime({ verseId, verse }: { verseId: string; verse: VerseLayers }) {
  const { user } = useAppData();
  const { data: show } = useQuery(async () => {
    const first = (await loadSettings(user))["lordSeen"] !== "1";
    if (first) void saveSetting(user, "lordSeen", "1");
    return first;
  }, []);
  if (show !== true) return null;
  const yahweh = verse.deeper.key_words.find((k) => k.term === "Yahweh");
  return (
    <View style={{ marginBottom: 20 }} testID="lord-first-time">
      <Prose step="claim">{LORD_PREFACE}</Prose>
      <Chrome step="note" tone="muted" style={{ marginTop: 4 }}>
        World English Bible, Preface
      </Chrome>
      {yahweh !== undefined ? (
        <Row first onPress={() => router.push({ pathname: "/understand/term", params: { ref: verseId, term: yahweh.term } })} testID="lord-yahweh">
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            Yahweh
          </Chrome>
          <RowNote>{yahweh.definition.split(/(?<=\.)\s/)[0] ?? yahweh.definition}</RowNote>
        </Row>
      ) : null}
    </View>
  );
}

/**
 * MM-02: a verse that opens as Genesis 1:1 opens in the BSB is set over it, each with the original words
 * that carry the phrase (lib/sameWords.ts). Built from the texts and their word-by-word English only.
 */
function SameFirstWords({ ord, words }: { ord: number; words: readonly Token[] }) {
  const core = useCore();
  const genesis = verseOrd("GEN", 1, 1);
  const { data } = useQuery(async () => {
    if (ord === genesis) return null;
    const [here, gen, genTokens] = await Promise.all([getTexts(core, ord), getTexts(core, genesis), getTokens(core, genesis)]);
    const phrase = sharedOpening(here["BSB"] ?? "", gen["BSB"] ?? "");
    return phrase === null ? null : { phrase, here: here["BSB"] ?? "", gen: gen["BSB"] ?? "", genWords: genTokens.words };
  }, [ord]);
  if (data === undefined || data === null) return null;
  const p = ordToParts(ord);
  const pair = (label: string, text: string, tokens: readonly Token[], rest: string, script: "greek" | "hebrew") => (
    <View style={{ marginTop: 16 }}>
      <Label style={{ marginBottom: 4 }}>{label}</Label>
      <Scripture step="claim">
        <Text style={{ fontWeight: "600" }}>{data.phrase}</Text>
        {rest}
      </Scripture>
      {/* Hebrew reads right to left but starts at the left margin, as MM-02 sets it: row-reverse, packed to its end. */}
      <View style={{ flexDirection: script === "hebrew" ? "row-reverse" : "row", justifyContent: script === "hebrew" ? "flex-end" : "flex-start", gap: 14, marginTop: 6 }}>
        {leadingInPhrase(tokens, data.phrase).map((t) => (
          <View key={t.position} style={{ alignItems: "center" }} accessible accessibilityLabel={`${t.translit}, ${t.gloss ?? ""}`}>
            <Original script={script}>{t.surface}</Original>
            <Chrome step="note" tone="muted">
              {t.gloss ?? ""}
            </Chrome>
          </View>
        ))}
      </View>
    </View>
  );
  const firstSentence = (t: string) => t.slice(data.phrase.length);
  return (
    <View style={{ marginBottom: 20 }} testID="same-first-words">
      <Prose step="claim">{`${BOOK_CODES[p.book].name} and Genesis open with the same words in the BSB.`}</Prose>
      {pair(`${BOOK_CODES[p.book].name} ${p.chapter}:${p.verse}`, data.here, words, firstSentence(data.here).split(/(?<=,)/)[0]?.replace(/,$/, "…") ?? "", scriptOf(p.book))}
      {pair("Genesis 1:1", data.gen, data.genWords, firstSentence(data.gen), "hebrew")}
    </View>
  );
}
