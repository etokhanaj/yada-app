/**
 * Search (SE-30 to SE-32, Build 12): a sheet with the field focused and `Cancel`, as Apple Books' in-book search, and
 * the Search tab, a page under the bar with its large title.
 *
 * Before anything is typed (SE-30): the ways in as tint tiles, For when you're as picture tiles (as Pray draws them),
 * then Recent, the last searches, kept on this phone only (data/user.ts recent_searches).
 *
 * Results (SE-31): a reference goes first as Go to. Then the verses, which came last under Dictionary, Guides and
 * Words: their true count and the books they fall in, each a pill with its own count to jump by, the searched word
 * marked in each verse. Yada holds nothing on which verses are best known, so it never puts a "best" one first (RU-16):
 * they stay in Bible order, as a concordance lists them. Words, Guides, Dictionary (and People, when a name finds a
 * Tyndale profile) are pills beside Verses, each its own list.
 *
 * Nothing found (SE-32): "Did you mean anxious?" from the nearest word the Bible's own index holds (lib/search.ts), and
 * when the word is a mood, its picture tile.
 *
 * Search follows the translation (John, 12 Oct 2026). A licensed version is searched through the proxy
 * (EG-06): its verses, the way to the BSB's own search with Words, and the notice (§7). Offline, or if
 * that search fails, the BSB is searched and one line says so (EG-07). Nothing found there is stored.
 */

import { BOOK_CODES, type BookCode, formatDisplayRef, formatVerseId, ordToParts, parseVerseId, verseOrd } from "@yada/schema";
import { router, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FilterPills } from "../components/FilterPills";
import { Icon } from "../components/Icon";
import { useTabBarClearance } from "../components/TabBar";
import { readerHref, useSheetNav } from "../components/navigation";
import { LargeTitle, ListRow } from "../components/Page";
import { NEAR_END, SheetScreen, TextLink } from "../components/Sheet";
import { PictureTile, TileGrid, TintTile } from "../components/Tiles";
import { SectionTitle, Chrome, Original, Prose, Scripture } from "../components/Type";
import { useAppData, useCore, useLog, useQuery } from "../data/AppData";
import {
  bookBounds,
  countPassages,
  countPassagesByBook,
  getTexts,
  type Lexeme,
  nearestTerm,
  type PassageHit,
  searchPassages,
  searchWordsByForm,
  searchWordsByGloss,
} from "../data/queries";
import { isLicensedCode } from "../data/licensed";
import { pictureFor } from "../data/pictures";
import { PRAYERS_OF_THE_BIBLE } from "../data/prayersOfTheBible";
import { searchProfiles } from "../data/study";
import { licensedEnabled, useLicensedSearch } from "../data/useLicensedChapter";
import { listRecentSearches, rememberSearch } from "../data/user";
import { useLayout, usePalette } from "../design/tokens";
import { fieldDirection } from "../lib/fieldDirection";
import { type Moment, MOMENTS } from "../lib/moments";
import { formatRange } from "../lib/chapters";
import { findGuides, findTerms, firstSentence } from "../lib/dictionary";
import { excerptOf } from "../lib/reader";
import { moodFor } from "../lib/search";
import { createSearchLogger } from "../lib/searchLog";
import { planSearch, type SearchPlan, splitSnippet } from "../lib/searchQuery";
import { whoLine } from "../lib/study";
import { useSettings } from "../state/settings";

const WORDS_SHOWN = 5;
/** All books: the first hundred in Bible order, the book pills reaching the rest. One book: up to three hundred. */
const VERSES_SHOWN = 100;
const BOOK_VERSES_SHOWN = 300;
const RECENT_SHOWN = 5;
/**
 * Verses are drawn a page at a time as the list nears its foot: "peace" drew every row at once and the app stopped
 * answering touch for most of a minute (Release build QA, 25 Oct 2026).
 */
const VERSE_PAGE = 30;

type Kind = "verses" | "words" | "guides" | "dictionary" | "people";
const KIND_TITLES: Record<Kind, string> = { verses: "Verses", words: "Words", guides: "Guides", dictionary: "Dictionary", people: "People" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * IA-15: Search is also the round button beside the tab bar, a tab of its own (app/(tabs)/search.tsx), so it is one
 * step from Today as well as Bible. There it is a page under the bar, not a sheet: no Cancel, and a verse opens the
 * reader over the tabs.
 */
export default function SearchScreen({ inTab = false }: { inTab?: boolean }) {
  const palette = usePalette();
  const { ax } = useLayout();
  const core = useCore();
  const { user } = useAppData();
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
  const [kind, setKind] = useState<Kind | null>(null);
  const [book, setBook] = useState<BookCode | null>(null);
  const [pages, setPages] = useState(1);
  const [recent, setRecent] = useState<string[]>([]);

  const loadRecent = useCallback(() => {
    void listRecentSearches(user, RECENT_SHOWN)
      .then(setRecent)
      .catch(() => setRecent([]));
  }, [user]);
  useFocusEffect(loadRecent);
  const remember = (q: string) => {
    if (q.trim() === "") return;
    void rememberSearch(user, q).then(loadRecent, () => undefined);
  };

  // Debounced: a query per keystroke would make typing feel heavy.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input.trim());
      setAllWords(false);
      setKind(null);
      setBook(null);
      setPages(1);
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
    const [people, passages, total, books, words] = await Promise.all([
      // Tyndale's profiles in the books whose study notes are downloaded (canvas TD-03).
      plan.reference === null ? searchProfiles(query) : Promise.resolve([]),
      plan.fts === null ? Promise.resolve([] as PassageHit[]) : searchPassages(core, plan.fts, translation, VERSES_SHOWN),
      plan.fts === null ? Promise.resolve(0) : countPassages(core, plan.fts, translation),
      plan.fts === null ? Promise.resolve([]) : countPassagesByBook(core, plan.fts, translation),
      plan.wordKey !== null
        ? searchWordsByForm(core, plan.wordKey)
        : plan.glossWord !== null
          ? searchWordsByGloss(core, plan.glossWord)
          : Promise.resolve([] as Lexeme[]),
    ]);
    // The dictionary and guide titles are in the app (data/dictionary.generated.ts): found with no book's file here.
    const terms = plan.reference === null ? findTerms(query) : [];
    const guides = plan.reference === null ? findGuides(query) : [];
    const nothing = reference === null && people.length === 0 && passages.length === 0 && words.length === 0 && terms.length === 0 && guides.length === 0;
    // SE-32: one English word that found nothing; a phrase or Greek has no single word to offer.
    const suggestion = nothing && plan.fts !== null && /^\p{Script=Latin}+$/u.test(query) ? await nearestTerm(core, query) : null;
    return { plan, reference, people, passages, total, books, words, terms, guides, nothing, suggestion };
  }, [query, translation]);

  const fts = data?.plan.fts ?? null;
  const { data: bookHits } = useQuery(
    async () => (book === null || fts === null ? null : searchPassages(core, fts, translation, BOOK_VERSES_SHOWN, bookBounds(book))),
    [fts, translation, book],
  );

  const searchLog = useMemo(() => createSearchLogger((detail) => log("search", undefined, detail)), [log]);
  useEffect(() => () => searchLog.dispose(), [searchLog]);
  useEffect(() => {
    searchLog.typed(query, searchDetail(planSearch(query)));
  }, [searchLog, query]);

  const { jumpTo } = useSheetNav();
  /** Opening a result keeps what found it in Recent (SE-30). */
  const leave = () => {
    searchLog.settle();
    remember(query);
  };
  const open = (href: Parameters<typeof router.push>[0]) => {
    leave();
    router.push(href);
  };
  /**
   * The dictionary's pages (DI-04) are pages, not sheets. In the tab they push over it with ‹ Search; from the sheet,
   * Search closes first, as it does for a verse, so a page is never drawn inside a sheet.
   */
  const openPage = (href: Parameters<typeof router.push>[0]) => {
    leave();
    if (!inTab) router.back();
    router.push(href);
  };
  const back = inTab ? "Search" : "Back";
  /** A verse or chapter: Search closes and the reader opens, never inside the sheet. */
  const read = (target: Parameters<typeof jumpTo>[0]) => {
    leave();
    if (inTab) router.push(readerHref(target));
    else jumpTo(target);
  };
  /** A recent search, or the word "Did you mean" offers: searched at once, as the Search key would. */
  const searchFor = (q: string) => {
    setInput(q);
    setQuery(q);
    setSubmitted(q);
    setAllWords(false);
    setKind(null);
    setBook(null);
    setPages(1);
  };

  // From the raw input, not the debounced query, so the first Hebrew letter turns the field at once.
  const direction = fieldDirection(input);

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
            remember(sent);
          }}
          // SE-30's own words: what the field takes.
          placeholder="Words, a verse or a book"
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
  const showLicensed = licensed?.status === "ok";
  // The BSB's verses on the phone, unless a licensed search is under way or answered.
  const showVerses = data != null && data.passages.length > 0 && (licensedCode === null || licensed === undefined || fallback);
  const kinds: Kind[] =
    data == null
      ? []
      : [
          ...(showVerses || showLicensed ? (["verses"] as const) : []),
          ...(data.words.length > 0 ? (["words"] as const) : []),
          ...(data.guides.length > 0 ? (["guides"] as const) : []),
          ...(data.terms.length > 0 ? (["dictionary"] as const) : []),
          ...(data.people.length > 0 ? (["people"] as const) : []),
        ];
  const shown: Kind | undefined = kind !== null && kinds.includes(kind) ? kind : kinds[0];
  const empty = query.length >= 2 && data != null && data.nothing && !showLicensed;
  const mood = empty ? moodFor(data.suggestion ?? query) : undefined;
  const openMood = (m: Moment) => openPage({ pathname: "/moment", params: { name: m.name, reopen: inTab ? "" : "1" } });

  return (
    <Frame inTab={inTab} field={field} onNearEnd={() => setPages((n) => Math.min(n + 1, Math.ceil(BOOK_VERSES_SHOWN / VERSE_PAGE)))}>
      {input === "" && query === "" ? (
        <Browse
          recent={recent}
          onRecent={searchFor}
          onMood={openMood}
          onPage={(pathname) => openPage({ pathname, params: { back } })}
        />
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

      {kinds.length > 1 ? (
        <View style={{ marginTop: 14 }}>
          <FilterPills options={kinds.map((k) => ({ key: k, title: KIND_TITLES[k] }))} chosen={shown ?? "verses"} onChoose={setKind} testID="search-kind" />
        </View>
      ) : null}

      {/* SE-31: the verses, their true count and the books they fall in. */}
      {shown === "verses" && data != null ? (
        <View testID="result-verses">
          {fallback && query.length >= 2 ? (
            <Prose step="note" tone="muted" style={{ marginTop: 12 }} testID="search-offline">
              {offline
                ? "You’re offline, so this searches the BSB."
                : licensed?.status === "limit"
                  ? `This searches the BSB: this month’s ${reading} searches are used.`
                  : `This searches the BSB: the ${reading} search didn’t answer.`}
            </Prose>
          ) : null}

          {showLicensed ? (
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

          {showVerses ? (
            <>
              <View style={[styles.versesHead, styles.section]}>
                <SectionTitle inSheet testID="result-verses-count">
                  {plural(data.total, "verse", "verses")}
                </SectionTitle>
                <Chrome step="note" tone="muted">
                  {`in ${plural(data.books.length, "book", "books")}`}
                </Chrome>
              </View>
              {data.books.length > 1 ? (
                <View style={{ marginTop: 6, marginBottom: 4 }}>
                  <FilterPills<BookCode | "all">
                    options={[
                      { key: "all", title: "All", count: data.total, label: `All books, ${plural(data.total, "verse", "verses")}` },
                      ...data.books.map((b) => ({
                        key: b.book,
                        title: BOOK_CODES[b.book].name,
                        count: b.count,
                        label: `${BOOK_CODES[b.book].name}, ${plural(b.count, "verse", "verses")}`,
                      })),
                    ]}
                    chosen={book ?? "all"}
                    onChoose={(k) => {
                      setBook(k === "all" ? null : k);
                      setPages(1);
                    }}
                    testID="search-book"
                  />
                </View>
              ) : null}
              <VerseList
                hits={book === null ? data.passages : (bookHits ?? [])}
                drawn={pages * VERSE_PAGE}
                books={data.books}
                more={moreLine(book === null ? data.total : (data.books.find((b) => b.book === book)?.count ?? 0), book === null ? data.passages.length : (bookHits?.length ?? 0), book === null && data.books.length > 1)}
                onRead={read}
              />
            </>
          ) : null}
        </View>
      ) : null}

      {shown === "words" && data != null ? (
        <View testID="result-words">
          {data.words.slice(0, allWords ? undefined : WORDS_SHOWN).map((lexeme, i) => (
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

      {/* IA-06: a passage title finds its guide, a sheet over Search as People's pages are. */}
      {shown === "guides" && data != null ? (
        <View testID="result-guides">
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

      {/* DI-03, PD-04: a term finds its dictionary entry. */}
      {shown === "dictionary" && data != null ? (
        <View testID="result-dictionary">
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

      {/* A name finds the person (canvas TD-03). */}
      {shown === "people" && data != null ? (
        <View testID="result-people">
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

      {empty ? (
        <NothingFound query={query} suggestion={data.suggestion} mood={mood} onSuggestion={searchFor} onMood={openMood} />
      ) : null}
    </Frame>
  );
}

/** SE-30: the ways in, the moods and Recent, before anything is typed. */
function Browse({
  recent,
  onRecent,
  onMood,
  onPage,
}: {
  recent: readonly string[];
  onRecent: (q: string) => void;
  onMood: (m: Moment) => void;
  onPage: (pathname: "/pray/bible" | "/plans" | "/dictionary") => void;
}) {
  const { ax, gutter } = useLayout();
  return (
    <View testID="search-browse">
      {/* Places has no page of its own yet (a place opens only from its verse, understand/place), so it is not drawn. */}
      <View style={{ marginTop: 14 }}>
        <TileGrid>
          {PRAYERS_OF_THE_BIBLE.length > 0 ? (
            <TintTile
              tint="sand"
              icon="book-open"
              title="Bible prayers"
              line={plural(PRAYERS_OF_THE_BIBLE.length, "prayer", "prayers")}
              onPress={() => onPage("/pray/bible")}
              testID="search-way-bible"
            />
          ) : null}
          {/* plans.tsx lists two: John passage by passage and M'Cheyne's whole Bible. */}
          <TintTile tint="forest" icon="calendar" title="Reading plans" line="2 plans" onPress={() => onPage("/plans")} testID="search-way-plans" />
          <TintTile tint="sky" icon="search" title="Dictionary" line="Words of the Bible" onPress={() => onPage("/dictionary")} testID="browse-dictionary" />
        </TileGrid>
      </View>

      <SectionTitle inSheet style={{ marginTop: 26, marginBottom: 10 }}>
        For when you’re
      </SectionTitle>
      <ScrollView
        horizontal={!ax}
        showsHorizontalScrollIndicator={false}
        style={ax ? null : { marginHorizontal: -gutter }}
        contentContainerStyle={ax ? styles.moodsAx : [styles.moods, { paddingHorizontal: gutter }]}
      >
        {MOMENTS.map((m) => (
          <PictureTile
            key={m.name}
            title={m.name}
            image={pictureFor(m.picture, "morning")?.image}
            onPress={() => onMood(m)}
            label={`When you’re ${m.name.toLowerCase()}: verses for this moment`}
            testID={`moment-${m.name}`}
          />
        ))}
      </ScrollView>

      {recent.length > 0 ? (
        <>
          <SectionTitle inSheet style={{ marginTop: 26, marginBottom: 2 }}>
            Recent
          </SectionTitle>
          {recent.map((q, i) => (
            <ListRow key={q} first={i === 0} title={q} label={`Search for ${q}`} onPress={() => onRecent(q)} testID={`search-recent-${i}`} />
          ))}
        </>
      ) : null}
    </View>
  );
}

/** SE-31's rows: each book's name and true count above its verses, in Bible order, the searched word marked. */
function VerseList({
  hits,
  drawn,
  books,
  more,
  onRead,
}: {
  hits: readonly PassageHit[];
  /** How many rows to draw now; more come as the list nears its foot. */
  drawn: number;
  books: ReadonlyArray<{ book: BookCode; count: number }>;
  more: string | null;
  onRead: (target: { book: BookCode; chapter: number; verse: number; select: boolean }) => void;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  const counts = new Map(books.map((b) => [b.book, b.count]));
  let previous: BookCode | null = null;
  return (
    <View>
      {hits.slice(0, drawn).map((hit) => {
        const parts = ordToParts(hit.ord);
        const head = parts.book !== previous;
        previous = parts.book;
        return (
          <View key={hit.ord}>
            {head ? (
              <Chrome step="note" tone="muted" accessibilityRole="header" style={styles.bookHead}>
                {`${BOOK_CODES[parts.book].name} · ${counts.get(parts.book) ?? ""}`}
              </Chrome>
            ) : null}
            <ListRow
              first={head}
              testID={`result-passage-${hit.ord}`}
              overline={formatDisplayRef(parts)}
              onPress={() => onRead({ book: parts.book, chapter: parts.chapter, verse: parts.verse, select: true })}
            >
              <Scripture step="claim" numberOfLines={ax ? 3 : 2} style={{ fontFamily: "Literata" }}>
                {/* Plain Text inherits the row's type step: a Scripture per piece read the type settings once per word. */}
                {splitSnippet(hit.snippet).map((piece, j) =>
                  piece.hit ? (
                    <Text key={j} style={{ backgroundColor: palette.highlight, color: palette.ink }}>
                      {piece.text}
                    </Text>
                  ) : (
                    piece.text
                  ),
                )}
              </Scripture>
            </ListRow>
          </View>
        );
      })}
      {more !== null && drawn >= hits.length ? (
        <Chrome step="note" tone="muted" style={{ marginTop: 12 }} testID="search-verses-more">
          {more}
        </Chrome>
      ) : null}
    </View>
  );
}

/** Said under a list that stops short of what the search holds, so the count above it is never contradicted. */
function moreLine(total: number, shown: number, books: boolean): string | null {
  if (shown === 0 || shown >= total) return null;
  return books ? `The first ${shown} of ${total}. Choose a book for the rest.` : `The first ${shown} of ${total}.`;
}

/** SE-32: the nearest word the Bible uses, and the mood's picture when the word is one. */
function NothingFound({
  query,
  suggestion,
  mood,
  onSuggestion,
  onMood,
}: {
  query: string;
  suggestion: string | null;
  mood: Moment | undefined;
  onSuggestion: (q: string) => void;
  onMood: (m: Moment) => void;
}) {
  return (
    <View style={{ marginTop: 22 }} testID="search-empty">
      {suggestion !== null ? (
        <Pressable
          onPress={() => onSuggestion(suggestion)}
          accessibilityRole="button"
          accessibilityLabel={`Did you mean ${suggestion}? Searches for ${suggestion}`}
          style={{ minHeight: 44, justifyContent: "center" }}
          testID="search-did-you-mean"
        >
          <Prose step="explanation" style={{ fontWeight: "600" }}>
            Did you mean{" "}
            <Prose step="explanation" tone="accent" style={{ fontWeight: "600", textDecorationLine: "underline" }}>
              {suggestion}
            </Prose>
            ?
          </Prose>
        </Pressable>
      ) : null}
      <Prose step={suggestion === null ? "explanation" : "note"} tone={suggestion === null ? "ink" : "muted"} style={{ marginTop: 4 }}>
        Nothing matches “{query}”.
      </Prose>
      {suggestion === null ? (
        <Prose step="note" tone="muted" style={{ marginTop: 6 }}>
          Search takes references, English words, and Greek or Hebrew.
        </Prose>
      ) : null}
      {mood !== undefined ? (
        <>
          <SectionTitle inSheet style={{ marginTop: 24, marginBottom: 10 }}>
            {`For when you’re ${mood.name.toLowerCase()}`}
          </SectionTitle>
          <PictureTile
            wide
            title={mood.name}
            image={pictureFor(mood.picture, "morning")?.image}
            onPress={() => onMood(mood)}
            label={`When you’re ${mood.name.toLowerCase()}: verses for this moment`}
            testID={`search-mood-${mood.name}`}
          />
        </>
      ) : null}
    </View>
  );
}

/** The sheet over the reader, or the page in the Search tab: the field on top, results scrolling under it, clear of the tab bar. */
function Frame({ inTab, field, children, onNearEnd }: { inTab: boolean; field: ReactNode; children: ReactNode; onNearEnd: () => void }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();
  const { gutter, tabs } = useLayout();
  if (!inTab)
    return (
      <SheetScreen title="Search" header={field} backLabel={null} footer={false} keyboard onNearEnd={onNearEnd} testID="search">
        {children}
      </SheetScreen>
    );
  return (
    <View style={{ flex: 1, backgroundColor: palette.paper, paddingTop: (tabs === "top" ? 0 : insets.top) + 8 }} testID="search-tab">
      {/* SE-30: the tab's large title over the field, which stays put while the results scroll. */}
      <View style={{ paddingHorizontal: gutter, paddingBottom: 8 }}>
        <LargeTitle>Search</LargeTitle>
        <View style={{ marginTop: 8 }}>{field}</View>
      </View>
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
          if (contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_END) onNearEnd();
        }}
        scrollEventThrottle={64}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: tabClearance }}>
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
  versesHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 12 },
  bookHead: { fontWeight: "600", marginTop: 16 },
  moods: { columnGap: 10 },
  moodsAx: { rowGap: 10 },
});
