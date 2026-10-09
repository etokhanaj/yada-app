/**
 * Every verse where a word occurs, as Apple Books lists search-in-book hits:
 * a small reference head, then the passage
 * (https://mobbin.com/screens/df9458bb-93ae-4866-b225-8d4a0f9e23d4).
 * The original form in each verse sits under the English, because the English
 * cannot be highlighted for a Greek or Hebrew word honestly.
 *
 * Tapping a verse reads it; the reader's back control then returns here, and
 * Back to reading returns to where the reader started.
 */

import { BOOK_CODES, type BookCode, formatDisplayRef, isBookCode, ordToParts, parseVerseId } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useSheetNav } from "../components/navigation";
import { SheetScreen } from "../components/Sheet";
import { Label, Original, Prose, Scripture } from "../components/Type";
import { useCore, useQuery } from "../data/AppData";
import { getLexeme, getOccurrences, getTextsForOrds, scriptOf } from "../data/queries";
import { SPACE, usePalette } from "../design/tokens";
import { useSettings } from "../state/settings";

const LIMIT = 600;

export default function OccurrencesScreen() {
  const params = useLocalSearchParams<{ key?: string; book?: string; from?: string; via?: string }>();
  const backText = params.via === "search" ? "Back to search" : undefined;
  const key = params.key ?? "";
  const book: BookCode | null = params.book !== undefined && isBookCode(params.book) ? params.book : null;
  const from = params.from ?? "";
  const fromRef = parseVerseId(from);
  const core = useCore();
  const palette = usePalette();
  const translation = useSettings((s) => s.translation);
  const { jumpTo } = useSheetNav();

  const { data } = useQuery(async () => {
    const [lexeme, occurrences] = await Promise.all([getLexeme(core, key), getOccurrences(core, key, book, LIMIT)]);
    const texts = await getTextsForOrds(core, occurrences.map((o) => o.ord), translation);
    return { lexeme, occurrences, texts };
  }, [key, book, translation]);

  const backLabel = fromRef === null ? null : formatDisplayRef(fromRef);
  if (data === undefined) return <SheetScreen backLabel={backLabel}>{null}</SheetScreen>;
  const { lexeme, occurrences, texts } = data;
  const script = lexeme?.script ?? (book === null ? "greek" : scriptOf(book));
  const scope = book === null ? "the Bible" : BOOK_CODES[book].name;

  return (
    <SheetScreen backLabel={backLabel} verseId={from} backText={backText}>
      <Label accessibilityRole="header">Occurrences in {scope}</Label>
      <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: SPACE.sm, marginTop: SPACE.xs }}>
        <Original script={script} step="headword">
          {lexeme?.lemma ?? key}
        </Original>
        {lexeme !== null ? (
          <Prose step="claim" tone="muted">
            {lexeme.translit}
            {lexeme.gloss === null ? "" : ` · “${lexeme.gloss}”`}
          </Prose>
        ) : null}
      </View>
      <Prose step="note" tone="muted" style={{ marginTop: SPACE.xs, marginBottom: SPACE.md }} testID="occurrence-count">
        {occurrences.length} {occurrences.length === 1 ? "verse" : "verses"}
        {occurrences.length >= LIMIT ? ` (first ${LIMIT} shown)` : ""}
      </Prose>

      {occurrences.map((occurrence) => {
        const parts = ordToParts(occurrence.ord);
        const id = `${parts.book}.${parts.chapter}.${parts.verse}`;
        const here = id === from;
        return (
          <Pressable
            key={occurrence.ord}
            onPress={() =>
              jumpTo({ book: parts.book, chapter: parts.chapter, verse: parts.verse === 0 ? 1 : parts.verse, from: from === "" ? undefined : from, select: true })
            }
            style={({ pressed }) => [
              styles.row,
              { borderTopColor: palette.divider },
              pressed ? { backgroundColor: palette.selection } : null,
            ]}
            accessibilityRole="link"
            accessibilityLabel={`${formatDisplayRef(parts)}${here ? ", where you are reading" : ""}`}
            testID={`occurrence-${id}`}
          >
            <View style={styles.head}>
              <Label tone={here ? "accent" : "ink"} accessibilityRole="text">
                {formatDisplayRef(parts)}
              </Label>
              {here ? <Label tone="accent">You are here</Label> : null}
            </View>
            <Scripture step="explanation" style={{ marginTop: SPACE.xs }}>
              {texts.get(occurrence.ord) ?? (parts.verse === 0 ? "Psalm title" : "")}
            </Scripture>
            <Original script={script} step="claim" tone="muted" style={{ marginTop: SPACE.xs }}>
              {occurrence.surfaces.join(" · ")}
            </Original>
          </Pressable>
        );
      })}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACE.md,
    marginHorizontal: -SPACE.sm,
    paddingHorizontal: SPACE.sm,
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: SPACE.md,
  },
});
