/**
 * The pages the chapter swipe shows beside the reader (build plan Phase 3):
 *
 * - ChapterPeek: the neighbouring chapter peeking in, with its first passage's name above its text
 *   (SW-01, MM-07: "The wedding at Cana" on John 2).
 * - EndOfBook: after a book's last chapter the swipe stops here, never running into the next book
 *   (SW-03). The book's own last verse set as a quotation, when the book was begun from the
 *   reader's own data, and the way on (MM-08).
 */

import { BOOK_CODES, type BookCode, verseOrd } from "@yada/schema";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppData, useCore, useQuery } from "../data/AppData";
import { chapterBounds, getChapter, getTexts, isTranslation } from "../data/queries";
import { loadPassages } from "../data/understand";
import { bookBegun } from "../data/user";
import { SPACE, useLayout, usePalette } from "../design/tokens";
import { formatDay } from "../lib/dates";
import { chapterTitle } from "../lib/reader";
import { Icon } from "./Icon";
import { Chrome, Scripture } from "./Type";

const PEEK_VERSES = 8;

export function ChapterPeek({ book, chapter, translation, top }: { book: BookCode; chapter: number; translation: string; top: number }) {
  const core = useCore();
  const palette = usePalette();
  const { gutter } = useLayout();
  // A licensed version is fetched per chapter through the proxy; the peek shows the BSB rather than
  // asking the network for a page the reader may not turn to.
  const shown = isTranslation(translation) ? translation : "BSB";
  const { data } = useQuery(async () => {
    const [verses, passages] = await Promise.all([getChapter(core, book, chapter, shown), loadPassages(book)]);
    const first = chapterBounds(book, chapter)[0];
    return { verses: verses.slice(0, PEEK_VERSES), title: passages.find((p) => p.startOrd === first)?.label ?? null };
  }, [book, chapter, shown]);
  return (
    <View style={{ flex: 1, paddingTop: top, paddingHorizontal: gutter }}>
      <Chrome tone="ink" step="sheetTitle" style={{ textAlign: "center", marginBottom: SPACE.md }}>
        {chapterTitle(book, chapter)}
      </Chrome>
      {data?.title != null ? (
        <Chrome tone="ink" style={styles.passage} testID="peek-passage">
          {data.title}
        </Chrome>
      ) : null}
      {(data?.verses ?? []).map((v) => (
        <Scripture key={v.ord} style={{ marginBottom: 12 }}>
          {/* A nested Text with a size only: a nested step's own line height broke the lines apart. */}
          <Text style={[styles.number, { color: palette.mutedInk }]}>{`${v.verse} `}</Text>
          {v.text}
        </Scripture>
      ))}
    </View>
  );
}

export function EndOfBook({ book, top, next, onNext }: { book: BookCode; top: number; next: { title: string } | null; onNext: () => void }) {
  const core = useCore();
  const { user } = useAppData();
  const palette = usePalette();
  const { gutter } = useLayout();
  const last = BOOK_CODES[book].chapters;
  const { data } = useQuery(async () => {
    const verses = await getChapter(core, book, last, "BSB");
    const final = verses.at(-1);
    const text = final === undefined ? null : ((await getTexts(core, verseOrd(book, last, final.verse)))["BSB"] ?? null);
    return { verse: final?.verse ?? null, text, begun: await bookBegun(user, book) };
  }, [book]);
  const name = BOOK_CODES[book].name;
  const where = data?.verse == null ? null : `${name} ${last}:${data.verse}`;
  return (
    <View style={{ flex: 1, paddingTop: top + SPACE.xl, paddingHorizontal: gutter }} testID="end-of-book">
      <Chrome tone="ink" accessibilityRole="header" style={styles.end}>
        {`End of ${name}`}
      </Chrome>
      {data?.text != null ? (
        <Scripture style={{ fontFamily: "LiterataItalic", marginTop: SPACE.lg }} testID="end-quote">
          {`“${data.text}”`}
        </Scripture>
      ) : null}
      {where !== null ? (
        <Chrome step="note" tone="muted" style={{ marginTop: 8 }}>
          {data?.begun == null ? where : `${where} · Begun ${formatDay(data.begun)}`}
        </Chrome>
      ) : null}
      {next !== null ? (
        <Pressable
          onPress={onNext}
          accessibilityRole="link"
          accessibilityLabel={`Next, ${next.title}`}
          testID="end-next"
          style={({ pressed }) => [styles.pill, { backgroundColor: palette.fill, opacity: pressed ? 0.7 : 1 }]}
        >
          <Chrome tone="ink" size={15} style={{ fontWeight: "500" }}>
            {next.title}
          </Chrome>
          <Icon name="forward" size={18} tone="muted" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  number: { fontFamily: "System", fontSize: 12, fontWeight: "600" },
  passage: { fontFamily: "Literata", fontSize: 19, lineHeight: 25, fontWeight: "600", marginBottom: 10 },
  end: { fontFamily: "Literata", fontSize: 28, lineHeight: 34, fontWeight: "600" },
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 2,
    minHeight: 44,
    paddingLeft: 16,
    paddingRight: 10,
    borderRadius: 999,
    marginTop: SPACE.lg,
  },
});
