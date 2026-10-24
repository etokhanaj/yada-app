/** All the places in a book (OR-04): in the order they first appear, with that verse; each opens its map. */

import { BOOK_CODES, isBookCode, ordToParts } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";

import { ListRow } from "../../components/Page";
import { SheetScreen } from "../../components/Sheet";
import { SourceLine } from "../../components/SourceLine";
import { useQuery } from "../../data/AppData";
import { loadBookPlaces } from "../../data/wordsAndPlaces";

export default function Places() {
  const { book } = useLocalSearchParams<{ book?: string }>();
  const code = book !== undefined && isBookCode(book) ? book : "JHN";
  const name = BOOK_CODES[code].name;
  const { data } = useQuery(() => loadBookPlaces(code), [code]);
  return (
    <SheetScreen title={`Places in ${name}`} backLabel={null} testID="about-places-list">
      {(data ?? []).map((p, i) => {
        const at = ordToParts(p.first);
        const first = `First in ${name} ${at.chapter}:${at.verse}`;
        return (
          <ListRow
            key={p.id}
            first={i === 0}
            title={p.name}
            subtitle={p.modern !== "" && p.modern !== p.name ? `${first} · ${p.modern}` : first}
            label={`${p.name}, first in ${name} ${at.chapter}:${at.verse}. Opens its map`}
            onPress={() => router.push({ pathname: "/about/place", params: { book: code, id: p.id, from: String(p.first) } })}
            testID={`about-place-${p.id}`}
          />
        );
      })}
      <SourceLine style={{ marginTop: 8 }}>OpenBible.info</SourceLine>
    </SheetScreen>
  );
}
