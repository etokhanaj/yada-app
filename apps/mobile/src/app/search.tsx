/**
 * Search: one field; results under tracked-uppercase section labels, the way
 * Telegram and Alta separate result kinds
 * (https://mobbin.com/screens/9faafc96-77c1-4cb1-8a81-d6bde4047fa2,
 * https://mobbin.com/screens/35a1d0ef-6282-466c-9cef-fd865c8d417a).
 *
 *   REFERENCE  "jn 3 16", "1 cor 14:34", "Genesis" — the forgiving parser
 *   PASSAGES   FTS5 over the reader's translation, every term quoted
 *   WORDS      Greek/Hebrew forms via word_forms, or English via glosses
 */

import { BOOK_CODES, formatDisplayRef, ordToParts, verseOrd } from "@yada/schema";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { readerHref } from "../components/navigation";
import { PageHeader } from "../components/PageHeader";
import { Label, Original, Prose, Scripture } from "../components/Type";
import { useCore, useLog, useQuery } from "../data/AppData";
import {
  countPassages,
  getTexts,
  type Lexeme,
  type PassageHit,
  searchPassages,
  searchWordsByForm,
  searchWordsByGloss,
} from "../data/queries";
import { SPACE, usePalette, useType } from "../design/tokens";
import { planSearch, splitSnippet } from "../lib/searchQuery";
import { useSettings } from "../state/settings";

export default function SearchScreen() {
  const palette = usePalette();
  const core = useCore();
  const log = useLog();
  const translation = useSettings((s) => s.translation);
  const field = useType("explanation");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  // Debounced: a query per keystroke would make typing feel heavy.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 180);
    return () => clearTimeout(timer);
  }, [input]);

  const { data } = useQuery(async () => {
    if (query === "") return null;
    const plan = planSearch(query);
    const reference =
      plan.reference === null
        ? null
        : {
            ref: plan.reference,
            text:
              (await getTexts(core, verseOrd(plan.reference.book, plan.reference.chapter, plan.reference.verse ?? 1)))[
                translation
              ] ?? "",
          };
    const [passages, total, words] = await Promise.all([
      plan.fts === null ? Promise.resolve([] as PassageHit[]) : searchPassages(core, plan.fts, translation, 100),
      plan.fts === null ? Promise.resolve(0) : countPassages(core, plan.fts, translation),
      plan.wordKey !== null
        ? searchWordsByForm(core, plan.wordKey)
        : plan.glossWord !== null
          ? searchWordsByGloss(core, plan.glossWord)
          : Promise.resolve([] as Lexeme[]),
    ]);
    return { plan, reference, passages, total, words };
  }, [query, translation]);

  useEffect(() => {
    if (data?.plan !== undefined) log("search", undefined, data.plan.reference !== null ? "reference" : data.plan.script);
  }, [log, data?.plan]);

  const empty =
    data !== undefined && data !== null && data.reference === null && data.passages.length === 0 && data.words.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }}>
      <PageHeader title="Search" />
      <View style={{ paddingHorizontal: SPACE.lg }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          placeholder="A reference, a word, or a Greek or Hebrew word"
          placeholderTextColor={palette.mutedInk}
          style={[
            styles.field,
            { color: palette.ink, borderBottomColor: palette.divider, fontSize: field.size, writingDirection: "ltr" },
          ]}
          accessibilityLabel="Search the Bible"
          testID="search-field"
        />
      </View>
      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.results}>
        {data?.reference !== null && data?.reference !== undefined ? (
          <View>
            <Label style={styles.section}>Reference</Label>
            <ResultRow
              testID="result-reference"
              onPress={() =>
                router.push(
                  readerHref({
                    book: data.reference!.ref.book,
                    chapter: data.reference!.ref.chapter,
                    verse: data.reference!.ref.verse,
                    select: data.reference!.ref.verse !== undefined,
                  }),
                )
              }
            >
              <Label tone="ink" accessibilityRole="text">
                {data.reference.ref.verse === undefined
                  ? `${BOOK_CODES[data.reference.ref.book].name} ${data.reference.ref.chapter}`
                  : formatDisplayRef({ ...data.reference.ref, verse: data.reference.ref.verse })}
              </Label>
              <Scripture step="explanation" numberOfLines={3} style={{ marginTop: SPACE.xs }}>
                {data.reference.text}
              </Scripture>
            </ResultRow>
          </View>
        ) : null}

        {data !== undefined && data !== null && data.words.length > 0 ? (
          <View>
            <Label style={styles.section}>Words</Label>
            {data.words.map((lexeme) => (
              <ResultRow
                key={lexeme.occurrenceKey}
                testID={`result-word-${lexeme.occurrenceKey}`}
                onPress={() => router.push({ pathname: "/occurrences", params: { key: lexeme.occurrenceKey } })}
              >
                <View style={styles.wordLine}>
                  <Original script={lexeme.script} step="explanation">
                    {lexeme.lemma}
                  </Original>
                  <Prose step="claim" tone="muted">
                    {lexeme.translit}
                    {lexeme.gloss === null ? "" : ` · “${lexeme.gloss}”`}
                  </Prose>
                </View>
                <Prose step="note" tone="muted">
                  {lexeme.strongs === null ? "" : `${lexeme.strongs} · `}
                  {lexeme.total} {lexeme.total === 1 ? "occurrence" : "occurrences"} ·{" "}
                  {lexeme.script === "greek" ? "Greek" : "Hebrew"}
                </Prose>
              </ResultRow>
            ))}
          </View>
        ) : null}

        {data !== undefined && data !== null && data.passages.length > 0 ? (
          <View>
            <Label style={styles.section}>
              Passages · {data.total} in {translation}
              {data.total > data.passages.length ? `, first ${data.passages.length} shown` : ""}
            </Label>
            {data.passages.map((hit) => {
              const parts = ordToParts(hit.ord);
              return (
                <ResultRow
                  key={hit.ord}
                  testID={`result-passage-${hit.ord}`}
                  onPress={() =>
                    router.push(readerHref({ book: parts.book, chapter: parts.chapter, verse: parts.verse, select: true }))
                  }
                >
                  <Label tone="ink" accessibilityRole="text">
                    {formatDisplayRef(parts)}
                  </Label>
                  <Scripture step="explanation" style={{ marginTop: SPACE.xs }}>
                    {splitSnippet(hit.snippet).map((piece, i) => (
                      <Scripture key={i} step="explanation" style={piece.hit ? { fontWeight: "700" } : null}>
                        {piece.text}
                      </Scripture>
                    ))}
                  </Scripture>
                </ResultRow>
              );
            })}
          </View>
        ) : null}

        {empty ? (
          <Prose tone="muted" style={{ marginTop: SPACE.lg }}>
            Nothing found for “{query}”.
          </Prose>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ResultRow({ children, onPress, testID }: { children: React.ReactNode; onPress: () => void; testID?: string }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderTopColor: palette.divider }, pressed ? { backgroundColor: palette.selection } : null]}
      accessibilityRole="link"
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACE.sm,
  },
  results: {
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.xxl,
  },
  section: {
    marginTop: SPACE.lg,
    marginBottom: SPACE.xs,
  },
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACE.md,
    marginHorizontal: -SPACE.sm,
    paddingHorizontal: SPACE.sm,
  },
  wordLine: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    columnGap: SPACE.sm,
  },
});
