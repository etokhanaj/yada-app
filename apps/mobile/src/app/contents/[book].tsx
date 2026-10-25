import { BOOK_CODES, isBookCode } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import { Pressable, type ScrollView, StyleSheet, View } from "react-native";

import { openAbout, useBookIntro } from "../../components/AboutHandle";
import { NumberGrid, useCloseContents, usePickChapter } from "../../components/Contents";
import { Icon } from "../../components/Icon";
import { ListRow } from "../../components/Page";
import { SheetScreen } from "../../components/Sheet";
import { Chrome } from "../../components/Type";
import { useAppData, useQuery } from "../../data/AppData";
import { loadChaptersRead } from "../../data/user";
import { usePalette } from "../../design/tokens";
import { chapterKey } from "../../lib/chaptersRead";
import { useSettings } from "../../state/settings";

/**
 * A book's chapters (CH-30), opened from the reader's `John 2`: the one being read filled in ink, the ones read with a
 * wash and a bar, `John ›` to change book. "1 of 21 read" counts the chapters marked read on this phone (rule 4: from
 * the data, never made up), and is left out until one is. With Choose a verse on (CT-03), a chapter opens its verses
 * inside the sheet before the reader. About the book is its first row when its introduction is approved (SC-09), so the
 * introduction is reachable without the reader's handle. The translation is the reader's split control's other half
 * (RD-30), so it is not repeated here.
 */
export default function ContentsChapters() {
  const params = useLocalSearchParams<{ book?: string; chapter?: string; from?: string }>();
  const palette = usePalette();
  const { user } = useAppData();
  const pick = usePickChapter(params.from);
  const closeContents = useCloseContents();
  const chooseVerse = useSettings((s) => s.chooseVerse);
  const code = params.book !== undefined && isBookCode(params.book) ? params.book : null;
  const intro = useBookIntro(code ?? "JHN");
  const { data: readKeys } = useQuery(() => loadChaptersRead(user), [code]);
  // Psalm 119 opened the sheet on Psalm 1, the current chapter far below (12f QA): it opens on the row that holds it.
  const scroll = useRef<ScrollView>(null);
  const gridY = useRef<number | null>(null);
  const cellY = useRef<number | null>(null);
  const scrolled = useRef(false);
  const showCurrent = () => {
    if (scrolled.current || gridY.current === null || cellY.current === null) return;
    scrolled.current = true;
    scroll.current?.scrollTo({ y: Math.max(0, gridY.current + cellY.current - 160), animated: false });
  };
  if (code === null) return null;
  const book = code;
  const meta = BOOK_CODES[book];
  const current = params.chapter === undefined || params.chapter === "" ? null : Number(params.chapter);
  const chapters = Array.from({ length: meta.chapters }, (_, i) => i + 1);
  const read = new Set(chapters.filter((n) => readKeys?.has(chapterKey(book, n)) === true));

  const books = (
    <Pressable
      onPress={() => router.push({ pathname: "/contents", params: { book, chapter: params.chapter ?? "" } })}
      accessibilityRole="button"
      accessibilityLabel={`${meta.name}. Change book`}
      testID="contents-books"
      style={({ pressed }) => [styles.books, { backgroundColor: palette.fill, opacity: pressed ? 0.6 : 1 }]}
    >
      <Chrome tone="ink" numberOfLines={1} style={{ fontWeight: "600" }} maxFontSizeMultiplier={2}>
        {meta.name}
      </Chrome>
      <Icon name="forward" size={16} tone="muted" />
    </Pressable>
  );

  return (
    <SheetScreen title={meta.name} backLabel={null} footer={false} leading={books} titleInBody scrollRef={scroll} testID="contents-chapters">
      {intro !== null ? (
        <ListRow
          first
          title={`About ${meta.name}`}
          onPress={() => {
            closeContents();
            openAbout(book);
          }}
          testID="contents-about-row"
        />
      ) : null}
      {read.size > 0 ? (
        <Chrome step="note" tone="muted" style={styles.count} testID="contents-read-count">
          {read.size} of {meta.chapters} read
        </Chrome>
      ) : null}
      <View
        onLayout={(e) => {
          gridY.current = e.nativeEvent.layout.y;
          showCurrent();
        }}
      >
        <NumberGrid
          numbers={chapters}
          current={current}
          onCurrentLayout={(y) => {
            cellY.current = y;
            showCurrent();
          }}
          read={read}
          onPick={(chapter) =>
            chooseVerse
              ? router.push({ pathname: "/contents/verses", params: { book, chapter: String(chapter), from: params.from ?? "" } })
              : pick(book, chapter)
          }
          label={(chapter) => `Chapter ${chapter}`}
          testID={(chapter) => `chapter-${book}-${chapter}`}
        />
      </View>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  books: {
    minHeight: 44,
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 2,
  },
  count: {
    marginTop: 2,
    marginBottom: 12,
  },
});
