/**
 * Understand: visually a sheet, semantically a mode. One scrolling surface,
 * never five destinations. The default viewport reads like an annotation —
 * if the reader has to scroll far to learn what the verse is about, the
 * default state has failed (design brief).
 *
 * One verse → the verse's entry, its claims as marginalia, the Original
 * inline. Several verses → the passage(s) they fall in (PassageUnderstand):
 * never an explanation stitched together from verse entries.
 */

import { BOOK_CODES, type BookCode, formatDisplayRef, ordToParts } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { ClaimGroup, groupClaims } from "../components/Claims";
import { useSheetNav } from "../components/navigation";
import { glossCaption, OriginalWords } from "../components/OriginalWords";
import { DraftLabel, Hairline, LinkRow, Section, SheetScreen } from "../components/Sheet";
import { Chrome, Label, Prose, Scripture } from "../components/Type";
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
import { SPACE } from "../design/tokens";
import { formatRange, resolveRef } from "../lib/chapters";
import { missingOriginalNote } from "../lib/omissions";
import { pericopeForVerse, resolvePassage } from "../lib/pericopes";
import { useSettings } from "../state/settings";

/** First-screen caps from the brief: three things we can see, two places readings differ. */
const FIRST_SCREEN_SEEN = 3;
const FIRST_SCREEN_DIFFERS = 2;

export default function UnderstandScreen() {
  const params = useLocalSearchParams<{ ref?: string; original?: string }>();
  const span = resolveRef(params.ref ?? "");
  if (span === null) return <SheetScreen backLabel={null}>{null}</SheetScreen>;
  if (span.startOrd === span.endOrd) {
    return <VerseUnderstand book={span.book} ord={span.startOrd} openOriginal={params.original === "1"} />;
  }
  return <PassageUnderstand book={span.book} startOrd={span.startOrd} endOrd={span.endOrd} refText={params.ref ?? ""} />;
}

function VerseUnderstand({ book, ord, openOriginal }: { book: BookCode; ord: number; openOriginal: boolean }) {
  const core = useCore();
  const log = useLog();
  const { jumpTo } = useSheetNav();
  const translation = useSettings((s) => s.translation);
  const parts = ordToParts(ord);
  const verseId = `${parts.book}.${parts.chapter}.${parts.verse}`;
  const display = formatDisplayRef(parts);
  const script = scriptOf(book);

  const { data } = useQuery(async () => {
    const [texts, tokens, loaded, pericopes] = await Promise.all([
      getTexts(core, ord),
      getTokens(core, ord),
      loadEntry(book, verseId),
      loadPericopes(book),
    ]);
    return { texts, tokens, loaded, pericope: pericopeForVerse(pericopes, ord) };
  }, [book, ord]);

  const [originalOpen, setOriginalOpen] = useState(openOriginal);
  useEffect(() => log("understand_open", verseId), [log, verseId]);
  // A verse with no entry has nothing above the Original to read, so it opens.
  useEffect(() => {
    if (data !== undefined && data.loaded === null) setOriginalOpen(true);
  }, [data]);

  if (data === undefined) return <SheetScreen backLabel={display}>{null}</SheetScreen>;
  const { texts, tokens, loaded, pericope } = data;
  const entry = loaded?.entry ?? null;
  const groups = entry === null ? null : groupClaims(entry.claims);
  const omission = missingOriginalNote(verseId, script, tokens.words.length > 0);

  return (
    <SheetScreen backLabel={display} verseId={verseId}>
      <Label accessibilityRole="header">{display}</Label>
      {loaded !== null && isUnreviewed(loaded.reviewStatus) ? <DraftLabel /> : null}
      <Scripture style={{ marginTop: SPACE.sm }}>{texts[translation] ?? texts.BSB ?? ""}</Scripture>

      <Hairline />

      {entry !== null ? (
        <Prose testID="whats-happening">{entry.whats_happening}</Prose>
      ) : (
        <Prose tone="muted" testID="no-entry">
          Explanation not yet available for this verse.
        </Prose>
      )}

      {groups !== null ? (
        <>
          <ClaimGroup title="What we can see" claims={groups.seen} cap={FIRST_SCREEN_SEEN} verseId={verseId} />
          <ClaimGroup title="Where interpretation differs" claims={groups.differs} cap={FIRST_SCREEN_DIFFERS} verseId={verseId} />
        </>
      ) : null}

      <View style={{ marginTop: SPACE.xl }}>
        <LinkRow
          label={`${script === "hebrew" ? "Original Hebrew" : "Original Greek"} · ${originalOpen ? "Hide" : "Show"}`}
          onPress={() => setOriginalOpen((v) => !v)}
          testID="toggle-original"
        />
        {originalOpen ? (
          <View style={{ marginTop: SPACE.sm }}>
            {omission !== null ? (
              <Prose step="claim" tone="muted" testID="omission-note">
                {omission}
              </Prose>
            ) : (
              <>
                <OriginalWords tokens={tokens} script={script} from={verseId} />
                <Prose step="note" tone="muted" style={{ marginTop: SPACE.sm }}>
                  {glossCaption(tokens)}
                </Prose>
              </>
            )}
            {entry !== null ? (
              <View style={{ marginTop: SPACE.lg }}>
                <Label>Close rendering</Label>
                <Prose step="claim" style={{ marginTop: SPACE.xs }}>
                  {entry.close_rendering}
                </Prose>
                <Prose step="note" tone="muted" style={{ marginTop: SPACE.xs }}>
                  Composed to sit close to the Greek or Hebrew; not a word-for-word gloss.
                </Prose>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <Section title="Translations">
        <LinkRow
          label="Compare BSB, WEB and KJV ›"
          onPress={() => router.push({ pathname: "/compare", params: { ref: verseId } })}
          testID="open-compare"
        />
      </Section>

      {pericope !== null ? (
        <Section title="The passage">
          <LinkRow
            label={`${pericope.label} · ${formatRange(pericope.pericope_id)} ›`}
            onPress={() => {
              const p = ordToParts(pericope.start_ord);
              const q = ordToParts(pericope.end_ord);
              router.push({
                pathname: "/understand",
                params: { ref: `${p.book}.${p.chapter}.${p.verse}-${q.chapter}.${q.verse}` },
              });
            }}
            testID="open-passage"
          />
        </Section>
      ) : null}

      {entry !== null && entry.related_passages.length > 0 ? (
        <Section title="Go deeper">
          {entry.related_passages.map((related) => {
            const target = resolveRef(related.ref);
            return (
              <View key={related.ref} style={{ marginBottom: SPACE.sm }}>
                <LinkRow
                  label={`${formatRange(related.ref)}${related.relationship === undefined ? "" : ` · ${related.relationship}`} ›`}
                  onPress={() => {
                    if (target === null) return;
                    log("go_deeper", verseId, related.ref);
                    jumpTo({ book: target.book, chapter: target.chapter, verse: target.startVerse, from: verseId, select: true });
                  }}
                />
                {related.note !== undefined ? (
                  <Prose step="note" tone="muted">
                    {related.note}
                  </Prose>
                ) : null}
              </View>
            );
          })}
        </Section>
      ) : null}
    </SheetScreen>
  );
}

/**
 * A selection of several verses, resolved to the pericopes it touches. Each
 * pericope shows its own generated payload when one exists — summary, key
 * ideas, how the passage moves. Otherwise its label, then the verse entries
 * inside the selection in order, each standing alone.
 */
function PassageUnderstand({
  book,
  startOrd,
  endOrd,
  refText,
}: {
  book: BookCode;
  startOrd: number;
  endOrd: number;
  refText: string;
}) {
  const core = useCore();
  const log = useLog();
  const translation = useSettings((s) => s.translation);
  const display = formatRange(refText);
  const first = ordToParts(startOrd);
  const firstId = `${first.book}.${first.chapter}.${first.verse}`;

  const { data } = useQuery(async () => {
    const [verses, pericopes, entries] = await Promise.all([
      getTextsInRange(core, startOrd, endOrd),
      loadPericopes(book),
      loadEntriesInRange(book, startOrd, endOrd),
    ]);
    return { verses, resolution: resolvePassage(pericopes, entries, startOrd, endOrd) };
  }, [book, startOrd, endOrd]);

  useEffect(() => log("passage_open", firstId, refText), [log, firstId, refText]);

  if (data === undefined) return <SheetScreen backLabel={display}>{null}</SheetScreen>;
  const { verses, resolution } = data;
  const multiChapter = ordToParts(startOrd).chapter !== ordToParts(endOrd).chapter;

  return (
    <SheetScreen backLabel={display} verseId={firstId}>
      <Label accessibilityRole="header">{display}</Label>
      <Scripture style={{ marginTop: SPACE.sm }}>
        {verses.map((v) => {
          const p = ordToParts(v.ord);
          return (
            <Scripture key={v.ord}>
              <Scripture tone="muted" style={{ fontSize: 13 }}>
                {multiChapter ? `${p.chapter}:${p.verse}` : p.verse}{" "}
              </Scripture>
              {(v.texts[translation] ?? v.texts.BSB ?? "") + " "}
            </Scripture>
          );
        })}
      </Scripture>

      <Hairline />

      {resolution.pericopes.length === 0 && resolution.loose.length === 0 ? (
        <Prose tone="muted" testID="no-entry">
          Explanation not yet available for this passage.
        </Prose>
      ) : null}

      {resolution.pericopes.map(({ pericope, entries }) => {
        const payload = parsePericopePayload(pericope);
        return (
          <View key={pericope.pericope_id} style={{ marginBottom: SPACE.xl }}>
            <Label>{formatRange(pericope.pericope_id)}</Label>
            {payload !== null && isUnreviewed(pericope.review_status ?? payload.review.status) ? <DraftLabel /> : null}
            <Prose style={{ marginTop: SPACE.xs, fontWeight: "600" }}>{pericope.label}</Prose>
            {payload !== null ? (
              <>
                <Prose style={{ marginTop: SPACE.sm }}>{payload.summary_one_sentence}</Prose>
                {payload.key_ideas.length > 0 ? (
                  <Section title="Key ideas">
                    {payload.key_ideas.map((idea) => (
                      <Prose key={idea} step="claim" style={{ marginBottom: SPACE.xs }}>
                        {idea}
                      </Prose>
                    ))}
                  </Section>
                ) : null}
                {payload.movement !== undefined && payload.movement.length > 0 ? (
                  <Section title="How the passage moves">
                    {payload.movement.map((step) => (
                      <View key={step.range} style={{ flexDirection: "row", columnGap: SPACE.md, marginBottom: SPACE.xs }}>
                        <Prose step="note" tone="muted" style={{ minWidth: 64 }}>
                          {formatRange(step.range).replace(`${BOOK_CODES[book].name} `, "")}
                        </Prose>
                        <Prose step="claim" style={{ flex: 1 }}>
                          {step.label}
                        </Prose>
                      </View>
                    ))}
                  </Section>
                ) : null}
              </>
            ) : entries.length === 0 ? (
              <Prose step="claim" tone="muted" style={{ marginTop: SPACE.sm }}>
                No verse in this part of the selection has an explanation yet.
              </Prose>
            ) : null}
            {entries.map((row) => (
              <VerseEntrySummary key={row.verse_id} row={row} />
            ))}
          </View>
        );
      })}

      {resolution.loose.map((row) => (
        <VerseEntrySummary key={row.verse_id} row={row} />
      ))}
    </SheetScreen>
  );
}

/** One verse's own explanation inside a passage, unchanged and attributed to its verse. */
function VerseEntrySummary({ row }: { row: Parameters<typeof parseEntry>[0] }) {
  const loaded = parseEntry(row);
  if (loaded === null) return null;
  const parts = ordToParts(row.ord);
  return (
    <View style={{ marginTop: SPACE.lg }}>
      <Label>{formatDisplayRef(parts)}</Label>
      {isUnreviewed(loaded.reviewStatus) ? <DraftLabel /> : null}
      <Prose step="claim" style={{ marginTop: SPACE.xs }}>
        {loaded.entry.whats_happening}
      </Prose>
      <View style={{ marginTop: SPACE.xs }}>
        <Chrome
          size={16}
          onPress={() => router.push({ pathname: "/understand", params: { ref: row.verse_id } })}
          accessibilityRole="link"
        >
          Understand {formatDisplayRef(parts)} ›
        </Chrome>
      </View>
    </View>
  );
}
