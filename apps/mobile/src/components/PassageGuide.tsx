/**
 * The passage guide, no AI (build plan Phase 2; canvas NA-04, JR-05, UL-02, UL-04, ON-04, UX-06, UX-07).
 * The same slots for every kind of writing: In short → Hear this passage → Readers differ → Read it alongside →
 * Go deeper → Sources → Next.
 *
 * - In short: the headline (What happens / Part of …) and the gated summary, built extractively from
 *   credited sources (docs/no-ai-understand.md). A flagged summary is held back; its facts stay (EG-01).
 *   A psalm's two lines, a prophet's setting line and a letter's "Before this · After this" are its In short.
 * - Readers differ: a passage's approved debate lines, each a source's own sentence.
 * - Go deeper: Verse by verse, Study notes, Key words, Check what you read, About this psalm, each only where
 *   its page has something (UL-04: nothing empty, nothing promised).
 * - Sources: one row; credits are never repeated under each line (JR-03).
 * - Next: the passage after this one, one tap; the guide turns to it and the reader under the sheet follows,
 *   so × lands on the passage just guided through (ON-04, state/guide.ts).
 * - A range opens its guide with the reader's verses first (UX-06); a range across two passages shows
 *   the first guide and a row to the next (UX-07).
 */

import { BOOK_CODES, type BookCode, type Passage, formatVerseId, isMissingVerse, ordToParts } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppData, useLog, useQuery } from "../data/AppData";
import { loadPassageNote } from "../data/passageNote";
import { loadRangeNotes, useStudy } from "../data/study";
import { ensureUnderstand, loadPassages, loadVersesInRange, useUnderstandFile } from "../data/understand";
import { useLayout, usePalette } from "../design/tokens";
import { FONTS } from "../design/type";
import { formatRange, formatRangeInBook, printedRef } from "../lib/chapters";
import { guideRows, guideSources, inShort, passageAfter, passageRef, passagesTouched, versesLabel } from "../lib/passageGuide";
import { alongsideLabel, offlineLine, plainSegments } from "../lib/understand";
import { useGuide } from "../state/guide";
import { HearPassage } from "./HearPassage";
import { ListRow } from "./Page";
import { PlacesInPassage } from "./PlacesInPassage";
import { useSheetBase } from "./navigation";
import { Row, RowNote, Section, SheetScreen, TextCapsule, UNDERSTAND_EXIT } from "./Sheet";
import { Chrome, Prose } from "./Type";

const idOf = (ord: number): string => formatVerseId(ordToParts(ord));

export function PassageGuide({ book, startOrd, endOrd }: { book: BookCode; startOrd: number; endOrd: number }) {
  const log = useLog();
  const { user } = useAppData();
  const base = useSheetBase();
  const file = useUnderstandFile(book);
  const study = useStudy((s) => s.installed[book]?.file ?? "");
  // The reader under this sheet, when it opened the guide: Next moves it too (ON-04).
  const { reader } = useLocalSearchParams<{ reader?: string }>();
  const { data } = useQuery(async () => {
    const passages = await loadPassages(book);
    const touched = passagesTouched(passages, startOrd, endOrd);
    const first = touched[0] ?? null;
    const verses = first === null ? [] : await loadVersesInRange(book, first.startOrd, first.endOrd);
    // GD-04: a book whose Understand is not on the phone opens on Tyndale's note on the passage.
    const note = first === null ? await loadPassageNote({ book, pericopeId: "", startOrd, endOrd }) : null;
    const notes = first === null ? null : await loadRangeNotes(book, first.startOrd, first.endOrd);
    const layers = verses.flatMap(({ verse }) => (isMissingVerse(verse) ? [] : [verse]));
    const content = {
      studyNotes: (notes?.length ?? 0) > 0,
      keyWords: layers.some((v) => v.deeper.key_words.length > 0),
      check: layers.some((v) => v.deeper.check.length > 0),
    };
    return { touched, first, verses, note, content, after: first === null ? null : passageAfter(passages, first) };
  }, [book, startOrd, endOrd, file, study]);
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
        {file === "offline" ? (
          <Chrome step="note" tone="muted" role="status" testID="guide-offline">
            {offlineLine(BOOK_CODES[book].name)}
          </Chrome>
        ) : null}
        {file !== "fetching" && file !== "offline" && data.note === null ? (
          <>
            <Prose step="claim" tone="muted" testID="guide-unavailable">
              This guide couldn’t be opened.
            </Prose>
            {/* US-08's grey capsule, not an accent row. */}
            <View style={{ marginTop: 12 }}>
              <TextCapsule label="Try again" onPress={() => void ensureUnderstand(user, book, true)} testID="guide-retry" />
            </View>
          </>
        ) : null}
        {data.note !== null ? (
          <Section title="Study notes" first={file !== "fetching" && file !== "offline"}>
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
  const after = data.after;

  const followNext = (to: Passage) => {
    const at = ordToParts(to.startOrd);
    if (reader !== undefined) useGuide.getState().setFollow({ reader, book: at.book, chapter: at.chapter, verse: at.verse === 0 ? 1 : at.verse });
    // The guide turns to the next passage in place, as one sheet: no pile of guides behind ‹.
    router.setParams({ ref: passageRef(to) });
  };

  return (
    <SheetScreen title={passage.label} subtitle={rangeLabel} backLabel={rangeLabel} verseId={idOf(passage.startOrd)} testID="guide" {...UNDERSTAND_EXIT}>
      {yours.length > 0 ? (
        <Section title={`Your verses · ${versesLabel(startOrd, Math.min(endOrd, passage.endOrd))}`} first>
          {yours.map(({ ord, verse }) => (
            <YourVerse key={ord} ord={ord} plain={"missing" in verse ? null : (verse.beginner.plain?.text ?? null)} base={base} />
          ))}
        </Section>
      ) : null}
      <GuideBody passage={passage} first={yours.length === 0} base={base} verseCount={data.verses.length} content={data.content} />
      {next !== null ? (
        <Section title="Your selection continues">
          <Row first onPress={() => router.push({ pathname: `${base}/passage`, params: { ref: passageRef(next) } })} testID="guide-continues">
            <Chrome tone="ink" style={{ fontWeight: "500" }}>
              {next.label}
            </Chrome>
            <RowNote>{`${BOOK_CODES[book].name} ${formatRangeInBook(next.id)} · its guide`}</RowNote>
          </Row>
        </Section>
      ) : after !== null ? (
        <NextPassage passage={after} onPress={() => followNext(after)} />
      ) : null}
    </SheetScreen>
  );
}

/**
 * The guide's last row (ON-04, UW-02 `.lrow.nx`): "Next · 1:19–34" in accent over the passage's title in
 * Literata, its own section after Sources. Start here's Next row marks the same thing the same way (PG-06).
 */
function NextPassage({ passage, onPress }: { passage: Passage; onPress: () => void }) {
  const { sectionGap } = useLayout();
  const book = BOOK_CODES[ordToParts(passage.startOrd).book].name;
  const range = formatRangeInBook(passage.id);
  return (
    <View style={{ marginTop: sectionGap }}>
      <ListRow first onPress={onPress} label={`Next, ${passage.label}, ${book} ${range.replace("–", " to ")}. Opens its guide`} testID="guide-next">
        <Chrome step="note" tone="accent" style={{ fontWeight: "600" }}>
          {`Next · ${range}`}
        </Chrome>
        <Chrome tone="ink" style={styles.nextTitle} maxFontSizeMultiplier={2.2}>
          {passage.label}
        </Chrome>
      </ListRow>
    </View>
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

function GuideBody({
  passage,
  first,
  base,
  verseCount,
  content,
}: {
  passage: Passage;
  first: boolean;
  base: string;
  verseCount: number;
  content: { studyNotes: boolean; keyWords: boolean; check: boolean };
}) {
  const { sectionGap } = useLayout();
  const short = inShort(passage);
  const ref = passageRef(passage);
  const rows = guideRows(passage, verseCount, content);
  const from = idOf(passage.startOrd);
  return (
    <>
      {short.headline !== null || short.lines.length > 0 || short.facts.length > 0 ? (
        <Section title="In short" first={first}>
          {short.headline !== null ? (
            // UL-02 `.claim b`: the headline in bold at claim size, above the Literata lines.
            <Prose step="claim" style={{ fontWeight: "700", marginBottom: 4 }} testID="guide-headline">
              {short.headline}
            </Prose>
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
      <HearPassage book={passage.id.split(".")[0] as BookCode} startOrd={passage.startOrd} range={formatRange(passage.id)} />
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
      <AlongsideRows refs={passage.also_told_in} from={from} />
      {/* "Go deeper", as in Understand (IA-12; IA stress test, 15 Oct 2026: one name for one thing). */}
      {rows.length > 0 ? (
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
      ) : null}
      {/* Its own section, one section gap below Go deeper (UL-02, UL-04). */}
      <View style={{ marginTop: sectionGap }}>
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

/**
 * Read it alongside (VS-02, VS-04, JR-05): reference rows (`.lrow`, 56 pt, hairlines), each opening the passage
 * in this sheet. A reference Yada can't open is left out rather than drawn as a row that does nothing.
 */
export function AlongsideRows({ refs, from }: { refs: readonly string[]; from: string }) {
  const rows = refs.flatMap((r) => {
    const id = printedRef(r);
    return id === null ? [] : [{ label: alongsideLabel(r), id }];
  });
  if (rows.length === 0) return null;
  return (
    <Section title="Read it alongside">
      {rows.map((r, i) => (
        <ListRow key={r.id} first={i === 0} title={r.label} label={`${r.label}. Opens the passage`} onPress={() => router.push({ pathname: "/evidence/peek", params: { ref: r.id, from, note: "" } })} testID={`alongside-${i}`} />
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  added: { fontStyle: "italic", opacity: 0.6 },
  nextTitle: { fontFamily: FONTS.scripture, fontSize: 20, lineHeight: 26, letterSpacing: -0.2, fontWeight: "600" },
});
