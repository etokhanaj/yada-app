/**
 * The pages the chapter swipe shows beside the reader (build plan Phase 3):
 *
 * - ChapterPeek: the neighbouring chapter peeking in, with its first passage's name above its text
 *   (SW-01, MM-07: "The wedding at Cana" on John 2).
 * - EndOfBook: after a book's last chapter the swipe stops here, never running into the next book
 *   (SW-03). RT-04: the book's own last verse set as a quotation, the claim only when every chapter was read, and
 *   the next book as the one card (this is MM-08, merged).
 */

import { BOOK_CODES, type BookCode, verseOrd } from "@yada/schema";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppData, useCore, useQuery } from "../data/AppData";
import { chapterBounds, getChapter, getTexts, isTranslation } from "../data/queries";
import { loadPassages } from "../data/understand";
import { loadChaptersRead } from "../data/user";
import { SPACE, useIsDark, useLayout, usePalette, WIDE } from "../design/tokens";
import { bookProgress, endTitle, nextBookAfter, progressLabel } from "../lib/chaptersRead";
import { chapterTitle } from "../lib/reader";
import { ChapterBar, NextCard, useFirstVerse } from "./ChapterClose";
import { Icon } from "./Icon";
import { Chrome, Scripture } from "./Type";
import { BRAND } from "../design/palette";

const PEEK_VERSES = 8;

export function ChapterPeek({ book, chapter, translation, top }: { book: BookCode; chapter: number; translation: string; top: number }) {
  const core = useCore();
  const palette = usePalette();
  const { gutter, regular } = useLayout();
  // A licensed version is fetched per chapter through the proxy; the peek shows the BSB rather than
  // asking the network for a page the reader may not turn to.
  const shown = isTranslation(translation) ? translation : "BSB";
  const { data } = useQuery(async () => {
    const [verses, passages] = await Promise.all([getChapter(core, book, chapter, shown), loadPassages(book)]);
    const first = chapterBounds(book, chapter)[0];
    return { verses: verses.slice(0, PEEK_VERSES), title: passages.find((p) => p.startOrd === first)?.label ?? null };
  }, [book, chapter, shown]);
  return (
    // The reader's own measure on an iPad (TB-02), so the turning page lines up with the text it replaces.
    <View style={[{ flex: 1, paddingTop: top, paddingHorizontal: gutter }, regular ? { width: "100%", maxWidth: WIDE.measure + 2 * gutter, alignSelf: "center" } : null]}>
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

/**
 * The end of a book (canvas RT-04, which merges MM-08; John, 18 Oct 2026): one screen on the forest, the book's own last
 * verse as a quotation, and the next book as the one card to tap. "You've read Mark." only when every chapter was read;
 * otherwise "End of Mark." with the bar showing what was read and no claim (CLAUDE.md rule 4). After Revelation the card
 * is Psalms. The × is always there: someone who swiped here to look something up is not trapped.
 * Style after Deepstash's completion (https://mobbin.com/screens/dc3f18fc-a2f3-499a-8b1d-43a448f22dc1): a named finish and
 * "read next"; no mascot. The quotation is the BSB's (public domain), whatever the reader's translation.
 */
export function EndOfBook({ book, onNext, onClose }: { book: BookCode; onNext: (to: BookCode) => void; onClose?: () => void }) {
  const core = useCore();
  const { user } = useAppData();
  const dark = useIsDark();
  const { gutter, control } = useLayout();
  const insets = useSafeAreaInsets();
  const last = BOOK_CODES[book].chapters;
  const after = nextBookAfter(book);
  const { data } = useQuery(async () => {
    const verses = await getChapter(core, book, last, "BSB");
    const final = verses.at(-1);
    const text = final === undefined ? null : ((await getTexts(core, verseOrd(book, last, final.verse)))["BSB"] ?? null);
    return { text, read: await loadChaptersRead(user) };
  }, [book]);
  const upNext = useFirstVerse(after, 1);
  const name = BOOK_CODES[book].name;
  const progress = bookProgress(book, data?.read ?? new Set());
  const nextName = BOOK_CODES[after].name;
  const label = progressLabel(name, progress);
  return (
    <View style={[styles.endRoot, { backgroundColor: dark ? BRAND.forestDark : BRAND.forest, paddingBottom: insets.bottom + 16 }]} testID="end-of-book">
      {onClose === undefined ? null : <StatusBar style="light" />}
      {onClose === undefined ? null : (
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Close, back to ${chapterTitle(book, last)}`}
          style={[styles.endClose, { top: insets.top + 4, width: control, height: control, borderRadius: control / 2 }]}
          testID="end-close"
        >
          <Icon name="close" size={20} tone="paper" />
        </Pressable>
      )}
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: gutter + 12, paddingTop: insets.top + control + 40, paddingBottom: 20 }} bounces={false}>
        <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ marginBottom: 24 }} testID="end-bar">
          <ChapterBar book={book} readKeys={data?.read ?? new Set()} lit={BRAND.chartreuse} unlit="rgba(255,255,255,0.22)" height={6} />
        </View>
        <Chrome accessibilityRole="header" maxFontSizeMultiplier={1.6} style={styles.endTitle}>
          {endTitle(name, progress)}
        </Chrome>
        {progress.complete ? null : (
          <Chrome step="note" style={{ color: "rgba(255,255,255,0.75)", marginTop: 6 }}>
            {label}
          </Chrome>
        )}
        {data?.text != null ? (
          <Scripture style={styles.endQuote} testID="end-quote">
            {`“${data.text}”`}
          </Scripture>
        ) : null}
      </ScrollView>
      <View style={{ paddingHorizontal: gutter }}>
        <NextCard
          quiet
          kicker="Next"
          title={nextName}
          verse={upNext}
          label={`Next, ${nextName}.${upNext === null ? "" : ` ${upNext}`}`}
          onPress={() => onNext(after)}
          testID="end-next"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  number: { fontFamily: "System", fontSize: 12, fontWeight: "600" },
  passage: { fontFamily: "Literata", fontSize: 19, lineHeight: 25, fontWeight: "600", marginBottom: 10 },
  endRoot: { flex: 1 },
  endClose: { position: "absolute", left: 16, zIndex: 2, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
  endTitle: { color: "#FFFFFF", fontFamily: "Literata", fontSize: 42, lineHeight: 48, fontWeight: "600", letterSpacing: -0.6 },
  endQuote: { color: "rgba(255,255,255,0.82)", fontFamily: "LiterataItalic", fontSize: 17, lineHeight: 25, marginTop: 18 },
});
