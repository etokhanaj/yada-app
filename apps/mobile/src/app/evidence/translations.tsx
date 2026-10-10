/**
 * Translations (J01-13, JN-06): the reader's own version first, then up to
 * three others (plan, "Compare cap": the first three installed, or those
 * chosen in the Translations sheet). Only the reader's translation carries
 * marks — its content words no other version uses, in their own warm wash
 * plus an underline, so "differs" never looks like "selected" (amendment 2;
 * v2-review S5). If every compared version agrees, one line says so and the
 * verse is shown once.
 *
 * The LSV's supplied words keep their brackets and are drawn muted; VoiceOver
 * reads them without the brackets (lib/supplied.ts).
 *
 * The entry's translation_note appears only on a real divergence; a note
 * explaining a difference nobody can see would be noise (handoff §6).
 */

import { formatVerseId, ordToParts } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import { Section, SheetScreen } from "../../components/Sheet";
import { Label, Prose, Scripture } from "../../components/Type";
import { DivineText } from "../../components/Verse";
import { useCore, useQuery } from "../../data/AppData";
import { BUILT_IN, getTextsInRange, readableTranslations } from "../../data/queries";
import { useTranslations } from "../../data/translations";
import { isUnreviewed, loadEntry } from "../../data/understand";
import { useLayout, usePalette } from "../../design/tokens";
import { formatRange, resolveRef } from "../../lib/chapters";
import { compareSelection, listAnd } from "../../lib/compare";
import { hasRealDivergence, markReadingDifferences } from "../../lib/diff";
import { spokenText, type SuppliedPiece, suppliedSlicer } from "../../lib/supplied";
import { notInLine, onPhoneOrder } from "../../lib/translations";
import { useSettings } from "../../state/settings";

export default function TranslationsScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const span = resolveRef(params.ref ?? "");
  const core = useCore();
  const palette = usePalette();
  const { sectionGap } = useLayout();
  const reading = useSettings((s) => s.translation);
  const compareWith = useSettings((s) => s.compareWith);
  const installed = useTranslations((s) => s.installed);

  const { data } = useQuery(async () => {
    if (span === null) return null;
    const verses = await getTextsInRange(core, span.startOrd, span.endOrd);
    const single = span.startOrd === span.endOrd ? ordToParts(span.startOrd) : null;
    const loaded = single === null ? null : await loadEntry(span.book, formatVerseId(single));
    return { verses, loaded };
  }, [params.ref, installed.map((t) => t.code).join(",")]);

  const label = span === null ? "" : formatRange(params.ref ?? "");
  const firstId = span === null ? "" : formatVerseId(ordToParts(span.startOrd));
  const shell = (children: React.ReactNode, unreviewed = false) => (
    <SheetScreen title="Translations" subtitle={label} unreviewed={unreviewed} backLabel={label} verseId={firstId} closeLabel="Back to Understand" testID="translations">
      {children}
    </SheetScreen>
  );
  if (data === undefined || data === null || span === null) return shell(null);

  const onPhone = onPhoneOrder(BUILT_IN, installed.map((t) => t.code));
  const order = [reading, ...compareSelection(reading, onPhone, compareWith)];
  const joined = (t: string) => data.verses.map((v) => v.texts[t] ?? "").join(" ").trim();
  const present = order.filter((t) => joined(t) !== "");
  // A compared version that does not print the passage (the ASV leaves Matthew 23:14 blank) is named, not
  // silently dropped: the reader chose it, and its absence is the difference. Only versions this
  // screen reads; a licensed one (API.Bible) is not in these files and is not "not in" anything.
  const readable = readableTranslations();
  const absent = order.filter((t) => joined(t) === "" && readable.includes(t));
  const absentLine =
    absent.length === 0 ? null : (
      <Prose step="note" tone="muted" style={{ marginTop: sectionGap }} testID="translations-absent">
        {notInLine(listAnd(absent))}
      </Prose>
    );
  // One translation present (or none) is not agreement; "agree" means every compared version does.
  const agree = present.length >= 2 && !hasRealDivergence(present.map(joined));
  const multi = data.verses.length > 1;

  if (agree) {
    return shell(
      <>
        <Prose step="claim" tone="muted" testID="translations-agree">
          {listAnd(present)} agree here.
        </Prose>
        <Scripture step="explanation" style={{ marginTop: 12 }} accessibilityLabel={spokenText(joined(reading), reading)}>
          <DivineText text={joined(reading)} translation={reading} />
        </Scripture>
        {absentLine}
      </>,
    );
  }

  const [base, ...others] = present;
  const pieces = (list: readonly SuppliedPiece[]) =>
    list.map((p, i) =>
      p.supplied ? (
        <Text key={i} style={{ color: palette.mutedInk }}>
          {p.text}
        </Text>
      ) : (
        p.text
      ),
    );

  return shell(
    <>
      {present.map((translation, index) => {
        const spoken: string[] = [];
        const body = data.verses.map((v, vi) => {
          const text = v.texts[translation] ?? "";
          const verse = ordToParts(v.ord).verse;
          if (multi) spoken.push(`${verse}`);
          const number = multi ? (
            <Scripture key={`n${v.ord}`} step="explanation" tone="muted" style={{ fontSize: 13 }}>
              {`${verse} `}
            </Scripture>
          ) : null;
          // One verse of the span this version does not print: its number stays, the gap is said.
          if (text === "") {
            spoken.push(notInLine(translation));
            return (
              <Scripture key={v.ord} step="explanation" tone="muted">
                {vi > 0 ? " " : ""}
                {number}
                {notInLine(translation)}
              </Scripture>
            );
          }
          if (translation !== base) {
            spoken.push(spokenText(text, translation));
            return (
              <Scripture key={v.ord} step="explanation">
                {vi > 0 ? " " : ""}
                {number}
                <DivineText text={text} translation={translation} />
              </Scripture>
            );
          }
          const slice = suppliedSlicer(text, translation);
          let cursor = 0;
          const words = markReadingDifferences(text, others.map((o) => v.texts[o] ?? "")).map((w, i) => {
            const found = text.indexOf(w.text, cursor);
            const start = found === -1 ? cursor : found;
            cursor = start + w.text.length;
            const space = w.trailing === "" ? "" : " ";
            spoken.push(`${spokenText(w.text, translation)}${w.divergent ? ", differs" : ""}`);
            if (!w.divergent) return <Text key={i}>{pieces(slice(start, cursor))}{space}</Text>;
            // Mark the word's letters only, not its punctuation or the space after it.
            const [, lead = "", core = w.text, tail = ""] = /^(\P{L}*)(.*?)(\P{L}*)$/u.exec(w.text) ?? [];
            const coreStart = start + lead.length;
            return (
              <Text key={i}>
                {pieces(slice(start, coreStart))}
                <Text style={{ backgroundColor: palette.highlight, textDecorationLine: "underline", textDecorationColor: palette.mutedInk }}>
                  {pieces(slice(coreStart, coreStart + core.length))}
                </Text>
                {pieces(slice(coreStart + core.length, coreStart + core.length + tail.length))}
                {space}
              </Text>
            );
          });
          return (
            <Scripture key={v.ord} step="explanation">
              {vi > 0 ? " " : ""}
              {number}
              {words}
            </Scripture>
          );
        });
        return (
          <View key={translation} style={{ marginTop: index === 0 ? 0 : sectionGap }} testID={`compare-${translation}`}>
            <Label accessibilityLabel={translation === reading ? `${translation}, your translation` : translation} style={{ marginBottom: 6 }}>
              {translation}
            </Label>
            {/* One reading for VoiceOver: brackets dropped, each marked word followed by "differs". */}
            <Scripture step="explanation" accessibilityLabel={spoken.join(" ")}>
              {body}
            </Scripture>
          </View>
        );
      })}
      {absentLine}

      {data.loaded?.entry.translation_note !== undefined ? (
        <Section title="Why they differ">
          <Prose step="claim">{data.loaded.entry.translation_note}</Prose>
        </Section>
      ) : null}
    </>,
    // The note is generated; the texts are the translations themselves.
    data.loaded?.entry.translation_note !== undefined && isUnreviewed(data.loaded.reviewStatus),
  );
}
