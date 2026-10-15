/**
 * The passage guide, no AI (build plan Phase 2; canvas NA-04, JR-05, JR-07, EG-01, UX-06, UX-07, UX-09).
 * The same slots for every kind of writing: In short → Readers differ → Read it alongside → More → Sources.
 *
 * - In short: the headline (What happens / Part of …) and the gated summary, built extractively from
 *   credited sources (docs/no-ai-understand.md). A flagged summary is held back; its facts stay (EG-01).
 *   A psalm's two lines, a prophet's setting line and a letter's "Before this · After this" are its In short.
 * - Readers differ: a passage's approved debate lines, each a source's own sentence.
 * - More: Verse by verse, Study notes (Tyndale moved here), Key words, Check what you read, About this psalm.
 * - Sources: one row at the bottom; credits are never repeated under each line (JR-03).
 * - A range opens its guide with the reader's verses first (UX-06); a range across two passages shows
 *   the first guide and a row to the next (UX-07).
 */

import { BOOK_CODES, type BookCode, type Passage, formatVerseId, ordToParts } from "@yada/schema";
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppData, useLog, useQuery } from "../data/AppData";
import { loadPassageNote } from "../data/passageNote";
import { ensureUnderstand, loadPassages, loadVersesInRange, useUnderstandFile } from "../data/understand";
import { usePalette } from "../design/tokens";
import { formatRange, formatRangeInBook } from "../lib/chapters";
import { guideRows, guideSources, inShort, passagesTouched, versesLabel } from "../lib/passageGuide";
import { plainSegments } from "../lib/understand";
import { HearPassage } from "./HearPassage";
import { PlacesInPassage } from "./PlacesInPassage";
import { useSheetBase } from "./navigation";
import { Row, RowNote, Section, SheetScreen, UNDERSTAND_EXIT } from "./Sheet";
import { Chrome, Prose } from "./Type";

const idOf = (ord: number): string => formatVerseId(ordToParts(ord));

export function PassageGuide({ book, startOrd, endOrd }: { book: BookCode; startOrd: number; endOrd: number }) {
  const log = useLog();
  const { user } = useAppData();
  const base = useSheetBase();
  const file = useUnderstandFile(book);
  const { data } = useQuery(async () => {
    const touched = passagesTouched(await loadPassages(book), startOrd, endOrd);
    const first = touched[0] ?? null;
    const verses = first === null ? [] : await loadVersesInRange(book, first.startOrd, first.endOrd);
    // GD-04: a book whose Understand is not on the phone opens on Tyndale's note on the passage.
    const note = first === null ? await loadPassageNote({ book, pericopeId: "", startOrd, endOrd }) : null;
    return { touched, first, verses, note };
  }, [book, startOrd, endOrd, file]);
  const whole = data?.first != null && data.first.startOrd === startOrd && data.first.endOrd === endOrd;
  useEffect(() => log("passage_open", idOf(startOrd), `${startOrd}-${endOrd}`), [log, startOrd, endOrd]);

  const fallbackTitle = formatRange(`${idOf(startOrd)}-${ordToParts(endOrd).chapter}.${ordToParts(endOrd).verse}`);
  if (data === undefined) return <SheetScreen title={fallbackTitle} backLabel={null} {...UNDERSTAND_EXIT}>{null}</SheetScreen>;
  const passage = data.first;
  if (passage === null) {
    // US-08: never an empty title over an empty body. While the book's file comes down, one line
    // (EG-02); without one, Tyndale's note on the passage (GD-04).
    return (
      <SheetScreen title={fallbackTitle} backLabel={null} testID="guide" {...UNDERSTAND_EXIT}>
        {file === "fetching" ? (
          <Chrome step="note" tone="muted" role="status" testID="guide-fetching">
            {`Getting the guide for ${BOOK_CODES[book].name}.`}
          </Chrome>
        ) : null}
        {/* Offline, or the book's file not offered, with no Tyndale note either: one sentence and Try again,
            never a title over an empty body (US-08; IA stress test, 15 Oct 2026). */}
        {file !== "fetching" && data.note === null ? (
          <>
            <Prose step="claim" tone="muted" testID="guide-unavailable">
              This guide couldn’t be opened.
            </Prose>
            <Row first chevron={false} onPress={() => void ensureUnderstand(user, book, true)} testID="guide-retry">
              <Chrome tone="accent" style={{ fontWeight: "600" }}>
                Try again
              </Chrome>
            </Row>
          </>
        ) : null}
        {data.note !== null ? (
          <Section title="Study notes" first={file !== "fetching"}>
            <Prose step="explanation">{data.note.text}</Prose>
            <Chrome step="note" tone="muted" style={{ marginTop: 8 }}>
              {data.note.credit}
            </Chrome>
          </Section>
        ) : null}
      </SheetScreen>
    );
  }
  const rangeLabel = `${BOOK_CODES[book].name} ${formatRangeInBook(passage.id)}`;
  const yours = whole ? [] : data.verses.filter((v) => v.ord >= startOrd && v.ord <= endOrd);
  const next = data.touched[1] ?? null;

  return (
    <SheetScreen title={passage.label} subtitle={rangeLabel} backLabel={rangeLabel} verseId={idOf(passage.startOrd)} testID="guide" {...UNDERSTAND_EXIT}>
      {yours.length > 0 ? (
        <Section title={`Your verses · ${versesLabel(startOrd, Math.min(endOrd, passage.endOrd))}`} first>
          {yours.map(({ ord, verse }) => (
            <YourVerse key={ord} ord={ord} plain={"missing" in verse ? null : (verse.beginner.plain?.text ?? null)} base={base} />
          ))}
        </Section>
      ) : null}
      <GuideBody passage={passage} first={yours.length === 0} base={base} verseCount={data.verses.length} />
      {next !== null ? (
        <Section title="Your selection continues">
          <Row first onPress={() => router.push({ pathname: `${base}/passage`, params: { ref: `${idOf(next.startOrd)}-${ordToParts(next.endOrd).chapter}.${ordToParts(next.endOrd).verse}` } })} testID="guide-continues">
            <Chrome tone="ink" style={{ fontWeight: "500" }}>
              {next.label}
            </Chrome>
            <RowNote>{`${BOOK_CODES[book].name} ${formatRangeInBook(next.id)} · its guide`}</RowNote>
          </Row>
        </Section>
      ) : null}
    </SheetScreen>
  );
}

function YourVerse({ ord, plain, base }: { ord: number; plain: string | null; base: string }) {
  const palette = usePalette();
  const parts = ordToParts(ord);
  const short = `${parts.chapter}:${parts.verse}`;
  return (
    <Row onPress={() => router.push({ pathname: `${base}/verse`, params: { ref: idOf(ord) } })} label={`More on ${short}${plain === null ? "" : `, ${plain.replace(/[{}]/gu, "")}`}`} testID={`your-verse-${short}`}>
      {/* The plain line is set as it is everywhere else ("In plain words", "In short"); in "claim" it changed face
          between the range and the verse it opens (UX pass, 15 Oct 2026). */}
      <Prose step="explanation">
        <Text style={{ color: palette.mutedInk, fontSize: 12 }}>{`${parts.verse} `}</Text>
        {plain === null
          ? `More on ${short}`
          : plainSegments(plain).map((s, i) =>
              s.added ? (
                <Text key={i} style={{ fontStyle: "italic", color: palette.mutedInk }}>
                  {s.text}
                </Text>
              ) : (
                s.text
              ),
            )}
      </Prose>
    </Row>
  );
}

function GuideBody({ passage, first, base, verseCount }: { passage: Passage; first: boolean; base: string; verseCount: number }) {
  const short = inShort(passage);
  const ref = `${idOf(passage.startOrd)}-${ordToParts(passage.endOrd).chapter}.${ordToParts(passage.endOrd).verse}`;
  const rows = guideRows(passage, verseCount);
  return (
    <>
      {short.headline !== null || short.lines.length > 0 || short.facts.length > 0 ? (
        <Section title="In short" first={first}>
          {short.headline !== null ? (
            <Chrome tone="ink" style={{ fontWeight: "600", marginBottom: 4 }} testID="guide-headline">
              {short.headline}
            </Chrome>
          ) : null}
          {short.lines.map((line) => (
            <Prose key={line} step="explanation" style={{ marginBottom: 6 }}>
              {plainSegments(line).map((s, i) => (s.added ? <Text key={i} style={styles.added}>{s.text}</Text> : s.text))}
            </Prose>
          ))}
          {short.facts.map((f) => (
            <Chrome key={f} step="note" tone="muted" style={{ marginTop: 8 }}>
              {f}
            </Chrome>
          ))}
        </Section>
      ) : null}
      {/* UL-02: under In short, the passage read aloud from its first verse; the sheet closes so the words are in view. */}
      <View style={{ marginTop: 20 }}>
        <HearPassage book={passage.id.split(".")[0] as BookCode} startOrd={passage.startOrd} range={formatRange(passage.id)} />
      </View>
      {passage.debates.length > 0 ? (
        <Section title="Readers differ">
          {passage.debates.map((d) => (
            <Prose key={d.sentence} step="claim" style={{ marginBottom: 10 }}>
              {d.sentence}
            </Prose>
          ))}
        </Section>
      ) : null}
      {/* MS-01 (canvas WM-05). */}
      <PlacesInPassage book={passage.id.split(".")[0] as BookCode} startOrd={passage.startOrd} endOrd={passage.endOrd} />
      {passage.also_told_in.length > 0 ? (
        <Section title="Read it alongside">
          {passage.also_told_in.map((r, i) => (
            <Row key={r} first={i === 0} chevron={false} testID={`also-told-${i}`}>
              <Chrome tone="ink" style={{ fontWeight: "500" }}>
                {r}
              </Chrome>
              {i === 0 ? <RowNote>Also told in</RowNote> : null}
            </Row>
          ))}
        </Section>
      ) : null}
      {/* "Go deeper", as in Understand (IA-12; IA stress test, 15 Oct 2026: one name for one thing). */}
      <Section title="Go deeper">
        {rows.map((row, i) => (
          <Row key={row.page} first={i === 0} onPress={() => router.push({ pathname: `${base}/${row.page}`, params: { ref } })} label={`${row.title}, ${row.note}`} testID={`guide-${row.page}`}>
            <Chrome tone="ink" style={{ fontWeight: "500" }}>
              {row.title}
            </Chrome>
            <RowNote>{row.note}</RowNote>
          </Row>
        ))}
      </Section>
      <View style={{ marginTop: 20 }}>
        <Row first onPress={() => router.push(`${base}/sources`)} label="Sources, every source and licence" testID="guide-sources">
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            Sources
          </Chrome>
          <RowNote>{guideSources()}</RowNote>
        </Row>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  added: { fontStyle: "italic", opacity: 0.6 },
});

