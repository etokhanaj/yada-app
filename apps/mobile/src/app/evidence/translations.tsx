/**
 * Translations (J01-13, JN-06): BSB, WEB and KJV stacked, the reader's own
 * first. Only the reader's translation carries marks — its content words no
 * other version uses, in their own warm wash plus an underline, so "differs"
 * never looks like "selected" (amendment 2; v2-review S5). If none differ,
 * one line says so and the verse is shown once.
 *
 * The entry's translation_note appears only on a real divergence; a note
 * explaining a difference nobody can see would be noise (handoff §6).
 */

import { formatVerseId, ordToParts } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { Section, SheetScreen } from "../../components/Sheet";
import { Label, Prose, Scripture } from "../../components/Type";
import { useCore, useQuery } from "../../data/AppData";
import { getTextsInRange, type Translation } from "../../data/queries";
import { isUnreviewed, loadEntry } from "../../data/understand";
import { useLayout, usePalette } from "../../design/tokens";
import { formatRange, resolveRef } from "../../lib/chapters";
import { hasRealDivergence, markReadingDifferences } from "../../lib/diff";
import { TRANSLATIONS, useSettings } from "../../state/settings";

export default function TranslationsScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const span = resolveRef(params.ref ?? "");
  const core = useCore();
  const palette = usePalette();
  const { sectionGap } = useLayout();
  const reading = useSettings((s) => s.translation);

  const { data } = useQuery(async () => {
    if (span === null) return null;
    const verses = await getTextsInRange(core, span.startOrd, span.endOrd);
    const single = span.startOrd === span.endOrd ? ordToParts(span.startOrd) : null;
    const loaded = single === null ? null : await loadEntry(span.book, formatVerseId(single));
    return { verses, loaded };
  }, [params.ref]);

  const label = span === null ? "" : formatRange(params.ref ?? "");
  const firstId = span === null ? "" : formatVerseId(ordToParts(span.startOrd));
  const shell = (children: React.ReactNode, unreviewed = false) => (
    <SheetScreen title="Translations" subtitle={label} unreviewed={unreviewed} backLabel={label} verseId={firstId} closeLabel="Back to Understand" testID="translations">
      {children}
    </SheetScreen>
  );
  if (data === undefined || data === null || span === null) return shell(null);

  const order: Translation[] = [reading, ...TRANSLATIONS.map((t) => t.code).filter((c) => c !== reading)];
  const joined = (t: Translation) => data.verses.map((v) => v.texts[t] ?? "").join(" ").trim();
  const present = order.filter((t) => joined(t) !== "");
  // One translation present (or none) is not agreement.
  const agree = present.length >= 2 && !hasRealDivergence(present.map(joined));
  const multi = data.verses.length > 1;

  if (agree) {
    const names = present.length === 3 ? `${present[0]}, ${present[1]} and ${present[2]}` : present.join(" and ");
    return shell(
      <>
        <Prose step="claim" tone="muted" testID="translations-agree">
          {names} agree here.
        </Prose>
        <Scripture step="explanation" style={{ marginTop: 12 }}>
          {joined(reading)}
        </Scripture>
      </>,
    );
  }

  const [base, ...others] = present;
  return shell(
    <>
      {present.map((translation, index) => (
        <View key={translation} style={{ marginTop: index === 0 ? 0 : sectionGap }} testID={`compare-${translation}`}>
          <Label accessibilityLabel={translation === reading ? `${translation}, your translation` : translation} style={{ marginBottom: 6 }}>
            {translation}
          </Label>
          <Scripture step="explanation">
            {data.verses.map((v, vi) => {
              const text = v.texts[translation] ?? "";
              const words =
                translation === base
                  ? markReadingDifferences(text, others.map((o) => v.texts[o] ?? ""))
                  : null;
              const number = multi ? (
                <Scripture key={`n${v.ord}`} step="explanation" tone="muted" style={{ fontSize: 13 }}>
                  {`${ordToParts(v.ord).verse} `}
                </Scripture>
              ) : null;
              return (
                <Scripture key={v.ord} step="explanation">
                  {vi > 0 ? " " : ""}
                  {number}
                  {words === null
                    ? text
                    : words.map((w, i) => {
                        const space = w.trailing === "" ? "" : " ";
                        if (!w.divergent) return `${w.text}${space}`;
                        // Mark the word's letters only, not its punctuation or the space after it.
                        const [, lead = "", core = w.text, tail = ""] = /^(\P{L}*)(.*?)(\P{L}*)$/u.exec(w.text) ?? [];
                        return (
                          <Scripture key={i} step="explanation">
                            {lead}
                            <Scripture
                              step="explanation"
                              style={{ backgroundColor: palette.highlight, textDecorationLine: "underline", textDecorationColor: palette.mutedInk }}
                              accessibilityLabel={`${core}, differs`}
                            >
                              {core}
                            </Scripture>
                            {tail}
                            {space}
                          </Scripture>
                        );
                      })}
                </Scripture>
              );
            })}
          </Scripture>
        </View>
      ))}

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
