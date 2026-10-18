import { BOOK_CODES, isBookCode } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";

import { NumberGrid, TranslationValueRow, usePickChapter } from "../../components/Contents";
import { SheetScreen } from "../../components/Sheet";
import { useSettings } from "../../state/settings";

/**
 * A book's chapters (C-02): the one being read in ink; no "16 chapters" — the grid shows it (S17). With Choose a
 * verse on (CT-03), a chapter opens its verses inside the sheet before the reader.
 */
export default function ContentsChapters() {
  const params = useLocalSearchParams<{ book?: string; chapter?: string; from?: string }>();
  const pick = usePickChapter(params.from);
  const chooseVerse = useSettings((s) => s.chooseVerse);
  if (params.book === undefined || !isBookCode(params.book)) return null;
  const book = params.book;
  const meta = BOOK_CODES[book];
  const current = params.chapter === undefined || params.chapter === "" ? null : Number(params.chapter);

  return (
    <SheetScreen title={meta.name} backLabel={null} footer={false} testID="contents-chapters">
      <TranslationValueRow />
      <NumberGrid
        numbers={Array.from({ length: meta.chapters }, (_, i) => i + 1)}
        current={current}
        onPick={(chapter) =>
          chooseVerse
            ? router.push({ pathname: "/contents/verses", params: { book, chapter: String(chapter), from: params.from ?? "" } })
            : pick(book, chapter)
        }
        label={(chapter) => `Chapter ${chapter}`}
        testID={(chapter) => `chapter-${book}-${chapter}`}
      />
    </SheetScreen>
  );
}
