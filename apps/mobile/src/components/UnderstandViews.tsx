/**
 * Understand (depth 1, canvas J01-03, J01-04, J01-06, J01-12, JN-03, GN-02):
 * one sheet over the reader, never five destinations. Original and Compare
 * from the action bar open this same sheet at that section (brief §1 rule 1).
 *
 * Order: What's happening → What we can see → Where interpretation differs →
 * Original ⌄ → Compare translations → Passage → Go deeper. At the medium
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
import { getTexts, getTextsInRange, getTokens, scriptOf } from "../data/queries";
import {
  isUnreviewed,
  loadEntriesInRange,
  loadEntry,
  loadPericopes,
  parseEntry,
  parsePericopePayload,
} from "../data/understand";
import { useAXLevel, useLayout, usePalette } from "../design/tokens";
import { formatRange, resolveRef } from "../lib/chapters";
import { RELATIONSHIP_LABEL } from "../lib/evidence";
import { missingOriginalNote } from "../lib/omissions";
import { pericopeForVerse, resolvePassage } from "../lib/pericopes";
import { useSettings } from "../state/settings";
import { useSheets } from "../state/sheets";
import { ClaimRows, groupClaims } from "./Claims";
import { Icon } from "./Icon";
import { glossCaption, OriginalWords } from "./OriginalWords";
import { Row, Section, SheetScreen, TextLink, useSheetSize } from "./Sheet";
import { Chrome, Label, Prose, Scripture } from "./Type";

const FIRST_SCREEN_SEEN = 3;
const FIRST_SCREEN_DIFFERS = 2;

export type UnderstandSection = "original" | "compare";

const verseIdOf = (ord: number): string => formatVerseId(ordToParts(ord));

/** A range in the sheet's own terms: "14:26–40" (the book is in the title). */
function shortRange(ref: string, book: BookCode): string {
  return formatRange(ref).replace(`${BOOK_CODES[book].name} `, "");
}

export function UnderstandRoute({ refText, section }: { refText: string; section?: UnderstandSection }) {
  const span = resolveRef(refText);
  if (span === null) return null;
  if (span.startOrd === span.endOrd) return <VerseUnderstand book={span.book} ord={span.startOrd} section={section} />;
  return <PassageUnderstand book={span.book} startOrd={span.startOrd} endOrd={span.endOrd} refText={refText} />;
}

function VerseUnderstand({ book, ord, section }: { book: BookCode; ord: number; section?: UnderstandSection }) {
  const core = useCore();
  const log = useLog();
  const palette = usePalette();
  const { sectionGap } = useLayout();
  const ax = useAXLevel() >= 1;
  const { large, headerHeight } = useSheetSize();
  const translation = useSettings((s) => s.translation);
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
  const [showHint] = useState(!evidenceHintSeen);
  useEffect(() => {
    if (!evidenceHintSeen) markEvidenceHintSeen();
  }, [evidenceHintSeen, markEvidenceHintSeen]);
  useEffect(() => log("understand_open", verseId), [log, verseId]);
  // A verse with no entry has nothing above the Original to read, so it opens (amendment 3, N-01).
  useEffect(() => {
    if (data !== undefined && data.loaded === null) setOriginalOpen(true);
  }, [data]);

  const scroll = useRef<ScrollView>(null);
  const scrolledTo = useRef(false);
  const land = (key: UnderstandSection, y: number) => {
    if (section === key && !scrolledTo.current) {
      scrolledTo.current = true;
      // Jumps land instantly (brief §5 Reduce Motion; and a sheet opening is motion enough).
      requestAnimationFrame(() => scroll.current?.scrollTo({ y: Math.max(0, y - headerHeight - 8), animated: false }));
    }
  };

  if (data === undefined) return <SheetScreen title={display} backLabel={display}>{null}</SheetScreen>;
  const { texts, tokens, loaded, pericope } = data;
  const entry = loaded?.entry ?? null;
  const groups = entry === null ? null : groupClaims(entry.claims);
  const omission = missingOriginalNote(verseId, script, tokens.words.length > 0);
  const verseText = texts[translation] ?? texts.BSB ?? "";
  // Medium detent, default sizes: four lines and More. Large or AX: in full.
  const clamp = !large && !ax && !explanationOpen;

  const openClaim = (claim: Claim) =>
    router.push({ pathname: "/evidence/why", params: { verse: verseId, claim: claim.id } });
  const openReadings = (claim: Claim) =>
    router.push({ pathname: "/evidence/readings", params: { verse: verseId, claim: claim.id } });

  return (
    <SheetScreen
      title={display}
      unreviewed={loaded !== null && isUnreviewed(loaded.reviewStatus)}
      backLabel={display}
      verseId={verseId}
      scrollRef={scroll}
      testID="understand"
    >
      {/* Large detent: the verse is no longer visible above the sheet, so one line of it here. */}
      {large && entry !== null ? (
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
            accessibilityLabel={verseText}
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
      {large && ax && verseOpen ? (
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

      {groups !== null && groups.seen.length > 0 ? (
        <Section title="What we can see" hint={showHint ? "Tap a line to see the evidence." : undefined}>
          <ClaimRows claims={groups.seen} cap={FIRST_SCREEN_SEEN} onOpen={openClaim} onReadings={openReadings} />
        </Section>
      ) : null}

      {groups !== null && groups.differs.length > 0 ? (
        <Section title="Where interpretation differs">
          <ClaimRows claims={groups.differs} cap={FIRST_SCREEN_DIFFERS} onOpen={openClaim} onReadings={openReadings} />
        </Section>
      ) : null}

      <View style={{ marginTop: entry === null ? 0 : sectionGap }} onLayout={(e) => land("original", e.nativeEvent.layout.y)}>
        <Pressable
          onPress={() => setOriginalOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={`Original ${language}`}
          accessibilityState={{ expanded: originalOpen }}
          testID="toggle-original"
          style={styles.disclosure}
        >
          <Chrome tone="ink" style={{ fontWeight: "600" }}>
            Original {language}
          </Chrome>
          {/* Swaps rather than rotates, so Reduce Motion needs no branch (brief §5). */}
          <View style={[styles.disc, { backgroundColor: palette.fill }]}>
            <Icon name={originalOpen ? "up" : "down"} size={16} />
          </View>
        </Pressable>
        {originalOpen ? (
          <View style={{ paddingTop: 8 }}>
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
      </View>

      <View onLayout={(e) => land("compare", e.nativeEvent.layout.y)}>
        <Row
          first
          onPress={() => router.push({ pathname: "/evidence/translations", params: { ref: verseId } })}
          label="Compare translations"
          testID="open-compare"
        >
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            Compare translations
          </Chrome>
        </Row>
      </View>

      {pericope !== null ? (
        <Section title="Passage">
          <Row
            first
            onPress={() => {
              const p = ordToParts(pericope.start_ord);
              const q = ordToParts(pericope.end_ord);
              router.push({ pathname: "/understand/passage", params: { ref: `${p.book}.${p.chapter}.${p.verse}-${q.chapter}.${q.verse}` } });
            }}
            testID="open-passage"
          >
            <Chrome tone="ink" style={{ fontWeight: "500" }}>
              {pericope.label} · {shortRange(pericope.pericope_id, book)}
            </Chrome>
          </Row>
        </Section>
      ) : null}

      {entry !== null && entry.related_passages.length > 0 ? (
        <Section title="Go deeper">
          {entry.related_passages.map((related, index) => (
            <Row
              key={related.ref}
              first={index === 0}
              onPress={() =>
                router.push({
                  pathname: "/evidence/peek",
                  params: {
                    ref: related.ref,
                    from: verseId,
                    relationship: related.relationship ?? "",
                    note: related.note ?? "",
                    unreviewed: loaded !== null && isUnreviewed(loaded.reviewStatus) ? "1" : "",
                  },
                })
              }
              testID={`deeper-${related.ref}`}
            >
              <Chrome tone="ink" style={{ fontWeight: "500" }}>
                {formatRange(related.ref)}
                {related.relationship === undefined ? "" : ` — ${RELATIONSHIP_LABEL[related.relationship]}`}
              </Chrome>
              {related.note !== undefined ? (
                <Prose step="note" tone="muted">
                  {related.note}
                </Prose>
              ) : null}
            </Row>
          ))}
        </Section>
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

  if (data === undefined) return <SheetScreen title={display} backLabel={display}>{null}</SheetScreen>;
  const { resolution } = data;
  const rows = [...resolution.pericopes.flatMap((p) => p.entries), ...resolution.loose];
  const anyUnreviewed =
    rows.some((r) => isUnreviewed(parseEntry(r)?.reviewStatus)) ||
    resolution.pericopes.some(({ pericope }) => parsePericopePayload(pericope) !== null && isUnreviewed(pericope.review_status));

  return (
    <SheetScreen title={display} unreviewed={anyUnreviewed} backLabel={display} verseId={firstId} testID="passage-understand">
      {resolution.pericopes.length === 0 && resolution.loose.length === 0 ? (
        <Prose step="claim" tone="muted" testID="no-entry">
          No verse in this selection has an explanation yet.
        </Prose>
      ) : null}

      {resolution.pericopes.map(({ pericope, entries }, i) => {
        const payload = parsePericopePayload(pericope);
        return (
          <View key={pericope.pericope_id} style={{ marginTop: i === 0 ? 0 : sectionGap }}>
            <Chrome tone="muted" style={{ fontWeight: "500", marginBottom: 4 }}>
              {pericope.label} · {shortRange(pericope.pericope_id, book)}
            </Chrome>
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
                          {shortRange(step.range, book)}
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
    minHeight: 52,
  },
  disc: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  movement: {
    flexDirection: "row",
    columnGap: 16,
    marginBottom: 6,
  },
});
