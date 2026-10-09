/**
 * Translation compare: the three versions stacked, the one being read first,
 * words that differ from it washed in the selection tone. Stacked rows of a
 * sentence over a small label, as language apps list parallel lines
 * (Babbel, https://mobbin.com/screens/96b28f59-d93b-4426-b7ec-2ad0253d85c9) —
 * no columns, no cards.
 *
 * The entry's translation_note appears only when the versions really choose
 * different words; a note explaining a divergence nobody can see would be
 * noise (handoff §6).
 */

import { formatDisplayRef, ordToParts } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { DraftLabel, Hairline, Section, SheetScreen } from "../components/Sheet";
import { Label, Prose, Scripture } from "../components/Type";
import { useCore, useQuery } from "../data/AppData";
import { getTextsInRange, type Translation } from "../data/queries";
import { isUnreviewed, loadEntry } from "../data/understand";
import { SPACE, usePalette } from "../design/tokens";
import { formatRange, resolveRef } from "../lib/chapters";
import { compareTranslations, hasRealDivergence } from "../lib/diff";
import { TRANSLATIONS, useSettings } from "../state/settings";

export default function CompareScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const span = resolveRef(params.ref ?? "");
  const core = useCore();
  const palette = usePalette();
  const reading = useSettings((s) => s.translation);

  const { data } = useQuery(async () => {
    if (span === null) return null;
    const verses = await getTextsInRange(core, span.startOrd, span.endOrd);
    const single = span.startOrd === span.endOrd ? ordToParts(span.startOrd) : null;
    const loaded = single === null ? null : await loadEntry(span.book, `${single.book}.${single.chapter}.${single.verse}`);
    return { verses, loaded };
  }, [params.ref]);

  const label = span === null ? null : formatRange(params.ref ?? "");
  if (data === undefined || data === null || span === null) return <SheetScreen backLabel={label}>{null}</SheetScreen>;
  const order: Translation[] = [reading, ...TRANSLATIONS.map((t) => t.code).filter((c) => c !== reading)];
  const firstParts = ordToParts(span.startOrd);
  const firstId = `${firstParts.book}.${firstParts.chapter}.${firstParts.verse}`;
  const anyDivergence = data.verses.some(({ texts }) =>
    hasRealDivergence(order.filter((t) => texts[t] !== undefined).map((t) => texts[t] ?? "")),
  );

  return (
    <SheetScreen backLabel={label} verseId={firstId}>
      <Label accessibilityRole="header">Compare translations · {label}</Label>
      <Prose step="note" tone="muted" style={{ marginTop: SPACE.xs }} testID="compare-caption">
        {anyDivergence
          ? `Shaded: words a version does not share with ${reading}, and in ${reading}, words neither of the others uses.`
          : "All three translations use the same words here."}
      </Prose>

      {data.verses.map(({ ord, texts }) => {
        const available = order.filter((t) => texts[t] !== undefined);
        const base = available[0];
        if (base === undefined) return null;
        const compared = compareTranslations(
          { translation: base, text: texts[base] ?? "" },
          available.slice(1).map((t) => ({ translation: t, text: texts[t] ?? "" })),
        );
        return (
          <View key={ord} style={{ marginTop: SPACE.lg }}>
            {data.verses.length > 1 ? <Label tone="ink">{formatDisplayRef(ordToParts(ord))}</Label> : null}
            {compared.map(({ translation, words }) => (
              <View key={translation} style={{ marginTop: SPACE.md }} testID={`compare-${translation}`}>
                <Label>
                  {translation}
                  {translation === reading ? " · reading" : ""}
                </Label>
                <Scripture step="explanation" style={{ marginTop: SPACE.xs }}>
                  {words.map((w, i) => (
                    <Scripture
                      key={i}
                      step="explanation"
                      style={w.divergent ? { backgroundColor: palette.selection } : null}
                      accessibilityLabel={w.divergent ? `${w.text}, differs` : undefined}
                    >
                      {w.text}
                      {w.trailing === "" ? "" : " "}
                    </Scripture>
                  ))}
                </Scripture>
              </View>
            ))}
          </View>
        );
      })}

      {data.loaded !== null && data.loaded.entry.translation_note !== undefined && anyDivergence ? (
        <>
          <Hairline />
          <Section title="Why the translations differ" first>
            {isUnreviewed(data.loaded.reviewStatus) ? <DraftLabel /> : null}
            <Prose step="claim" style={{ marginTop: SPACE.xs }}>
              {data.loaded.entry.translation_note}
            </Prose>
          </Section>
        </>
      ) : null}
    </SheetScreen>
  );
}
