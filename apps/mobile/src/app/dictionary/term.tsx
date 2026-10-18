/**
 * A dictionary term from Search or the Dictionary (DI-03, DI-04): its definition, then the books whose verses name it.
 * DI-02's term page lists one book's verses from that book's Understand file; here no book's file need be on the
 * phone, so each book is one row, its count of verses, opening the reader at the first of them.
 */

import { BOOK_CODES, ordToParts } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { readerHref } from "../../components/navigation";
import { ListRow, PageScreen } from "../../components/Page";
import { Chrome, Prose, SectionTitle } from "../../components/Type";
import { useLayout } from "../../design/tokens";
import { DICTIONARY_CREDIT, dictionaryEntry } from "../../lib/dictionary";

const places = (n: number) => `${n} ${n === 1 ? "place" : "places"}`;

export default function DictionaryTermScreen() {
  const params = useLocalSearchParams<{ term?: string; back?: string }>();
  const { sectionGap } = useLayout();
  const entry = dictionaryEntry(params.term ?? "");
  if (entry === null) return null;

  return (
    <PageScreen title={entry.term} back={params.back ?? "Search"} testID="dictionary-term">
      <Prose step="explanation">{entry.definition}</Prose>
      {entry.uses.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <SectionTitle style={{ marginBottom: 6 }}>{`In the Bible · ${places(entry.verses)}`}</SectionTitle>
          {entry.uses.map((use, i) => {
            const at = ordToParts(use.ord);
            return (
              <ListRow
                key={use.book}
                first={i === 0}
                book
                title={BOOK_CODES[use.book].name}
                label={`${BOOK_CODES[use.book].name}, ${places(use.verses)}, opens at ${at.chapter}:${at.verse}`}
                onPress={() => router.push(readerHref({ book: at.book, chapter: at.chapter, verse: at.verse, select: true, back: "Search" }))}
                testID={`term-book-${use.book}`}
              >
                <Chrome step="note" tone="muted">
                  {/* Says where the row lands: the first of the book's verses, not all of them. */}
                  {`${places(use.verses)} · from ${at.chapter}:${at.verse}`}
                </Chrome>
              </ListRow>
            );
          })}
        </View>
      ) : null}
      <Chrome step="note" tone="muted" style={{ marginTop: sectionGap }}>
        {DICTIONARY_CREDIT}
      </Chrome>
    </PageScreen>
  );
}
