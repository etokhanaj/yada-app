/**
 * A word across the Bible (canvas S-04): how often, in how many verses, then
 * each book with its count; a book opens its occurrences. Counts are the
 * bundle's own (occurrences table), never estimated.
 */

import { BOOK_CODES, formatDisplayRef, parseVerseId } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";

import { ListRow } from "../../components/Page";
import { SheetScreen } from "../../components/Sheet";
import { Chrome, Prose } from "../../components/Type";
import { useCore, useQuery } from "../../data/AppData";
import { countsByBook, countVerses, getLexeme } from "../../data/queries";

export default function InBibleScreen() {
  const params = useLocalSearchParams<{ key?: string; from?: string; via?: string }>();
  const key = params.key ?? "";
  const from = params.from ?? "";
  const fromRef = parseVerseId(from);
  const core = useCore();
  const viaSearch = params.via === "search";

  const { data } = useQuery(async () => {
    const [lexeme, books, verses] = await Promise.all([getLexeme(core, key), countsByBook(core, key), countVerses(core, key)]);
    return { lexeme, books, verses };
  }, [key]);

  const display = fromRef === null ? null : formatDisplayRef(fromRef);
  return (
    <SheetScreen
      title={`${data?.lexeme?.lemma ?? ""} in the Bible`}
      subtitle={display ?? undefined}
      backLabel={display}
      verseId={from}
      backText={viaSearch ? "Back to search" : undefined}
      closeLabel={viaSearch ? "Close" : "Back to Understand"}
      testID="in-bible"
    >
      {data !== undefined && data.lexeme !== null ? (
        <>
          <Prose step="claim" tone="muted" style={{ marginBottom: 8 }}>
            {data.lexeme.total} {data.lexeme.total === 1 ? "time" : "times"} in {data.verses} {data.verses === 1 ? "verse" : "verses"}
          </Prose>
          {data.books.map((b, i) => (
            <ListRow
              key={b.book}
              first={i === 0}
              book
              title={BOOK_CODES[b.book].name}
              label={`${BOOK_CODES[b.book].name}, ${b.count} ${b.count === 1 ? "time" : "times"}`}
              right={
                <Chrome tone="muted" style={{ fontVariant: ["tabular-nums"] }}>
                  {b.count}
                </Chrome>
              }
              onPress={() => router.push({ pathname: "/evidence/occurrences", params: { key, book: b.book, from, via: viaSearch ? "search" : "" } })}
              testID={`in-bible-${b.book}`}
            />
          ))}
        </>
      ) : null}
    </SheetScreen>
  );
}
