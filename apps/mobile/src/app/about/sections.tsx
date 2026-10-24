/** All of a book's sections in order (OR-01's "All N sections"): its shape, with each section's range. */

import { BOOK_CODES, isBookCode } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";

import { ListRow } from "../../components/Page";
import { SheetScreen } from "../../components/Sheet";
import { useQuery } from "../../data/AppData";
import { loadPassages } from "../../data/understand";
import { shortRange } from "../../lib/orientation";

export default function Sections() {
  const { book } = useLocalSearchParams<{ book?: string }>();
  const code = book !== undefined && isBookCode(book) ? book : "JHN";
  const { data } = useQuery(() => loadPassages(code), [code]);
  return (
    <SheetScreen title={`The shape of ${BOOK_CODES[code].name}`} backLabel={null} testID="about-sections-list">
      {(data ?? []).map((p, i) => (
        <ListRow key={p.id} first={i === 0} chevron={false} overline={shortRange(p.startOrd, p.endOrd)} title={p.label} />
      ))}
    </SheetScreen>
  );
}
