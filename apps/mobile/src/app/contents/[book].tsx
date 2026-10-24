import { BOOK_CODES, isBookCode } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";

import { openAbout, useBookIntro } from "../../components/AboutHandle";
import { NumberGrid, TranslationValueRow, useCloseContents, usePickChapter } from "../../components/Contents";
import { ListRow } from "../../components/Page";
import { SheetScreen } from "../../components/Sheet";
import { useSettings } from "../../state/settings";

/**
 * A book's chapters (C-02): the one being read in ink; no "16 chapters" — the grid shows it (S17). With Choose a
 * verse on (CT-03), a chapter opens its verses inside the sheet before the reader. About the book is its first row when
 * its introduction is approved (SC-09), so the introduction is reachable without the reader's handle.
 */
export default function ContentsChapters() {
  const params = useLocalSearchParams<{ book?: string; chapter?: string; from?: string }>();
  const pick = usePickChapter(params.from);
  const closeContents = useCloseContents();
  const chooseVerse = useSettings((s) => s.chooseVerse);
  const code = params.book !== undefined && isBookCode(params.book) ? params.book : null;
  const intro = useBookIntro(code ?? "JHN");
  if (code === null) return null;
  const book = code;
  const meta = BOOK_CODES[book];
  const current = params.chapter === undefined || params.chapter === "" ? null : Number(params.chapter);

  return (
    <SheetScreen title={meta.name} backLabel={null} footer={false} testID="contents-chapters">
      {intro !== null ? <ListRow first title={`About ${meta.name}`} onPress={() => {
            closeContents();
            openAbout(book);
          }} testID="contents-about-row" /> : null}
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
