/**
 * Search (canvas S-01…S-04, E-04): a sheet with the field focused and
 * `Cancel`, as Apple Books' in-book search. Groups under sentence-case labels:
 *
 *   Go to       "jn 3 16", "1 cor 14:34", "Genesis" — the forgiving parser
 *   Words       Greek/Hebrew forms via word_forms, or English via glosses (5, then Show all)
 *   Passages    FTS5 over the reader's translation, every term quoted
 *
 * Words sit above passages, few and capped, as Telegram puts chats above
 * messages (https://mobbin.com/screens/9faafc96-77c1-4cb1-8a81-d6bde4047fa2).
 */

import { BOOK_CODES, formatDisplayRef, formatVerseId, ordToParts, verseOrd } from "@yada/schema";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Icon } from "../components/Icon";
import { useSheetNav } from "../components/navigation";
import { ListRow } from "../components/Page";
import { SheetScreen, TextLink } from "../components/Sheet";
import { Chrome, Label, Original, Prose, Scripture } from "../components/Type";
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
import { searchProfiles } from "../data/study";
import { useLayout, usePalette } from "../design/tokens";
import { fieldDirection } from "../lib/fieldDirection";
import { excerptOf } from "../lib/reader";
import { createSearchLogger } from "../lib/searchLog";
import { planSearch, type SearchPlan, splitSnippet } from "../lib/searchQuery";
import { whoLine } from "../lib/study";
import { useSettings } from "../state/settings";

const WORDS_SHOWN = 5;

export default function SearchScreen() {
  const palette = usePalette();
  const { ax } = useLayout();
  const core = useCore();
  const log = useLog();
  const translation = useSettings((s) => s.translation);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [allWords, setAllWords] = useState(false);

  // Debounced: a query per keystroke would make typing feel heavy.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input.trim());
      setAllWords(false);
    }, 180);
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
    const [people, passages, total, words] = await Promise.all([
      // Tyndale's profiles in the books whose study notes are downloaded (canvas TD-03).
      plan.reference === null ? searchProfiles(query) : Promise.resolve([]),
      plan.fts === null ? Promise.resolve([] as PassageHit[]) : searchPassages(core, plan.fts, translation, 100),
      plan.fts === null ? Promise.resolve(0) : countPassages(core, plan.fts, translation),
      plan.wordKey !== null
        ? searchWordsByForm(core, plan.wordKey)
        : plan.glossWord !== null
          ? searchWordsByGloss(core, plan.glossWord)
          : Promise.resolve([] as Lexeme[]),
    ]);
    return { plan, reference, people, passages, total, words };
  }, [query, translation]);

  const searchLog = useMemo(() => createSearchLogger((detail) => log("search", undefined, detail)), [log]);
  useEffect(() => () => searchLog.dispose(), [searchLog]);
  useEffect(() => {
    searchLog.typed(query, searchDetail(planSearch(query)));
  }, [searchLog, query]);

  const { jumpTo } = useSheetNav();
  const open = (href: Parameters<typeof router.push>[0]) => {
    searchLog.settle();
    router.push(href);
  };
  /** A verse or chapter: Search closes and the reader opens, never inside the sheet. */
  const read = (target: Parameters<typeof jumpTo>[0]) => {
    searchLog.settle();
    jumpTo(target);
  };

  // From the raw input, not the debounced query, so the first Hebrew letter turns the field at once.
  const direction = fieldDirection(input);

  const empty =
    query.length >= 2 &&
    data !== undefined &&
    data !== null &&
    data.reference === null &&
    data.people.length === 0 &&
    data.passages.length === 0 &&
    data.words.length === 0;

  const field = (
    <View style={styles.searchRow}>
      <View style={[styles.field, { backgroundColor: palette.fill, height: ax ? 64 : 44 }]}>
        <Icon name="search" size={16} tone="muted" />
        <TextInput
          value={input}
          onChangeText={setInput}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          onSubmitEditing={() => {
            const submitted = input.trim();
            setQuery(submitted);
            searchLog.typed(submitted, searchDetail(planSearch(submitted)));
            searchLog.settle();
          }}
          placeholder="Search the Bible"
          placeholderTextColor={palette.mutedInk}
          maxFontSizeMultiplier={2}
          // Direction follows the first strong character, so Hebrew types right to left (brief §5).
          // Alignment is set with it rather than left to "auto", so the field does not depend on
          // how UITextField resolves natural alignment against an LTR app.
          style={{
            flex: 1,
            color: palette.ink,
            fontSize: 17,
            writingDirection: direction,
            textAlign: direction === "rtl" ? "right" : "left",
          }}
          accessibilityLabel="Search the Bible"
          testID="search-field"
        />
      </View>
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.cancel} testID="search-cancel">
        <Chrome tone="ink" style={{ fontWeight: "500" }}>
          Cancel
        </Chrome>
      </Pressable>
    </View>
  );

  const ref = data?.reference ?? null;
  return (
    <SheetScreen title="Search" header={field} backLabel={null} footer={false} keyboard testID="search">
      {ref !== null ? (
        <View>
          <Label style={styles.section}>Go to</Label>
          <ListRow
            first
            testID="result-reference"
            onPress={() =>
              read({ book: ref.ref.book, chapter: ref.ref.chapter, verse: ref.ref.verse, select: ref.ref.verse !== undefined })
            }
            title={
              ref.ref.verse === undefined
                ? `${BOOK_CODES[ref.ref.book].name} ${ref.ref.chapter}`
                : formatDisplayRef({ ...ref.ref, verse: ref.ref.verse })
            }
          >
            <Scripture step="claim" tone="muted" numberOfLines={ax ? 3 : 1} style={{ fontFamily: "Literata" }}>
              {excerptOf(ref.text)}
            </Scripture>
          </ListRow>
        </View>
      ) : null}

      {/* A name finds the person first, then the verses that name them (canvas TD-03). */}
      {data !== undefined && data !== null && data.people.length > 0 ? (
        <View>
          <Label style={styles.section}>People</Label>
          {data.people.map((person, i) => {
            const who = whoLine(person.title ?? "", person.text);
            const line = who === null ? "Tyndale" : `${who} · Tyndale`;
            return (
              <ListRow
                key={`${person.book}-${person.id}`}
                first={i === 0}
                testID={`result-person-${person.id}`}
                title={person.title ?? ""}
                label={`${person.title ?? ""}, ${line.replace(" · ", ", from ")}`}
                onPress={() =>
                  open({
                    pathname: "/understand/person",
                    params: { book: person.book, id: String(person.id), from: formatVerseId(ordToParts(person.ord_start)), via: "search" },
                  })
                }
              >
                <Chrome step="note" tone="muted">
                  {line}
                </Chrome>
              </ListRow>
            );
          })}
        </View>
      ) : null}

      {data !== undefined && data !== null && data.words.length > 0 ? (
        <View>
          <Label style={styles.section}>Words</Label>
          {(allWords ? data.words : data.words.slice(0, WORDS_SHOWN)).map((lexeme, i) => (
            <ListRow
              key={lexeme.occurrenceKey}
              first={i === 0}
              testID={`result-word-${lexeme.occurrenceKey}`}
              label={`${lexeme.translit}, ${lexeme.gloss ?? ""}. ${lexeme.script === "greek" ? "Greek" : "Hebrew"}, ${lexeme.total} times`}
              onPress={() => open({ pathname: "/evidence/in-bible", params: { key: lexeme.occurrenceKey, via: "search" } })}
            >
              {/* Headword in its own Text: nested inside English, a Hebrew span set the whole line right to left. */}
              <View style={styles.wordLine}>
                <Original script={lexeme.script} step="claim" style={{ fontSize: 22, lineHeight: 30 }}>
                  {lexeme.lemma}
                </Original>
                <Prose step="claim">
                  <Prose step="claim" tone="muted">
                    {lexeme.translit}
                  </Prose>
                  {lexeme.gloss === null ? "" : ` “${lexeme.gloss}”`}
                </Prose>
              </View>
              <Chrome step="note" tone="muted">
                {lexeme.script === "greek" ? "Greek" : "Hebrew"} · {lexeme.total} {lexeme.total === 1 ? "time" : "times"}
              </Chrome>
            </ListRow>
          ))}
          {!allWords && data.words.length > WORDS_SHOWN ? (
            <TextLink label={`Show all ${data.words.length} words`} onPress={() => setAllWords(true)} testID="show-all-words" />
          ) : null}
        </View>
      ) : null}

      {data !== undefined && data !== null && data.passages.length > 0 ? (
        <View>
          <Label style={styles.section}>Passages · {data.total}</Label>
          {data.passages.map((hit, i) => {
            const parts = ordToParts(hit.ord);
            return (
              <ListRow
                key={hit.ord}
                first={i === 0}
                testID={`result-passage-${hit.ord}`}
                overline={formatDisplayRef(parts)}
                onPress={() => read({ book: parts.book, chapter: parts.chapter, verse: parts.verse, select: true })}
              >
                <Scripture step="claim" numberOfLines={ax ? 3 : 2} style={{ fontFamily: "Literata" }}>
                  {splitSnippet(hit.snippet).map((piece, j) => (
                    <Scripture key={j} step="claim" style={[{ fontFamily: "Literata" }, piece.hit ? { fontWeight: "600" } : null]}>
                      {piece.text}
                    </Scripture>
                  ))}
                </Scripture>
              </ListRow>
            );
          })}
        </View>
      ) : null}

      {empty ? (
        <View style={{ marginTop: 20 }} testID="search-empty">
          <Prose step="explanation">No results for “{query}”.</Prose>
          <Prose step="note" tone="muted" style={{ marginTop: 6 }}>
            Search takes references, English words, and Greek or Hebrew.
          </Prose>
        </View>
      ) : null}
    </SheetScreen>
  );
}

function searchDetail(plan: SearchPlan): string {
  return plan.reference !== null ? "reference" : plan.script;
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    paddingTop: 6,
  },
  field: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  cancel: {
    minHeight: 44,
    justifyContent: "center",
  },
  wordLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: 6,
  },
  section: {
    marginTop: 18,
    marginBottom: 4,
  },
});
