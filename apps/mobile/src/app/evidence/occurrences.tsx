/**
 * Every verse where a word occurs (J01-08, GN-05), as Apple Books lists
 * search-in-book hits: a small reference head, then the verse
 * (https://mobbin.com/screens/df9458bb-93ae-4866-b225-8d4a0f9e23d4), then the
 * form the word takes there. The verse the reader came from is marked `Here`
 * with the selection wash and bar, as everything chosen is.
 *
 * The English is not bolded: the bundle has no word alignment between the
 * English and the Greek or Hebrew, and guessing one would state a match the
 * data does not contain (rule 4).
 *
 * Tapping a verse peeks it first, then `Read …` leaves (brief §1 rule 5).
 */

import { useEffect } from "react";
import { clearFootprints, showFootprints } from "../../state/footprints";
import { BOOK_CODES, type BookCode, formatDisplayRef, formatVerseId, isBookCode, ordToParts, parseVerseId } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "../../components/Icon";
import { SheetScreen } from "../../components/Sheet";
import { Chrome, Original, Prose, Scripture } from "../../components/Type";
import { useCore, useQuery } from "../../data/AppData";
import { getLexeme, getOccurrences, getTextsForOrds, scriptOf } from "../../data/queries";
import { RADIUS, usePalette } from "../../design/tokens";
import { useSettings } from "../../state/settings";

const LIMIT = 600;

export default function OccurrencesScreen() {
  const params = useLocalSearchParams<{ key?: string; book?: string; from?: string; via?: string }>();
  const key = params.key ?? "";
  const book: BookCode | null = params.book !== undefined && isBookCode(params.book) ? params.book : null;
  const from = params.from ?? "";
  const fromRef = parseVerseId(from);
  const core = useCore();
  const palette = usePalette();
  const translation = useSettings((s) => s.translation);

  const { data } = useQuery(async () => {
    const [lexeme, occurrences] = await Promise.all([getLexeme(core, key), getOccurrences(core, key, book, LIMIT)]);
    const ords = occurrences.map((o) => o.ord);
    const own = await getTextsForOrds(core, ords, translation);
    // A licensed or downloaded version is not in the core bundle, so its verses came back empty here (IA stress
    // test, 15 Oct 2026). The BSB stands in, and says so, as Peek does.
    const missing = ords.filter((o) => !own.has(o));
    const bsb = missing.length > 0 && translation !== "BSB" ? await getTextsForOrds(core, missing, "BSB") : new Map<number, string>();
    const texts = new Map([...bsb, ...own]);
    return { lexeme, occurrences, texts, shownInBsb: bsb.size > 0 };
  }, [key, book, translation]);

  // MM-04: the uses in the chapter behind the sheet are ticked there while this page is open.
  useEffect(() => {
    if (data === undefined || fromRef === null) return;
    const here = data.occurrences.map((o) => ordToParts(o.ord)).filter((p) => p.book === fromRef.book && p.chapter === fromRef.chapter);
    showFootprints(fromRef.book, fromRef.chapter, here.map((p) => p.verse));
    return clearFootprints;
  }, [data, from]);

  const scope = book === null ? "the Bible" : BOOK_CODES[book].name;
  const display = fromRef === null ? null : formatDisplayRef(fromRef);
  const viaSearch = params.via === "search";
  const chapters = new Set((data?.occurrences ?? []).map((o) => ordToParts(o.ord).chapter));
  const n = data?.occurrences.length ?? 0;
  const countLine =
    book === null || n === 0 || n >= LIMIT ? null : `${n} ${n === 1 ? "time" : "times"}${chapters.size === 1 && n > 1 ? `, all in chapter ${[...chapters][0]}` : ""}`;
  const title = `${data?.lexeme?.lemma ?? ""} in ${scope}`;
  const shell = (children: React.ReactNode) => (
    <SheetScreen
      title={title}
      // MM-04: how often, and whether all in one chapter ("3 times, all in chapter 14"); else the verse.
      subtitle={countLine ?? display ?? undefined}
      backLabel={display}
      verseId={from}
      backText={viaSearch ? "Back to search" : undefined}
      closeLabel={viaSearch ? "Close" : "Back to Understand"}
      testID="occurrences"
    >
      {children}
    </SheetScreen>
  );
  if (data === undefined) return shell(null);
  const { lexeme, occurrences, texts, shownInBsb } = data;
  const script = lexeme?.script ?? (book === null ? "greek" : scriptOf(book));
  // A psalm title (verse 0) is read with verse 1, so it is marked there.
  const ids = occurrences.map((o) => {
    const p = ordToParts(o.ord);
    return formatVerseId(p.book, p.chapter, p.verse === 0 ? 1 : p.verse);
  });

  return shell(
    <>
      {shownInBsb ? (
        <Chrome step="note" tone="muted" style={{ marginBottom: 8 }} testID="bsb-basis">
          Shown in BSB
        </Chrome>
      ) : null}
      {occurrences.length >= LIMIT ? (
        <Prose step="note" tone="muted" style={{ marginBottom: 8 }}>
          The first {LIMIT} verses.
        </Prose>
      ) : null}
      {occurrences.map((occurrence, index) => {
        const parts = ordToParts(occurrence.ord);
        const verse = parts.verse === 0 ? 1 : parts.verse;
        const id = ids[index] ?? "";
        const here = id === from;
        const ref = formatDisplayRef({ ...parts, verse });
        const text = texts.get(occurrence.ord) ?? "";
        const forms = occurrence.surfaces.join(" · ");
        const previousHere = index > 0 && ids[index - 1] === from;
        return (
          <Pressable
            key={occurrence.ord}
            onPress={() => router.push({ pathname: "/evidence/peek", params: { ref: id, from, via: viaSearch ? "search" : "" } })}
            unstable_pressDelay={60}
            accessibilityRole="button"
            accessibilityLabel={`${ref}${here ? ", Here" : ""}. Form ${forms}. ${text}`}
            testID={`occurrence-${id}`}
            style={({ pressed }) => [
              styles.row,
              index > 0 && !here && !previousHere ? { boxShadow: `0 -1px 0 ${palette.divider}` } : null,
              here ? [styles.here, { backgroundColor: palette.selection }] : null,
              pressed && !here ? { backgroundColor: palette.fill } : null,
            ]}
          >
            {here ? <View style={[styles.bar, { backgroundColor: palette.accent }]} /> : null}
            <View style={{ flex: 1, minWidth: 0, rowGap: 4 }}>
              <View style={{ flexDirection: "row", columnGap: 8, flexWrap: "wrap" }}>
                <Chrome step="note" tone="muted" style={{ fontWeight: "500" }}>
                  {ref}
                </Chrome>
                {here ? (
                  <Chrome step="note" tone="ink" style={{ fontWeight: "700" }}>
                    Here
                  </Chrome>
                ) : null}
              </View>
              <Scripture step="claim" style={{ fontFamily: "Literata" }}>
                {text}
              </Scripture>
              <Prose step="note" tone="muted">
                Form{" "}
                <Original script={script} step="note" tone="muted">
                  {forms}
                </Original>
              </Prose>
            </View>
            <Icon name="forward" size={18} tone="muted" />
          </Pressable>
        );
      })}
    </>,
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    paddingVertical: 14,
  },
  here: {
    borderRadius: RADIUS.wash,
    marginHorizontal: -12,
    paddingLeft: 22,
    paddingRight: 12,
  },
  bar: {
    position: "absolute",
    left: 8,
    top: 16,
    bottom: 16,
    width: 3,
    borderRadius: 2,
  },
});
