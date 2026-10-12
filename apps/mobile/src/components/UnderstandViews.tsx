/**
 * Understand (depth 1, canvas J01-03, J01-04, J01-06, J01-12, JN-03, GN-02):
 * one sheet over the reader, never five destinations. Original and Compare
 * from the action bar open this same sheet at that section (brief §1 rule 1).
 *
 * Order (brief §8.19, canvas U-01–04, superseding J01-03/04): What's happening →
 * What we can see (reading claims only) → Where readers differ → Go further:
 * Original ⌄ (with the grammar claims under "In the Greek / Hebrew"), Compare
 * translations, the passage, Related passages (pushed). At the medium
 * detent What's happening is clamped to four lines so the first claims sit
 * above the fold while the verse stays visible above the sheet (amendment 1).
 * Explanations are set in Literata (amendment 5).
 *
 * A verse with no entry shows Original and Compare only (amendment 3).
 * Several verses: their passage, or each verse's own entry under its number —
 * never an explanation stitched together from verse entries.
 */

import { BOOK_CODES, type BookCode, type Claim, formatDisplayRef, formatVerseId, ordToParts } from "@yada/schema";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, type ScrollView, StyleSheet, View } from "react-native";

import { useCore, useLog, useQuery } from "../data/AppData";
import { BUILT_IN, getTexts, getTextsInRange, getTokens, isDownloaded, scriptOf } from "../data/queries";
import { useTranslations } from "../data/translations";
import {
  isUnreviewed,
  loadEntriesInRange,
  loadEntry,
  loadPericopes,
  parseEntry,
  parsePericopePayload,
} from "../data/understand";
import { useAXLevel, useLayout, usePalette } from "../design/tokens";
import { formatRange, formatRangeInBook, resolveRef } from "../lib/chapters";
import { compareSelection } from "../lib/compare";
import { compareLine, originalLine, passageLine } from "../lib/goFurther";
import { mergeSeeAlso, OPENBIBLE_LINE } from "../lib/study";
import { missingOriginalNote } from "../lib/omissions";
import { pericopeForVerse, resolvePassage } from "../lib/pericopes";
import { spokenText } from "../lib/supplied";
import { BSB_BASIS, bsbStandsIn, notInLine, onPhoneOrder, verseTextIn } from "../lib/translations";
import { useSettings } from "../state/settings";
import { useSheets } from "../state/sheets";
import { ClaimRows, groupClaims } from "./Claims";
import { Icon } from "./Icon";
import { glossCaption, OriginalWords } from "./OriginalWords";
import { Row, RowNote, Section, SheetScreen, type SheetSizeValue, TextLink, UNDERSTAND_EXIT } from "./Sheet";
import {
  hasStatusLine,
  useShownSeeAlso,
  PeopleRows,
  SeeAlsoRow,
  SeeAlsoSection,
  StudyNotesInline,
  StudyRows,
  StudyStatus,
  useVerseStudy,
} from "./StudyLayer";
import { Chrome, Label, Prose, Scripture } from "./Type";

const FIRST_SCREEN_SEEN = 3;
const FIRST_SCREEN_DIFFERS = 2;

export type UnderstandSection = "original" | "compare";

const verseIdOf = (ord: number): string => formatVerseId(ordToParts(ord));

/** Pushes the whole pericope onto the same sheet (brief §1 rule 1: one sheet, never a new destination). */
function openPassage(pericope: { start_ord: number; end_ord: number }): void {
  const p = ordToParts(pericope.start_ord);
  const q = ordToParts(pericope.end_ord);
  router.push({ pathname: "/understand/passage", params: { ref: `${p.book}.${p.chapter}.${p.verse}-${q.chapter}.${q.verse}` } });
}

/**
 * `subtitle`: a verse pushed inside its passage guide names the passage under its own title (PG-04).
 * `onPassage`: what its passage row does there. Inside the guide the passage is the screen
 * underneath, so the row goes back to it rather than opening a second passage sheet (package F).
 */
export function UnderstandRoute({
  refText,
  section,
  subtitle,
  onPassage,
  inGuide = false,
}: {
  refText: string;
  section?: UnderstandSection;
  subtitle?: string;
  onPassage?: () => void;
  /**
   * Pushed inside the passage guide (PG-04): the guide already shows the passage, so no verse line,
   * no first-time hint and no Supported / Background labels (John, 11 Oct 2026: "Background"
   * meant nothing to a reader).
   */
  inGuide?: boolean;
}) {
  const span = resolveRef(refText);
  if (span === null) return null;
  if (span.startOrd === span.endOrd) return <VerseUnderstand book={span.book} ord={span.startOrd} section={section} subtitle={subtitle} onPassage={onPassage} inGuide={inGuide} />;
  return <PassageUnderstand book={span.book} startOrd={span.startOrd} endOrd={span.endOrd} refText={refText} />;
}

function VerseUnderstand({
  book,
  ord,
  section,
  subtitle,
  onPassage,
  inGuide,
}: {
  book: BookCode;
  ord: number;
  section?: UnderstandSection;
  subtitle?: string;
  onPassage?: () => void;
  inGuide: boolean;
}) {
  const core = useCore();
  const log = useLog();
  const palette = usePalette();
  const { sectionGap } = useLayout();
  const ax = useAXLevel() >= 1;
  // Not useSheetSize: this component renders the SheetScreen, so the context never reaches it
  // here, and it read the defaults (header 0, never large) and landed sections under the header.
  const [{ large, headerHeight }, setSize] = useState<SheetSizeValue>({ large: false, headerHeight: 0 });
  const translation = useSettings((s) => s.translation);
  const compareWith = useSettings((s) => s.compareWith);
  const installedCodes = useTranslations((s) => s.installed).map((t) => t.code);
  const evidenceHintSeen = useSettings((s) => s.evidenceHintSeen);
  const markEvidenceHintSeen = useSettings((s) => s.markEvidenceHintSeen);
  const openWord = useSheets((s) => s.openWord);
  const parts = ordToParts(ord);
  const verseId = verseIdOf(ord);
  const display = formatDisplayRef(parts);
  const script = scriptOf(book);
  const language = script === "hebrew" ? "Hebrew" : "Greek";

  const { data } = useQuery(async () => {
    const [texts, tokens, loaded, pericopes] = await Promise.all([
      getTexts(core, ord),
      getTokens(core, ord),
      loadEntry(book, verseId),
      loadPericopes(book),
    ]);
    return { texts, tokens, loaded, pericope: pericopeForVerse(pericopes, ord) };
  }, [book, ord]);

  const [originalOpen, setOriginalOpen] = useState(section === "original");
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [verseOpen, setVerseOpen] = useState(false);
  // The first-time evidence hint shows on this sheet and never again (brief §2).
  // Not inside the guide, so the hint is still there the first time Understand opens on its own.
  const [showHint] = useState(!evidenceHintSeen && !inGuide);
  useEffect(() => {
    if (showHint) markEvidenceHintSeen();
  }, [showHint, markEvidenceHintSeen]);
  useEffect(() => log("understand_open", verseId), [log, verseId]);
  const study = useVerseStudy(book, ord, data?.texts["BSB"]);
  // Before the early return below: a hook, and See also's count must not jump once texts arrive.
  const shownSeeAlso = useShownSeeAlso(
    mergeSeeAlso(relatedSpans(data?.loaded?.entry.related_passages ?? []), study.kind === "ready" ? study.study.xrefs : []),
  );
  // A verse with no entry has nothing above the Original to read, so it opens (amendment 3, N-01),
  // unless Study notes now lead (canvas SN-03): then there is something to read first.
  const studyLeads = study.kind === "ready" && study.study.notes.length > 0;
  const studySettled = study.kind !== "loading" && study.kind !== "fetching";
  useEffect(() => {
    if (data !== undefined && data.loaded === null && studySettled && !studyLeads) setOriginalOpen(true);
  }, [data, studySettled, studyLeads]);

  const scroll = useRef<ScrollView>(null);
  // The section moves while the sheet settles (What's happening clamps once the detent is
  // known), so it re-lands on each move for the first moments, then never again.
  const landUntil = useRef(Date.now() + 800);
  // Compare sits inside Go further, so its layout y is relative to the group: both are kept.
  const offsets = useRef({ further: 0, compare: 0 });
  const land = () => {
    if (section === undefined || Date.now() > landUntil.current) return;
    const y = section === "original" ? offsets.current.further : offsets.current.further + offsets.current.compare;
    // Jumps land instantly (brief §5 Reduce Motion; and a sheet opening is motion enough).
    requestAnimationFrame(() => scroll.current?.scrollTo({ y: Math.max(0, y - headerHeight - 8), animated: false }));
  };

  if (data === undefined) return <SheetScreen title={display} subtitle={subtitle} backLabel={display} {...UNDERSTAND_EXIT}>{null}</SheetScreen>;
  const { texts, tokens, loaded, pericope } = data;
  const entry = loaded?.entry ?? null;
  const groups = entry === null ? null : groupClaims(entry.claims);
  const grammar = groups?.grammar ?? [];
  const omission = missingOriginalNote(verseId, script, tokens.words.length > 0);
  // A downloaded version without this verse says so, muted like the line itself, rather than
  // showing BSB's words while the reader is reading ASV (lib/translations.ts, verseTextIn).
  const verseText = verseTextIn(texts, translation, isDownloaded(translation)) ?? notInLine(translation);
  const fromBsb = bsbStandsIn(texts, translation, isDownloaded(translation));
  const unreviewed = loaded !== null && isUnreviewed(loaded.reviewStatus);
  // Medium detent, default sizes: four lines and More. Large or AX: in full.
  const clamp = !large && !ax && !explanationOpen;
  const originalSecond = omission !== null ? "Why no words are shown" : originalLine(tokens.words.length, grammar.length);
  const compareOrder = [translation, ...compareSelection(translation, onPhoneOrder(BUILT_IN, installedCodes), compareWith)];
  const related = entry?.related_passages ?? [];

  const openClaim = (claim: Claim) =>
    router.push({ pathname: "/evidence/why", params: { verse: verseId, claim: claim.id } });
  const openReadings = (claim: Claim) =>
    router.push({ pathname: "/evidence/readings", params: { verse: verseId, claim: claim.id } });

  const original = (
    <>
      <Pressable
        onPress={() => setOriginalOpen((v) => !v)}
        accessibilityRole="button"
        // The state is spoken in the label ("Original Greek, 3 notes, collapsed", brief §8.19):
        // the count is hidden on screen at AX sizes, so VoiceOver must carry it regardless.
        accessibilityLabel={[`Original ${language}`, originalSecond, originalOpen ? "expanded" : "collapsed"].join(", ")}
        testID="toggle-original"
        style={({ pressed }) => [styles.disclosure, pressed ? { backgroundColor: palette.fill } : null]}
      >
        {/* Canvas SN-09: the same object as every Go further row, name and one muted line, with
            a bare chevron that turns down to up when open. It still expands in place. */}
        <View style={{ flex: 1, minWidth: 0, rowGap: 4 }}>
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            Original {language}
          </Chrome>
          <RowNote>
            {originalSecond}
          </RowNote>
        </View>
        {/* Swaps rather than rotates, so Reduce Motion needs no branch (brief §5). */}
        <Icon name={originalOpen ? "up" : "down"} size={18} tone="muted" />
      </Pressable>
      {originalOpen ? (
        <View style={{ paddingTop: 8, paddingBottom: 8 }}>
          {omission !== null ? (
            <Prose step="claim" tone="muted" testID="omission-note">
              {omission}
            </Prose>
          ) : (
            <>
              <OriginalWords
                tokens={tokens}
                script={script}
                chosen={openWord?.startsWith(`${ord}:`) === true ? Number(openWord.split(":")[1]) : undefined}
                onWord={(word) => {
                  useSheets.getState().setOpenWord(`${word.ord}:${word.position}`);
                  router.push({ pathname: "/evidence/word", params: { ord: String(word.ord), pos: String(word.position), from: verseId } });
                }}
              />
              <Prose step="note" tone="muted" style={{ marginTop: 16 }}>
                {glossCaption(tokens)}
              </Prose>
            </>
          )}
          {/* The parse and apparatus claims, moved here from What we can see (brief §8.19, U-03):
              the same rows, each still opening Why we say this. */}
          {grammar.length > 0 ? (
            <View style={{ marginTop: sectionGap }}>
              <Label style={{ marginBottom: 6 }}>In the {language}</Label>
              <ClaimRows claims={grammar} cap={grammar.length} onOpen={openClaim} onReadings={openReadings} labels={!inGuide} />
            </View>
          ) : null}
          {entry !== null ? (
            <View style={{ marginTop: sectionGap }}>
              <Label style={{ marginBottom: 6 }}>Closer to the {language}</Label>
              <Scripture style={{ fontSize: 19, lineHeight: 28 }}>{entry.close_rendering}</Scripture>
              <Prose step="note" tone="muted" style={{ marginTop: 6 }}>
                Composed, not a word-for-word gloss.
              </Prose>
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );

  // Study notes after the UX pass (canvas SN-01, SN-03): with a Yada entry, People, Study notes
  // and See also are rows in Go further and Understand keeps its shape; without one, they lead,
  // inline. Related passages are See also's first rows, not a row of their own.
  const ready = study.kind === "ready" ? study.study : null;
  const people = ready?.people ?? [];

  const further = (
    <>
      {original}
      {/* Canvas SN-01: Study notes and See also sit straight after Original, before Compare;
          People come first of the three, as they lead without an entry (TD-01). */}
      {entry !== null ? (
        <>
          <PeopleRows people={people} book={book} from={verseId} first={false} />
          <StudyRows study={ready} seeAlso={shownSeeAlso.length} from={verseId} />
        </>
      ) : null}
      <View
        onLayout={(e) => {
          offsets.current.compare = e.nativeEvent.layout.y;
          land();
        }}
      >
        <Row
          onPress={() => router.push({ pathname: "/evidence/translations", params: { ref: verseId } })}
          label={`Compare translations, ${compareLine(compareOrder)}`}
          testID="open-compare"
        >
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            Compare translations
          </Chrome>
          <RowNote>
            {compareLine(compareOrder)}
          </RowNote>
        </Row>
      </View>
      {pericope !== null ? (
        <Row
          onPress={onPassage ?? (() => openPassage(pericope))}
          label={`${pericope.label}, ${passageLine(formatRangeInBook(pericope.pericope_id))}`}
          testID="open-passage"
        >
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            {pericope.label}
          </Chrome>
          <RowNote>
            {passageLine(formatRangeInBook(pericope.pericope_id))}
          </RowNote>
        </Row>
      ) : null}
    </>
  );

  const status = hasStatusLine(study);
  const notesLead = ready !== null && ready.notes.length > 0;
  const leads =
    entry === null ? (
      <>
        {people.length > 0 ? (
          <Section title="People" first>
            <PeopleRows people={people} book={book} from={verseId} first />
          </Section>
        ) : null}
        {status ? <StudyStatus book={book} state={study} first={people.length === 0} /> : null}
        {ready !== null ? <StudyNotesInline study={ready} ord={ord} from={verseId} first={people.length === 0} /> : null}
        <SeeAlsoSection items={shownSeeAlso} from={verseId} ax={ax} first={people.length === 0 && !status && !notesLead} />
      </>
    ) : null;
  const led = entry === null && (people.length > 0 || status || notesLead || shownSeeAlso.length > 0);

  return (
    <SheetScreen title={display} subtitle={subtitle} unreviewed={unreviewed} backLabel={display} verseId={verseId} scrollRef={scroll} onSize={setSize} testID="understand" {...UNDERSTAND_EXIT}>
      {fromBsb ? (
        <Chrome step="note" tone="muted" style={{ marginBottom: 12 }} testID="bsb-basis">
          {BSB_BASIS}
        </Chrome>
      ) : null}
      {/* Large detent: the verse is no longer visible above the sheet, so one line of it here. */}
      {large && entry !== null && !inGuide ? (
        ax ? (
          <Pressable
            onPress={() => setVerseOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: verseOpen }}
            style={[styles.showVerse, { backgroundColor: palette.fill }]}
          >
            <Chrome tone="ink" style={{ fontWeight: "500" }}>
              {verseOpen ? "Hide verse" : "Show verse"}
            </Chrome>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setVerseOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={spokenText(verseText, translation)}
            accessibilityHint={verseOpen ? "Shows one line" : "Shows the whole verse"}
            style={styles.verseLine}
          >
            <Scripture step="explanation" tone="muted" numberOfLines={verseOpen ? undefined : 1} style={{ flex: 1 }}>
              {verseText}
            </Scripture>
            <Icon name="down" size={16} tone="muted" />
          </Pressable>
        )
      ) : null}
      {large && ax && verseOpen && !inGuide ? (
        <Scripture step="explanation" tone="muted" style={{ marginBottom: 16 }}>
          {verseText}
        </Scripture>
      ) : null}

      {entry !== null ? (
        <Section title="What’s happening" first>
          <Prose step="explanation" numberOfLines={clamp ? 4 : undefined} testID="whats-happening">
            {entry.whats_happening}
          </Prose>
          {clamp ? <TextLink label="More" a11yLabel="More of what’s happening" onPress={() => setExplanationOpen(true)} /> : null}
        </Section>
      ) : null}

      {/* Reading claims only: Show all counts these, not the grammar notes under Original (§8.19). */}
      {groups !== null && groups.seen.length > 0 ? (
        <Section title="What we can see" hint={showHint ? "Tap a line to see the evidence." : undefined}>
          <ClaimRows claims={groups.seen} cap={FIRST_SCREEN_SEEN} onOpen={openClaim} onReadings={openReadings} labels={!inGuide} />
        </Section>
      ) : null}

      {groups !== null && groups.differs.length > 0 ? (
        <Section title="Where readers differ">
          <ClaimRows claims={groups.differs} cap={FIRST_SCREEN_DIFFERS} onOpen={openClaim} onReadings={openReadings} labels={!inGuide} />
        </Section>
      ) : null}

      {leads}

      {/* Canvas SN-04–06: the one line has its own place straight above Go further, never under
          the last row where the sheet's foot hides it. */}
      {entry !== null && status ? <StudyStatus book={book} state={study} /> : null}

      <View
        onLayout={(e) => {
          offsets.current.further = e.nativeEvent.layout.y;
          land();
        }}
      >
        {/* A verse with neither an entry nor study notes has nothing to go further from: Original
            and Compare stand alone (amendment 3). */}
        {entry !== null || led ? <Section title="Go further">{further}</Section> : further}
      </View>
    </SheetScreen>
  );
}

/** Yada's related passages as spans for See also; one whose ref cannot be read is left out. */
function relatedSpans(related: ReadonlyArray<{ ref: string; note?: string | undefined }>) {
  return related.flatMap((r) => {
    const span = resolveRef(r.ref);
    return span === null ? [] : [{ ref: r.ref, note: r.note ?? null, start: span.startOrd, end: span.endOrd }];
  });
}

/**
 * See also, all of it (canvas SN-08): Yada's related passages, then OpenBible's, pushed inside the
 * Understand sheet; ‹ goes back. Unreviewed only when Yada's own rows are here and unreviewed.
 */
export function SeeAlsoRoute({ refText }: { refText: string }) {
  const span = resolveRef(refText);
  if (span === null) return null;
  return <SeeAlsoPage book={span.book} ord={span.startOrd} />;
}

function SeeAlsoPage({ book, ord }: { book: BookCode; ord: number }) {
  const core = useCore();
  const ax = useAXLevel() >= 1;
  const verseId = verseIdOf(ord);
  const display = formatDisplayRef(ordToParts(ord));
  const { data } = useQuery(async () => ({ loaded: await loadEntry(book, verseId), texts: await getTexts(core, ord) }), [book, verseId]);
  const study = useVerseStudy(book, ord, data?.texts["BSB"]);
  const loaded = data?.loaded ?? null;
  const related = relatedSpans(loaded?.entry.related_passages ?? []);
  const items = useShownSeeAlso(mergeSeeAlso(related, study.kind === "ready" ? study.study.xrefs : []));
  const unreviewed = loaded !== null && related.length > 0 && isUnreviewed(loaded.reviewStatus);

  return (
    <SheetScreen title="See also" subtitle={display} unreviewed={unreviewed} backLabel={display} verseId={verseId} testID="see-also" {...UNDERSTAND_EXIT}>
      {items.map((item, i) => (
        <SeeAlsoRow key={`${item.source}-${item.start}-${item.end}`} item={item} from={verseId} first={i === 0} ax={ax} />
      ))}
      {items.some((item) => item.source === "openbible") ? (
        <Chrome step="note" tone="muted" style={{ marginTop: 8 }} testID="openbible-source">
          {OPENBIBLE_LINE}
        </Chrome>
      ) : null}
    </SheetScreen>
  );
}

/**
 * Several verses (J01-12, JN-07): the passage's own payload when there is
 * one; otherwise its label and each verse entry inside the selection under a
 * small number, with `More on 14:34` to that verse's Understand, pushed
 * inside this sheet.
 */
function PassageUnderstand({ book, startOrd, endOrd, refText }: { book: BookCode; startOrd: number; endOrd: number; refText: string }) {
  const log = useLog();
  const { sectionGap } = useLayout();
  const display = formatRange(refText);
  const firstId = verseIdOf(startOrd);
  const core = useCore();

  const { data } = useQuery(async () => {
    const [pericopes, entries, verses] = await Promise.all([
      loadPericopes(book),
      loadEntriesInRange(book, startOrd, endOrd),
      getTextsInRange(core, startOrd, endOrd),
    ]);
    return { resolution: resolvePassage(pericopes, entries, startOrd, endOrd), verses };
  }, [book, startOrd, endOrd]);

  useEffect(() => log("passage_open", firstId, refText), [log, firstId, refText]);

  if (data === undefined) return <SheetScreen title={display} backLabel={display} {...UNDERSTAND_EXIT}>{null}</SheetScreen>;
  const { resolution } = data;
  const rows = [...resolution.pericopes.flatMap((p) => p.entries), ...resolution.loose];
  const anyUnreviewed =
    rows.some((r) => isUnreviewed(parseEntry(r)?.reviewStatus)) ||
    resolution.pericopes.some(({ pericope }) => parsePericopePayload(pericope) !== null && isUnreviewed(pericope.review_status));

  return (
    <SheetScreen title={display} unreviewed={anyUnreviewed} backLabel={display} verseId={firstId} testID="passage-understand" {...UNDERSTAND_EXIT}>
      {resolution.pericopes.length === 0 && resolution.loose.length === 0 ? (
        <Prose step="claim" tone="muted" testID="no-entry">
          No verse in this selection has an explanation yet.
        </Prose>
      ) : null}

      {resolution.pericopes.map(({ pericope, entries }, i) => {
        const payload = parsePericopePayload(pericope);
        const label = `${pericope.label} · ${formatRangeInBook(pericope.pericope_id)}`;
        // J01-12: a selection inside a passage offers the whole of it; once the selection is the
        // passage there is nowhere further to go, so the label stays plain text.
        const whole = startOrd === pericope.start_ord && endOrd === pericope.end_ord;
        return (
          <View key={pericope.pericope_id} style={{ marginTop: i === 0 ? 0 : sectionGap }}>
            {whole ? (
              <Chrome tone="muted" style={{ fontWeight: "500", marginBottom: 4 }}>
                {label}
              </Chrome>
            ) : (
              <Row first onPress={() => openPassage(pericope)} testID={`open-passage-${pericope.pericope_id}`}>
                <Chrome tone="ink" style={{ fontWeight: "500" }}>
                  {label}
                </Chrome>
              </Row>
            )}
            {payload !== null ? (
              <>
                <Prose step="explanation" style={{ marginTop: 8 }}>
                  {payload.summary_one_sentence}
                </Prose>
                {payload.movement !== undefined && payload.movement.length > 0 ? (
                  <Section title="How the passage moves">
                    {payload.movement.map((step) => (
                      <View key={step.range} style={styles.movement}>
                        <Prose step="note" tone="muted" style={{ minWidth: 64 }}>
                          {formatRangeInBook(step.range)}
                        </Prose>
                        <Prose step="claim" style={{ flex: 1 }}>
                          {step.label}
                        </Prose>
                      </View>
                    ))}
                  </Section>
                ) : null}
                {payload.key_ideas.length > 0 ? (
                  <Section title="Key ideas">
                    {payload.key_ideas.map((idea) => (
                      <Prose key={idea} step="claim" style={{ marginBottom: 6 }}>
                        {idea}
                      </Prose>
                    ))}
                  </Section>
                ) : null}
              </>
            ) : null}
            {entries.map((row) => (
              <VerseEntrySummary key={row.verse_id} row={row} book={book} />
            ))}
          </View>
        );
      })}

      {resolution.loose.map((row) => (
        <VerseEntrySummary key={row.verse_id} row={row} book={book} />
      ))}
    </SheetScreen>
  );
}

function VerseEntrySummary({ row, book }: { row: Parameters<typeof parseEntry>[0]; book: BookCode }) {
  const { sectionGap } = useLayout();
  const loaded = parseEntry(row);
  if (loaded === null) return null;
  const parts = ordToParts(row.ord);
  const short = `${parts.chapter}:${parts.verse}`;
  return (
    <View style={{ marginTop: sectionGap }}>
      <Label style={{ marginBottom: 6 }} accessibilityLabel={`${BOOK_CODES[book].name} ${short}`}>
        {short}
      </Label>
      <Prose step="explanation">{loaded.entry.whats_happening}</Prose>
      <TextLink
        label={`More on ${short}`}
        onPress={() => router.push({ pathname: "/understand/verse", params: { ref: row.verse_id } })}
        testID={`more-on-${row.verse_id}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  verseLine: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    minHeight: 44,
    marginBottom: 12,
  },
  showVerse: {
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 999,
    justifyContent: "center",
    marginBottom: 16,
  },
  disclosure: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    minHeight: 44,
    paddingVertical: 12,
  },
  movement: {
    flexDirection: "row",
    columnGap: 16,
    marginBottom: 6,
  },
});
