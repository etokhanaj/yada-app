/**
 * The passage guide (canvas PG-01–10, ON-02, ON-04): one sheet per passage.
 *
 * Order: Where we are → Three things to notice → Where readers differ → The
 * passage → Next. Labelled sections of plain prose, typography only (Headway
 * "What's inside?", https://mobbin.com/screens/3a17e556-460c-43b0-bf46-893f5d49e263;
 * Co–Star's stacked serif sections,
 * https://mobbin.com/screens/b2f59e7e-d75c-4065-9726-9e3f9be19afc).
 *
 * - × is the only exit at the top level and says where it goes ("Close, back
 *   to reading"): × and Back to reading did the same thing, two controls with
 *   one meaning to VoiceOver (canvas `guide`).
 * - A thing to notice marks its evidence in the passage (PG-10) when the data
 *   says which words those are (lib/guide.ts evidenceMarks), and VoiceOver hears
 *   a status line; a second tap, or a row with nothing to mark, opens Why we
 *   say this.
 * - A reading row opens the readings; it holds no control of its own.
 * - A verse of the passage pushes its Understand inside this sheet (PG-04).
 * - The Next row opens the following passage's guide in place (ON-04);
 *   reaching it counts this passage read (lib/startHere.ts).
 *
 * Passages without a Yada entry get the fallback guide: the study note on the
 * passage (data/passageNote.ts), the text, Next. A missing field shows nothing;
 * the canvas's grey placeholders are annotations, never app UI.
 */

import { BOOK_CODES, type Claim, ordToParts } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";

import { Icon } from "../../components/Icon";
import { Row, Section, SheetScreen } from "../../components/Sheet";
import { Chrome, Original, Prose } from "../../components/Type";
import { Verse } from "../../components/Verse";
import { useAppData, useCore, useLog, useQuery } from "../../data/AppData";
import { type GuideCloser, type GuideData, loadGuide } from "../../data/guide";
import { loadPericopes } from "../../data/understand";
import { markPassageRead } from "../../data/user";
import { FONTS, usePalette } from "../../design/tokens";
import { claimPlace, evidenceMarks, type EvidenceMarks, marksAnnouncement } from "../../lib/guide";
import { displayGloss } from "../../lib/glosses";
import { nextRowReached, readThread, START_HERE_BOOK, THREAD } from "../../lib/startHere";
import { useGuide } from "../../state/guide";
import { useSettings } from "../../state/settings";

export default function GuideScreen() {
  const params = useLocalSearchParams<{ ref?: string; reader?: string }>();
  const ref = params.ref ?? "";
  const core = useCore();
  const translation = useSettings((s) => s.translation);
  const { data } = useQuery(() => loadGuide(core, ref, translation), [ref, translation]);
  // Keyed on the passage: Next swaps the passage in place, and nothing of the last one carries over.
  return <Guide key={ref} data={data ?? null} reader={params.reader ?? null} translation={translation} />;
}

function Guide({ data, reader, translation }: { data: GuideData | null; reader: string | null; translation: string }) {
  const { user } = useAppData();
  const log = useLog();
  const [shown, setShown] = useState<{ claim: string; marks: EvidenceMarks } | null>(null);
  const [closerOpen, setCloserOpen] = useState(false);
  const nextRow = useRef<{ y: number; height: number } | null>(null);
  const counted = useRef(false);
  const view = useRef({ y: 0, viewport: 0 });

  const id = data?.pericope.pericope_id ?? null;
  useEffect(() => {
    if (data === null) return;
    const first = ordToParts(data.pericope.start_ord);
    log("passage_open", `${first.book}.${first.chapter}.${first.verse}`, data.pericope.pericope_id);
  }, [data, log]);

  // ON-04: a passage of John counts as read when its Next row comes into view (the end of the
  // text for the last passage, which has none). Once per opening; nothing announces it.
  const check = useCallback(() => {
    const row = nextRow.current;
    if (data === null || id === null || counted.current || row === null || data.book !== START_HERE_BOOK) return;
    if (!nextRowReached(row.y, row.height, view.current.y, view.current.viewport)) return;
    counted.current = true;
    void (async () => {
      const index = (await loadPericopes(START_HERE_BOOK)).findIndex((p) => p.pericope_id === id);
      if (index >= 0) await markPassageRead(user, THREAD, readThread(id), index + 1);
    })();
  }, [data, id, user]);

  if (data === null) {
    return <SheetScreen title="" backLabel={null} footer={false} closeLabel="Close, back to reading" testID="guide">{null}</SheetScreen>;
  }

  const entryVerseId = data.entryVerseId;
  const chapter = ordToParts(data.pericope.start_ord).chapter;
  const book = BOOK_CODES[data.book].name;

  const openWhy = (claim: Claim) => {
    if (entryVerseId !== null) router.push({ pathname: "/evidence/why", params: { verse: entryVerseId, claim: claim.id } });
  };
  const openReadings = (claim: Claim) => {
    if (entryVerseId !== null) router.push({ pathname: "/evidence/readings", params: { verse: entryVerseId, claim: claim.id } });
  };

  const marksFor = (claim: Claim): EvidenceMarks | null =>
    // Evidence words are marked only in the BSB, the text the entries were written against;
    // in any other translation the row opens its evidence instead (edge case 6).
    data.bsbText
      ? evidenceMarks(
          claim,
          data.verses.filter((v) => data.tokens.has(v.ord)).map((v) => ({ ord: v.ord, verseId: v.verseId, text: v.text, tokens: data.tokens.get(v.ord) ?? [] })),
        )
      : null;

  const tapNotice = (claim: Claim) => {
    if (shown?.claim === claim.id) return openWhy(claim);
    const marks = marksFor(claim);
    if (marks === null) return openWhy(claim);
    setShown({ claim: claim.id, marks });
    // VoiceOver hears what the eye sees (PG-10's status line).
    AccessibilityInfo.announceForAccessibility(`${marksAnnouncement(marks)} Swipe to the passage to hear it.`);
  };

  const goNext = () => {
    if (data.next === null) return;
    const start = ordToParts(data.next.pericope.start_ord);
    // The reader beneath follows, so × lands on the passage just guided (state/guide.ts).
    if (reader !== null) useGuide.getState().setFollow({ reader, book: start.book, chapter: start.chapter, verse: start.verse });
    // A new key remounts the guide at its top (GuideScreen).
    router.setParams({ ref: data.next.pericope.pericope_id });
  };

  const hasNotice = data.notice.length > 0;
  const hasDiffer = data.differ.length > 0;
  const opener = data.whereWeAre !== null || data.moves.length > 0 || data.note !== null;

  return (
    <SheetScreen
      title={data.pericope.label}
      subtitle={data.title}
      unreviewed={data.unreviewed}
      backLabel={null}
      footer={false}
      closeLabel="Close, back to reading"
      onScrollY={(y, viewport) => {
        view.current = { y, viewport };
        check();
      }}
      testID="guide"
    >
      {data.whereWeAre !== null ? (
        <Section title="Where we are" first>
          <Prose step="explanation" testID="guide-where">
            {data.whereWeAre}
          </Prose>
        </Section>
      ) : null}

      {data.moves.length > 0 ? (
        <Section title="How the passage moves" first={data.whereWeAre === null}>
          {data.moves.map((move, i) => (
            <Prose key={`${i}-${move}`} step="claim" style={{ marginBottom: 6 }}>
              {move}
            </Prose>
          ))}
        </Section>
      ) : null}

      {data.note !== null ? (
        <Section title="Study notes" first={data.whereWeAre === null && data.moves.length === 0}>
          {data.note.text.split(/\n\s*\n/u).map((para, i) => (
            <Prose key={i} step="explanation" style={{ marginBottom: 10 }}>
              {para}
            </Prose>
          ))}
          <Chrome step="note" tone="muted">
            {data.note.credit}
          </Chrome>
        </Section>
      ) : null}

      {hasNotice ? (
        <Section title="Three things to notice" first={!opener}>
          {data.notice.map((claim, i) => {
            const on = shown?.claim === claim.id;
            const place = claimPlace(claim.evidence, entryVerseId ?? "", chapter);
            const markable = !on && marksFor(claim) !== null;
            return (
              <View key={claim.id}>
                <Row
                  first={i === 0}
                  onPress={() => tapNotice(claim)}
                  label={`${claim.claim} ${place}${on ? ", shown in the passage" : ""}`}
                  hint={markable ? "Marks its words in the passage" : "Shows why we say this"}
                  testID={`notice-${claim.id}`}
                >
                  <Prose step="claim" style={on ? { fontWeight: "600" } : undefined}>
                    {claim.claim}
                  </Prose>
                  <Chrome step="note" tone="muted">
                    {place}
                    {on ? (
                      <Chrome step="note" tone="accent" style={{ fontWeight: "600" }}>
                        {" · Shown in the passage"}
                      </Chrome>
                    ) : null}
                  </Chrome>
                </Row>
                {data.closer !== null && claim.id.endsWith(`.${data.closer.claim}`) ? (
                  <Closer
                    word={data.closer.word}
                    book={book}
                    script={BOOK_CODES[data.book].testament === "NT" ? "greek" : "hebrew"}
                    open={closerOpen}
                    onToggle={() => setCloserOpen((v) => !v)}
                    onCount={() =>
                      router.push({
                        pathname: "/evidence/occurrences",
                        params: { key: data.closer?.word.occurrenceKey ?? "", book: data.book, from: entryVerseId ?? "" },
                      })
                    }
                  />
                ) : null}
              </View>
            );
          })}
        </Section>
      ) : null}

      {hasDiffer ? (
        <Section title="Where readers differ" first={!opener && !hasNotice}>
          {data.differ.map((claim, i) => {
            const place = claimPlace(claim.evidence, entryVerseId ?? "", chapter);
            const n = claim.positions?.length ?? 0;
            return (
              <Row
                key={claim.id}
                first={i === 0}
                onPress={() => (n > 0 ? openReadings(claim) : openWhy(claim))}
                label={`${claim.claim} ${place}.${n > 0 ? ` Compare the ${n} readings` : ""}`}
                testID={`differ-${claim.id}`}
              >
                <Prose step="claim">{claim.claim}</Prose>
                <Chrome step="note" tone="muted">
                  {n > 0 ? (
                    <Chrome step="note" tone="accent" style={{ fontWeight: "600" }}>
                      {`Compare the ${n} readings`}
                    </Chrome>
                  ) : null}
                  {n > 0 ? ` · ${place}` : place}
                </Chrome>
              </Row>
            );
          })}
        </Section>
      ) : null}

      <Section title="The passage" first={!opener && !hasNotice && !hasDiffer}>
        {data.shownInBsb ? (
          <Chrome step="note" tone="muted" style={{ marginBottom: 8 }}>
            Shown in BSB
          </Chrome>
        ) : null}
        {shown !== null ? (
          // Screen readers only, as the canvas's sr-only status line: the marks are visual.
          <Chrome step="note" tone="muted" style={styles.srOnly} accessibilityLiveRegion="polite">
            {marksAnnouncement(shown.marks)}
          </Chrome>
        ) : null}
        <View style={{ marginTop: 6 }}>
          {data.verses.map((v) => {
            // A passage that crosses a chapter (John 7:53–8:11, 15:18–16:4) opens the new
            // chapter with its numeral at verse 1, as the reader does.
            return (
              <Verse
                key={v.ord}
                verse={v.verse}
                chapter={v.chapter}
                text={v.text}
                translation={data.shownInBsb ? "BSB" : translation}
                place="none"
                bookmarked={false}
                hasEntry={v.verseId === entryVerseId}
                marks={shown?.marks.ranges.get(v.ord)}
                hint={`Opens ${book} ${v.chapter}:${v.verse}`}
                actions={false}
                onPress={() => router.push({ pathname: "/guide/verse", params: { ref: v.verseId, passage: data.pericope.label } })}
                onAction={() => undefined}
                testID={`guide-verse-${v.chapter}-${v.verse}`}
              />
            );
          })}
        </View>
      </Section>

      <View
        onLayout={(e) => {
          nextRow.current = { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height };
          check();
        }}
        style={{ marginTop: 12 }}
      >
        {data.next !== null ? <NextRow label={data.next.pericope.label} range={data.next.range} book={book} onPress={goNext} /> : null}
      </View>
    </SheetScreen>
  );
}

/**
 * ON-04: the next passage, one tap. "Next · 1:19–34" above the title in the
 * accent, the title in Literata semibold, a chevron. Marked in type, never the
 * wash, which means a selected verse only.
 */
function NextRow({ label, range, book, onPress }: { label: string; range: string; book: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Next, ${label}, ${book} ${range.replace("–", " to ")}. Opens its guide`}
      testID="guide-next"
      style={({ pressed }) => [styles.next, pressed ? { backgroundColor: palette.fill } : null]}
    >
      <View style={{ flex: 1, minWidth: 0, rowGap: 2 }}>
        <Chrome step="note" tone="accent" style={{ fontWeight: "600" }}>
          Next · {range}
        </Chrome>
        <Chrome tone="ink" style={styles.nextTitle} maxFontSizeMultiplier={2.2}>
          {label}
        </Chrome>
      </View>
      <Icon name="forward" size={18} tone="muted" />
    </Pressable>
  );
}

/**
 * "Closer to the Greek: λόγος", one line inside the claim it supports (PG-05;
 * Matter's inline note, not a mode). Open, the word with its transliteration
 * and gloss, then how often it occurs in the book, which opens the list.
 */
function Closer({
  word,
  book,
  script,
  open,
  onToggle,
  onCount,
}: {
  word: GuideCloser;
  book: string;
  script: "greek" | "hebrew";
  open: boolean;
  onToggle: () => void;
  onCount: () => void;
}) {
  const palette = usePalette();
  const language = script === "hebrew" ? "Hebrew" : "Greek";
  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`Closer to the ${language}: ${word.surface}`}
        accessibilityState={{ expanded: open }}
        testID="guide-closer"
        style={styles.closer}
      >
        <Chrome tone="accent" size={15} style={{ fontWeight: "600", flexShrink: 1 }}>
          Closer to the {language}:{" "}
          <Chrome tone="ink" size={19} style={{ fontFamily: script === "hebrew" ? FONTS.hebrew : FONTS.greek, fontWeight: "400" }}>
            {word.surface}
          </Chrome>
        </Chrome>
        <Icon name={open ? "up" : "down"} size={16} tone="accent" />
      </Pressable>
      {open ? (
        <View style={[styles.closerBody, { boxShadow: `inset 1.5px 0 0 ${palette.divider}` }]}>
          <View style={styles.word}>
            <Original script={script} style={{ fontSize: 26, lineHeight: 34 }}>
              {word.surface}
            </Original>
            <Prose step="claim" tone="muted">
              {word.translit}
              {word.gloss === null ? "" : ` · “${displayGloss(word.gloss)}”`}
            </Prose>
          </View>
          <Row first onPress={onCount} label={`${word.surface} in ${book}, ${word.inBook} times`} testID="guide-closer-count">
            <Chrome tone="ink" style={{ fontWeight: "500" }}>
              <Chrome tone="ink" style={{ fontFamily: script === "hebrew" ? FONTS.hebrew : FONTS.greek, fontWeight: "400" }}>
                {word.surface}
              </Chrome>
              {` in ${book} · ${word.inBook}`}
            </Chrome>
          </Row>
          <Chrome step="note" tone="muted">
            {script === "hebrew" ? "Gloss: STEPBible TAHOT · Count: OSHB" : "Gloss: STEPBible TAGNT · Count: SBLGNT"}
          </Chrome>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  next: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    minHeight: 44,
    paddingVertical: 12,
  },
  nextTitle: {
    fontFamily: FONTS.scripture,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    fontWeight: "600",
  },
  closer: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    minHeight: 44,
  },
  closerBody: {
    paddingLeft: 12,
    paddingBottom: 10,
    rowGap: 8,
  },
  word: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: 8,
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
});
