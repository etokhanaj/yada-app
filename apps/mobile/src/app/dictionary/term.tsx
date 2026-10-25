/**
 * DI-31: a word from Search or the Dictionary. Its kind, the definition, then its verses: the true count ("47
 * verses"; it said "47 places" beside a group called People and places), the first few written out, and By book
 * behind them (`by=book`, the same route). The data keeps each book's first verse and its count, not every verse, so
 * the verses written out are the first in each of the first books that name the word.
 * The credit is the short one, a link to Sources and licences, which carries unfoldingWord's notice and what Yada
 * changed (CC BY-SA 4.0 §3(a)(2); content/raw/uw-tw/en_tw/LICENSE.md, rule 3).
 */

import { BOOK_CODES, formatDisplayRef, ordToParts } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { readerHref } from "../../components/navigation";
import { LargeTitle, ListRow, PageScreen } from "../../components/Page";
import { SourceLine } from "../../components/SourceLine";
import { Chrome, Prose, Scripture, SectionTitle } from "../../components/Type";
import { useCore, useQuery } from "../../data/AppData";
import { isLicensedCode } from "../../data/licensed";
import { getTextsForOrds } from "../../data/queries";
import { useLayout } from "../../design/tokens";
import { DICTIONARY_CREDIT, DICTIONARY_GROUPS, type DictionaryEntry, dictionaryEntry } from "../../lib/dictionary";
import { useSettings } from "../../state/settings";

/** How many verses DI-31 writes out before By book. */
const WRITTEN = 3;

const verses = (n: number) => `${n} ${n === 1 ? "verse" : "verses"}`;

export default function DictionaryTermScreen() {
  const params = useLocalSearchParams<{ term?: string; back?: string; by?: string }>();
  const { sectionGap } = useLayout();
  const entry = dictionaryEntry(params.term ?? "");
  if (entry === null) return null;
  const kind = DICTIONARY_GROUPS.find((g) => g.kind === entry.kind)?.one;

  if (params.by === "book") return <ByBook entry={entry} back={params.back ?? entry.term} />;

  return (
    <PageScreen
      title={entry.term}
      back={params.back ?? "Search"}
      testID="dictionary-term"
      // DI-31 sets the kind over the word, as an overline (ListRow's), so VoiceOver reads "Key word, Almighty".
      titleNode={
        <View>
          {kind === undefined ? null : (
            <Chrome step="note" tone="muted" style={{ fontWeight: "600", marginBottom: 2 }}>
              {kind}
            </Chrome>
          )}
          <LargeTitle>{entry.term}</LargeTitle>
        </View>
      }
    >
      <Prose step="explanation">{entry.definition}</Prose>
      {entry.uses.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <SectionTitle
            style={{ marginBottom: 6 }}
            link={
              entry.uses.length > 1
                ? {
                    title: "By book",
                    label: `${verses(entry.verses)} by book`,
                    onPress: () => router.push({ pathname: "/dictionary/term", params: { term: entry.term, back: entry.term, by: "book" } }),
                    testID: "term-by-book",
                  }
                : undefined
            }
          >
            {verses(entry.verses)}
          </SectionTitle>
          <FirstVerses entry={entry} />
        </View>
      ) : null}
      <SourceLine style={{ marginTop: sectionGap }}>{DICTIONARY_CREDIT}</SourceLine>
    </PageScreen>
  );
}

function FirstVerses({ entry }: { entry: DictionaryEntry }) {
  const core = useCore();
  const { ax } = useLayout();
  const translation = useSettings((s) => s.translation);
  // A licensed version is not on the phone: the verses are the BSB's (US-11).
  const shown = isLicensedCode(translation) ? "BSB" : translation;
  const ords = entry.uses.slice(0, WRITTEN).map((u) => u.ord);
  const { data: texts } = useQuery(() => getTextsForOrds(core, ords, shown), [ords.join(","), shown]);
  if (texts === undefined) return null;
  return ords.map((ord, i) => {
    const at = ordToParts(ord);
    const ref = formatDisplayRef(at);
    const text = texts.get(ord) ?? "";
    return (
      <ListRow
        key={ord}
        first={i === 0}
        chevron={false}
        overline={ref}
        label={`${ref}. ${text}`}
        onPress={() => router.push(readerHref({ book: at.book, chapter: at.chapter, verse: at.verse, select: true, back: entry.term }))}
        testID={`term-verse-${ord}`}
      >
        <Scripture step="claim" numberOfLines={ax ? undefined : 3} style={{ fontFamily: "Literata" }}>
          {marked(text, entry.term).map((piece, j) => (
            <Scripture key={j} step="claim" style={[{ fontFamily: "Literata" }, piece.hit ? { fontWeight: "600" } : null]}>
              {piece.text}
            </Scripture>
          ))}
        </Scripture>
      </ListRow>
    );
  });
}

/** The word in the verse, in weight as Search marks its hits (SE-31); only where the verse spells it so. */
function marked(text: string, term: string): Array<{ text: string; hit: boolean }> {
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return [{ text, hit: false }];
  return [
    { text: text.slice(0, i), hit: false },
    { text: text.slice(i, i + term.length), hit: true },
    { text: text.slice(i + term.length), hit: false },
  ];
}

/** By book: each book whose verses name the word, its count, opening the reader at the first of them. */
function ByBook({ entry, back }: { entry: DictionaryEntry; back: string }) {
  return (
    <PageScreen title="By book" back={back} subtitle={`${entry.term} · ${verses(entry.verses)}`} testID="dictionary-term-books">
      {entry.uses.map((use, i) => {
        const at = ordToParts(use.ord);
        const name = BOOK_CODES[use.book].name;
        return (
          <ListRow
            key={use.book}
            first={i === 0}
            book
            title={name}
            label={`${name}, ${verses(use.verses)}, opens at ${at.chapter}:${at.verse}`}
            onPress={() => router.push(readerHref({ book: at.book, chapter: at.chapter, verse: at.verse, select: true, back: "By book" }))}
            testID={`term-book-${use.book}`}
          >
            <Chrome step="note" tone="muted">
              {/* Says where the row lands: the first of the book's verses, not all of them. */}
              {`${verses(use.verses)} · from ${at.chapter}:${at.verse}`}
            </Chrome>
          </ListRow>
        );
      })}
    </PageScreen>
  );
}
