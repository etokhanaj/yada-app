/**
 * Search (canvas S-01…S-04, E-04): a sheet with the field focused and
 * `Cancel`, as Apple Books' in-book search. Groups under sentence-case labels:
 *
 *   Go to       "jn 3 16", "1 cor 14:34", "Genesis" — the forgiving parser
 *   Dictionary  Translation Words' terms, before the verses (DI-03, PD-04)
 *   Guides      a passage title finds its guide (IA-06)
 *   Words       Greek/Hebrew forms via word_forms, or English via glosses (5, then Show all)
 *   Passages    FTS5 over the reader's translation, every term quoted
 *
 * Words sit above passages, few and capped, as Telegram puts chats above
 * messages (https://mobbin.com/screens/9faafc96-77c1-4cb1-8a81-d6bde4047fa2).
 *
 * Search follows the translation (John, 12 Oct 2026). A licensed version is searched through the proxy
 * (EG-06): its verses, the way to the BSB's own search with Words, and the notice (§7). Offline, or if
 * that search fails, the BSB is searched and one line says so (EG-07). Nothing found there is stored.
 *
 * Before anything is typed, Search offers the dictionary to browse (DI-04). VM-01 draws six moments there (Anxious,
 * Afraid…); their verse lists need a vetted source and John's review (build-7-plan.md, "Verses for a moment"), and no
 * bundle holds them, so they are not drawn.
 */

import { BOOK_CODES, formatDisplayRef, formatVerseId, ordToParts, parseVerseId, verseOrd } from "@yada/schema";
import { router } from "expo-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "../components/Icon";
import { useTabBarClearance } from "../components/TabBar";
import { readerHref, useSheetNav } from "../components/navigation";
import { ListRow } from "../components/Page";
import { SheetScreen, TextLink } from "../components/Sheet";
import { SectionTitle, Chrome, Original, Prose, Scripture } from "../components/Type";
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
import { isLicensedCode } from "../data/licensed";
import { searchProfiles } from "../data/study";
import { licensedEnabled, useLicensedSearch } from "../data/useLicensedChapter";
import { useLayout, usePalette } from "../design/tokens";
import { fieldDirection } from "../lib/fieldDirection";
import { formatRange } from "../lib/chapters";
import { findGuides, findTerms, firstSentence } from "../lib/dictionary";
import { excerptOf } from "../lib/reader";
import { createSearchLogger } from "../lib/searchLog";
import { planSearch, type SearchPlan, splitSnippet } from "../lib/searchQuery";
import { whoLine } from "../lib/study";
import { useSettings } from "../state/settings";

const WORDS_SHOWN = 5;

/**
 * IA-15: Search is also the round button beside the tab bar, a tab of its own (app/(tabs)/search.tsx), so it is one
 * step from Today as well as Bible. There it is a page under the bar, not a sheet: no Cancel, and a verse opens the
 * reader over the tabs.
 */
export default function SearchScreen({ inTab = false }: { inTab?: boolean }) {
  const palette = usePalette();
  const { ax } = useLayout();
  const core = useCore();
  const log = useLog();
  const reading = useSettings((s) => s.translation);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  // What the Search key sent. A licensed search runs on that alone: each costs one of the month's
  // API.Bible calls, so typing searches the BSB on the phone and the licensed version waits.
  const [submitted, setSubmitted] = useState("");
  const [bsbInstead, setBsbInstead] = useState(false);
  const licensedCode = licensedEnabled() && isLicensedCode(reading) && !bsbInstead ? reading : null;
  // The proxy takes words only: references, verse numbers and punctuation are the BSB's own search.
  const words = submitted.replace(/[^\p{L}\p{N}\s'’-]/gu, " ").replace(/\s+/gu, " ").trim();
  const licensed = useLicensedSearch(licensedCode, submitted !== "" && submitted === query && planSearch(submitted).reference === null ? words : "");
  const fallback = licensed !== undefined && licensed.status !== "ok";
  // "Offline" only when it is: a refused or failed search falls back quietly with its own line.
  const offline = licensed?.status === "needs-connection";
  // The core holds no licensed text: everything here searches the BSB under a licensed reading.
  const translation = isLicensedCode(reading) ? "BSB" : reading;
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
    // The dictionary and guide titles are in the app (data/dictionary.generated.ts): found with no book's file here.
    const terms = plan.reference === null ? findTerms(query) : [];
    const guides = plan.reference === null ? findGuides(query) : [];
    return { plan, reference, people, passages, total, words, terms, guides };
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
  /**
   * The dictionary's pages (DI-04) are pages, not sheets. In the tab they push over it with ‹ Search; from the sheet,
   * Search closes first, as it does for a verse, so a page is never drawn inside a sheet.
   */
  const openPage = (href: Parameters<typeof router.push>[0]) => {
    searchLog.settle();
    if (!inTab) router.back();
    router.push(href);
  };
  const back = inTab ? "Search" : "Back";
  /** A verse or chapter: Search closes and the reader opens, never inside the sheet. */
  const read = (target: Parameters<typeof jumpTo>[0]) => {
    searchLog.settle();
    if (inTab) router.push(readerHref(target));
    else jumpTo(target);
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
    data.words.length === 0 &&
    data.terms.length === 0 &&
    data.guides.length === 0;

  const field = (
    <View style={styles.searchRow}>
      <View style={[styles.field, { backgroundColor: palette.fill, height: ax ? 64 : 44 }]}>
        <Icon name="search" size={16} tone="muted" />
        <TextInput
          value={input}
          onChangeText={(text) => {
            setInput(text);
            setSubmitted("");
          }}
          autoFocus={!inTab}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          onSubmitEditing={() => {
            const sent = input.trim();
            setQuery(sent);
            setSubmitted(sent);
            searchLog.typed(sent, searchDetail(planSearch(sent)));
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
      {inTab ? null : (
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.cancel} testID="search-cancel">
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            Cancel
          </Chrome>
        </Pressable>
      )}
    </View>
  );

  const ref = data?.reference ?? null;
  return (
    <Frame inTab={inTab} field={field}>
      {input === "" && query === "" ? (
        <View testID="search-browse">
          <SectionTitle inSheet style={styles.section}>Browse</SectionTitle>
          <ListRow first title="Dictionary" onPress={() => openPage({ pathname: "/dictionary", params: { back } })} testID="browse-dictionary" />
        </View>
      ) : null}

      {ref !== null ? (
        <View>
          <SectionTitle inSheet style={styles.section}>Go to</SectionTitle>
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

      {/* DI-03, PD-04: a term finds its dictionary entry before the verses. */}
      {data !== undefined && data !== null && data.terms.length > 0 ? (
        <View testID="result-dictionary">
          <SectionTitle inSheet style={styles.section}>Dictionary</SectionTitle>
          {data.terms.map((entry, i) => (
            <ListRow
              key={entry.term}
              first={i === 0}
              title={entry.term}
              label={`${entry.term}, ${firstSentence(entry.definition)}`}
              onPress={() => openPage({ pathname: "/dictionary/term", params: { term: entry.term, back } })}
              testID={`result-term-${entry.term}`}
            >
              <Chrome step="note" tone="muted">
                {firstSentence(entry.definition)}
              </Chrome>
            </ListRow>
          ))}
        </View>
      ) : null}

      {/* IA-06: a passage title finds its guide, a sheet over Search as People's pages are. */}
      {data !== undefined && data !== null && data.guides.length > 0 ? (
        <View testID="result-guides">
          <SectionTitle inSheet style={styles.section}>Guides</SectionTitle>
          {data.guides.map((guide, i) => (
            <ListRow
              key={guide.ref}
              first={i === 0}
              book
              title={guide.title}
              label={`${guide.title}, ${formatRange(guide.ref)}`}
              onPress={() => open({ pathname: "/guide", params: { ref: guide.ref } })}
              testID={`result-guide-${guide.ref}`}
            >
              <Chrome step="note" tone="muted">
                {formatRange(guide.ref)}
              </Chrome>
            </ListRow>
          ))}
        </View>
      ) : null}

      {/* A name finds the person first, then the verses that name them (canvas TD-03). */}
      {data !== undefined && data !== null && data.people.length > 0 ? (
        <View>
          <SectionTitle inSheet style={styles.section}>People</SectionTitle>
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
          <SectionTitle inSheet style={styles.section}>Words</SectionTitle>
          {(allWords ? data.words : data.words.slice(0, WORDS_SHOWN)).map((lexeme, i) => (
            <ListRow
              key={lexeme.occurrenceKey}
              first={i === 0}
              testID={`result-word-${lexeme.occurrenceKey}`}
              label={`${lexeme.translit}, ${lexeme.gloss ?? ""}. ${lexeme.language}, ${lexeme.total} times`}
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
                {lexeme.language} · {lexeme.total} {lexeme.total === 1 ? "time" : "times"}
              </Chrome>
            </ListRow>
          ))}
          {!allWords && data.words.length > WORDS_SHOWN ? (
            <TextLink label={`Show all ${data.words.length} words`} onPress={() => setAllWords(true)} testID="show-all-words" />
          ) : null}
        </View>
      ) : null}

      {licensed?.status === "ok" ? (
        <View testID="licensed-results">
          <SectionTitle inSheet style={styles.section}>{`Verses in the ${licensed.translation}`}</SectionTitle>
          {licensed.verses.map((v, i) => {
            const at = parseVerseId(v.verseId);
            return (
              <ListRow
                key={v.verseId}
                first={i === 0}
                overline={v.reference}
                onPress={at === null ? undefined : () => read({ book: at.book, chapter: at.chapter, verse: at.verse, select: true })}
              >
                <Scripture step="claim" numberOfLines={ax ? 3 : 2} style={{ fontFamily: "Literata" }}>
                  {v.text}
                </Scripture>
              </ListRow>
            );
          })}
          <SectionTitle inSheet style={styles.section}>Also</SectionTitle>
          <ListRow first title="Search the BSB instead" onPress={() => setBsbInstead(true)} testID="search-bsb-instead">
            <Chrome step="note" tone="muted">
              on this iPhone · with Words
            </Chrome>
          </ListRow>
          <Chrome step="note" tone="muted" style={{ marginTop: 12 }} testID="licensed-search-notice">
            {licensed.copyright}
          </Chrome>
        </View>
      ) : null}

      {fallback && query.length >= 2 ? (
        <Prose step="note" tone="muted" style={{ marginTop: 12 }} testID="search-offline">
          {offline
            ? "You’re offline, so this searches the BSB."
            : licensed?.status === "limit"
              ? `This searches the BSB: this month’s ${reading} searches are used.`
              : `This searches the BSB: the ${reading} search didn’t answer.`}
        </Prose>
      ) : null}

      {data !== undefined && data !== null && data.passages.length > 0 && (licensedCode === null || licensed === undefined || fallback) ? (
        <View>
          <SectionTitle inSheet style={styles.section}>{`Verses · ${data.total}`}</SectionTitle>
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
    </Frame>
  );
}

/** The sheet over the reader, or the page in the Search tab: the field on top, results scrolling under it, clear of the tab bar. */
function Frame({ inTab, field, children }: { inTab: boolean; field: ReactNode; children: ReactNode }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();
  const { gutter, tabs } = useLayout();
  if (!inTab)
    return (
      <SheetScreen title="Search" header={field} backLabel={null} footer={false} keyboard testID="search">
        {children}
      </SheetScreen>
    );
  return (
    <View style={{ flex: 1, backgroundColor: palette.paper, paddingTop: (tabs === "top" ? 0 : insets.top) + 8 }} testID="search-tab">
      <View style={{ paddingHorizontal: gutter, paddingBottom: 8 }}>{field}</View>
      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: tabClearance }}>
        {children}
      </ScrollView>
    </View>
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
