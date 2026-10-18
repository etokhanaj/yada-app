import { BOOK_CODES, isBookCode } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";

import { NumberGrid, TranslationValueRow, usePickChapter } from "../../components/Contents";
import { SheetScreen } from "../../components/Sheet";
import { useCore, useQuery } from "../../data/AppData";
import { getChapter, readableTranslations } from "../../data/queries";
import { useSettings } from "../../state/settings";

/**
 * CT-03, Choose a verse on: John › 3 shows its verses, and 16 opens the reader at 3:16. The numbers are the
 * chapter's own rows in the reader's translation, so a verse a translation leaves out (Romans 16:24 in the BSB) is
 * not offered; a licensed version is not on the phone, so its BSB rows stand in.
 */
export default function ContentsVerses() {
  const params = useLocalSearchParams<{ book?: string; chapter?: string; from?: string }>();
  const core = useCore();
  const reading = useSettings((s) => s.translation);
  const pick = usePickChapter(params.from === "" ? undefined : params.from);
  const book = params.book !== undefined && isBookCode(params.book) ? params.book : null;
  const chapter = Number(params.chapter);
  // Only what is on the phone is asked for; licensed text never enters Contents (licensedSurfaces.test.ts).
  const translation = readableTranslations().includes(reading) ? reading : "BSB";
  const { data } = useQuery(
    async () => (book === null || !Number.isInteger(chapter) ? [] : (await getChapter(core, book, chapter, translation)).map((v) => v.verse)),
    [book, chapter, translation],
  );
  if (book === null) return null;

  return (
    <SheetScreen title={`${BOOK_CODES[book].name} ${chapter}`} backLabel={null} footer={false} testID="contents-verses">
      <TranslationValueRow />
      <NumberGrid
        numbers={data ?? []}
        current={null}
        onPick={(verse) => pick(book, chapter, verse)}
        label={(verse) => `Verse ${verse}`}
        testID={(verse) => `verse-${book}-${chapter}-${verse}`}
      />
    </SheetScreen>
  );
}
